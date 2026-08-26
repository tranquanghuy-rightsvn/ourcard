/**
 * Cloudflare Worker cho khtcard (Kyu Craft).
 *
 * Truoc day Worker nay chi phuc vu file tinh trong html/. Gio no lam them DUNG MOT viec:
 * lam proxy giua widget chat va Gemini API.
 *
 * Ly do phai co lop server nay (khong goi Gemini thang tu trinh duyet): API key la BI MAT.
 * Bat cu thu gi gui xuong trinh duyet deu doc duoc bang View Source, va co bot quet san
 * JS bundle de tim key. Key nam o Worker secret (`wrangler secret put GEMINI_API_KEY`),
 * khong bao gio nam trong repo hay trong html/.
 *
 * Moi duong dan khac /api/* van duoc phuc vu boi static assets nhu cu (xem wrangler.toml,
 * `run_worker_first` chi bat /api/*), nen html_handling/not_found_handling giu nguyen.
 */
import { SYSTEM_INSTRUCTION } from "./knowledge.generated.js";

// Endpoint cong khai => phai chan lam dung ngay tu kich thuoc payload, truoc khi ton mot
// dong quota Gemini nao.
const MAX_MESSAGE_CHARS = 600;
const MAX_HISTORY_MESSAGES = 12;
const GEMINI_TIMEOUT_MS = 25000;

// Cold start cua Apps Script rat that thuong: do thuc te 2.7s / 2.9s / 8.5s / 11.7s va mot
// lan treo han. Nen thay vi cho that lau MOT lan, cho ngan roi thu lai - lan thu 2 gan nhu
// luon roi vao instance da am (~3s). Toi da ~24s cho ca hai lan, bang mot lan cho cu.
const RELAY_ATTEMPT_TIMEOUT_MS = 12000;
const RELAY_ATTEMPTS = 2;
const MAX_OUTPUT_TOKENS = 400;

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      return handleChat(request, env, url);
    }
    // Moi thu con lai: tra file tinh trong html/ (binding khai o wrangler.toml).
    return env.ASSETS.fetch(request);
  },
};

function json_(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Chi cho phep request phat ra tu chinh trang web nay. Trinh duyet luon gui Origin (voi
 * POST) hoac Referer; curl/script thi khong gui gi ca - nen kiem tra ca hai vua chan duoc
 * goi truc tiep vua khong lam vo widget that.
 */
function isAllowedOrigin_(request, url, env) {
  const allowed = new Set([url.host]);
  for (const extra of String(env.ALLOWED_HOSTS || "").split(",")) {
    const host = extra.trim();
    if (host) allowed.add(host);
  }

  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      return allowed.has(new URL(origin).host);
    } catch (e) {
      return false;
    }
  }
  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return allowed.has(new URL(referer).host);
    } catch (e) {
      return false;
    }
  }
  return false;
}

async function handleChat(request, env, url) {
  if (request.method !== "POST") {
    return json_({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (!isAllowedOrigin_(request, url, env)) {
    return json_({ ok: false, error: "forbidden_origin" }, 403);
  }

  // Can MOT trong hai duong goi Gemini: relay qua GAS (mac dinh, xem callViaRelay_) hoac
  // goi thang bang key cua chinh Worker. Thieu ca hai -> bao ro de client rot ve khoi lien
  // he, KHONG de trang trang.
  if (!env.GEMINI_RELAY_URL && !env.GEMINI_API_KEY) {
    return json_({ ok: false, error: "not_configured" }, 503);
  }

  // Rate limit theo IP. Binding nay la per-colo va "eventually consistent" (theo tai lieu
  // Cloudflare) - du de chan spam, khong dung de tinh tien.
  if (env.CHAT_RATE_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const { success } = await env.CHAT_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return json_({ ok: false, error: "rate_limited" }, 429);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json_({ ok: false, error: "bad_request" }, 400);
  }

  const contents = normalizeMessages_(body && body.messages);
  if (!contents.length) {
    return json_({ ok: false, error: "empty_message" }, 400);
  }

  try {
    const reply = await callGemini_(contents, env);
    if (!reply) {
      return json_({ ok: false, error: "empty_reply" }, 502);
    }
    return json_({ ok: true, reply: reply });
  } catch (err) {
    // Khong tra chi tiet loi ve client (co the lo thong tin upstream); log de xem o
    // `wrangler tail`.
    console.error("gemini call failed:", err && err.message);
    return json_({ ok: false, error: "upstream_error" }, 502);
  }
}

/**
 * Chuyen lich su hoi thoai tu client thanh dinh dang `contents` cua Gemini, dong thoi cat
 * bot: client la thu KHONG tin duoc, no co the gui 10.000 tin nhan dai 1MB de dot quota.
 * Gemini yeu cau contents phai KET THUC bang luot "user".
 */
function normalizeMessages_(messages) {
  if (!Array.isArray(messages)) return [];
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  const contents = [];
  for (const msg of recent) {
    if (!msg || typeof msg.text !== "string") continue;
    const text = msg.text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text) continue;
    contents.push({
      role: msg.role === "model" ? "model" : "user",
      parts: [{ text: text }],
    });
  }
  while (contents.length && contents[contents.length - 1].role !== "user") {
    contents.pop();
  }
  return contents;
}

/**
 * Gemini CHAN theo vi tri dia ly va Worker chay o colo gan khach nhat - khach Viet Nam roi
 * vao colo Hong Kong, vung Google khong cho phep, tra 400 "User location is not supported".
 * GAS thi chay tren ha tang cua chinh Google nen goi duoc. Vi vay mac dinh la nho GAS goi ho.
 *
 * Da thu Smart Placement de Cloudflare tu doi cho chay Worker: 34/34 request van bao
 * `cf-placement: local-HKG` (xem ghi chu trong wrangler.toml) - khong an.
 *
 * Bo GEMINI_RELAY_URL di la Worker tu dong quay lai goi thang Google - dung khi ban bat
 * billing cho Gemini, vi ban tra phi thi khong con bi chan dia ly nua.
 */
function useRelay_(env) {
  return !!env.GEMINI_RELAY_URL;
}

/** fetch co han thoi gian - Gemini/GAS cham hoac treo thi widget phai rot ve khoi lien he
 * chu khong duoc quay mai. */
async function fetchWithTimeout_(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || GEMINI_TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini_(contents, env) {
  const payload = {
    contents: contents,
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };
  if (!useRelay_(env)) return callGeminiDirect_(payload, env);

  let lastError;
  for (let attempt = 1; attempt <= RELAY_ATTEMPTS; attempt++) {
    try {
      return await callViaRelay_(payload, env);
    } catch (err) {
      lastError = err;
      // Loi nghiep vu (token sai, het quota GAS) thi thu lai cung vo ich - chi thu lai voi
      // loi ha tang: treo, dut ket noi, 5xx.
      if (/relay error:/.test(err.message) && !/upstream 5/.test(err.message)) throw err;
      console.error("relay attempt " + attempt + " that bai:", err.message);
    }
  }
  throw lastError;
}

/** Nho GAS goi Gemini ho. GAS chi la ong dan: system prompt, rate limit theo IP, cat bot
 * lich su... deu da lam xong o tren truoc khi goi ham nay. */
async function callViaRelay_(payload, env) {
  const body = JSON.stringify({
    action: "chat",
    // GAS khong doc duoc header tuy chinh trong doPost, nen token phai di trong body.
    token: env.CHAT_RELAY_TOKEN || "",
    model: env.GEMINI_MODEL || DEFAULT_MODEL,
    systemInstruction: payload.systemInstruction.parts[0].text,
    contents: payload.contents,
    generationConfig: payload.generationConfig,
  });

  // GAS /exec KHONG tra ket qua ngay: no chay doPost roi tra 302 sang
  // script.googleusercontent.com/macros/echo, noi giu san ket qua. Tu di 2 chang thay vi de
  // runtime tu follow - de kiem soat duoc timeout tung chang va biet chang nao hong.
  const first = await fetchWithTimeout_(env.GEMINI_RELAY_URL, {
    method: "POST",
    // text/plain de ne CORS preflight ma GAS khong tra loi duoc - giong html/js/lead-form.js.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: body,
    redirect: "manual",
    // GAS tu quyet dinh cache; ep bo qua cache cua Cloudflare cho chac.
    cf: { cacheTtl: 0, cacheEverything: false },
  }, RELAY_ATTEMPT_TIMEOUT_MS);

  let res = first;
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("Location");
    if (!location) throw new Error("relay redirect thieu Location (" + first.status + ")");
    // Chang 2 PHAI la GET: URL echo chi phuc vu GET, POST vao do se bi 405.
    res = await fetchWithTimeout_(location, { method: "GET" }, RELAY_ATTEMPT_TIMEOUT_MS);
  }

  if (!res.ok) throw new Error("relay http " + res.status);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // GAS tra HTML (trang loi/dang nhap) thay vi JSON - thuong la deployment sai quyen
    // truy cap hoac chua tao version moi.
    throw new Error("relay tra ve khong phai JSON: " + text.slice(0, 200));
  }
  if (!data.ok) {
    // GAS kem theo `status` khi loi den tu Gemini - giu lai de `wrangler tail` chi thang
    // duoc nguyen nhan (429 = cham tran tan suat, 400 = payload sai...).
    throw new Error(
      "relay error: " + (data.error || "unknown") + (data.status ? " (upstream " + data.status + ")" : "")
    );
  }
  return String(data.reply || "").trim();
}

/** Goi thang Google. Chi dung duoc khi Worker khong bi chan dia ly - tuc la sau khi ban bat
 * billing cho Gemini (luc do bo GEMINI_RELAY_URL di la tu dong roi vao nhanh nay). */
async function callGeminiDirect_(payload, env) {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(env.GEMINI_API_KEY);

  const res = await fetchWithTimeout_(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("gemini http " + res.status + ": " + (await res.text()).slice(0, 400));
  }

  const data = await res.json();
  // Bi chan boi bo loc an toan -> khong co candidates. Tra rong de client hien khoi lien he.
  if (data.promptFeedback && data.promptFeedback.blockReason) return "";
  const parts =
    data.candidates && data.candidates[0] && data.candidates[0].content
      ? data.candidates[0].content.parts || []
      : [];
  return parts
    .map((x) => (typeof x.text === "string" ? x.text : ""))
    .join("")
    .trim();
}

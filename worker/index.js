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

// KHONG retry qua relay. Da tung cho 12s roi thu lai, nhung do la SAI: khi GAS cham hon 12s
// no VAN DANG CHAY chu khong chet - Worker bo cuoc va gui lai lam Gemini bi hoi 2 lan, nhat
// ky ghi 2 dong va quota bi dot gap doi. Retry chi an toan voi thao tac khong co tac dung
// phu; thao tac nay co. Nen chi goi MOT lan, voi ngan sach rong.
//
// Khong co co che giu am nao: cold start cua Apps Script (12-28s cho tin nhan dau tien sau
// khi site vang khach) duoc chap nhan, doi lay viec khong tieu quota cua tai khoan Google.
const RELAY_TIMEOUT_MS = 25000;
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
  if (provider_(env) !== "workers-ai" && !env.GEMINI_RELAY_URL && !env.GEMINI_API_KEY) {
    return json_({ ok: false, error: "not_configured" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json_({ ok: false, error: "bad_request" }, 400);
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

  const contents = normalizeMessages_(body && body.messages);
  if (!contents.length) {
    return json_({ ok: false, error: "empty_message" }, 400);
  }

  // Chi de gom nhom trong nhat ky CMS - khong dung vao logic nao, va khong tin tuong:
  // cat ngan o day roi de GAS tu cat tiep.
  const meta = {
    conversationId: String((body && body.conversationId) || "").slice(0, 64),
    page: String((body && body.page) || "").slice(0, 300),
  };

  try {
    const reply = await callGemini_(contents, env, meta);
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
/**
 * Chon nha cung cap. Ba duong, doi bang bien CHAT_PROVIDER trong wrangler.toml:
 *
 *   "workers-ai"   (mac dinh) - Workers AI cua chinh Cloudflare. Chay NGAY trong Worker nay,
 *                  khong hop nao them, khong bi chan dia ly, mien phi 10.000 Neuron/ngay.
 *   "gemini-relay" - Gemini goi vong qua Apps Script. Ne duoc chan dia ly nhung DO THUC TE
 *                  3-19 giay: rieng to hop "web app + UrlFetchApp" cua GAS moi cham, con
 *                  UrlFetchApp chay trong editor chi 1.1-1.8s va doPost khong goi
 *                  UrlFetchApp chi ~2s. Giu lai lam duong lui.
 *   "gemini"       - goi thang Google. Chi dung duoc o vung Google cho phep.
 */
function provider_(env) {
  const p = String(env.CHAT_PROVIDER || "").trim();
  if (p) return p;
  return env.GEMINI_RELAY_URL ? "gemini-relay" : "gemini";
}

function useRelay_(env) {
  return provider_(env) === "gemini-relay" && !!env.GEMINI_RELAY_URL;
}

const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

/** Doi tu dinh dang `contents` cua Gemini sang `messages` kieu OpenAI ma Workers AI dung. */
function toMessages_(systemText, contents) {
  const messages = [{ role: "system", content: systemText }];
  contents.forEach((c) => {
    const text = (c.parts || []).map((x) => x.text || "").join("");
    messages.push({ role: c.role === "model" ? "assistant" : "user", content: text });
  });
  return messages;
}

async function callWorkersAI_(payload, env) {
  const model = env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL;
  const res = await env.AI.run(model, {
    messages: toMessages_(payload.systemInstruction.parts[0].text, payload.contents),
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.3,
  });
  return String((res && (res.response !== undefined ? res.response : res.result)) || "").trim();
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

async function callGemini_(contents, env, meta) {
  const payload = {
    contents: contents,
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };
  const which = provider_(env);
  if (which === "workers-ai") return callWorkersAI_(payload, env);
  if (which === "gemini-relay" && env.GEMINI_RELAY_URL) {
    payload.meta = meta || {};
    return callViaRelay_(payload, env);
  }
  return callGeminiDirect_(payload, env);
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
    // Chi de gom nhom trong nhat ky CMS, khong anh huong cau tra loi.
    conversationId: (payload.meta || {}).conversationId || "",
    page: (payload.meta || {}).page || "",
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
  }, RELAY_TIMEOUT_MS);

  let res = first;
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("Location");
    if (!location) throw new Error("relay redirect thieu Location (" + first.status + ")");
    // Chang 2 PHAI la GET: URL echo chi phuc vu GET, POST vao do se bi 405.
    res = await fetchWithTimeout_(location, { method: "GET" }, RELAY_TIMEOUT_MS);
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

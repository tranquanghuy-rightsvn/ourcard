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
const GEMINI_TIMEOUT_MS = 20000;
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

  // Chua cau hinh secret -> bao ro de client rot ve khoi lien he, KHONG de trang trang.
  if (!env.GEMINI_API_KEY) {
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

async function callGemini_(contents, env) {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(env.GEMINI_API_KEY);

  // Gemini cham/treo thi widget phai rot ve khoi lien he chu khong duoc quay mai.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: contents,
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

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
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

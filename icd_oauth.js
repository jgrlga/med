/* 
 * ICD-11 Integration for MedCalcPWA (proxy + CORS-safe)
 * Requiere un Cloudflare Worker que haga proxy a la OMS y obtenga el token (client_credentials).
 * Config en config.json: ICD_PROXY_BASE, ICD_RELEASE, TIMEOUT_MS, RETRY
 */

let ICDCFG = {
  base: "",
  release: "2024-01",
  timeoutMs: 12000,
  retry: { retries: 1, backoff_ms: 400 }
};

export function setICDConfig(cfg) {
  if (cfg?.ICD_PROXY_BASE) ICDCFG.base = cfg.ICD_PROXY_BASE.replace(/\/+$/, "");
  if (cfg?.ICD_RELEASE) ICDCFG.release = cfg.ICD_RELEASE;
  if (cfg?.TIMEOUT_MS) ICDCFG.timeoutMs = cfg.TIMEOUT_MS;
  if (cfg?.RETRY) ICDCFG.retry = cfg.RETRY;
}

function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

async function fetchJSON(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ICDCFG.timeoutMs);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    if (!resp.ok) {
      const txt = await resp.text();
      const err = new Error(`HTTP ${resp.status} ${resp.statusText} - ${txt.slice(0, 200)}`);
      err.status = resp.status;
      throw err;
    }
    const ct = resp.headers.get("Content-Type") || "";
    if (ct.includes("application/json")) return await resp.json();
    // fallback
    const t = await resp.text();
    try { return JSON.parse(t); } catch { return t; }
  } finally {
    clearTimeout(id);
  }
}

async function withRetry(fn) {
  const {retries, backoff_ms} = ICDCFG.retry || {retries:0, backoff_ms:0};
  let lastErr;
  for (let i=0; i<=retries; i++) {
    try { return await fn(); } 
    catch (e) {
      lastErr = e;
      // retry sólo en 429/5xx o abort
      if (e.name === "AbortError" || (e.status && (e.status === 429 || e.status >= 500))) {
        if (i < retries) await delay(backoff_ms * (i+1));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/** Busca términos en ICD-11 */
export async function searchICD11(query, {linearization="mms", chapterFilter=null, lang="es"} = {}) {
  if (!ICDCFG.base) throw new Error("ICD Proxy BASE no configurado");
  const params = new URLSearchParams();
  params.set("q", query);
  if (linearization) params.set("linearization", linearization);
  if (chapterFilter) params.set("chapterFilter", chapterFilter);
  if (lang) params.set("lang", lang);
  const url = `${ICDCFG.base}/icd/search?${params.toString()}`;
  return withRetry(() => fetchJSON(url));
}

/** Obtiene un recurso por su URI pública de ICD-11 (vía proxy) */
export async function getICD11EntityByUri(uri, {lang="es"} = {}) {
  if (!ICDCFG.base) throw new Error("ICD Proxy BASE no configurado");
  const params = new URLSearchParams();
  if (lang) params.set("lang", lang);
  params.set("uri", uri);
  // El Worker puede mapear /icd/entity?uri=... -> https://id.who.int/icd/entity/...
  const url = `${ICDCFG.base}/icd/entity?${params.toString()}`;
  return withRetry(() => fetchJSON(url));
}

/** Helper para inicializar desde config.json */
export async function initICDFromConfig(url = "./config.json") {
  const cfg = await fetchJSON(url);
  setICDConfig(cfg);
  return cfg;
}

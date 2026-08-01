/**
 * WeSell UTM / atribuição (origem, canal, campanha)
 *
 * Uso em qualquer página:
 *
 *   <script src="https://links.wesellsoftware.com.br/wesell-utm.js"></script>
 *   <script>
 *     WeSellUtm.init({
 *       // opcional: sobrescreve campanha nesta página
 *       // campanha: "pagina_vendas_crm",
 *       // propaga para links internos WeSell
 *       linkSelector: 'a[href]',
 *       domains: ["wesellsoftware.com.br"],
 *       // preenche inputs hidden name="origem|canal|campanha"
 *       fillForms: true,
 *     });
 *   </script>
 *
 * Em links específicos:
 *   <a href="https://form.wesellsoftware.com.br" data-campanha="pagina_vendas_crm">
 *
 * Valores CRM (chaves):
 *   origem:   prospeccao_ativa | organico | indicacao | trafego_pago
 *   canal:    evento | site | parceiro | cliente | instagram | pagina_venda
 *   campanha: diagnostico | link_bio_instagram | form_solutions |
 *             pagina_vendas_crm | link_bio_tiktok
 *
 * API:
 *   WeSellUtm.get()
 *   WeSellUtm.set({ origem, canal, campanha })
 *   WeSellUtm.appendToUrl(url, overrides?)
 *   WeSellUtm.applyToLinks(selector?, domains?)
 *   WeSellUtm.fillForms(root?)
 *   WeSellUtm.toQueryString(overrides?)
 */
(() => {
  const KEYS = ["origem", "canal", "campanha"];
  const STORAGE_KEY = "wesell_utm";
  const COOKIE_NAME = "wesell_utm";
  const COOKIE_DAYS = 30;
  const PARENT_DOMAIN = "wesellsoftware.com.br";

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = {};
    for (const key of KEYS) {
      const value = (params.get(key) || "").trim();
      if (value) fromQuery[key] = value;
    }
    return fromQuery;
  }

  function readStorage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return sanitize(parsed);
    } catch {
      return {};
    }
  }

  function readCookie() {
    try {
      const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${COOKIE_NAME}=`));
      if (!match) return {};
      const value = decodeURIComponent(match.split("=").slice(1).join("="));
      return sanitize(JSON.parse(value));
    } catch {
      return {};
    }
  }

  function sanitize(input) {
    if (!input || typeof input !== "object") return {};
    const out = {};
    for (const key of KEYS) {
      const value = String(input[key] || "").trim();
      if (value) out[key] = value;
    }
    return out;
  }

  function cookieDomain() {
    const host = window.location.hostname;
    if (host === PARENT_DOMAIN || host.endsWith(`.${PARENT_DOMAIN}`)) {
      return `.${PARENT_DOMAIN}`;
    }
    return "";
  }

  function writeStorage(data) {
    const clean = sanitize(data);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      /* ignore */
    }

    try {
      const encoded = encodeURIComponent(JSON.stringify(clean));
      const maxAge = COOKIE_DAYS * 24 * 60 * 60;
      const domain = cookieDomain();
      let cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
      if (domain) cookie += `; domain=${domain}`;
      if (window.location.protocol === "https:") cookie += "; Secure";
      document.cookie = cookie;
    } catch {
      /* ignore */
    }

    return clean;
  }

  function mergeTracking(base, overlay) {
    return sanitize({ ...base, ...overlay });
  }

  let state = {};

  function captureFromEnvironment(overrides = {}) {
    const fromUrl = readQuery();
    const fromCookie = readCookie();
    const fromSession = readStorage();
    state = mergeTracking(
      mergeTracking(mergeTracking(fromCookie, fromSession), fromUrl),
      overrides
    );
    return writeStorage(state);
  }

  function get() {
    return { ...state };
  }

  function set(partial) {
    state = mergeTracking(state, partial);
    return writeStorage(state);
  }

  function toQueryString(overrides = {}) {
    const data = mergeTracking(state, overrides);
    const params = new URLSearchParams();
    for (const key of KEYS) {
      if (data[key]) params.set(key, data[key]);
    }
    return params.toString();
  }

  function appendToUrl(url, overrides = {}) {
    const data = mergeTracking(state, overrides);
    if (!KEYS.some((key) => data[key])) return String(url);

    let parsed;
    try {
      parsed = new URL(url, window.location.href);
    } catch {
      return String(url);
    }

    // wa.me / api.whatsapp.com: UTMs na query não ajudam o CRM; anexa no texto
    if (
      parsed.hostname === "wa.me" ||
      parsed.hostname === "api.whatsapp.com"
    ) {
      return appendToWhatsApp(parsed, data);
    }

    for (const key of KEYS) {
      if (data[key]) parsed.searchParams.set(key, data[key]);
    }
    return parsed.toString();
  }

  function appendToWhatsApp(parsed, data) {
    const bits = KEYS.filter((key) => data[key]).map(
      (key) => `${key}:${data[key]}`
    );
    if (!bits.length) return parsed.toString();

    const marker = bits.join(" | ");
    const current = parsed.searchParams.get("text") || "";
    if (current.includes("origem:") || current.includes("canal:")) {
      return parsed.toString();
    }
    const next = current
      ? `${current}\n\n[${marker}]`
      : `[${marker}]`;
    parsed.searchParams.set("text", next);
    return parsed.toString();
  }

  function hostMatches(hostname, domains) {
    return domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  }

  function shouldTrackLink(anchor, domains) {
    if (anchor.hasAttribute("data-utm-ignore")) return false;
    if (anchor.hasAttribute("data-campanha") || anchor.hasAttribute("data-utm-link")) {
      return true;
    }
    if (!domains.length) return false;

    try {
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return false;
      }
      const parsed = new URL(anchor.href, window.location.href);
      return hostMatches(parsed.hostname, domains);
    } catch {
      return false;
    }
  }

  function overridesFromElement(element) {
    const overrides = {};
    for (const key of KEYS) {
      const value = (element.getAttribute(`data-${key}`) || "").trim();
      if (value) overrides[key] = value;
    }
    return overrides;
  }

  function applyToLinks(
    selector = "a[href][data-campanha], a[href][data-utm-link], a[href]",
    domains = [PARENT_DOMAIN]
  ) {
    document.querySelectorAll(selector).forEach((anchor) => {
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!shouldTrackLink(anchor, domains)) return;

      const original = anchor.getAttribute("href");
      if (!original) return;

      const overrides = overridesFromElement(anchor);
      anchor.href = appendToUrl(original, overrides);

      // Clique: reaplica (caso o href tenha sido alterado depois do init)
      if (!anchor.dataset.utmBound) {
        anchor.dataset.utmBound = "1";
        anchor.addEventListener("click", () => {
          const base = anchor.getAttribute("data-utm-href") || original;
          anchor.href = appendToUrl(base, overridesFromElement(anchor));
        });
        anchor.setAttribute("data-utm-href", original);
      }
    });
  }

  function fillForms(root = document) {
    const data = get();
    KEYS.forEach((key) => {
      if (!data[key]) return;
      root.querySelectorAll(`[name="${key}"]`).forEach((el) => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.value = data[key];
        }
      });
    });
  }

  function init(options = {}) {
    const {
      origem,
      canal,
      campanha,
      linkSelector = 'a[href][data-campanha], a[href][data-utm-link]',
      domains = [PARENT_DOMAIN],
      fillForms: shouldFillForms = true,
      autoApplyLinks = true,
    } = options;

    captureFromEnvironment({ origem, canal, campanha });

    if (autoApplyLinks) {
      applyToLinks(linkSelector, domains);
    }

    if (shouldFillForms) {
      fillForms();
    }

    return get();
  }

  window.WeSellUtm = {
    KEYS,
    init,
    get,
    set,
    capture: captureFromEnvironment,
    appendToUrl,
    applyToLinks,
    fillForms,
    toQueryString,
  };
})();

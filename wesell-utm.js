/**
 * WeSell UTM / atribuição (origem, canal, campanha + jornada)
 *
 * Aceita na URL de entrada:
 *   origem / canal / campanha
 *   ou aliases: utm_source / utm_channel|utm_medium / utm_campaign
 *
 * Ao clicar em banners, propaga os params e empilha a jornada
 * (todos os pontos pelos quais o lead passou).
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
  const KEYS = ["origem", "canal", "campanha", "jornada"];
  const CRM_KEYS = ["origem", "canal", "campanha"];
  const STORAGE_KEY = "wesell_utm";
  const COOKIE_NAME = "wesell_utm";
  const COOKIE_DAYS = 30;
  const PARENT_DOMAIN = "wesellsoftware.com.br";

  const QUERY_ALIASES = {
    origem: ["origem", "utm_source"],
    canal: ["canal", "utm_channel", "utm_medium"],
    campanha: ["campanha", "utm_campaign"],
    jornada: ["jornada", "utm_content"],
  };

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = {};

    for (const key of KEYS) {
      const aliases = QUERY_ALIASES[key] || [key];
      for (const alias of aliases) {
        const value = (params.get(alias) || "").trim();
        if (value) {
          fromQuery[key] = value;
          break;
        }
      }
    }

    return fromQuery;
  }

  function readStorage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return sanitize(JSON.parse(raw));
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

  function uniquePush(parts, value) {
    if (!value) return parts;
    if (parts[parts.length - 1] === value) return parts;
    parts.push(value);
    return parts;
  }

  function buildJornada(base, nextCampanha) {
    const parts = base.jornada
      ? base.jornada.split("|").map((part) => part.trim()).filter(Boolean)
      : [];

    if (!parts.length) {
      uniquePush(parts, base.origem);
      uniquePush(parts, base.canal);
      uniquePush(parts, base.campanha);
    }

    uniquePush(parts, nextCampanha);
    return parts.join("|");
  }

  function stackCampaignHistory(base, nextCampanha) {
    const parts = [];
    if (base.campanha) {
      base.campanha.split("|").forEach((part) => uniquePush(parts, part.trim()));
    }
    uniquePush(parts, nextCampanha);
    return parts.join("|");
  }

  /**
   * Aplica override de banner sem perder a origem (utm_source) da links page.
   * Empilha campanha/jornada para reconstruir o caminho do lead.
   */
  function applyBannerOverrides(base, overlay = {}) {
    const next = { ...base };

    if (overlay.origem) next.origem = overlay.origem;
    if (overlay.canal) next.canal = overlay.canal;

    if (overlay.campanha) {
      next.jornada = buildJornada(base, overlay.campanha);
      next.campanha = stackCampaignHistory(base, overlay.campanha);
    } else if (overlay.jornada) {
      next.jornada = overlay.jornada;
    }

    if (!next.jornada) {
      next.jornada = [next.origem, next.canal, next.campanha]
        .filter(Boolean)
        .join("|");
    }

    return sanitize(next);
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

    if (!state.jornada && (state.origem || state.canal || state.campanha)) {
      state.jornada = [state.origem, state.canal, state.campanha]
        .filter(Boolean)
        .join("|");
    }

    return writeStorage(state);
  }

  function get() {
    return { ...state };
  }

  function set(partial) {
    state = applyBannerOverrides(state, sanitize(partial));
    return writeStorage(state);
  }

  function latestCampaign(campanha) {
    if (!campanha) return "";
    const parts = campanha.split("|").map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  function toQueryString(overrides = {}) {
    const data = applyBannerOverrides(state, sanitize(overrides));
    const params = new URLSearchParams();
    writeParams(params, data);
    return params.toString();
  }

  function writeParams(params, data) {
    const origem = data.origem || "";
    const canal = data.canal || "";
    const campanhaStack = data.campanha || "";
    const campanhaAtual = latestCampaign(campanhaStack);
    const jornada = data.jornada || "";

    // CRM / padrão WeSell — campanha atual (último passo)
    if (origem) params.set("origem", origem);
    if (canal) params.set("canal", canal);
    if (campanhaAtual) params.set("campanha", campanhaAtual);
    if (jornada) params.set("jornada", jornada);

    // Aliases UTM — source herdado; campaign empilhado; channel herdado
    if (origem) params.set("utm_source", origem);
    if (canal) params.set("utm_channel", canal);
    if (campanhaStack) params.set("utm_campaign", campanhaStack);
    if (jornada) params.set("utm_content", jornada);
  }

  function appendToUrl(url, overrides = {}) {
    const data = applyBannerOverrides(state, sanitize(overrides));
    if (!CRM_KEYS.some((key) => data[key]) && !data.jornada) return String(url);

    let parsed;
    try {
      parsed = new URL(url, window.location.href);
    } catch {
      return String(url);
    }

    if (
      parsed.hostname === "wa.me" ||
      parsed.hostname === "api.whatsapp.com"
    ) {
      return appendToWhatsApp(parsed, data);
    }

    writeParams(parsed.searchParams, data);
    return parsed.toString();
  }

  function appendToWhatsApp(parsed, data) {
    const origem = data.origem || "";
    const canal = data.canal || "";
    const campanha = data.campanha || "";
    const jornada = data.jornada || "";

    const bits = [
      origem && `utm_source:${origem}`,
      canal && `utm_channel:${canal}`,
      campanha && `utm_campaign:${campanha}`,
      jornada && `jornada:${jornada}`,
    ].filter(Boolean);

    if (!bits.length) return parsed.toString();

    const marker = bits.join(" | ");
    const current = parsed.searchParams.get("text") || "";
    if (
      current.includes("utm_source:") ||
      current.includes("origem:") ||
      current.includes("jornada:")
    ) {
      return parsed.toString();
    }

    const next = current ? `${current}\n\n[${marker}]` : `[${marker}]`;
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
    for (const key of CRM_KEYS) {
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

      if (!anchor.dataset.utmBound) {
        anchor.dataset.utmBound = "1";
        anchor.setAttribute("data-utm-href", original);
        anchor.addEventListener("click", () => {
          const clickOverrides = overridesFromElement(anchor);
          // Persiste o empilhamento antes de sair da página
          if (clickOverrides.campanha) {
            set({ campanha: clickOverrides.campanha });
          }
          const base = anchor.getAttribute("data-utm-href") || original;
          anchor.href = appendToUrl(base, clickOverrides);
        });
      }
    });
  }

  function fillForms(root = document) {
    const data = get();
    const latest = latestCampaign(data.campanha);
    const values = {
      ...data,
      campanha: latest,
      utm_source: data.origem || "",
      utm_channel: data.canal || "",
      utm_campaign: data.campanha || "",
      utm_content: data.jornada || "",
    };

    Object.entries(values).forEach(([key, value]) => {
      if (!value) return;
      root.querySelectorAll(`[name="${key}"]`).forEach((el) => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.value = value;
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

/**
 * WeSell UTM / atribuição (origem, canal, campanha + jornada)
 *
 * Aceita na URL de entrada:
 *   origem / canal / campanha
 *   ou aliases: utm_source / utm_channel|utm_medium / utm_campaign
 *
 * Ao clicar em um banner, empilha APENAS:
 *   campanha_entrada | campanha_do_banner
 * Ex.: link_bio_instagram|wesell-CRM
 *
 * Não acumula cliques anteriores (diagnóstico, solutions, etc.).
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
  const KEYS = ["origem", "canal", "campanha", "campanha_entrada", "jornada"];
  const CRM_KEYS = ["origem", "canal", "campanha"];
  const STORAGE_KEY = "wesell_utm";
  const COOKIE_NAME = "wesell_utm";
  const COOKIE_DAYS = 30;
  const PARENT_DOMAIN = "wesellsoftware.com.br";

  /** Valores oficiais do CRM (campo Origem). */
  const ORIGEM_VALUES = new Set([
    "prospeccao_ativa",
    "organico",
    "indicacao",
    "trafego_pago",
  ]);

  /** Valores oficiais do CRM (campo Canal). */
  const CANAL_VALUES = new Set([
    "evento",
    "site",
    "parceiro",
    "cliente",
    "instagram",
    "pagina_venda",
  ]);

  /** Aliases → chave CRM de origem. */
  const ORIGEM_ALIASES = {
    organico: "organico",
    organic: "organico",
    orgânico: "organico",
    indicacao: "indicacao",
    indicação: "indicacao",
    referral: "indicacao",
    trafego_pago: "trafego_pago",
    "tráfego_pago": "trafego_pago",
    paid: "trafego_pago",
    cpc: "trafego_pago",
    ppc: "trafego_pago",
    ads: "trafego_pago",
    paid_social: "trafego_pago",
    prospeccao_ativa: "prospeccao_ativa",
    "prospecção_ativa": "prospeccao_ativa",
  };

  /**
   * Aliases → chave CRM de canal.
   * Obs.: `ig` / `instagram` são CANAL, nunca origem.
   */
  const CANAL_ALIASES = {
    evento: "evento",
    site: "site",
    website: "site",
    web: "site",
    parceiro: "parceiro",
    partner: "parceiro",
    cliente: "cliente",
    client: "cliente",
    instagram: "instagram",
    ig: "instagram",
    pagina_venda: "pagina_venda",
    pagina_vendas: "pagina_venda",
    "páginas_de_venda": "pagina_venda",
  };

  function normalizeOrigem(value) {
    const key = String(value || "")
      .trim()
      .toLowerCase();
    if (!key) return "";
    if (ORIGEM_VALUES.has(key)) return key;
    return ORIGEM_ALIASES[key] || "";
  }

  function normalizeCanal(value) {
    const key = String(value || "")
      .trim()
      .toLowerCase();
    if (!key) return "";
    if (CANAL_VALUES.has(key)) return key;
    return CANAL_ALIASES[key] || "";
  }

  /**
   * Lê origem/canal só com chaves do CRM.
   * - Prefere `origem` / `canal` explícitos
   * - `utm_source=ig` → canal=instagram (não origem)
   * - `utm_medium=social` sozinho não é canal válido
   */
  function readOrigemCanal(params) {
    let origem = normalizeOrigem(params.get("origem"));
    let canal = normalizeCanal(
      params.get("canal") || params.get("utm_channel")
    );

    const utmSource = (params.get("utm_source") || "").trim().toLowerCase();
    const utmMedium = (params.get("utm_medium") || "").trim().toLowerCase();

    if (!origem) {
      origem = normalizeOrigem(utmSource);
    }

    if (!canal) {
      canal = normalizeCanal(utmMedium) || normalizeCanal(utmSource);
    }

    // Padrão Meta bio: utm_source=ig&utm_medium=social
    if (!canal && (utmSource === "ig" || utmSource === "instagram")) {
      canal = "instagram";
    }

    return { origem, canal };
  }

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = {};
    const { origem, canal } = readOrigemCanal(params);

    if (origem) fromQuery.origem = origem;
    if (canal) fromQuery.canal = canal;

    for (const key of ["campanha", "campanha_entrada", "jornada"]) {
      const aliases =
        key === "campanha"
          ? ["campanha", "utm_campaign"]
          : key === "jornada"
            ? ["jornada", "utm_content"]
            : ["campanha_entrada"];
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
      let value = String(input[key] || "").trim();
      if (!value) continue;

      if (key === "origem") {
        value = normalizeOrigem(value);
      } else if (key === "canal") {
        value = normalizeCanal(value);
      }

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

  function firstCampaign(campanha) {
    if (!campanha) return "";
    return (
      campanha
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)[0] || ""
    );
  }

  function latestCampaign(campanha) {
    if (!campanha) return "";
    const parts = campanha
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  /** Empilha só entrada + banner atual (não acumula cliques anteriores). */
  function stackEntryAndBanner(entrada, banner) {
    const parts = [];
    uniquePush(parts, entrada);
    uniquePush(parts, banner);
    return parts.join("|");
  }

  function buildJornada(origem, canal, entrada, banner) {
    const parts = [];
    uniquePush(parts, origem);
    uniquePush(parts, canal);
    uniquePush(parts, entrada);
    uniquePush(parts, banner);
    return parts.join("|");
  }

  function resolveEntrada(base) {
    return (
      base.campanha_entrada ||
      firstCampaign(base.campanha) ||
      ""
    );
  }

  /**
   * Aplica override de banner sem perder origem/canal.
   * campanha = campanha_entrada|banner (sem cliques intermediários).
   */
  function applyBannerOverrides(base, overlay = {}) {
    const next = { ...base };

    if (overlay.origem) next.origem = overlay.origem;
    if (overlay.canal) next.canal = overlay.canal;

    const entrada = resolveEntrada(base);
    if (entrada) next.campanha_entrada = entrada;

    if (overlay.campanha) {
      next.campanha = stackEntryAndBanner(entrada, overlay.campanha);
      next.jornada = buildJornada(
        next.origem,
        next.canal,
        entrada,
        overlay.campanha
      );
    } else if (overlay.jornada) {
      next.jornada = overlay.jornada;
    }

    if (!next.jornada) {
      next.jornada = buildJornada(
        next.origem,
        next.canal,
        next.campanha_entrada || firstCampaign(next.campanha),
        ""
      );
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

    // URL de entrada define a campanha de origem e limpa stacks antigos do cookie
    if (fromUrl.campanha) {
      state.campanha_entrada = firstCampaign(fromUrl.campanha);
      state.campanha = state.campanha_entrada;
      state.jornada = buildJornada(
        state.origem,
        state.canal,
        state.campanha_entrada,
        ""
      );
    } else if (!state.campanha_entrada && state.campanha) {
      state.campanha_entrada = firstCampaign(state.campanha);
    }

    if (!state.jornada && (state.origem || state.canal || state.campanha)) {
      state.jornada = buildJornada(
        state.origem,
        state.canal,
        state.campanha_entrada || firstCampaign(state.campanha),
        ""
      );
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

    if (origem) params.set("origem", origem);
    if (canal) params.set("canal", canal);
    if (campanhaAtual) params.set("campanha", campanhaAtual);
    if (data.campanha_entrada) {
      params.set("campanha_entrada", data.campanha_entrada);
    }
    if (jornada) params.set("jornada", jornada);

    // Trilha do lead: entrada|banner (ex.: link_bio_instagram|wesell-CRM)
    if (campanhaStack) params.set("utm_campaign", campanhaStack);
    if (campanhaStack) params.set("campanha_lead", campanhaStack);
    if (jornada) params.set("utm_content", jornada);

    if (origem && !params.get("utm_source")) params.set("utm_source", origem);
    if (canal && !params.get("utm_channel")) params.set("utm_channel", canal);
  }

  function syncOrigemCanalFromUrl() {
    const live = readQuery();
    let changed = false;

    if (live.origem && live.origem !== state.origem) {
      state.origem = live.origem;
      changed = true;
    }
    if (live.canal && live.canal !== state.canal) {
      state.canal = live.canal;
      changed = true;
    }
    if (live.campanha) {
      const entrada = firstCampaign(live.campanha);
      if (entrada && entrada !== state.campanha_entrada) {
        state.campanha_entrada = entrada;
        changed = true;
      }
      if (!state.campanha_entrada) {
        state.campanha_entrada = entrada;
        changed = true;
      }
    }
    if (!state.campanha && state.campanha_entrada) {
      state.campanha = state.campanha_entrada;
      changed = true;
    }
    if (!state.jornada && (state.origem || state.canal || state.campanha_entrada)) {
      state.jornada = buildJornada(
        state.origem,
        state.canal,
        state.campanha_entrada,
        ""
      );
      changed = true;
    }

    if (changed) writeStorage(state);
    return state;
  }

  function passThroughEntryParams(parsed) {
    const current = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_content", "fbclid"].forEach((key) => {
      const value = (current.get(key) || "").trim();
      if (value) parsed.searchParams.set(key, value);
    });
  }

  function ensureFromLiveUrl(data) {
    const live = new URLSearchParams(window.location.search);
    const next = { ...data };
    const resolved = readOrigemCanal(live);

    if (!next.origem && resolved.origem) next.origem = resolved.origem;
    if (!next.canal && resolved.canal) next.canal = resolved.canal;

    if (!next.campanha_entrada) {
      const fromLive =
        (live.get("campanha") || live.get("utm_campaign") || "").trim();
      if (fromLive) next.campanha_entrada = firstCampaign(fromLive);
    }
    if (!next.campanha && next.campanha_entrada) {
      next.campanha = next.campanha_entrada;
    }

    return sanitize(next);
  }

  function appendToUrl(url, overrides = {}) {
    syncOrigemCanalFromUrl();

    let parsed;
    try {
      parsed = new URL(url, window.location.href);
    } catch {
      return String(url);
    }

    let data = ensureFromLiveUrl(
      applyBannerOverrides(state, sanitize(overrides))
    );

    if (!CRM_KEYS.some((key) => data[key]) && !data.jornada) {
      return String(url);
    }

    if (
      parsed.hostname === "wa.me" ||
      parsed.hostname === "api.whatsapp.com"
    ) {
      return appendToWhatsApp(parsed, data);
    }

    passThroughEntryParams(parsed);
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
        anchor.addEventListener("click", (event) => {
          const clickOverrides = overridesFromElement(anchor);
          syncOrigemCanalFromUrl();
          if (clickOverrides.campanha) {
            set({ campanha: clickOverrides.campanha });
          }
          const base = anchor.getAttribute("data-utm-href") || original;
          const nextHref = appendToUrl(base, clickOverrides);
          anchor.href = nextHref;

          if (
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            event.preventDefault();
            if (anchor.target === "_blank") {
              window.open(nextHref, "_blank", "noopener,noreferrer");
            } else {
              window.location.assign(nextHref);
            }
          }
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
      campanha_lead: data.campanha || "",
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
    ORIGEM_VALUES: [...ORIGEM_VALUES],
    CANAL_VALUES: [...CANAL_VALUES],
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

(() => {
  const WEBHOOK_URL =
    "https://n8n.wesellsoftware.com.br/webhook/960cf264-7532-4c13-9c0d-584eb2eb15d7";
  const WAITLIST_WEBHOOK_URL =
    "https://webhook.sellflux.app/flux/sellflux/8369bbb4fae0647587dacbd568c4bcf0";
  const BANNER_COLUMNS = ["Education", "CRM", "Solutions", "Diagnostico"];
  const TIMEZONE = "America/Sao_Paulo";

  const modal = document.getElementById("waitlist-modal");
  const trigger = document.getElementById("waitlist-trigger");
  const form = document.getElementById("waitlist-form");
  const phoneInput = document.getElementById("waitlist-phone");
  const errorEl = document.getElementById("waitlist-error");
  const formView = document.getElementById("waitlist-form-view");
  const successView = document.getElementById("waitlist-success-view");

  if (!modal || !trigger || !form || !phoneInput) return;

  let lastFocus = null;

  function formatDateSaoPaulo(date = new Date()) {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
  }

  function getUtmParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
    };
  }

  function getDeviceType() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? "mobile"
      : "desktop";
  }

  function buildContextPayload() {
    const now = new Date();
    return {
      Data: formatDateSaoPaulo(now),
      timestamp_iso: now.toISOString(),
      timezone: TIMEZONE,
      page_url: window.location.href,
      referrer: document.referrer || "",
      ...getUtmParams(),
      device: getDeviceType(),
      user_agent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language || "",
    };
  }

  function buildBannerColumns(banner) {
    return Object.fromEntries(
      BANNER_COLUMNS.map((column) => [column, column === banner ? "1" : ""])
    );
  }

  function sendWebhook(url, payload) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((error) => {
      console.error("webhook-error", error);
    });
  }

  function trackBannerClick(banner) {
    if (!BANNER_COLUMNS.includes(banner)) return;

    sendWebhook(WEBHOOK_URL, {
      event: "banner_click",
      banner,
      ...buildBannerColumns(banner),
      ...buildContextPayload(),
    });
  }

  function toE164Phone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return `+${digits}`;
    return `+55${digits}`;
  }

  function trackWaitlistSubmit({ name, email, phone }) {
    sendWebhook(WAITLIST_WEBHOOK_URL, {
      name,
      email,
      phone: toE164Phone(phone),
      tags: [],
      remove_tags: [],
    });
  }

  function openModal() {
    lastFocus = document.activeElement;
    formView.hidden = false;
    successView.hidden = true;
    errorEl.hidden = true;
    errorEl.textContent = "";
    form.reset();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    const firstInput = form.querySelector("input");
    firstInput?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    lastFocus?.focus();
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 2) return digits.replace(/^(\d{0,2})/, "($1");
    if (digits.length <= 7) {
      return digits.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    }
    return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  document.querySelectorAll(".banner-link[data-banner]").forEach((element) => {
    element.addEventListener("click", () => {
      trackBannerClick(element.dataset.banner);
    });
  });

  trigger.addEventListener("click", openModal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhone(phoneInput.value);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (!name) {
      showError("Informe seu nome.");
      form.elements.namedItem("name")?.focus();
      return;
    }

    if (!isValidEmail(email)) {
      showError("Informe um e-mail válido.");
      form.elements.namedItem("email")?.focus();
      return;
    }

    if (phoneDigits.length < 10) {
      showError("Informe um telefone válido com DDD.");
      phoneInput.focus();
      return;
    }

    errorEl.hidden = true;
    formView.hidden = true;
    successView.hidden = false;
    successView.querySelector("button")?.focus();

    trackWaitlistSubmit({ name, email, phone });
  });
})();

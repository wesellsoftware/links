(() => {
  const modal = document.getElementById("waitlist-modal");
  const trigger = document.getElementById("waitlist-trigger");
  const form = document.getElementById("waitlist-form");
  const phoneInput = document.getElementById("waitlist-phone");
  const errorEl = document.getElementById("waitlist-error");
  const formView = document.getElementById("waitlist-form-view");
  const successView = document.getElementById("waitlist-success-view");

  if (!modal || !trigger || !form || !phoneInput) return;

  let lastFocus = null;

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

    // Pronto para integrar com API/CRM quando houver endpoint.
    console.info("waitlist-lead", { name, email, phone });
  });
})();

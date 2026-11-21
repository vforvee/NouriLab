(() => {
  const storageKey = "nourilab_theme";
  const toggle = document.querySelector("#themeToggle");
  const preferredTheme = () => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  function applyTheme(theme, persist = false) {
    const dark = theme === "dark";
    document.body.dataset.theme = dark ? "dark" : "light";
    if (persist) localStorage.setItem(storageKey, dark ? "dark" : "light");
    if (toggle) {
      toggle.textContent = dark ? "☀" : "☾";
      toggle.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
      toggle.setAttribute("title", `Switch to ${dark ? "light" : "dark"} mode`);
      toggle.setAttribute("aria-pressed", String(dark));
    }
  }

  applyTheme(localStorage.getItem(storageKey) || preferredTheme());
  if (toggle) {
    toggle.addEventListener("click", () => {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark", true);
    });
  }
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) applyTheme(event.newValue || preferredTheme());
  });
})();

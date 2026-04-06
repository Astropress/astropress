function preferredTheme(): "dark" | "light" {
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {}

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);

  const toggles = document.querySelectorAll<HTMLButtonElement>(".theme-toggle-admin");
  for (const toggle of toggles) {
    const darkLabel = toggle.getAttribute("data-theme-label-dark") || "Switch to dark mode";
    const lightLabel = toggle.getAttribute("data-theme-label-light") || "Switch to light mode";
    const icon = toggle.querySelector<HTMLElement>(".theme-toggle-icon");
    const isDark = theme === "dark";

    toggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    toggle.setAttribute("aria-label", isDark ? lightLabel : darkLabel);
    toggle.setAttribute("title", isDark ? lightLabel : darkLabel);

    if (icon) {
      icon.textContent = isDark ? "☀" : "☾";
    }
  }
}

const initialTheme = preferredTheme();
applyTheme(initialTheme);

window.addEventListener("DOMContentLoaded", () => {
  applyTheme(preferredTheme());

  document.querySelectorAll<HTMLButtonElement>(".theme-toggle-admin").forEach((toggle) => {
    if (toggle.dataset.themeBound === "true") {
      return;
    }

    toggle.dataset.themeBound = "true";
    toggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      try {
        window.localStorage.setItem("theme", nextTheme);
      } catch {}
    });
  });
});

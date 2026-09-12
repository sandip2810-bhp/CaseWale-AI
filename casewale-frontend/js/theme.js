// Applies the saved theme (light/dark) before the page paints, to avoid
// a flash of the wrong theme. Include this as early as possible in
// <head>, before any stylesheet that depends on the CSS variables it
// controls (see css/style.css).
(function () {
    var saved = localStorage.getItem("cw_theme");
    var theme = saved === "light" ? "light" : "dark";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
})();

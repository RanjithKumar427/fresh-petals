(function () {
  document.documentElement.classList.add("js");
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("motion");
  }
})();

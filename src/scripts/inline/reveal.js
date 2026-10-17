(function () {
  var root = document.documentElement;
  var els = [].slice.call(document.querySelectorAll("[data-reveal]"));
  if (!root.classList.contains("motion") || !("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -4% 0px", threshold: 0 }
  );
  els.forEach(function (el) { io.observe(el); });
})();

(function () {
  var path = function (value) {
    return (value || "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  };

  if (measurementId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    // No advertising features; the page URL is sent without its query string.
    window.gtag("config", measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + location.pathname,
      // The referring site only. Google's tag would otherwise send the whole
      // referring URL, which can carry another site's path and query.
      page_referrer: (function () {
        try {
          return document.referrer ? new URL(document.referrer).origin + "/" : "";
        } catch (e) {
          return "";
        }
      })(),
    });
  }

  // Known assistant hostnames only. Anything else is left unlabelled.
  var AI_HOSTS = { "chatgpt.com": "chatgpt", "chat.openai.com": "chatgpt", "perplexity.ai": "perplexity", "www.perplexity.ai": "perplexity", "copilot.microsoft.com": "copilot", "gemini.google.com": "gemini", "claude.ai": "claude", "search.chatgpt.com": "chatgpt", "meta.ai": "meta-ai", "www.meta.ai": "meta-ai" };
  var AI_LABELS = {};
  for (var host in AI_HOSTS) AI_LABELS[AI_HOSTS[host]] = true;
  var METHODS = { referrer: true, campaign: true };

  // Application context (docs/seo/measurement.md): the visit's landing path
  // and assistant label, with the time of the last activity, in
  // sessionStorage. It ends after 30 minutes without activity. This is the
  // site's own grouping for event parameters, not GA4's session.
  var IDLE_MS = 30 * 60 * 1000;
  var CONTEXT_KEY = "fp_context";
  var OLD_KEYS = ["fp_landing", "fp_ai_ref", "fp_ai_method"];
  var memory = null;
  var storage = function () {
    try {
      return window.sessionStorage || null;
    } catch (e) {
      return null;
    }
  };
  var valid = function (context) {
    return !!context && typeof context.landing === "string" && context.landing.charAt(0) === "/" && typeof context.at === "number" && isFinite(context.at) && context.at <= Date.now() + 60000 && (context.ai === "" || AI_LABELS[context.ai] === true) && (context.method === "" || METHODS[context.method] === true);
  };
  // The stored context, or this document's copy when storage is unavailable; null when absent or malformed.
  var load = function () {
    var raw = null;
    try {
      raw = storage() ? storage().getItem(CONTEXT_KEY) : null;
    } catch (e) {}
    var saved = memory;
    if (raw) {
      try {
        saved = JSON.parse(raw);
      } catch (e) {
        saved = null;
      }
    }
    return valid(saved) ? saved : null;
  };
  var save = function (context) {
    memory = context;
    try {
      if (storage()) storage().setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch (e) {}
  };
  var expired = function (context, at) {
    return !context || at - context.at > IDLE_MS;
  };
  var referrerUrl = function () {
    try {
      return document.referrer ? new URL(document.referrer) : null;
    } catch (e) {
      return null;
    }
  };
  // This document's own entry: an allowlisted referring hostname, else a utm_source that is exactly one.
  // "referrer": the browser named the assistant. "campaign": the link carried an allowlisted utm_source.
  var entrySource = function () {
    var ref = referrerUrl();
    var refHost = ref ? ref.hostname.toLowerCase() : "";
    var utm = "";
    try {
      utm = (new URLSearchParams(location.search).get("utm_source") || "").toLowerCase();
    } catch (e) {}
    return AI_HOSTS[refHost] ? { ai: AI_HOSTS[refHost], method: "referrer" } : AI_HOSTS[utm] ? { ai: AI_HOSTS[utm], method: "campaign" } : { ai: "", method: "" };
  };
  var startNew = function (at, source) {
    return { landing: path(location.pathname), ai: source.ai, method: source.method, at: at };
  };

  // On load: an active context continues (ordinary internal navigation keeps
  // its landing path and label). Otherwise a new one starts here and may
  // classify this document's own referrer or campaign.
  var context = (function () {
    var at = Date.now();
    var current = load();
    if (expired(current, at)) {
      current = null;
      // Keys from before the timestamped context carry no time: they are
      // continued only on an internal navigation (an active visit), then removed.
      try {
        var store = storage();
        var oldLanding = store ? store.getItem("fp_landing") : null;
        var ref = referrerUrl();
        if (oldLanding && ref && ref.origin === location.origin) {
          var migrated = { landing: path(oldLanding), ai: store.getItem("fp_ai_ref") || "", method: store.getItem("fp_ai_method") || "", at: at };
          if (!migrated.ai) migrated.method = "";
          else if (!migrated.method) migrated.method = "referrer";
          if (valid(migrated)) current = migrated;
        }
        if (store) for (var i = 0; i < OLD_KEYS.length; i += 1) store.removeItem(OLD_KEYS[i]);
      } catch (e) {}
    }
    if (!current) current = startNew(at, entrySource());
    current.at = at;
    save(current);
    return current;
  })();

  // Activity: a tap, a key press, a page shown again, or an event. After 30
  // idle minutes the next activity starts a new context for this page with no
  // assistant label: the entry referrer or campaign of a document loaded
  // hours ago is not a fresh referral. No timer keeps a context alive.
  var touch = function () {
    var at = Date.now();
    var current = load() || context;
    if (expired(current, at)) {
      current = startNew(at, { ai: "", method: "" });
      save(current);
    } else if (at - current.at > 15000) {
      current.at = at;
      save(current);
    }
    context = current;
    return current;
  };
  var activity = function () {
    touch();
  };
  document.addEventListener("pointerdown", activity, { capture: true, passive: true });
  document.addEventListener("keydown", activity, { capture: true, passive: true });
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) touch();
  });

  // Destination city: the stored choice, else the city page in view. Only a
  // lower-case slug ever leaves here; never an address or a pincode.
  var destinationCity = function () {
    var slug = "";
    try {
      slug = localStorage.getItem("fresh_petals_destination_city") || "";
    } catch (e) {}
    if (!slug) {
      var cityContext = document.querySelector("[data-city-context]");
      slug = (cityContext && cityContext.getAttribute("data-city-context")) || "";
    }
    return /^[a-z][a-z-]{1,40}$/.test(slug) ? slug : "";
  };

  window.fpTrack = function (name, params) {
    // Checked when the event happens, not only when the page loaded.
    var current = touch();
    var data = { page_path: path(location.pathname), landing_path: current.landing };
    var city = destinationCity();
    if (city) data.destination_city = city;
    if (current.ai) {
      data.ai_referrer = current.ai;
      data.ai_attribution = current.method || "referrer";
    }
    for (var key in params || {}) if (params[key] !== undefined && params[key] !== null && params[key] !== "") data[key] = String(params[key]).slice(0, 100);
    try {
      document.dispatchEvent(new CustomEvent("fp:track", { detail: { name: name, params: data } }));
    } catch (e) {}
    if (measurementId && window.gtag) window.gtag("event", name, data);
  };

  var list = document.querySelector("[data-track-list]");
  if (list) window.fpTrack("view_item_list", { item_category: list.getAttribute("data-track-list") });
  var item = document.querySelector("[data-track-item]");
  if (item) window.fpTrack("view_item", { item_id: item.getAttribute("data-track-item"), item_category: item.getAttribute("data-track-category") });

  // Direct enquiries: any link or button that opens a WhatsApp chat with
  // the shop. The basket's own button reports basket_quote_request instead.
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target && event.target.closest ? event.target.closest("a[href], button") : null;
      if (!target || target.hasAttribute("data-send-cart-whatsapp")) return;
      var href = target.getAttribute("href") || "";
      var direct = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href) || href.indexOf("/garland-enquiry") === 0 || target.hasAttribute("data-simple-whatsapp") || target.hasAttribute("data-whatsapp-order-link") || target.hasAttribute("data-detailed-whatsapp");
      if (!direct) return;
      var scope = target.closest("[data-track-item]") || document.querySelector("[data-track-item]");
      var card = target.closest("[data-garland-card], [data-product-card], article");
      var code = target.getAttribute("data-garland-quote") || (href.match(/code=(FP-G\d+)/i) || [])[1];
      var slug = card && card.querySelector ? ((card.querySelector('a[href^="/products/"]') || { getAttribute: function () {} }).getAttribute("href") || "").split("?")[0].replace("/products/", "") : "";
      window.fpTrack("whatsapp_enquiry_click", {
        item_id: code || slug || (scope && scope.getAttribute("data-track-item")) || "",
        item_category: code ? "Garlands" : (scope && scope.getAttribute("data-track-category")) || (list && list.getAttribute("data-track-list")) || "general",
        link_type: target.closest("header, footer") ? "site" : card ? "card" : "page",
      });
    },
    true
  );
})();

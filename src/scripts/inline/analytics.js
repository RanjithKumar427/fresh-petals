(function () {
  var path = function (value) {
    return (value || "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  };
  var landing = path(location.pathname);
  try {
    landing = sessionStorage.getItem("fp_landing") || landing;
    sessionStorage.setItem("fp_landing", landing);
  } catch (e) {}

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
  var aiReferrer = "";
  var aiMethod = "";
  try {
    aiReferrer = sessionStorage.getItem("fp_ai_ref") || "";
    aiMethod = sessionStorage.getItem("fp_ai_method") || "";
    if (!aiReferrer) {
      var refHost = "";
      try {
        refHost = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : "";
      } catch (e) {}
      var utm = (new URLSearchParams(location.search).get("utm_source") || "").toLowerCase();
      // "referrer": the browser named the assistant. "campaign": the link carried an allowlisted utm_source.
      aiMethod = AI_HOSTS[refHost] ? "referrer" : AI_HOSTS[utm] ? "campaign" : "";
      aiReferrer = AI_HOSTS[refHost] || AI_HOSTS[utm] || "";
      if (aiReferrer) {
        sessionStorage.setItem("fp_ai_ref", aiReferrer);
        sessionStorage.setItem("fp_ai_method", aiMethod);
      }
    }
  } catch (e) {}

  // Destination city: the stored choice, else the city page in view. Only a
  // lower-case slug ever leaves here; never an address or a pincode.
  var destinationCity = function () {
    var slug = "";
    try {
      slug = localStorage.getItem("fresh_petals_destination_city") || "";
    } catch (e) {}
    if (!slug) {
      var context = document.querySelector("[data-city-context]");
      slug = (context && context.getAttribute("data-city-context")) || "";
    }
    return /^[a-z][a-z-]{1,40}$/.test(slug) ? slug : "";
  };

  window.fpTrack = function (name, params) {
    var data = { page_path: path(location.pathname), landing_path: landing };
    var city = destinationCity();
    if (city) data.destination_city = city;
    if (aiReferrer) {
      data.ai_referrer = aiReferrer;
      data.ai_attribution = aiMethod || "referrer";
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

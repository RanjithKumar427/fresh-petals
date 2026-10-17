    const whatsappNumber = "919652012274";
    // The shared quote-only rule (src/shared/quoteOnly.ts), as data: these
    // items and the add-ons chosen with them never show or send an amount.
    const quoteOnly = JSON.parse(document.getElementById("quote-only").textContent);
    const isQuoteOnlyItem = (item) => quoteOnly.categories.includes(item.category) || quoteOnly.slugs.includes(item.slug);
    const hasQuoteOnlyItems = (items) => items.some(isQuoteOnlyItem);
    const itemPriceLabel = (item) => (isQuoteOnlyItem(item) ? quoteOnly.label : item.priceLabel);
    const addOnPriceText = (item, addOn) => (!isQuoteOnlyItem(item) && addOn.priceLabel ? ` (${addOn.priceLabel})` : "");
    const CART_KEY = "fresh_petals_cart";

    // The order's recipient city: the one value src/utils/destination.ts
    // keeps, read here and checked against the registry. A basket saved
    // before cities existed simply has none.
    const serviceCities = JSON.parse(document.getElementById("service-cities")?.textContent || "{}");
    function destinationSlug() {
      try {
        const slug = window.localStorage.getItem("fresh_petals_destination_city") || "";
        return Object.prototype.hasOwnProperty.call(serviceCities, slug) ? slug : "";
      } catch {
        return "";
      }
    }
    function destinationName() {
      return serviceCities[destinationSlug()] || "";
    }

    /**
     * Fire-and-forget admin inquiry log — Commerce Foundation Phase 3,
     * Milestone 5. Deliberately never awaited by its caller and never
     * throws: the site's one promise is "opens WhatsApp", and a slow or
     * failed log write must never delay or block that. If this silently
     * fails, the only cost is a missing row in the admin's inbox — the
     * WhatsApp message the customer sends is unaffected either way.
     */
    function logInquiry({
      customerName,
      phone,
      products,
      deliveryDate,
      recipientName,
      recipientPhone,
      deliveryLandmark,
      occasion,
      deliveryMethod,
      deliveryPromise,
      deliveryFee,
    }) {
      fetch("/api/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          products,
          deliveryDate,
          recipientName,
          recipientPhone,
          deliveryLandmark,
          occasion,
          deliveryMethod,
          deliveryPromise,
          deliveryFee,
        }),
      }).catch(() => {});
    }

    function getCartItems() {
      const storedCart = window.localStorage.getItem(CART_KEY);

      if (!storedCart) return [];

      try {
        return JSON.parse(storedCart);
      } catch {
        return [];
      }
    }

    function saveCartItems(items) {
      window.localStorage.setItem(CART_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event("fresh-petals-cart-updated"));
    }

    function updateCartItemQuantity(id, quantity) {
      const currentItems = getCartItems();

      if (quantity <= 0) {
        removeCartItem(id);
        return;
      }

      const updatedItems = currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity,
            }
          : item
      );

      saveCartItems(updatedItems);
    }

    function removeCartItem(id) {
      const currentItems = getCartItems();
      const updatedItems = currentItems.filter((item) => item.id !== id);
      saveCartItems(updatedItems);
    }

    function clearCart() {
      saveCartItems([]);
    }

    const emptyState = document.querySelector("[data-cart-empty]");
    const cartContent = document.querySelector("[data-cart-content]");
    const cartItemsContainer = document.querySelector("[data-cart-items]");
    const clearCartButton = document.querySelector("[data-clear-cart]");
    const sendWhatsappButton = document.querySelector("[data-send-cart-whatsapp]");
    const errorBox = document.querySelector("[data-cart-error]");
    const serviceAreaResult = document.querySelector("[data-service-area-result]");
    const cartSummary = document.querySelector("[data-cart-summary]");

    const nameInput = document.querySelector("[data-customer-name]");
    const phoneInput = document.querySelector("[data-customer-phone]");
    const pincodeInput = document.querySelector("[data-customer-pincode]");
    const dateInput = document.querySelector("[data-delivery-date]");
    const slotInput = document.querySelector("[data-delivery-slot]");
    const noteInput = document.querySelector("[data-customer-note]");

    const recipientNameInput = document.querySelector("[data-recipient-name]");
    const recipientPhoneInput = document.querySelector("[data-recipient-phone]");
    const landmarkInput = document.querySelector("[data-delivery-landmark]");
    const occasionInput = document.querySelector("[data-occasion]");
    const occasionOtherInput = document.querySelector("[data-occasion-other]");
    const occasionOtherWrapper = document.querySelector("[data-occasion-other-wrapper]");

    occasionInput?.addEventListener("change", () => {
      if (!occasionOtherWrapper) return;
      occasionOtherWrapper.classList.toggle("hidden", occasionInput.value !== "Other");
    });

    // Occasion choices belong to each basket item. The optional order field is never populated from another item.

    // Business-timezone "today", not the browser's local/UTC date — the
    // server's authoritative /api/delivery/check (see businessTime.ts)
    // always evaluates "today" in Asia/Kolkata. Using toISOString() here
    // instead would disagree with the server for part of every day (IST
    // is UTC+5:30, so browsing between 00:00-05:29 IST reads one calendar
    // day earlier in UTC), letting this min-date hint allow a date the
    // server would then correctly reject. This is a pure display/UX
    // affordance either way — the actual availability decision is never
    // made client-side — but it should still agree with the server it's
    // describing.
    const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

    if (dateInput) {
      dateInput.min = todayIso;
    }

    function escapeHtml(value) {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function showError(message) {
      if (!errorBox) return;

      errorBox.textContent = message;
      errorBox.classList.remove("hidden");
    }

    function hideError() {
      if (!errorBox) return;

      errorBox.textContent = "";
      errorBox.classList.add("hidden");
    }

    function showServiceAreaResult({ type, html }) {
      if (!serviceAreaResult) return;

      serviceAreaResult.classList.remove("hidden");
      serviceAreaResult.innerHTML = html;

      if (type === "success") {
        serviceAreaResult.className =
          "mt-5 rounded-2xl border border-mint-line bg-mint-soft p-4 text-sm leading-7 text-ink";
      } else if (type === "info") {
        serviceAreaResult.className =
          "mt-5 rounded-2xl border border-line bg-paper p-4 text-sm leading-7 text-ink";
      } else {
        serviceAreaResult.className =
          "mt-5 rounded-2xl border border-rose bg-linen p-4 text-sm leading-7 text-berry";
      }
    }

    function hideServiceAreaResult() {
      if (!serviceAreaResult) return;

      serviceAreaResult.classList.add("hidden");
      serviceAreaResult.innerHTML = "";
    }

    function hideCartSummary() {
      if (!cartSummary) return;

      cartSummary.classList.add("hidden");
      cartSummary.innerHTML = "";
    }

    function getSelectedMethod() {
      const selectedOption = slotInput?.options?.[slotInput.selectedIndex];
      return selectedOption?.dataset?.method || "";
    }

    /**
     * The ONE place this page asks "is this deliverable?" — Delivery
     * Capability Engine milestone. Replaces what used to be an inline
     * lookup against a locally-embedded copy of service-area data
     * (duplicated across this file, DeliveryChecker.astro and
     * ProductOptions.astro); now every one of them calls this same
     * authoritative, server-side DeliveryService. Never throws: a
     * network failure or non-2xx response is treated as "couldn't
     * confirm right now", the same fail-safe shape the engine itself
     * returns for a database failure — see /api/delivery/check.
     *
     * Kept as this page's own copy rather than importing
     * utils/deliveryCheck.ts's shared version (Customer UX milestone):
     * this script is `is:inline` (not bundled/processed by Astro), so it
     * can't use ES module imports — converting it to a normal script to
     * enable that surfaced ~90 pre-existing implicit-`any`/DOM-typing
     * issues across this whole file, a disproportionate, unrelated
     * rewrite for one shared function. ProductOptions.astro (already a
     * normal script) uses the shared version instead.
     */
    async function checkDeliveryMethod(pincode, deliveryDate, method) {
      try {
        const response = await fetch("/api/delivery/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pincode, deliveryDate, method }),
        });
        const result = await response.json();
        if (!response.ok || !result?.ok || !Array.isArray(result.data) || !result.data[0]) {
          return {
            available: false,
            method,
            label: method,
            reason: "We couldn't confirm delivery availability right now. Please continue on WhatsApp and we'll confirm availability.",
          };
        }
        return result.data[0];
      } catch {
        return {
          available: false,
          method,
          label: method,
          reason: "We couldn't confirm delivery availability right now. Please continue on WhatsApp and we'll confirm availability.",
        };
      }
    }

    function itemProductHref(item) {
      const pathname = `/products/${encodeURIComponent(item.slug)}`;
      if (!item.journey?.occasion) return pathname;
      const params = new URLSearchParams({ occ: item.journey.occasion, for: item.journey.intent });
      if (item.journey.from) params.set("from", item.journey.from);
      return pathname + "?" + params;
    }

    function hasConfiguredDetails(item) {
      return Boolean(
        item.deliveryDate ||
          item.deliverySlot ||
          item.pincode ||
          item.greetingCard ||
          item.message ||
          item.note ||
          (item.addOns && item.addOns.length > 0) ||
          item.subscription || item.journey
      );
    }

    // Older persisted baskets may contain the withdrawn express promise.
    function requestedSlotText(slot) {
      return /within 4\s*[-–]\s*6 hours/i.test(slot) ? "Express request — timing to be confirmed on WhatsApp" : slot;
    }

    function renderAddOnsHtml(addOns, item) {
      if (!addOns || addOns.length === 0) return "";

      const addOnRows = addOns
        .map(
          (addOn) => `
            <li>
              ${escapeHtml(addOn.name)}${escapeHtml(addOnPriceText(item, addOn))} × ${escapeHtml(addOn.quantity || 1)}
            </li>
          `
        )
        .join("");

      return `
        <div>
          <p class="font-semibold text-ink">Add-ons</p>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            ${addOnRows}
          </ul>
        </div>
      `;
    }

    function renderSubscriptionHtml(subscription) {
  if (!subscription) return "";

  const rows = [
    subscription.frequency ? `Frequency: ${subscription.frequency}` : "",
    subscription.duration ? `Duration: ${subscription.duration}` : "",
    subscription.preferredDays && subscription.preferredDays.length > 0
      ? `Preferred Days: ${subscription.preferredDays.join(", ")}`
      : "",
    subscription.startDate ? `Start Date: ${subscription.startDate}` : "",
    subscription.pincode ? `Subscription Pincode: ${subscription.pincode}` : "",
    subscription.deliverySlot
      ? `Subscription Delivery Slot: ${subscription.deliverySlot}`
      : "",
    subscription.message ? `Subscription Message: ${subscription.message}` : "",
  ].filter(Boolean);

  if (rows.length === 0) return "";

  return `
    <div>
      <p class="font-semibold text-ink">Subscription</p>
      <ul class="mt-1 list-disc space-y-1 pl-5">
        ${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}
      </ul>
    </div>
  `;
}

    function renderConfiguredDetailsHtml(item) {
      if (!hasConfiguredDetails(item)) return "";

      const deliveryRows = [
        item.journey?.occasionLabel ? `Chosen for: ${item.journey.occasionLabel} · ${item.journey.intentLabel}` : "",
        item.pincode ? `Item Pincode: ${item.pincode}` : "",
        item.deliveryDate ? `Item Delivery Date: ${item.deliveryDate}` : "",
        item.deliverySlot ? `Item Delivery Slot: ${requestedSlotText(item.deliverySlot)}` : "",
        item.greetingCard ? `Greeting Card: ${item.greetingCard}` : "",
        item.message ? `Message: ${item.message}` : "",
        item.note ? `Item Note: ${item.note}` : "",
      ].filter(Boolean);

      const deliveryHtml =
        deliveryRows.length > 0
          ? `
            <div>
              <p class="font-semibold text-ink">Configured Details</p>
              <ul class="mt-1 list-disc space-y-1 pl-5">
                ${deliveryRows.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}
              </ul>
            </div>
          `
          : "";

      return `
        <div class="mt-4 space-y-3 rounded-2xl border border-line bg-linen p-4 text-xs leading-6 text-moss">
          ${deliveryHtml}
          ${renderAddOnsHtml(item.addOns, item)}
          ${renderSubscriptionHtml(item.subscription)}
        </div>
      `;
    }

    function buildConfiguredDetailsText(item) {
      const lines = [];
      if (item.journey?.occasionLabel) { lines.push(`Occasion: ${item.journey.occasionLabel}`); lines.push(`For: ${item.journey.intentLabel}`); }

      if (item.pincode) lines.push(`Item Pincode: ${item.pincode}`);
      if (item.deliveryDate) lines.push(`Item Delivery Date: ${item.deliveryDate}`);
      if (item.deliverySlot) lines.push(`Item Delivery Slot: ${requestedSlotText(item.deliverySlot)}`);
      if (item.greetingCard) lines.push(`Greeting Card: ${item.greetingCard}`);
      if (item.message) lines.push(`Message: ${item.message}`);
      if (item.note) lines.push(`Item Note: ${item.note}`);

      if (item.addOns && item.addOns.length > 0) {
        lines.push("Add-ons:");
        item.addOns.forEach((addOn) => {
          lines.push(
            `- ${addOn.name}${addOnPriceText(item, addOn)} × ${addOn.quantity || 1}`
          );
        });
      }

      if (item.subscription) {
  lines.push("Subscription:");

  if (item.subscription.frequency) {
    lines.push(`- Frequency: ${item.subscription.frequency}`);
  }

  if (item.subscription.duration) {
    lines.push(`- Duration: ${item.subscription.duration}`);
  }

  if (
    item.subscription.preferredDays &&
    item.subscription.preferredDays.length > 0
  ) {
    lines.push(`- Preferred Days: ${item.subscription.preferredDays.join(", ")}`);
  }

  if (item.subscription.startDate) {
    lines.push(`- Start Date: ${item.subscription.startDate}`);
  }

  if (item.subscription.pincode) {
    lines.push(`- Subscription Pincode: ${item.subscription.pincode}`);
  }

  if (item.subscription.deliverySlot) {
    lines.push(`- Subscription Delivery Slot: ${item.subscription.deliverySlot}`);
  }

  if (item.subscription.message) {
    lines.push(`- Subscription Message: ${item.subscription.message}`);
  }
      }

      return lines.join("\n");
    }

    function renderCart() {
      const items = getCartItems();

      if (!cartItemsContainer || !emptyState || !cartContent) return;

      cartItemsContainer.innerHTML = "";

      if (items.length === 0) {
        emptyState.classList.remove("hidden");
        cartContent.classList.add("hidden");
        return;
      }

      emptyState.classList.add("hidden");
      cartContent.classList.remove("hidden");
      if (sendWhatsappButton) sendWhatsappButton.textContent = hasQuoteOnlyItems(items) ? quoteOnly.basketLabel : "Send basket on WhatsApp";

      items.forEach((item) => {
        const itemElement = document.createElement("div");

        itemElement.className =
          "grid gap-4 rounded-[24px] border border-line bg-paper p-4 shadow-[0_10px_30px_rgba(40,24,32,0.05)] md:grid-cols-[110px_1fr_auto] md:items-start";

        itemElement.innerHTML = `
          <a href="${escapeHtml(itemProductHref(item))}" class="block overflow-hidden rounded-2xl bg-linen">
            <img
              src="${escapeHtml(item.image)}"
              alt="${escapeHtml(item.name)}"
              class="h-[110px] w-full object-cover md:w-[110px]"
            />
          </a>

          <div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-deep">
              ${escapeHtml(item.category)}
            </p>

            <a href="${escapeHtml(itemProductHref(item))}" class="mt-2 block">
              <h2 class="text-base font-semibold text-ink">
                ${escapeHtml(item.name)}
              </h2>
            </a>

            <p class="mt-2 text-sm font-bold text-ink" data-cart-item-price>
              ${escapeHtml(itemPriceLabel(item))}
            </p>

            ${renderConfiguredDetailsHtml(item)}
          </div>

          <div class="flex items-center justify-between gap-3 md:flex-col md:items-end">
            <div class="flex items-center rounded-full border border-line-strong bg-paper">
              <button
                type="button"
                data-decrease="${escapeHtml(item.id)}"
                class="px-4 py-2 text-sm font-bold text-ink"
              >
                -
              </button>

              <span class="min-w-8 text-center text-sm font-semibold text-ink">
                ${escapeHtml(item.quantity)}
              </span>

              <button
                type="button"
                data-increase="${escapeHtml(item.id)}"
                class="px-4 py-2 text-sm font-bold text-ink"
              >
                +
              </button>
            </div>

            <button
              type="button"
              data-remove="${escapeHtml(item.id)}"
              class="text-[10px] font-bold uppercase tracking-[0.18em] text-berry underline underline-offset-4"
            >
              Remove
            </button>
          </div>
        `;

        cartItemsContainer.appendChild(itemElement);
      });

      bindCartButtons();
    }

    function bindCartButtons() {
      document.querySelectorAll("[data-increase]").forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.getAttribute("data-increase");
          const item = getCartItems().find((cartItem) => cartItem.id === id);

          if (!item) return;

          updateCartItemQuantity(item.id, item.quantity + 1);
          hideCartSummary();
          renderCart();
        });
      });

      document.querySelectorAll("[data-decrease]").forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.getAttribute("data-decrease");
          const item = getCartItems().find((cartItem) => cartItem.id === id);

          if (!item) return;

          updateCartItemQuantity(item.id, item.quantity - 1);
          hideCartSummary();
          renderCart();
        });
      });

      document.querySelectorAll("[data-remove]").forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.getAttribute("data-remove");

          if (!id) return;

          removeCartItem(id);
          hideCartSummary();
          renderCart();
        });
      });
    }

    function renderCartSummaryItemRows(items) {
      return items
        .map((item, index) => {
          const configuredHtml = renderConfiguredDetailsHtml(item);

          return `
            <div class="border-b border-line pb-3">
              <div class="flex justify-between gap-4">
                <span>${index + 1}. ${escapeHtml(item.name)}</span>
                <strong class="text-right text-ink">
                  ${escapeHtml(itemPriceLabel(item))} × ${escapeHtml(item.quantity)}
                </strong>
              </div>

              ${configuredHtml}
            </div>
          `;
        })
        .join("");
    }

    function renderCartSummary({
      customerName,
      customerPhone,
      pincode,
      areaText,
      deliveryFeeText,
      serviceStatusText,
      deliveryDate,
      deliverySlot,
      slotStatusText,
      note,
      items,
      recipientName,
      recipientPhone,
      landmark,
      occasion,
    }) {
      if (!cartSummary) return;

      const itemRows = renderCartSummaryItemRows(items);

      cartSummary.classList.remove("hidden");

      cartSummary.innerHTML = `
        <h3 class="text-[12px] font-bold uppercase tracking-[0.24em] text-ink">
          Cart Order Summary
        </h3>

        <div class="mt-4 space-y-3 text-sm leading-6 text-moss">
          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Name</span>
            <strong class="text-right text-ink">${escapeHtml(customerName)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Phone</span>
            <strong class="text-right text-ink">${escapeHtml(customerPhone)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Recipient</span>
            <strong class="text-right text-ink">${escapeHtml(recipientName)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Recipient Phone</span>
            <strong class="text-right text-ink">${escapeHtml(recipientPhone)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Landmark</span>
            <strong class="text-right text-ink">${escapeHtml(landmark)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Occasion</span>
            <strong class="text-right text-ink">${escapeHtml(occasion)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Recipient city</span>
            <strong class="text-right text-ink">${escapeHtml(destinationName() || "Not chosen")}</strong>
          </div>
          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Main Pincode</span>
            <strong class="text-right text-ink">${escapeHtml(pincode)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Area</span>
            <strong class="text-right text-ink">${escapeHtml(areaText)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Delivery Fee</span>
            <strong class="text-right text-ink">${escapeHtml(deliveryFeeText)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Service Status</span>
            <strong class="text-right text-ink">${escapeHtml(serviceStatusText)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Main Delivery Date</span>
            <strong class="text-right text-ink">${escapeHtml(deliveryDate)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Main Delivery Slot</span>
            <strong class="text-right text-ink">${escapeHtml(deliverySlot)}</strong>
          </div>

          <div class="flex justify-between gap-4 border-b border-line pb-2">
            <span>Delivery Promise</span>
            <strong class="text-right text-ink">${escapeHtml(slotStatusText)}</strong>
          </div>

          <div class="pt-2">
            <h4 class="mb-3 text-[11px] font-bold uppercase tracking-[0.20em] text-ink">
              Items
            </h4>
            <div class="space-y-3">
              ${itemRows}
            </div>
          </div>

          <div>
            <span class="block text-moss">Address / Order Note</span>
            <strong class="mt-1 block text-ink">${escapeHtml(note || "None")}</strong>
          </div>
        </div>

        <p class="mt-4 rounded-2xl bg-linen p-4 text-xs leading-6 text-berry">
          This is a summary of your request, not an order total. Prices, flower availability, delivery fee and payment are confirmed on WhatsApp.
        </p>
      `;
    }

    function buildCartLineText(item, index) {
      const configuredText = buildConfiguredDetailsText(item);

      return [
        `${index + 1}. ${item.name}`,
        ...(isQuoteOnlyItem(item) ? [] : [`Price: ${item.priceLabel}`]),
        `Qty: ${item.quantity}`,
        `Category: ${item.category}`,
        ...(item.slug ? [`Link: ${location.origin}/products/${encodeURIComponent(item.slug)}`] : []),
        configuredText !== "No item-level configuration"
          ? `Configured Details:\n${configuredText}`
          : "Configured Details: None",
      ].join("\n");
    }

    async function buildCartWhatsappUrl() {
      const items = getCartItems();

      const customerName = nameInput?.value.trim() || "";
      const customerPhone = phoneInput?.value.trim() || "";
      const pincode = pincodeInput?.value.trim() || "";
      const deliveryDate = dateInput?.value || "";
      const deliverySlot = slotInput?.value || "";
      const note = noteInput?.value.trim() || "";

      const recipientName = recipientNameInput?.value.trim() || "";
      const recipientPhoneRaw = recipientPhoneInput?.value.trim() || "";
      const landmark = landmarkInput?.value.trim() || "";
      const occasionSelected = occasionInput?.value || "";
      const occasionOtherText = occasionOtherInput?.value.trim() || "";
      // Folded into one string rather than a second stored field — see
      // inquirySchema.ts's comment on `occasion` for why.
      const occasion =
        occasionSelected === "Other" && occasionOtherText ? `Other: ${occasionOtherText}` : occasionSelected;

      hideError();
      hideServiceAreaResult();
      hideCartSummary();

      if (items.length === 0) {
        showError("Your cart is empty.");
        return "#";
      }

      if (!customerName) {
        showError("Please enter your name.");
        return "#";
      }

      if (!customerPhone) {
        showError("Please enter your phone number.");
        return "#";
      }

      // Pincode is optional: delivery area, timing and charges are always
      // confirmed on WhatsApp. If one is given it must be a real 6-digit code.
      if (pincode && !/^[0-9]{6}$/.test(pincode)) {
        showError("Please enter a valid 6-digit pincode, or leave it blank.");
        return "#";
      }

      if (!deliveryDate) {
        showError("Please select a delivery date.");
        return "#";
      }

      if (!deliverySlot) {
        showError("Please select a delivery time slot.");
        return "#";
      }

      if (!recipientName) {
        showError("Please enter the recipient's name.");
        return "#";
      }

      const recipientPhoneDigits = recipientPhoneRaw.replace(/\D/g, "");
      const recipientPhoneLocal =
        recipientPhoneDigits.length === 12 && recipientPhoneDigits.startsWith("91")
          ? recipientPhoneDigits.slice(2)
          : recipientPhoneDigits.length === 11 && recipientPhoneDigits.startsWith("0")
            ? recipientPhoneDigits.slice(1)
            : recipientPhoneDigits;

      if (!/^[6-9]\d{9}$/.test(recipientPhoneLocal)) {
        showError("Please enter a valid 10-digit recipient mobile number.");
        return "#";
      }

      if (!landmark) {
        showError("Please enter a delivery landmark.");
        return "#";
      }

      // Occasion is optional (Customer UX milestone) — the business
      // doesn't require it to fulfil an order; it's genuinely nice-to-have
      // context, not a blocking field. See inquirySchema.ts's matching change.
      const method = getSelectedMethod();

      const cartLines = items
        .map((item, index) => buildCartLineText(item, index))
        .join("\n\n");

      // The one authoritative call — see checkDeliveryMethod. This is a
      // genuine revalidation, not a reuse of whatever the customer last
      // saw: the pincode/date/method could have been typed seconds ago
      // or minutes ago, and a slot's cutoff (or the area's own data) may
      // have changed in between. Nothing downstream trusts client state.
      const deliveryResult = pincode
        ? await checkDeliveryMethod(pincode, deliveryDate, method)
        : {
            available: false,
            method,
            label: deliverySlot || method,
            reason: "Delivery charges will be confirmed on WhatsApp.",
          };

      let areaText = "To be confirmed on WhatsApp";
      let deliveryFeeText = "To be confirmed";
      let serviceStatusText = deliveryResult.reason || "Delivery charges will be confirmed on WhatsApp.";
      let promiseText = "To be confirmed";

      if (deliveryResult.available) {
        areaText = `${deliveryResult.area}, ${deliveryResult.city}`;
        deliveryFeeText = `₹${deliveryResult.fee}`;
        serviceStatusText = "Delivery available";
        promiseText = deliveryResult.promise;

        showServiceAreaResult({
          type: "success",
          html: `
            <strong>Delivery available in ${escapeHtml(deliveryResult.area)}.</strong><br />
            Delivery fee: ₹${escapeHtml(deliveryResult.fee)}<br />
            ${escapeHtml(deliveryResult.label)}<br />
            Promise: ${escapeHtml(deliveryResult.promise)}
          `,
        });
      } else {
        // No estimate is not "unavailable": the city is confirmed with the
        // customer, and only the charge and timing remain to be agreed.
        showServiceAreaResult({
          type: "info",
          html: `
            <strong>${escapeHtml(deliveryResult.reason)}</strong><br />
            Continue on WhatsApp — we confirm the delivery details, charge and timing for ${escapeHtml(destinationName() || "the recipient city")} before you pay.
          `,
        });
      }

      renderCartSummary({
        customerName,
        customerPhone,
        pincode,
        areaText,
        deliveryFeeText,
        serviceStatusText,
        deliveryDate,
        deliverySlot,
        slotStatusText: promiseText,
        note,
        items,
        recipientName,
        recipientPhone: recipientPhoneLocal,
        landmark,
        occasion,
      });

      // A basket with quote-only items is a price request: no amounts (item,
      // add-on or delivery fee) and the shared closing line.
      const priceRequest = hasQuoteOnlyItems(items);
      const message = `
${priceRequest ? "FreshPetals Price Request" : "FreshPetals Order Request"}

${priceRequest ? "This is a request, not a confirmed order." : "This is a request, not a confirmed order — please confirm availability, final price, delivery fee and payment details."}

CUSTOMER
Name: ${customerName}
Phone: ${customerPhone}

RECIPIENT
Name: ${recipientName}
Phone: ${recipientPhoneLocal}

DELIVERY
Recipient city: ${destinationName() || "Not chosen — please confirm the recipient city"}
Pincode: ${pincode || "Not given"}
Area: ${areaText}
Delivery Option: ${deliveryResult.label}
Promise: ${promiseText}${priceRequest ? "" : `\nDelivery Fee: ${deliveryFeeText}`}
Service Status: ${serviceStatusText}
Date: ${deliveryDate}
Landmark: ${landmark}
Order occasion (optional): ${occasion || "Not specified"}

PRODUCTS
${cartLines}

Order Note / Address:
${note || "None"}

${priceRequest ? quoteOnly.closing : "Please confirm availability, final price, delivery fee and payment details."}
      `.trim();

      logInquiry({
        customerName,
        phone: customerPhone,
        products: items.map((item) => `${item.name} x${item.quantity}`).join(", "),
        deliveryDate,
        recipientName,
        recipientPhone: recipientPhoneLocal,
        deliveryLandmark: landmark,
        occasion,
        deliveryMethod: deliveryResult.available ? deliveryResult.method : null,
        deliveryPromise: deliveryResult.available ? deliveryResult.promise : null,
        deliveryFee: deliveryResult.available ? deliveryResult.fee : null,
      });

      return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    }

    // Customer UX validation milestone — this handler awaits a real
    // server round-trip (buildCartWhatsappUrl's own delivery revalidation)
    // before opening WhatsApp. A rapid double/triple-tap during that
    // window previously re-ran the whole flow per tap: multiple WhatsApp
    // tabs AND, since this path also logs an inquiry, multiple duplicate
    // rows in the admin's inquiry list for one order. Guarded the same
    // way as ProductOptions.astro's two WhatsApp buttons.
    let sendCartInFlight = false;

    sendWhatsappButton?.addEventListener("click", async () => {
      if (sendCartInFlight) return;
      sendCartInFlight = true;

      try {
        // buildCartWhatsappUrl() now awaits a server revalidation
        // (checkDeliveryMethod), which breaks the synchronous call chain
        // most browsers require for window.open() to count as a direct
        // user gesture — calling it only after that await would get
        // silently popup-blocked in several browsers. Opening a blank tab
        // right here, still inside the synchronous click handler, and
        // only pointing it at the real URL once validation finishes avoids
        // that — same window, no extra popup-permission prompt.
        const whatsappTab = window.open("", "_blank", "noopener,noreferrer");

        const url = await buildCartWhatsappUrl();

        if (url === "#") {
          whatsappTab?.close();
          return;
        }

        // Measurement only: which products, never who or the message.
        const sent = getCartItems();
        window.fpTrack?.("basket_quote_request", {
          item_id: sent.map((item) => item.slug || item.name).join(",").slice(0, 100),
          item_category: [...new Set(sent.map((item) => item.category))].join(","),
          item_count: sent.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
          request_type: hasQuoteOnlyItems(sent) ? "price_request" : "order_request",
          destination_city: destinationSlug(),
        });

        if (whatsappTab) {
          whatsappTab.location.href = url;
        } else {
          // The blank-tab open itself was blocked (rare, but possible under
          // strict popup settings) — fall back to a direct open with the
          // final URL now that we have one.
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } finally {
        sendCartInFlight = false;
      }
    });

    pincodeInput?.addEventListener("input", () => {
      hideServiceAreaResult();
      hideCartSummary();
      hideError();
    });

    slotInput?.addEventListener("change", () => {
      hideServiceAreaResult();
      hideCartSummary();
      hideError();
    });

    dateInput?.addEventListener("change", () => {
      hideCartSummary();
      hideError();
    });

    noteInput?.addEventListener("input", () => {
      hideCartSummary();
      hideError();
    });

    recipientNameInput?.addEventListener("input", () => {
      hideCartSummary();
      hideError();
    });

    recipientPhoneInput?.addEventListener("input", () => {
      hideCartSummary();
      hideError();
    });

    landmarkInput?.addEventListener("input", () => {
      hideCartSummary();
      hideError();
    });

    occasionInput?.addEventListener("change", () => {
      hideCartSummary();
      hideError();
    });

    occasionOtherInput?.addEventListener("input", () => {
      hideCartSummary();
      hideError();
    });

    clearCartButton?.addEventListener("click", () => {
      clearCart();
      hideCartSummary();
      renderCart();
    });

    // A basket saved before a price change is brought up to this deployment's
    // published prices (products and add-ons) before it is shown or sent, and
    // the customer is told what changed. Items that aren't catalogue
    // products (none can be added today) are left as they are.
    function reconcilePrices() {
      let published = {};
      try {
        published = JSON.parse(document.getElementById("published-prices")?.textContent || "{}");
      } catch {}
      const has = (slug) => typeof slug === "string" && Object.prototype.hasOwnProperty.call(published, slug);
      const changes = [];
      let quiet = false;
      const items = getCartItems().map((item) => {
        let next = item;
        // Quote-only items lose any amount saved earlier, without a notice
        // (a notice would repeat the amounts).
        if (isQuoteOnlyItem(item)) {
          const addOns = Array.isArray(item.addOns) ? item.addOns.map((addOn) => (addOn.priceLabel ? { ...addOn, priceLabel: "" } : addOn)) : item.addOns;
          const changed = item.priceLabel !== quoteOnly.label || (Array.isArray(addOns) && addOns.some((addOn, i) => addOn !== item.addOns[i]));
          if (changed) quiet = true;
          return changed ? { ...item, priceLabel: quoteOnly.label, addOns } : item;
        }
        if (has(item.slug) && published[item.slug] !== item.priceLabel) {
          changes.push(`${item.name}: ${item.priceLabel || "no price"} → ${published[item.slug]}`);
          next = { ...next, priceLabel: published[item.slug] };
        }
        if (Array.isArray(next.addOns)) {
          next = {
            ...next,
            addOns: next.addOns.map((addOn) => {
              if (!has(addOn.id) || published[addOn.id] === addOn.priceLabel) return addOn;
              changes.push(`${addOn.name}: ${addOn.priceLabel || "no price"} → ${published[addOn.id]}`);
              return { ...addOn, priceLabel: published[addOn.id] };
            }),
          };
        }
        return next;
      });
      if (changes.length === 0 && !quiet) return;
      saveCartItems(items);
      if (changes.length === 0) return;
      const notice = document.querySelector("[data-cart-price-notice]");
      if (notice) {
        notice.textContent = `Prices updated to the current listed prices: ${changes.join("; ")}.`;
        notice.hidden = false;
      }
    }

    reconcilePrices();
    renderCart();

import type { Journey } from "./journey";

export type CartAddOn = {
  id: string;
  name: string;
  priceLabel: string;
  quantity: number;
};

export type CartSubscription = {
  frequency?: "daily" | "weekly" | "biweekly" | "monthly";
  duration?: "1-month" | "3-months" | "6-months";
  preferredDays?: string[];
  startDate?: string;
  pincode?: string;
  deliverySlot?: string;
  message?: string;
};

export type CartItem = {
  id: string;
  productId?: string;
  slug: string;
  name: string;
  image: string;
  priceLabel: string;
  category: string;
  quantity: number;

  journey?: Journey | null;
  deliveryDate?: string;
  deliverySlot?: string;
  pincode?: string;

  addOns?: CartAddOn[];
  greetingCard?: string;
  message?: string;
  note?: string;

  subscription?: CartSubscription;
};

const CART_KEY = "fresh_petals_cart";

// Products this deployment does not publish (archived or draft catalogue
// records), embedded by the site header as #fp-unavailable-products. A basket
// saved before a product was unpublished drops it here, the one place every
// basket reader goes through, so it leaves the count, the basket page and the
// WhatsApp draft together and cannot come back on a reload or a quantity
// change. The names are kept under UNAVAILABLE_KEY until the basket page has
// said what was removed. The basket page's own script (src/scripts/inline/
// cart.js) applies the same rule.
export const UNAVAILABLE_KEY = "fresh_petals_cart_unavailable";
export const UNAVAILABLE_ELEMENT_ID = "fp-unavailable-products";

/** Items (and add-ons) whose product is unavailable removed; `removed` names what went. */
export function withoutUnavailable<T extends { slug?: string; name: string; addOns?: { id: string; name: string }[] }>(items: T[], unavailable: Set<string>): { items: T[]; removed: string[] } {
  if (unavailable.size === 0) return { items, removed: [] };
  const removed: string[] = [];
  const kept = items.flatMap((item) => {
    if (item.slug && unavailable.has(item.slug)) {
      removed.push(item.name);
      return [];
    }
    if (!Array.isArray(item.addOns) || !item.addOns.some((addOn) => unavailable.has(addOn.id))) return [item];
    for (const addOn of item.addOns) if (unavailable.has(addOn.id)) removed.push(`${addOn.name} (add-on with ${item.name})`);
    return [{ ...item, addOns: item.addOns.filter((addOn) => !unavailable.has(addOn.id)) }];
  });
  return { items: kept, removed };
}

function unavailableProducts(): Set<string> {
  try {
    return new Set(JSON.parse(document.getElementById(UNAVAILABLE_ELEMENT_ID)?.textContent || "[]"));
  } catch {
    return new Set();
  }
}

function recordRemoved(names: string[]) {
  try {
    const earlier = JSON.parse(window.localStorage.getItem(UNAVAILABLE_KEY) || "[]");
    window.localStorage.setItem(UNAVAILABLE_KEY, JSON.stringify([...new Set([...(Array.isArray(earlier) ? earlier : []), ...names])]));
  } catch {}
}

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];

  const storedCart = window.localStorage.getItem(CART_KEY);

  if (!storedCart) return [];

  let parsed: CartItem[];
  try {
    parsed = JSON.parse(storedCart) as CartItem[];
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const { items, removed } = withoutUnavailable(parsed, unavailableProducts());
  if (removed.length) {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    recordRemoved(removed);
  }
  return items;
}

export function saveCartItems(items: CartItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("fresh-petals-cart-updated"));
}

let configuredSequence = 0;
function createConfiguredItemId(item: Omit<CartItem, "quantity">) {
  const contextId = item.journey ? `${item.id}:journey:${encodeURIComponent(item.journey.occasion)}:${item.journey.intent}` : item.id;
  const hasConfiguration =
    Boolean(item.deliveryDate) ||
    Boolean(item.deliverySlot) ||
    Boolean(item.pincode) ||
    Boolean(item.greetingCard) ||
    Boolean(item.message) ||
    Boolean(item.note) ||
    Boolean(item.subscription) ||
    Boolean(item.addOns && item.addOns.length > 0);

  if (!hasConfiguration) {
    return contextId;
  }

  return `${contextId}-${Date.now()}-${configuredSequence++}`;
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity = 1) {
  const currentItems = getCartItems();

  const finalItemId = createConfiguredItemId(item);

  const cartItemToAdd: CartItem = {
    ...item,
    id: finalItemId,
    productId: item.productId ?? item.id,
    quantity,
  };

  const hasConfiguration =
    Boolean(cartItemToAdd.deliveryDate) ||
    Boolean(cartItemToAdd.deliverySlot) ||
    Boolean(cartItemToAdd.pincode) ||
    Boolean(cartItemToAdd.greetingCard) ||
    Boolean(cartItemToAdd.message) ||
    Boolean(cartItemToAdd.note) ||
    Boolean(cartItemToAdd.subscription) ||
    Boolean(cartItemToAdd.addOns && cartItemToAdd.addOns.length > 0);

  if (!hasConfiguration) {
    const existingItem = currentItems.find((cartItem) => cartItem.id === finalItemId);

    if (existingItem) {
      const updatedItems = currentItems.map((cartItem) =>
        cartItem.id === finalItemId
          ? {
              ...cartItem,
              quantity: cartItem.quantity + quantity,
            }
          : cartItem
      );

      saveCartItems(updatedItems);
      return updatedItems;
    }
  }

  const updatedItems = [...currentItems, cartItemToAdd];

  saveCartItems(updatedItems);
  return updatedItems;
}

export function updateCartItemQuantity(id: string, quantity: number) {
  const currentItems = getCartItems();

  if (quantity <= 0) {
    return removeCartItem(id);
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
  return updatedItems;
}

export function removeCartItem(id: string) {
  const currentItems = getCartItems();

  const updatedItems = currentItems.filter((item) => item.id !== id);

  saveCartItems(updatedItems);
  return updatedItems;
}

export function clearCart() {
  saveCartItems([]);
}

export function getCartCount() {
  return getCartItems().reduce((total, item) => total + item.quantity, 0);
}

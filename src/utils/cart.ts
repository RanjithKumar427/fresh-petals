 export type CartAddOn = {
  id: string;
  name: string;
  priceLabel: string;
  quantity: number;
};

export type CartSubscription = {
  frequency?: "weekly" | "biweekly" | "monthly";
  duration?: "1-month" | "3-months" | "6-months";
  startDate?: string;
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

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];

  const storedCart = window.localStorage.getItem(CART_KEY);

  if (!storedCart) return [];

  try {
    return JSON.parse(storedCart) as CartItem[];
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("fresh-petals-cart-updated"));
}

function createConfiguredItemId(item: Omit<CartItem, "quantity">) {
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
    return item.id;
  }

  return `${item.id}-${Date.now()}`;
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
    const existingItem = currentItems.find((cartItem) => cartItem.id === item.id);

    if (existingItem) {
      const updatedItems = currentItems.map((cartItem) =>
        cartItem.id === item.id
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
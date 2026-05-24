export type CartItem = {
  id: string;
  slug: string;
  name: string;
  image: string;
  priceLabel: string;
  category: string;
  quantity: number;
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

export function addToCart(item: Omit<CartItem, "quantity">, quantity = 1) {
  const currentItems = getCartItems();

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

  const updatedItems = [
    ...currentItems,
    {
      ...item,
      quantity,
    },
  ];

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
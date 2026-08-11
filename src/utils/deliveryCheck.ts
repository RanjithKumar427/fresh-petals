// Customer UX milestone — the ONE client-side copy of "ask the
// authoritative Delivery Capability Engine whether this pincode/date/
// method combination is deliverable, and what it costs." Before this,
// the exact same fetch-with-fallback function was hand-copied three
// times (cart.astro, ProductOptions.astro, and the unused
// DeliveryChecker.astro) — all calling the same POST /api/delivery/check,
// all with the same fail-closed fallback shape. This is that function,
// extracted once so every caller shares it instead of maintaining their
// own copy that could silently drift out of sync.
//
// Never trust localStorage/area for this decision — pincode is the only
// input the server-side engine accepts, and every result here comes
// straight from DeliveryService via the API, never computed here.
export type DeliveryCheckResult =
  | {
      available: true;
      method: string;
      label: string;
      promise: string;
      deliveryDate: string;
      fee: number;
      area: string;
      city: string;
      reason: null;
    }
  | {
      available: false;
      method: string;
      label: string;
      reason: string;
    };

const INFRA_FAILURE_MESSAGE =
  "We couldn't confirm delivery availability right now. Please continue on WhatsApp and we'll confirm availability.";

export async function checkDeliveryMethod(
  pincode: string,
  deliveryDate: string,
  method: string
): Promise<DeliveryCheckResult> {
  const fallback: DeliveryCheckResult = {
    available: false,
    method,
    label: method,
    reason: INFRA_FAILURE_MESSAGE,
  };

  try {
    const response = await fetch("/api/delivery/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pincode, deliveryDate, method }),
    });
    const result = await response.json();

    if (!response.ok || !result?.ok || !Array.isArray(result.data) || !result.data[0]) {
      return fallback;
    }

    return result.data[0] as DeliveryCheckResult;
  } catch {
    return fallback;
  }
}

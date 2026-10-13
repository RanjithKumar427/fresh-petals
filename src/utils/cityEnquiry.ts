// Server-rendered WhatsApp drafts that name the recipient city. They work
// without scripts, go to the one business number, and state no price, fee or
// delivery time: the draft asks for them.
import { whatsappLink } from "../config/storefront";
import { QUOTE_ONLY_CLOSING } from "../shared/quoteOnly";

/** A general enquiry for one city (the directory and the hub's own button). */
export function cityEnquiryHref(cityName: string): string {
  return whatsappLink(
    ["Hi Fresh Petals, I'd like to send flowers.", `Recipient city: ${cityName}`, "What I'm looking for (bouquet / garland / pooja flowers): ", "Date: ", "Delivery address: ", "", "Please confirm availability, the price and the delivery details."].join("\n")
  );
}

/** An enquiry about one catalogue product for one city. Quote-only products carry no amount. */
export function cityProductEnquiryHref({ name, url, cityName, quoteOnly, priceLabel }: { name: string; url: string; cityName: string; quoteOnly: boolean; priceLabel: string }): string {
  const lines = quoteOnly
    ? [`Hi Fresh Petals, I'd like to enquire about ${name}.`, "Quantity: 1", `Link: ${url}`, `Recipient city: ${cityName}`, "Date: ", "", QUOTE_ONLY_CLOSING]
    : [`Hi Fresh Petals, I'd like to order ${name}.`, `Price shown: ${priceLabel}`, "Quantity: 1", `Link: ${url}`, `Recipient city: ${cityName}`, "Date: ", "", "Please confirm availability, the final price and the delivery details."];
  return whatsappLink(lines.join("\n"));
}

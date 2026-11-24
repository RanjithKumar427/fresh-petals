// WhatsApp drafts for the city pages. They go to the one business number and
// state no price, fee or delivery time: the draft asks for them. The general
// city enquiry (not about a product) names the page's city and works without
// scripts; a product draft carries no city until the customer chooses one.
import { whatsappLink } from "../config/storefront";
import { QUOTE_ONLY_CLOSING } from "../shared/quoteOnly";

/** A general enquiry for one city (the directory and the hub's own button). */
export function cityEnquiryHref(cityName: string): string {
  return whatsappLink(
    ["Hi Fresh Petals, I'd like to send flowers.", `Recipient city: ${cityName}`, "What I'm looking for (bouquet / garland / pooja flowers): ", "Date: ", "Delivery address: ", "", "Please confirm availability, the price and the delivery details."].join("\n")
  );
}

/**
 * The draft for an enquiry about one catalogue product, without a recipient
 * city: product enquiries name only the city the customer chose, added when
 * the link is used (src/utils/productEnquiry.ts). Quote-only products carry no amount.
 */
export function productEnquiryDraft({ name, url, quoteOnly, priceLabel, quantityLine = "Quantity: 1" }: { name: string; url: string; quoteOnly: boolean; priceLabel: string; quantityLine?: string }): string {
  const lines = quoteOnly
    ? [`Hi Fresh Petals, I'd like to enquire about ${name}.`, quantityLine, `Link: ${url}`, "Date: ", "", QUOTE_ONLY_CLOSING]
    : [`Hi Fresh Petals, I'd like to order ${name}.`, `Price shown: ${priceLabel}`, quantityLine, `Link: ${url}`, "Date: ", "", "Please confirm availability, the final price and the delivery details."];
  return lines.join("\n");
}

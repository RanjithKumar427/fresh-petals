// The recipient city's line in a product WhatsApp draft. Pure text, shared by
// the browser (src/utils/productEnquiry.ts) and the server (/garland-enquiry),
// so every product draft names the chosen city exactly once, in one wording.

const CITY_LINE = /^Recipient city:/;

/** The one line that names the city. */
export const recipientCityLine = (city: string) => `Recipient city: ${city}`;

/**
 * The draft with exactly one recipient-city line naming `city`. Any other
 * city line is removed first: an empty placeholder ("Recipient city: "), a
 * different city, or the older two-line form ("Recipient city:" followed by
 * the name). The line goes under a DELIVERY heading when the draft has one,
 * else after the product link, else after the greeting. Everything else in
 * the draft (product, quantities, options, links) is left as it was.
 */
export function withRecipientCity(text: string, city: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!CITY_LINE.test(lines[i])) {
      kept.push(lines[i]);
      continue;
    }
    // Two-line form: the label alone, then the name on the next line.
    if (/^Recipient city:\s*$/.test(lines[i]) && i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(":")) i += 1;
  }
  const delivery = kept.findIndex((line) => line.trim() === "DELIVERY");
  const link = kept.findIndex((line) => /^Link: /.test(line));
  const at = delivery >= 0 ? delivery + 1 : link >= 0 ? link + 1 : Math.min(1, kept.length);
  kept.splice(at, 0, recipientCityLine(city));
  return kept.join("\n");
}

/** How many lines name a recipient city (for checks: a product draft has exactly one). */
export const recipientCityLines = (text: string) => text.split("\n").filter((line) => CITY_LINE.test(line));

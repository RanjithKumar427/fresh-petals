// Non-garland products: the dashboard status is not the same as what the
// storefront shows. Catalogue products are published to the website with a
// deployment (src/content.config.ts "catalogueStatus"), and the storefront's
// name, description, photographs and flowers come from its catalogue entry
// (src/data/productCatalog.ts), not from the editor. storefrontMessage() and
// storefrontDetails() keep four things apart — the dashboard status, what this
// deployment's catalogue snapshot holds, what is waiting for a deployment, and
// whether a storefront entry exists — so "Published" here is never read as
// "live on the website".
import type { ProductStatus } from "./types";

export type StorefrontReadiness = {
  /** The product has a storefront catalogue entry. */
  mapped: boolean;
  /** Its status in the deployed storefront snapshot (null: not in the snapshot). */
  deployedStatus: string | null;
  /** The deployed snapshot's selling price, when the storefront shows an amount for this product. */
  deployedPrice?: number | null;
  /** Whether the storefront shows an amount at all (false for quote-only products). */
  priceShown?: boolean;
  /** Dashboard values the storefront does not show, as of when the editor was opened. */
  drift?: { field: string; deliberate?: string }[];
  /** Editor fields the storefront does not read but which are compared with the catalogue. */
  unmappedFields: string[];
  /** Editor fields with no catalogue equivalent: not shown and not compared. */
  uncomparedFields?: string[];
  /** Fields the storefront takes from the database, and when. */
  databaseFields: string[];
};

export type StorefrontTone = "ok" | "pending" | "off" | "problem";

const STATUS_WORDS: Record<string, string> = { published: "published", draft: "a draft", archived: "archived" };

export function storefrontMessage(status: ProductStatus, readiness: Pick<StorefrontReadiness, "mapped" | "deployedStatus">): { tone: StorefrontTone; text: string } {
  const live = readiness.deployedStatus === "published";
  if (!readiness.mapped) {
    return {
      tone: status === "published" ? "problem" : "off",
      text:
        status === "published"
          ? "Published here, but not live: this product has no storefront catalogue entry, so the website has no page, card or listing for it. It needs a catalogue entry and a deployment."
          : "Not on the storefront: this product has no storefront catalogue entry. Publishing it here would not make it live; it also needs a catalogue entry and a deployment.",
    };
  }
  if (status === "published" && live) return { tone: "ok", text: "Live on the storefront in the current deployment." };
  if (status === "published") return { tone: "pending", text: "Published here; not on the storefront yet. It appears on its product page, lists, search and sitemap with the next successful deployment." };
  if (live) return { tone: "pending", text: `${status === "archived" ? "Archived" : "Back to draft"} here, but still live on the storefront until the next successful deployment, which removes it from every page.` };
  return { tone: "off", text: "Not on the storefront." };
}

export type StorefrontDetails = {
  rows: { label: string; value: string }[];
  /** Changes saved here that reach the storefront only with the next deployment. */
  pending: string[];
  /** Dashboard edits the storefront does not show at all (it uses the catalogue entry). */
  notShown: string[];
  /** Expected, deliberate differences. */
  deliberate: string[];
};

export function storefrontDetails(status: ProductStatus, sellingPrice: number | null, readiness: StorefrontReadiness): StorefrontDetails {
  const rows = [
    { label: "Dashboard status", value: STATUS_WORDS[status] ?? status },
    { label: "This deployment's catalogue", value: readiness.deployedStatus === null ? "not included" : `included as ${STATUS_WORDS[readiness.deployedStatus] ?? readiness.deployedStatus}` },
    { label: "Storefront entry", value: readiness.mapped ? "present" : "missing" },
  ];
  const pending: string[] = [];
  if (readiness.mapped && (readiness.deployedStatus ?? "none") !== status) pending.push(`Status: ${STATUS_WORDS[status] ?? status} here, ${readiness.deployedStatus === null ? "not in" : `${STATUS_WORDS[readiness.deployedStatus] ?? readiness.deployedStatus} in`} the deployed catalogue.`);
  if (readiness.mapped && readiness.priceShown && (readiness.deployedPrice ?? null) !== (sellingPrice ?? null)) pending.push(`Price: ${sellingPrice == null ? "none" : `₹${sellingPrice}`} here, ${readiness.deployedPrice == null ? "none" : `₹${readiness.deployedPrice}`} on the storefront.`);
  const drift = readiness.drift ?? [];
  return {
    rows,
    pending,
    notShown: drift.filter((entry) => !entry.deliberate).map((entry) => entry.field),
    deliberate: drift.filter((entry) => entry.deliberate).map((entry) => `${entry.field} (${entry.deliberate})`),
  };
}

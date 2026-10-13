// The national service-city registry: the one list of cities Fresh Petals
// takes orders for (docs/seo/national-coverage-2026-10.md).
//
// Three separate facts are kept apart on purpose:
//   serviceable  the owner confirmed fulfilment for the city (13 Oct 2026).
//   hub          whether a city page exists: "published" (/locations/<slug>),
//                "queued" (next in line, no page yet) or "none".
//   demand       whether search demand has been measured for the city.
//                Only Bengaluru has a Keyword Planner export; "unknown"
//                elsewhere says nothing about whether we deliver there.
// A city is serviceable whether or not it has a page or a measured volume.
//
// Coverage is not a delivery promise: no same-day claim, fee, pincode list,
// branch or dispatch origin is recorded here. Availability, price and
// delivery details are confirmed on WhatsApp for each order.
//
// Plain data with no server imports, so pages, the basket script and the
// enquiry endpoint all validate against the same list.

export type CityRegion = "south" | "west" | "north" | "east-central";
export type HubStatus = "published" | "queued" | "none";
export type DemandStatus = "measured" | "unknown";

export type ServiceCity = {
  /** Canonical slug: the ?city= value and, for a published hub, its path. */
  slug: string;
  /** Display name (current official spelling). */
  name: string;
  /** Other names customers type (lower-case). They resolve to this city; they never get a page of their own. */
  aliases: string[];
  state: string;
  region: CityRegion;
  serviceable: boolean;
  hub: HubStatus;
  demand: DemandStatus;
};

export const CITY_REGIONS: { key: CityRegion; label: string }[] = [
  { key: "south", label: "South India" },
  { key: "west", label: "West India" },
  { key: "north", label: "North India" },
  { key: "east-central", label: "East and Central India" },
];

type Row = [slug: string, name: string, state: string, region: CityRegion, hub?: HubStatus, aliases?: string[], demand?: DemandStatus];

// Order: published hubs and the queue first within the owner's list, then
// the rest as confirmed. 59 rows.
const ROWS: Row[] = [
  ["bengaluru", "Bengaluru", "Karnataka", "south", "published", ["bangalore", "bengalooru"], "measured"],
  ["mumbai", "Mumbai", "Maharashtra", "west", "published", ["bombay"]],
  ["delhi", "Delhi", "Delhi", "north", "published", ["new delhi"]],
  ["hyderabad", "Hyderabad", "Telangana", "south", "published", ["secunderabad"]],
  ["chennai", "Chennai", "Tamil Nadu", "south", "published", ["madras"]],
  ["pune", "Pune", "Maharashtra", "west", "published", ["poona"]],
  ["kolkata", "Kolkata", "West Bengal", "east-central", "published", ["calcutta"]],
  ["ahmedabad", "Ahmedabad", "Gujarat", "west", "published", ["amdavad"]],
  ["jaipur", "Jaipur", "Rajasthan", "north", "published"],
  ["coimbatore", "Coimbatore", "Tamil Nadu", "south", "published", ["kovai"]],
  ["visakhapatnam", "Visakhapatnam", "Andhra Pradesh", "south", "published", ["vizag", "vishakhapatnam"]],
  ["vijayawada", "Vijayawada", "Andhra Pradesh", "south", "published", ["bezawada"]],
  ["gurugram", "Gurugram", "Haryana", "north", "published", ["gurgaon"]],
  ["noida", "Noida", "Uttar Pradesh", "north", "published"],
  ["mysuru", "Mysuru", "Karnataka", "south", "published", ["mysore"]],
  ["surat", "Surat", "Gujarat", "west"],
  ["lucknow", "Lucknow", "Uttar Pradesh", "north"],
  ["indore", "Indore", "Madhya Pradesh", "east-central"],
  ["chandigarh", "Chandigarh", "Chandigarh", "north"],
  ["kochi", "Kochi", "Kerala", "south", "none", ["cochin", "ernakulam"]],
  ["bhubaneswar", "Bhubaneswar", "Odisha", "east-central", "none", ["bhubaneshwar"]],
  ["nagpur", "Nagpur", "Maharashtra", "west"],
  ["nashik", "Nashik", "Maharashtra", "west", "none", ["nasik"]],
  ["vadodara", "Vadodara", "Gujarat", "west", "none", ["baroda"]],
  ["rajkot", "Rajkot", "Gujarat", "west"],
  ["bhopal", "Bhopal", "Madhya Pradesh", "east-central"],
  ["patna", "Patna", "Bihar", "east-central"],
  ["guwahati", "Guwahati", "Assam", "east-central", "none", ["gauhati"]],
  ["thiruvananthapuram", "Thiruvananthapuram", "Kerala", "south", "none", ["trivandrum"]],
  ["ludhiana", "Ludhiana", "Punjab", "north"],
  ["faridabad", "Faridabad", "Haryana", "north"],
  ["ghaziabad", "Ghaziabad", "Uttar Pradesh", "north"],
  ["navi-mumbai", "Navi Mumbai", "Maharashtra", "west", "none", ["new mumbai"]],
  ["kalyan-dombivli", "Kalyan-Dombivli", "Maharashtra", "west", "none", ["kalyan", "dombivli", "dombivali", "kalyan dombivali"]],
  ["greater-noida", "Greater Noida", "Uttar Pradesh", "north"],
  ["thane", "Thane", "Maharashtra", "west", "none", ["thana"]],
  ["varanasi", "Varanasi", "Uttar Pradesh", "north", "none", ["banaras", "benares", "kashi"]],
  ["udaipur", "Udaipur", "Rajasthan", "north"],
  ["madurai", "Madurai", "Tamil Nadu", "south"],
  ["tirupati", "Tirupati", "Andhra Pradesh", "south", "none", ["tirupathi"]],
  ["mangaluru", "Mangaluru", "Karnataka", "south", "none", ["mangalore"]],
  ["kanpur", "Kanpur", "Uttar Pradesh", "north"],
  ["meerut", "Meerut", "Uttar Pradesh", "north"],
  ["dehradun", "Dehradun", "Uttarakhand", "north", "none", ["dehra dun"]],
  ["raipur", "Raipur", "Chhattisgarh", "east-central"],
  ["ranchi", "Ranchi", "Jharkhand", "east-central"],
  ["mira-bhayandar", "Mira-Bhayandar", "Maharashtra", "west", "none", ["mira road", "bhayandar", "mira bhayander"]],
  ["vasai-virar", "Vasai-Virar", "Maharashtra", "west", "none", ["vasai", "virar"]],
  ["tiruppur", "Tiruppur", "Tamil Nadu", "south", "none", ["tirupur"]],
  ["jamshedpur", "Jamshedpur", "Jharkhand", "east-central", "none", ["tatanagar"]],
  ["manipal", "Manipal", "Karnataka", "south"],
  ["belagavi", "Belagavi", "Karnataka", "south", "none", ["belgaum"]],
  ["hubballi-dharwad", "Hubballi-Dharwad", "Karnataka", "south", "none", ["hubli", "hubballi", "dharwad", "hubli dharwad"]],
  ["guntur", "Guntur", "Andhra Pradesh", "south"],
  ["salem", "Salem", "Tamil Nadu", "south"],
  ["warangal", "Warangal", "Telangana", "south"],
  ["kolhapur", "Kolhapur", "Maharashtra", "west"],
  ["siliguri", "Siliguri", "West Bengal", "east-central"],
  ["agra", "Agra", "Uttar Pradesh", "north"],
];

export const SERVICE_CITIES: ServiceCity[] = ROWS.map(([slug, name, state, region, hub = "none", aliases = [], demand = "unknown"]) => ({
  slug,
  name,
  aliases,
  state,
  region,
  serviceable: true,
  hub,
  demand,
}));

const key = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_/-]+/g, " ")
    .replace(/[^a-z ]/g, "");

const LOOKUP = new Map<string, ServiceCity>();
for (const city of SERVICE_CITIES) for (const name of [city.slug, city.name, ...city.aliases]) LOOKUP.set(key(name), city);

/** The registry city for a slug, name or alias ("Bangalore", "gurgaon", "navi-mumbai"); null for anything else. */
export function findCity(value: string | null | undefined): ServiceCity | null {
  if (!value || value.length > 60) return null;
  return LOOKUP.get(key(value)) ?? null;
}

/** A serviceable city's slug for any accepted spelling, or null. The only way a city value enters a link, the basket or a draft. */
export function normalizeCity(value: string | null | undefined): string | null {
  const city = findCity(value);
  return city?.serviceable ? city.slug : null;
}

export const cityName = (slug: string | null | undefined): string | null => findCity(slug)?.name ?? null;

export const serviceableCities = () => SERVICE_CITIES.filter((city) => city.serviceable);
/** Displayed counts come from here, never a typed number. */
export const serviceCityCount = () => serviceableCities().length;
export const publishedHubs = () => SERVICE_CITIES.filter((city) => city.serviceable && city.hub === "published");
export const queuedHubs = () => SERVICE_CITIES.filter((city) => city.serviceable && city.hub === "queued");
export const hasHub = (city: ServiceCity) => city.serviceable && city.hub === "published";

export const LOCATIONS_PATH = "/locations";
/** Path of a city's page: its hub when published, otherwise null (never a link to a page that does not exist). */
export const hubPath = (city: ServiceCity): string | null => (hasHub(city) ? `${LOCATIONS_PATH}/${city.slug}` : null);

export function citiesByRegion(): { key: CityRegion; label: string; cities: ServiceCity[] }[] {
  return CITY_REGIONS.map((region) => ({
    ...region,
    cities: serviceableCities()
      .filter((city) => city.region === region.key)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((region) => region.cities.length > 0);
}

/** Query parameter that names the recipient city in shop links. Validated with normalizeCity wherever it is read. */
export const CITY_PARAM = "city";

/** Slug → name for the client (basket and product scripts read this as JSON). */
export const cityOptions = (): { slug: string; name: string; region: CityRegion }[] =>
  serviceableCities().map(({ slug, name, region }) => ({ slug, name, region }));

/** The standard coverage sentence; the count is derived. */
export const COVERAGE_SENTENCE = (count = serviceCityCount()) =>
  `We take orders for ${count} cities across India. Share the recipient city and date; we confirm availability, price and delivery details on WhatsApp.`;

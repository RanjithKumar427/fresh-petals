// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others)
// that production pages are new or have changed. Google does not use IndexNow.
//
//   node scripts/seo/indexnow.mjs                    dry run: priority pages
//   node scripts/seo/indexnow.mjs --all              dry run: every sitemap URL
//   node scripts/seo/indexnow.mjs --urls /a,/b       dry run: these paths
//   node scripts/seo/indexnow.mjs [...] --submit     actually notify
//
// Run it by hand after a deployment has gone live; it is never part of a
// page request or the build. Safeguards:
// - only https://onlyfreshpetals.in — previews and other hosts are refused;
// - every URL must be listed in the live sitemaps (so never a private, admin,
//   noindexed or unpublished page) and answer 200;
// - the key file must already be live (public/<key>.txt, the protocol's
//   ownership check);
// - at most MAX_URLS per run.
// A 200/202 response means the notification was received. It does not mean a
// page was crawled or indexed.
const HOST = "onlyfreshpetals.in";
const ORIGIN = `https://${HOST}`;
const KEY = "811bb0d64c3644549f2fe0364bc86b52";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS = 500;
const PRIORITY = [
  "/",
  "/categories/bouquets",
  "/categories/garlands",
  "/categories/garlands/rose",
  "/categories/garlands/lotus",
  "/categories/garlands/tuberose",
  "/guides/choosing-wedding-garlands",
  "/occasions/wedding",
  "/occasions/birthday",
  "/occasions/anniversary",
  "/categories/pooja-flowers",
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

async function sitemapUrls() {
  const robots = await (await fetch(`${ORIGIN}/robots.txt`)).text();
  const sitemaps = [...robots.matchAll(/^Sitemap:\s*(\S+)/gim)].map((match) => match[1]).filter((url) => url.startsWith(`${ORIGIN}/`));
  const urls = new Set();
  for (const sitemap of sitemaps) {
    const xml = await (await fetch(sitemap)).text();
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(match[1].trim());
  }
  return urls;
}

const listed = await sitemapUrls();
const wanted = flag("--all") ? [...listed] : (value("--urls")?.split(",") ?? PRIORITY).map((path) => new URL(path.trim(), ORIGIN).toString());
const skipped = [];
const urls = [];
for (const url of wanted.slice(0, MAX_URLS)) {
  if (new URL(url).host !== HOST) skipped.push([url, "not the production host"]);
  else if (!listed.has(url)) skipped.push([url, "not in the live sitemaps"]);
  else urls.push(url);
}
// Status check, a few at a time. With --all the sitemap membership is the gate.
if (!flag("--all")) {
  for (const url of [...urls]) {
    const response = await fetch(url, { redirect: "manual" });
    if (response.status !== 200) {
      urls.splice(urls.indexOf(url), 1);
      skipped.push([url, `HTTP ${response.status}`]);
    }
  }
}
if (wanted.length > MAX_URLS) console.log(`Only the first ${MAX_URLS} of ${wanted.length} URLs are considered in one run.`);
for (const [url, reason] of skipped) console.log(`skip  ${url}  (${reason})`);
console.log(`${urls.length} URL(s) to notify:`);
for (const url of urls.slice(0, 40)) console.log(`  ${url}`);
if (urls.length > 40) console.log(`  … and ${urls.length - 40} more`);

const keyLocation = `${ORIGIN}/${KEY}.txt`;
const keyResponse = await fetch(keyLocation);
const keyLive = keyResponse.status === 200 && (await keyResponse.text()).trim() === KEY;
console.log(keyLive ? `Key file is live: ${keyLocation}` : `Key file is NOT live at ${keyLocation} — deploy it before submitting.`);

if (!flag("--submit")) {
  console.log("\nDry run: nothing was sent. Add --submit to notify.");
} else if (!keyLive || urls.length === 0) {
  console.log("\nNothing sent.");
  process.exitCode = 1;
} else {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation, urlList: urls }),
  });
  console.log(`\nIndexNow answered HTTP ${response.status} ${response.statusText} for ${urls.length} URL(s).`);
  console.log(response.status === 200 || response.status === 202 ? "Received. This is a notification, not proof of crawling or indexing." : `Not accepted: ${(await response.text()).slice(0, 300)}`);
  if (response.status !== 200 && response.status !== 202) process.exitCode = 1;
}

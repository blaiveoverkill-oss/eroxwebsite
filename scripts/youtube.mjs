// Reads the channel's public subscriber count (no API key) and writes youtube.json.
// Run by the GitHub Action. If YouTube changes its page or blocks the request, this exits with
// an error and the previous youtube.json stays untouched.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CHANNEL = process.env.YT_CHANNEL || "UCoDs7EzXlKTj_py9_Glq9ZQ";
const URLS = [
  `https://www.youtube.com/channel/${CHANNEL}`,
  `https://www.youtube.com/channel/${CHANNEL}/about`,
  `https://m.youtube.com/channel/${CHANNEL}`,
];
const HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  cookie: "CONSENT=YES+1; SOCS=CAI",
};

const MULT = { "": 1, K: 1e3, M: 1e6, B: 1e9 };
function toNumber(num, suffix) {
  const n = parseFloat(String(num).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * (MULT[(suffix || "").toUpperCase()] || 1)) : null;
}

// exported-style helper: pulls "1.23K subscribers" style text out of the page HTML
export function parseSubscribers(html) {
  const text = String(html);
  const re = /([\d][\d.,]*)\s*([KMB]?)\s*subscribers?/i;
  // prefer the structured field, then fall back to any "N subscribers" text
  const at = text.indexOf('"subscriberCountText"');
  if (at >= 0) {
    const m = text.slice(at, at + 600).match(re);
    if (m) return toNumber(m[1], m[2]);
  }
  const m = text.match(re);
  return m ? toNumber(m[1], m[2]) : null;
}

async function main() {
  let subs = null, lastErr = "";
  for (const url of URLS) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) { lastErr = `${url} -> HTTP ${res.status}`; continue; }
      subs = parseSubscribers(await res.text());
      if (subs != null) break;
      lastErr = `${url} -> no subscriber text found`;
    } catch (e) { lastErr = `${url} -> ${e.message}`; }
  }
  if (subs == null) throw new Error("Could not read subscriber count. " + lastErr);

  const out = { subscribers: subs };
  let old = null;
  if (existsSync("youtube.json")) {
    try { old = JSON.parse(readFileSync("youtube.json", "utf8")); delete old.updated; } catch (e) {}
  }
  if (old && JSON.stringify(old) === JSON.stringify(out)) {
    console.log("No changes");
  } else {
    writeFileSync("youtube.json", JSON.stringify({ updated: new Date().toISOString(), ...out }, null, 2) + "\n");
    console.log("youtube.json updated:", subs);
  }
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

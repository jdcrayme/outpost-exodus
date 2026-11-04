// Decisive geometry check: do the radiator panel bboxes intersect the aft
// tank/stage bboxes in the rendered SVG? (getBoundingClientRect in SVG user
// space via getBBox on the transformed groups.)
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://localhost:3111/", { waitUntil: "networkidle" });
await page.waitForSelector('[aria-label="Skip intro"]', { timeout: 20000 });
await page.locator('[aria-label="Skip intro"]').click();
await page.waitForSelector("text=INITIATE MISSION START SEQUENCE", { timeout: 30000 });
await page.getByRole("button", { name: /INITIATE MISSION START/i }).click();
await page.waitForSelector("text=61 CYGNI A");
await page.getByRole("button", { name: /61 CYGNI A/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /COMMIT DESTINATION/i }).click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /FULL SHIP/i }).click();
await page.waitForTimeout(1600);
const result = await page.evaluate(() => {
  const svg = document.querySelector('svg[aria-label^="General arrangement"]');
  const R = (el) => el.getBoundingClientRect();
  const hit = (a, b) => !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  const panels = [...svg.querySelectorAll("g")].filter((g) => /translate\(168,/.test(g.getAttribute("transform") ?? "")).map(R);
  const tanks = [...svg.querySelectorAll("circle.bp-copper")].map(R);
  const stages = [...svg.querySelectorAll("rect.bp-copper")].map(R);
  const labels = [...svg.querySelectorAll("text.bp-txt")].map(R);
  const overlaps = [];
  panels.forEach((p, i) => {
    tanks.forEach((t, j) => { if (hit(p, t)) overlaps.push(`panel ${i} × tank ${j}`); });
    stages.forEach((r, j) => { if (hit(p, r)) overlaps.push(`panel ${i} × stage ${j}`); });
    labels.forEach((l, k) => { if (hit(p, l)) overlaps.push(`panel ${i} × label ${k} "${labels[k] ? "" : ""}"`); });
  });
  return { panelCount: panels.length, overlaps };
});
console.log(JSON.stringify(result, null, 1));
await browser.close();

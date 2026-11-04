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
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /FULL SHIP/i }).click();
await page.waitForTimeout(1500);
const overflows = await page.evaluate(() => {
  const svg = document.querySelector('svg[aria-label^="General arrangement"]');
  const vb = svg.getAttribute("viewBox").split(" ").map(Number);
  const [x0, y0, w, h] = vb;
  const bad = [];
  svg.querySelectorAll("text").forEach((t) => {
    const b = t.getBBox();
    if (b.x < x0 - 0.5 || b.y < y0 - 0.5 || b.x + b.width > x0 + w + 0.5 || b.y + b.height > y0 + h + 0.5) {
      bad.push({ text: t.textContent.slice(0, 40), x: +b.x.toFixed(1), right: +(b.x + b.width).toFixed(1), y: +b.y.toFixed(1), bottom: +(b.y + b.height).toFixed(1) });
    }
  });
  return { viewBox: vb, count: svg.querySelectorAll("text").length, bad };
});
console.log(JSON.stringify(overflows, null, 1));
await browser.close();

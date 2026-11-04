// Visual smoke test — clicks through to the changed screens and screenshots them.
import { chromium } from "playwright-core";

const BASE = "http://localhost:3111";
const OUT = "/tmp/render";
const exe = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

const browser = await chromium.launch({
  executablePath: exe,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const btn = async (text) => {
  await page.getByRole("button", { name: new RegExp(text, "i") }).first().click();
};

await page.goto(BASE, { waitUntil: "networkidle" });
// INTRO → skip (wait for the button to exist, then click)
await page.waitForSelector('[aria-label="Skip intro"]', { timeout: 20000 });
await page.locator('[aria-label="Skip intro"]').click();
await page.waitForTimeout(1200);

// BOOT → initiate (wait for the button to appear after boot lines)
await page.waitForSelector("text=INITIATE MISSION START SEQUENCE", { timeout: 30000 });
await btn("INITIATE MISSION START");
await page.waitForTimeout(1000);

// STAR → pick 61 CYG (abiotic O2 world in this seed), commit
await page.waitForSelector("text=61 CYGNI A");
await page.getByRole("button", { name: /61 CYGNI A/ }).click();
await page.waitForTimeout(800);
await shot("01-star-dossier");
await btn("COMMIT DESTINATION");
await page.waitForTimeout(1500);

// EQUIP → toggle VLBI + science lander + shipshop, confirm
for (const label of ["VLBI DEEP-SPACE", "SCIENCE LANDER", "SHIPBOARD REMANUFACTURING"]) {
  await page.getByRole("button", { name: new RegExp(label, "i") }).first().click();
  await page.waitForTimeout(400);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
await page.getByRole("button", { name: /FULL SHIP/i }).click();
await page.waitForTimeout(1400); // camera tween
await shot("02-equip-blueprint");
await btn("CONFIRM PAYLOAD");
await page.waitForTimeout(1200);

// CREW → proceed
await btn("PROCEED TO TRANSIT");
await page.waitForTimeout(9000); // let the draw-on complete and counter settle
await page.evaluate(() => window.scrollTo(0, 0));
await shot("03-transit-plate");
await page.waitForTimeout(9000);
await shot("04-transit-magsail-lines");
await page.waitForTimeout(16000);

// PLANET → open the ambiguous world dossier
await page.waitForSelector("text=61CYG-III", { timeout: 30000 });
await page.getByRole("button", { name: /61CYG-III/ }).click();
await page.waitForTimeout(1500);
await shot("05-planet-abiotic");
await btn("DESIGNATE LANDING SITE");
await page.waitForTimeout(1500);
await shot("06-profile");

await browser.close();
console.log("done — screenshots in /tmp/render/");

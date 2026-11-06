// Layout probe — measures document + main overflow at each mission phase across
// viewports, exercises the MANIFEST screen's popups, and screenshots key states.
// Temporary diagnostic script; not part of the project.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3111";
const OUT = "local-shots";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
];

const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({ executablePath: exe });

const measure = (page, label) =>
  page.evaluate((l) => {
    const d = document.documentElement;
    const m = document.querySelector("main");
    const dlg = document.querySelector('[role="dialog"]');
    const dr = dlg ? dlg.getBoundingClientRect() : null;
    return {
      phase: l,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      docOverflowY: d.scrollHeight - window.innerHeight,
      mainOverflowY: m ? m.scrollHeight - m.clientHeight : -1,
      dialog: dr
        ? {
            fits: dr.top >= 0 && dr.bottom <= window.innerHeight && dr.left >= 0 && dr.right <= window.innerWidth,
            h: Math.round(dr.height),
          }
        : null,
    };
  }, label);

const btn = async (page, text) => {
  await page.getByRole("button", { name: new RegExp(text, "i") }).first().click();
};

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  const rows = [];

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  rows.push(await measure(page, "INTRO (title card)"));

  await page.locator('[aria-label="Skip intro"]').click();
  await page.waitForTimeout(1500);
  rows.push(await measure(page, "BOOT (log growing)"));

  await page.waitForSelector("text=INITIATE MISSION START SEQUENCE", { timeout: 30000 });
  rows.push(await measure(page, "BOOT (initiate ready)"));
  await page.screenshot({ path: `${OUT}/boot-${vp.w}x${vp.h}.png` });
  await btn(page, "INITIATE MISSION START");
  await page.waitForTimeout(1000);
  rows.push(await measure(page, "STAR"));

  await page.waitForSelector("text=61 CYGNI A", { timeout: 15000 });
  await page.getByRole("button", { name: /61 CYGNI A/ }).click();
  await page.waitForTimeout(800);
  rows.push(await measure(page, "STAR (dossier open)"));
  await btn(page, "COMMIT DESTINATION");
  await page.waitForTimeout(1500);
  rows.push(await measure(page, "MANIFEST"));
  await page.screenshot({ path: `${OUT}/manifest-${vp.w}x${vp.h}.png` });

  // empty rack cell → stow picker
  await page.locator("rect.bp-cell").first().click();
  await page.waitForTimeout(500);
  rows.push(await measure(page, "MANIFEST (rack picker)"));
  // stow the fuel refinery kit (+130 T)
  await page.locator('[role="dialog"]').getByRole("button", { name: /Stow Fuel Refinery Kit/i }).click();
  await page.waitForTimeout(700);
  rows.push(await measure(page, "MANIFEST (+refinery)"));
  // open the refinery's station popup from the rail manifest, then clear it
  await page.getByRole("button", { name: /Fuel Refinery Kit/i }).first().click();
  await page.waitForTimeout(500);
  rows.push(await measure(page, "MANIFEST (station popup)"));
  await page.screenshot({ path: `${OUT}/manifest-picker-${vp.w}x${vp.h}.png` });
  await btn(page, /CLEAR STATION/);
  await page.waitForTimeout(500);
  rows.push(await measure(page, "MANIFEST (−refinery)"));

  // seed lander: clear must be refused
  await page.getByRole("button", { name: /SEED LANDER/i }).first().click();
  await page.waitForTimeout(500);
  await btn(page, /CLEAR STATION/);
  await page.waitForTimeout(3400); // the refusal line types at ~22 ms/char
  const seedRefused = await page.getByText(/there can be no surface industry/i).count();
  rows.push(await measure(page, "MANIFEST (seed refused)"));
  await page.getByRole("button", { name: /✕ CLOSE/i }).click();

  // bay click → cohort popup → member dossier → back
  await page.getByRole("button", { name: /FULL SHIP/i }).click();
  await page.waitForTimeout(1100);
  await page.locator('title:has-text("BAY C-03")').locator("xpath=..").click();
  await page.waitForTimeout(500);
  rows.push(await measure(page, "MANIFEST (cohort popup)"));
  await page.screenshot({ path: `${OUT}/manifest-cohort-${vp.w}x${vp.h}.png` });
  await page.getByRole("dialog").getByRole("button").first().click();
  await page.waitForTimeout(500);
  rows.push(await measure(page, "MANIFEST (dossier popup)"));
  await page.screenshot({ path: `${OUT}/manifest-dossier-${vp.w}x${vp.h}.png` });
  await btn(page, /BACK TO THE ROSTER/);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /✕ CLOSE/i }).click();
  await page.waitForTimeout(400);
  // watch sphere popup (reset the camera first — it may be parked on the rack)
  await page.getByRole("button", { name: /FULL SHIP/i }).click();
  await page.waitForTimeout(1100);
  await page.locator('title:has-text("COMMAND SPHERE")').locator("xpath=..").click();
  await page.waitForTimeout(400);
  rows.push(await measure(page, "MANIFEST (watch popup)"));
  await page.getByRole("button", { name: /✕ CLOSE/i }).click();
  await page.waitForTimeout(300);

  await btn(page, "COMMIT MANIFEST");
  await page.waitForTimeout(1200);
  rows.push(await measure(page, "TRANSIT"));
  await page.locator('[aria-label="Skip transit"]').click();
  await page.waitForTimeout(1200);
  rows.push(await measure(page, "PLANET"));

  await page.waitForSelector("text=61CYG-III", { timeout: 30000 });
  await page.getByRole("button", { name: /61CYG-III/ }).click();
  await page.waitForTimeout(1200);
  rows.push(await measure(page, "PLANET (dossier open)"));
  await btn(page, "DESIGNATE LANDING SITE");
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  rows.push(await measure(page, "PROFILE"));
  await page.screenshot({ path: `${OUT}/profile-${vp.w}x${vp.h}-viewport.png` });

  const buttonPos = await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((b) =>
      /MISSION START/i.test(b.textContent ?? "")
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), inViewport: r.bottom <= window.innerHeight && r.top >= 0 };
  });

  console.log(`\n=== ${vp.w}x${vp.h} ===`);
  for (const r of rows) {
    const doc = r.docOverflowY > 0 ? `  ⚠ DOC +${r.docOverflowY}` : "";
    const main = r.mainOverflowY > 0 ? `  main-scroll +${r.mainOverflowY}px` : "";
    const dlg = r.dialog ? (r.dialog.fits ? "  [dialog fits]" : "  ⚠ DIALOG OVERFLOWS") : "";
    console.log(`${r.phase.padEnd(30)} doc=${r.docOverflowY}  main=${r.mainOverflowY}${doc}${main}${dlg}`);
  }
  console.log("seed refusal spoken:", seedRefused > 0);
  console.log("mission-start button:", JSON.stringify(buttonPos));
  await page.close();
}

await browser.close();
console.log("\nprobe done");

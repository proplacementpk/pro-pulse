// Checks that a session about to run out is renewed without the person noticing.
// Run the portal with PROPULSE_TEST_TOKEN_SECONDS=30 so every request renews.
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "http://127.0.0.1:3101";
let failed = 0;
const check = (ok, what) => { console.log((ok ? "  ok  " : "  FAIL ") + what); if (!ok) failed++; };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();
const cookie = async () => (await context.cookies()).find((c) => c.name === "pp_session")?.value;
await page.goto(BASE + "/login");
await page.fill("#email", "sana@example.com"); await page.fill("#password", "password2");
await page.click('button[type="submit"]'); await page.waitForURL("**/search");
const first = await cookie();
await page.goto(BASE + "/search?city=Karachi"); await page.waitForLoadState("networkidle");
const second = await cookie();
check(first && second && first !== second, "the session is renewed on the way to the next page");
check((await page.getByTestId("total").innerText()).includes("candidates"), "the page that triggered the renewal still loads its data");
await page.click(".row .name"); await page.waitForURL(/\/candidates\//);
await page.fill('textarea[name="body"]', "Note written right after a renewal.");
await page.click("text=Save note");
await page.waitForFunction(() => document.querySelector(".note p")?.textContent?.startsWith("Note written right after"));
check(true, "saving still works straight after a renewal");
check((await cookie()) !== second && page.url().includes("/candidates/"), "the person stays signed in throughout");
await browser.close();
console.log(failed ? `${failed} FAILED` : "RENEWAL CHECKS PASSED");
process.exit(failed ? 1 : 0);

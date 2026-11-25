// Browser checks for adding a resume, roles, export, email and the admin screen.
import { chromium } from "playwright-core";
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const FAKES = "http://127.0.0.1:54500";
const SHOTS = process.env.SHOTS || "/tmp/web-shots";
const FILES = "/tmp/web-files";
mkdirSync(SHOTS, { recursive: true }); mkdirSync(FILES, { recursive: true });
let passed = 0, failed = 0;
const check = (ok, what) => { if (ok) { passed++; console.log("  ok  " + what); } else { failed++; console.log("  FAIL " + what); } };
const fakeLog = async () => (await fetch(FAKES + "/__log")).json();

const resume = (name, email, extra = "") => `Name: ${name}\nEmail: ${email}\nPhone: +92 321 5557788\nCity: Lahore\nTitle: QA Manager\nCompany: Dairy plant\nEducation: MSc Food Science\nYears: 8\nSkills: HACCP, ISO 22000, Audits, Lab testing\nSummary: Runs quality assurance for a dairy plant.\n${extra}`;
writeFileSync(`${FILES}/Kiran_Fatima_CV.txt`, resume("Kiran Fatima", "kiran.fatima@example.com"));
writeFileSync(`${FILES}/Ayesha_new_CV.txt`, resume("Ayesha Khan", "ayesha.khan@example.com", "Newer version."));
writeFileSync(`${FILES}/scan.pdf`, "%PDF-1.4\n% a small test file\n");
writeFileSync(`${FILES}/notes.exe`, "MZ not a resume");
writeFileSync(`${FILES}/fake.pdf`, "this is not really a pdf");

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on("dialog", (d) => d.accept());
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); };
const signIn = async (email, password) => {
  await go("/login"); await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]'); await page.waitForURL("**/search");
};
const signOut = async () => { await page.click('button[title="Sign out of the portal on this device"]'); await page.waitForURL("**/login"); };
const saved = async () => { await page.waitForURL(/\/candidates\/.*added=1/); await page.waitForSelector(".notice.good"); await page.waitForLoadState("networkidle"); };
const arrive = async (where) => { await page.waitForURL(where); await page.waitForLoadState("networkidle"); };
const flat = (t) => t.replace(/\s+/g, " ");
const toggles = async () => flat(await page.innerText(".toggles"));
const shows = async (text) => page.waitForFunction((t) => (document.querySelector(".toggles")?.innerText || "").replace(/\s+/g, " ").includes(t), text, { timeout: 8000 }).then(() => true, () => false);
const toast = async (text) => page.waitForFunction((t) => [...document.querySelectorAll(".toast")].some((x) => x.textContent.includes(t)), text);
async function sheet(download) {
  const path = `${FILES}/${Date.now()}-${download.suggestedFilename()}`;
  await download.saveAs(path);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  const head = ws.getRow(1).values.slice(1);
  const rows = []; ws.eachRow((r, i) => { if (i > 1) rows.push(r.values.slice(1)); });
  return { name: download.suggestedFilename(), head, rows, ws };
}
const exportVia = async (item) => {
  await page.locator(".menu-box .btn", { hasText: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".menu button", { hasText: item }).click()]);
  return sheet(download);
};

console.log("Adding a resume");
await signIn("sana@example.com", "password2");
check(await page.locator(".nav a").count() === 3 && !(await page.locator(".nav").innerText()).includes("Admin"), "a consultant sees Search, Add resume and Roles, not Admin");
await go("/add");
await page.setInputFiles('input[type="file"]', `${FILES}/notes.exe`);
await page.waitForSelector(".notice.bad");
check((await page.innerText(".notice.bad")).includes("not supported"), "a file that is not a resume type is refused");
await page.setInputFiles('input[type="file"]', `${FILES}/fake.pdf`);
await page.waitForFunction(() => document.querySelector(".notice.bad")?.textContent?.includes("does not match"));
check(true, "a file whose content does not match its type is refused");
writeFileSync(`${FILES}/huge.txt`, "x".repeat(5 * 1024 * 1024));
await page.setInputFiles('input[type="file"]', `${FILES}/huge.txt`);
await page.waitForFunction(() => document.querySelector(".notice.bad")?.textContent?.includes("larger than 4 MB"));
check(true, "a file over the size limit is refused before it is sent");
await page.setInputFiles('input[type="file"]', `${FILES}/Kiran_Fatima_CV.txt`);
await page.waitForSelector("#full_name");
check(await page.inputValue("#full_name") === "Kiran Fatima" && await page.inputValue("#email") === "kiran.fatima@example.com"
      && await page.inputValue("#total_experience_years") === "8" && (await page.inputValue("#skills")).startsWith("HACCP, ISO 22000"),
      "the details read from the resume fill the form");
check(await page.locator('label[for="phone"] .tag.warn').count() === 1 && await page.getByTestId("duplicates").count() === 0, "a detail the AI was unsure of is marked for checking");
await page.screenshot({ path: `${SHOTS}/07-add-review.png` });
await page.fill("#expected_salary", "PKR 380,000"); await page.fill("#city", "Faisalabad");
await page.click('button:has-text("Save candidate")');
await saved();
let body = await page.innerText(".main");
check(body.includes("stored in Google Drive") && body.includes("Kiran Fatima") && body.includes("Faisalabad") && body.includes("PKR 380,000")
      && body.includes("Jan 2020 to Present") && body.includes("MSc Food Science"), "the checked details are saved, with job history and education");
check(!body.includes("must be dropped"), "details the database must not hold are left out");
let log = await fakeLog();
check(log.uploads.length === 1 && log.uploads[0].name === "Kiran Fatima - Kiran_Fatima_CV.txt" && log.folders.length === 2 && /^\d{4}$/.test(log.folders[0]),
      "the file is stored in Google Drive, in a year and month folder " + JSON.stringify(log.folders) + JSON.stringify(log.uploads));
const kiranUrl = page.url().split("?")[0].replace(BASE, "");
const openHref = await page.locator(".line-list a.btn", { hasText: "Open" }).getAttribute("href");
const fileRes = await context.request.get(BASE + openHref);
check(fileRes.status() === 200 && (await fileRes.text()).startsWith("Name: Kiran Fatima") && (fileRes.headers()["content-disposition"] || "").includes("Kiran_Fatima_CV.txt"),
      "Open returns the stored file through the portal");
await go("/search?q=Kiran");
check((await page.locator(".row .name").allInnerTexts()).includes("Kiran Fatima"), "the new candidate is found by search straight away");

await go("/add");
await page.setInputFiles('input[type="file"]', `${FILES}/Ayesha_new_CV.txt`);
await page.waitForSelector('[data-testid="duplicates"]');
check((await page.getByTestId("duplicates").innerText()).includes("Ayesha Khan") && await page.locator("button", { hasText: "Update the profile" }).count() === 1,
      "a resume with a known email offers to update that person instead of adding a second one");
await page.getByText("Only add the file to Ayesha Khan").click();
await page.click('button:has-text("Add the file")');
await saved();
body = await page.innerText(".main");
check(body.includes("Ayesha_new_CV.txt") && body.includes("Ayesha_Khan_CV.pdf") && body.includes("Plant Manager at Dairy processor"), "the file is added and the profile is left as it was");
await go("/add");
await page.setInputFiles('input[type="file"]', `${FILES}/Kiran_Fatima_CV.txt`);
await page.waitForSelector('[data-testid="duplicates"]');
check((await page.getByTestId("duplicates").innerText()).includes("Kiran Fatima"), "the same file again is recognised");
await page.getByText("Only add the file to Kiran Fatima").click(); await page.click('button:has-text("Add the file")');
await page.waitForFunction(() => document.querySelector(".notice.bad")?.textContent?.includes("already on that profile"));
check(true, "the same file is not stored twice on one profile");
await go("/add");
await page.setInputFiles('input[type="file"]', `${FILES}/scan.pdf`);
await page.waitForSelector("#full_name");
check(await page.inputValue("#full_name") === "Pdf Person", "a PDF is read too");

writeFileSync(`${FILES}/Zara_Sheikh_CV.txt`, resume("Zara Sheikh", "zara.sheikh@example.com"));
await fetch(FAKES + "/__break?what=drive");
await go("/add");
await page.setInputFiles('input[type="file"]', `${FILES}/Zara_Sheikh_CV.txt`);
await page.waitForSelector("#full_name");
await page.click('button:has-text("Save candidate")');
await arrive(/\/candidates\/.*added=nofile/);
await page.waitForSelector(".notice.warn");
check((await page.innerText(".notice.warn")).includes("the file itself was not stored") && (await page.innerText("h1")).includes("Zara Sheikh"),
      "when Google Drive fails, the details are still saved and the person is told the file was not stored");
await fetch(FAKES + "/__break?what=");

console.log("Roles");
await go("/roles");
check((await page.getByTestId("roles-total").innerText()).startsWith("3 roles") && (await page.innerText(".main")).includes("Sana Malik") && (await page.innerText(".main")).includes("Farah Siddiqui"),
      "the roles list shows each role with its consultant");
check(!(await page.innerText(".main")).toLowerCase().includes("opening"), "there is no openings number");
await page.screenshot({ path: `${SHOTS}/08-roles.png` });
await page.click("text=My roles"); await arrive(/whose=mine/);
check((await page.getByTestId("roles-total").innerText()).startsWith("2 roles"), "My roles lists the two assigned to this consultant");
await go("/roles/new");
check(await page.locator("#assigned_to").inputValue() !== "" && (await page.locator("#assigned_to option").allInnerTexts()).some((t) => t.includes("Farah Siddiqui (admin)")),
      "a new role picks its consultant from the users, starting with yourself");
await page.fill("#title", "QA Manager, Lahore"); await page.fill("#department", "Quality"); await page.fill("#location", "Lahore");
await page.fill("#description", "Leads quality assurance."); await page.click("text=Create role");
await arrive(/\/roles\/[0-9a-f-]{36}$/);
check(await page.innerText("h1") === "QA Manager, Lahore" && (await page.innerText(".page-head .sub")).includes("Consultant: Sana Malik"), "the role is created and opens");
const qaRole = page.url();
await page.click("text=Edit role"); await arrive(/\/edit$/);
await page.selectOption("#status", "On hold"); await page.click("text=Save role"); await arrive(qaRole);
check((await page.innerText(".page-head")).includes("On hold"), "a role can be edited");

await go("/roles"); await page.click("text=Plant Manager, Karachi"); await arrive(/\/roles\//);
check(await page.locator(".member").count() === 4 && (await toggles()).includes("Interview 1") && (await toggles()).includes("Added 2"),
      "inside a role, everyone is listed with a count per stage");
await page.screenshot({ path: `${SHOTS}/09-role.png` });
await page.locator(".toggle", { hasText: "Added" }).click();
check(await page.locator(".member").count() === 2, "a stage can be hidden from the list");
await page.locator(".toggle", { hasText: "All stages" }).click();
check(await page.locator(".member").count() === 4, "All stages brings everyone back");
await page.locator(".member", { hasText: "Hina Raza" }).locator("select").selectOption({ label: "Evaluated" });
await toast("Moved to Evaluated");
check(await shows("Evaluated 1"), "one candidate is moved by choosing a stage on their line");
await page.getByLabel("Select everyone listed").check();
check(await page.getByTestId("selected").innerText() === "4 selected", "Select all ticks everyone listed");
await page.click("text=Clear selection");
check(await page.getByTestId("selected").count() === 0, "Clear selection unticks them");
await page.getByLabel("Select Usman Tariq").check(); await page.getByLabel("Select Hina Raza").check();
await page.locator('.bar select').selectOption({ label: "Selected" }); await page.getByRole("button", { name: "Move", exact: true }).click();
await toast("2 moved to Selected");
check(await shows("Selected 2"), "the ticked candidates are moved together");
await page.locator(".member", { hasText: "Ayesha Khan" }).locator("button", { hasText: "Notes" }).click();
check((await page.innerText(".member-notes")).includes("Spoke on the phone"), "notes written for this role are shown on the candidate's line");
await page.fill('.member-notes textarea', "Second interview booked for Friday."); await page.click(".member-notes >> text=Save note");
await page.waitForFunction(() => document.querySelector(".member-notes")?.textContent?.includes("Second interview booked"));
check(true, "a note can be added inside the role");

let x = await exportVia("Excel sheet");
check(x.rows.length === 2 && x.rows.every((r) => r[1] === "Selected"), "with candidates ticked in a role, the sheet holds only them");
await page.click("text=Clear selection");
x = await exportVia("Excel sheet");
check(x.name === "Plant Manager Karachi.xlsx" && x.head[0] === "Name" && x.head[1] === "Stage" && x.rows.length === 4 && !x.head.includes("Roles and stages"),
      "the role sheet has every candidate with the Stage beside the name");
check(x.rows.find((r) => r[0] === "Ayesha Khan")[1] === "Interview" && Object.keys(x.ws.tables || {}).length === 1, "each row carries the right stage, in an Excel table with filter buttons");
await page.locator(".toggle", { hasText: "Selected" }).click();
x = await exportVia("Excel sheet");
check(x.rows.length === 2 && x.rows.every((r) => r[1] !== "Selected"), "the export follows the stages on screen");
await page.locator(".toggle", { hasText: "All stages" }).click();
await page.locator(".menu-box .btn", { hasText: "Export" }).click(); await page.locator(".menu button", { hasText: "Choose columns" }).click();
check(await page.locator('.dialog input[value="stage"]').isChecked() && !(await page.locator('.dialog input[value="skills"]').isChecked()), "Stage is ticked in advance when choosing columns inside a role");
await page.locator('.dialog input[value="skills"]').check(); await page.locator('.dialog input[value="phone"]').uncheck();
const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".dialog >> text=Download sheet")]);
x = await sheet(dl);
check(x.head.includes("Skills") && x.head.includes("Stage") && !x.head.includes("Phone"), "a sheet with chosen columns has exactly those columns");
await page.locator(".menu-box .btn", { hasText: "Export" }).click(); await page.locator(".menu button", { hasText: "Email this list" }).click();
check((await page.innerText(".dialog")).includes("sent to your own address, sana@example.com") && await page.locator("#others").count() === 0, "a consultant's list can only go to their own address");
await fetch(FAKES + "/__break?what=brevo");
await page.click(".dialog >> text=Send");
await page.waitForFunction(() => document.querySelector(".dialog .notice")?.textContent?.length > 5);
check(/not verified|could not be sent|Brevo/i.test(await page.innerText(".dialog .notice")), "when the email service refuses, the reason is shown and nothing is claimed as sent: " + (await page.innerText(".dialog .notice")).slice(0, 90));
await fetch(FAKES + "/__break?what=");
await page.fill("#message", "Shortlist for Monday."); await page.click(".dialog >> text=Send");
await toast("Sent to sana@example.com");
log = await fakeLog();
const mail = log.mails.at(-1);
check(mail.to.join() === "sana@example.com" && mail.subject === "Plant Manager, Karachi" && mail.attachment === "Plant Manager Karachi.xlsx" && mail.bytes > 4000
      && mail.html.includes("Shortlist for Monday.") && mail.sender.email === "desk@example.com", "the email carries the sheet, the message and the sender set in the desktop app");
await page.getByLabel("Select Bilal Ahmed").check(); await page.getByRole("button", { name: "Remove", exact: true }).click();
await toast("Removed 1 from this role");
await page.waitForFunction(() => document.querySelectorAll(".member").length === 3, null, { timeout: 8000 }).catch(() => {});
check(await page.locator(".member").count() === 3, "a consultant can take a candidate out of a role");
check(await page.locator('button[aria-label="More: delete this role"]').count() === 0, "a consultant has no Delete on a role");

console.log("Export from Search");
await go("/search?city=Karachi");
const karachi = Number((await page.getByTestId("total").innerText()).replace(/[^\d]/g, ""));
x = await exportVia("Excel sheet");
check(x.rows.length === karachi && x.head.includes("Roles and stages") && !x.head.includes("Stage"), `with nothing ticked the sheet holds the whole result (${karachi}), with roles and stages`);
check(x.rows.find((r) => r[0] === "Ayesha Khan")[x.head.indexOf("Roles and stages")].includes("Plant Manager, Karachi: Interview"), "the sheet says where each candidate stands");
await page.locator('.row input[type="checkbox"]').nth(0).check(); await page.locator('.row input[type="checkbox"]').nth(1).check();
x = await exportVia("Excel sheet");
check(x.rows.length === 2, "with candidates ticked, only they are exported");
await go(kiranUrl);
check(await page.locator('button[aria-label="More: delete this candidate"]').count() === 0, "a consultant has no Delete on a profile");
await go("/admin");
check((await page.innerText(".main")).includes("That page is not here"), "the admin screen does not exist for a consultant");
await signOut();

console.log("Admin");
await signIn("farah@example.com", "password1");
check((await page.locator(".nav").innerText()).includes("Admin") && await page.locator(".who .role").innerText() === "Admin", "an admin sees the Admin screen in the side bar");
await go("/admin");
await page.screenshot({ path: `${SHOTS}/10-admin.png`, fullPage: true });
const omar = page.locator('tr[data-user="omar@example.com"]');
check(await omar.locator('input[type="checkbox"]').isChecked() === false && await page.locator('tr[data-user="farah@example.com"] select').isDisabled(), "users are listed; your own account cannot be switched off or demoted");
await omar.locator('input[type="checkbox"]').click(); await toast("Saved");
await page.waitForFunction(() => document.querySelector('tr[data-user="omar@example.com"] input[type="checkbox"]')?.checked);
check(true, "an account is switched on from the portal");
await omar.locator("select").selectOption("admin"); await page.waitForTimeout(600);
await omar.locator("select").selectOption("consultant"); await page.waitForTimeout(600);
await page.fill("#u-name", "Nadia Khan"); await page.fill("#u-email", "nadia@example.com"); await page.fill("#u-password", "short");
await page.click("text=Add user"); await page.waitForTimeout(300);
check(await page.locator("#u-password:invalid").count() === 1, "a short password is not accepted");
await page.fill("#u-password", "welcome-2026"); await page.click("text=Add user");
await page.waitForFunction(() => document.querySelector(".notice.good")?.textContent?.includes("Nadia Khan can sign in now"));
check(await page.locator('tr[data-user="nadia@example.com"] input[type="checkbox"]').isChecked(), "a user is added and switched on from the portal");

await page.click("text=Add stage");
await page.locator('.stage-edit input[placeholder="Stage name"]').last().fill("Offer made");
await page.locator(".stage-edit").last().locator('button[aria-label="Move up"]').click();
await page.click("text=Save stages");
await page.waitForFunction(() => [...document.querySelectorAll(".notice.good")].some((n) => n.textContent.includes("Stages saved")));
await go("/roles"); await page.click("text=Plant Manager, Karachi"); await arrive(/\/roles\//);
const order = (await page.locator(".toggle").allInnerTexts()).map((t) => flat(t).replace(/\s*\d+$/, "").trim());
check(order.includes("Offer made") && order.indexOf("Offer made") === order.indexOf("Rejected") - 1, "a new stage is saved in the order chosen: " + order.join(", "));
await go("/admin");
for (const [kind, words] of [["gemini", "Resumes are read with gemini-flash-latest"], ["drive", 'shared drive "Propulse Resumes"'], ["brevo", "Emails are sent from desk@example.com"]]) {
  await page.locator(".check-row", { hasText: kind === "gemini" ? "Gemini" : kind === "drive" ? "Google Drive" : "Brevo" }).locator("button").click();
  await page.waitForSelector(`[data-check="${kind}"]`);
  check((await page.innerText(`[data-check="${kind}"]`)).includes(words), `the ${kind} connection test reports what it found`);
}

await go("/roles"); await page.click("text=Plant Manager, Karachi"); await arrive(/\/roles\//);
await page.locator(".menu-box .btn", { hasText: "Export" }).click(); await page.locator(".menu button", { hasText: "Email this list" }).click();
await page.locator(".dialog .check", { hasText: "Sana Malik" }).locator("input").check();
await page.fill("#others", "client@example.org"); await page.click(".dialog >> text=Send");
await toast("Sent to sana@example.com, client@example.org");
log = await fakeLog();
check(log.mails.at(-1).to.join() === "sana@example.com,client@example.org", "an admin ticks people from the team and can add other addresses");
await page.locator(".menu-box .btn", { hasText: "Export" }).click(); await page.locator(".menu button", { hasText: "Email this list" }).click();
await page.fill("#others", "not-an-address"); await page.click(".dialog >> text=Send");
await page.waitForFunction(() => document.querySelector(".dialog .notice")?.textContent?.includes("is not an email address"));
check(true, "a wrong address is refused before anything is sent");
await page.click(".dialog >> text=Cancel");

await go(kiranUrl);
await page.click('button[aria-label="More: delete this candidate"]'); await page.click("text=Delete this candidate");
await arrive(/\/search\?deleted=1/);
await go("/search?q=Kiran");
check(!(await page.locator(".row .name").allInnerTexts()).includes("Kiran Fatima"), "an admin can delete a candidate");
await go(qaRole.replace(BASE, ""));
await page.click('button[aria-label="More: delete this role"]'); await page.click("text=Delete this role");
await arrive(/\/roles\?deleted=1/);
check((await page.getByTestId("roles-total").innerText()).startsWith("3 roles") && !(await page.innerText(".main")).includes("QA Manager, Lahore"), "an admin can delete a role");
await signOut();
await go("/login"); await page.fill("#email", "omar@example.com"); await page.fill("#password", "password3"); await page.click('button[type="submit"]');
await arrive("**/search");
check(true, "the account the admin switched on can now sign in");
check(errors.length === 0, "no errors in the browser (" + errors.slice(0, 2).join(" | ") + ")");

await browser.close();
console.log(failed ? `\n${failed} CHECK(S) FAILED, ${passed} passed` : `\nALL ${passed} WEB CHECKS PASSED (resumes, roles, export, admin)`);
process.exit(failed ? 1 : 0);

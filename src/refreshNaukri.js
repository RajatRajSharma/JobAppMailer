// Toggles a trailing dot on your Naukri "Resume headline" (add if missing, remove if present),
// then reads the profile's last-modified time (dashboard.mod_dt) from Naukri's own API call.
// Used by getEmails.js (runs first), or on its own with `npm run refresh`.
const readline = require('readline');
const { chromium } = require('playwright');

const PROFILE_URL = 'https://www.naukri.com/mnjuser/profile';
const HOME_URL = 'https://www.naukri.com/mnjuser/homepage';
const DASHBOARD_API = '/resman-aggregator-services/v0/users/self/dashboard';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ask = (q) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
};

// Open the profile page and return dashboard.mod_dt from the dashboard API response
async function readModDate(page) {
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(DASHBOARD_API), { timeout: 20000 }),
    page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded' }),
  ]);
  const json = await resp.json();
  return (json?.dashBoard ?? json?.dashboard)?.mod_dt ?? 'not found in API response';
}

async function refreshProfile(page) {
  console.log('\nNaukri: refreshing resume headline');

  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  if (/login|nlogin/.test(page.url())) {
    await ask('Log in to Naukri (Google login) in the Chrome window, then press ENTER here... ');
  }

  const before = await readModDate(page);
  console.log(`  Last updated before: ${before}`);
  await page.waitForSelector('#lazyResumeHead', { timeout: 20000 });

  await page.locator('#lazyResumeHead span.edit.icon').click({ timeout: 10000 });
  const box = page.locator('textarea#resumeHeadlineTxt');
  await box.waitFor({ timeout: 10000 });

  const trimmed = (await box.inputValue()).trimEnd();
  let updated, action;
  if (trimmed.endsWith('.')) { updated = trimmed.slice(0, -1); action = 'REMOVED'; }
  else { updated = trimmed + '.'; action = 'ADDED'; }

  await box.fill(updated);
  await page.locator('form[name="resumeHeadlineForm"] button[type="submit"]').click({ timeout: 10000 });
  await sleep(4000);
  console.log(`  Dot ${action} at the end of your Naukri resume headline.`);

  const after = await readModDate(page);
  console.log(`  Last updated now:    ${after}`);
  return after;
}

module.exports = { refreshProfile };

if (require.main === module) {
  (async () => {
    let browser;
    try {
      browser = await chromium.connectOverCDP('http://localhost:9222');
    } catch {
      console.error('Cannot reach Chrome on port 9222. Run `npm run chrome` first.');
      process.exit(1);
    }
    const page = await browser.contexts()[0].newPage();
    try {
      await refreshProfile(page);
    } catch (err) {
      console.error('Could not update the headline:', err.message.split('\n')[0]);
      process.exitCode = 1;
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  })();
}

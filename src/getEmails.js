const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');
const config = require('../config/search.config');
const { refreshProfile } = require('./refreshNaukri');

const RESULT_FILE = path.join(__dirname, '..', 'result.json');

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const JUNK_DOMAINS = ['linkedin.com', 'licdn.com', 'naukri.com', 'example.com', 'sentry.io', 'w3.org'];
const JUNK_EXT = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const humanPause = (a = 1500, b = 3500) => sleep(rand(a, b));
const slug = (s) => s.toLowerCase().trim().replace(/\s+/g, '-');

function extractEmails(text) {
  const found = (text || '').match(EMAIL_RE) || [];
  return found
    .map((e) => e.toLowerCase().replace(/^[.\-_]+|[.\-_]+$/g, ''))
    .filter((e) => !JUNK_EXT.test(e) && !JUNK_DOMAINS.some((d) => e.endsWith('@' + d) || e.endsWith('.' + d)));
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a); }));
}

async function ensureLoggedIn(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await humanPause();
  if (/login|authwall|checkpoint|signup/.test(page.url())) {
    console.log('\nNot logged in. Log in to LinkedIn in the opened browser window.');
    await ask('Press ENTER here once you are on your LinkedIn feed... ');
  }
}

// LinkedIn boolean query: "Node.js" OR NodeJS OR "Node JS"
const orQuery = (kw) =>
  kw.variants.map((v) => (/[\s.]/.test(v) ? `"${v}"` : v)).join(' OR ');

// ---------- URL builders (time window comes from config.hoursBack) ----------
function jobsUrl(keyword, location) {
  const p = new URLSearchParams({
    keywords: orQuery(keyword),
    location,
    f_TPR: `r${Math.round(config.hoursBack * 3600)}`,
    sortBy: 'DD',
  });
  return `https://www.linkedin.com/jobs/search/?${p}`;
}

function postsUrl(keyword, location) {
  const h = config.hoursBack;
  const datePosted = h <= 24 ? 'past-24h' : h <= 168 ? 'past-week' : 'past-month';
  const p = new URLSearchParams({
    keywords: `hiring (${orQuery(keyword)}) ${location}`,
    datePosted: `"${datePosted}"`,
    sortBy: '"date_posted"',
  });
  return `https://www.linkedin.com/search/results/content/?${p}`;
}

// ---------- LinkedIn jobs: open each card, read description ----------
async function scrapeJobs(page, keyword, location) {
  const emails = new Set();
  await page.goto(jobsUrl(keyword, location), { waitUntil: 'domcontentloaded' });
  await humanPause(3000, 5000);

  const cardSel = 'li[data-occludable-job-id], .job-card-container';
  let opened = 0;
  while (opened < config.maxJobsPerSearch) {
    if (page.isClosed()) { console.log('  LinkedIn tab was closed, keeping what was found so far'); break; }
    const count = await page.locator(cardSel).count();
    if (opened >= count) {
      await page.mouse.wheel(0, 3000);
      await humanPause();
      if ((await page.locator(cardSel).count()) <= count) break;
      continue;
    }
    // re-find the card by index each time; LinkedIn re-renders the list and old handles go stale
    const card = page.locator(cardSel).nth(opened++);
    try {
      await card.scrollIntoViewIfNeeded({ timeout: 5000 });
      await card.click({ timeout: 5000 });
      await humanPause(1500, 3000);
      const text = await page.evaluate(() => {
        const el = document.querySelector('#job-details') ||
          document.querySelector('.jobs-search__job-details--container') ||
          document.querySelector('.jobs-description');
        return el ? el.innerText : '';
      });
      extractEmails(text).forEach((e) => emails.add(e));
    } catch (err) {
      console.log(`  skip card ${opened}: ${err.message.split('\n')[0]}`);
    }
  }
  console.log(`  [linkedin jobs]  ${keyword.text} / ${location}: ${opened} jobs -> ${emails.size} emails`);
  return emails;
}

// ---------- LinkedIn posts: people who posted "we are hiring ... mail CV to x@y.com" ----------
async function scrapePosts(page, keyword, location) {
  const emails = new Set();
  await page.goto(postsUrl(keyword, location), { waitUntil: 'domcontentloaded' });
  await humanPause(3000, 5000);
  for (let i = 0; i < config.maxPostScrolls; i++) {
    for (const b of await page.$$('button:has-text("see more"), button:has-text("…more")')) {
      await b.click({ timeout: 500 }).catch(() => {});
    }
    await page.mouse.wheel(0, 2500);
    await humanPause(2000, 4000);
  }
  const text = await page.evaluate(() => document.body.innerText);
  extractEmails(text).forEach((e) => emails.add(e));
  console.log(`  [linkedin posts] ${keyword.text} / ${location}: ${emails.size} emails`);
  return emails;
}

// ---------- Naukri: collect job links from result pages, open each, read text ----------
async function scrapeNaukri(page, keyword, location) {
  const emails = new Set();
  const days = Math.max(1, Math.ceil(config.hoursBack / 24)); // Naukri jobAge is in days
  const links = new Set();

  for (let p = 1; p <= config.naukri.maxPages; p++) {
    const url = `https://www.naukri.com/${slug(keyword.text)}-jobs-in-${slug(location)}${p > 1 ? '-' + p : ''}?jobAge=${days}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await humanPause(3000, 5000);
    const hrefs = await page.$$eval('a.title, a[href*="/job-listings-"]', (as) => as.map((a) => a.href));
    const before = links.size;
    hrefs.forEach((h) => links.add(h.split('?')[0]));
    if (links.size === before) break; // no new jobs on this page
  }

  const list = [...links].slice(0, config.maxJobsPerSearch);
  for (const link of list) {
    if (page.isClosed()) break;
    try {
      await page.goto(link, { waitUntil: 'domcontentloaded' });
      await humanPause(1500, 3000);
      const text = await page.evaluate(() => document.body.innerText);
      extractEmails(text).forEach((e) => emails.add(e));
    } catch (err) {
      console.log(`  skip naukri job: ${err.message.split('\n')[0]}`);
    }
  }
  console.log(`  [naukri]         ${keyword.text} / ${location}: ${list.length} jobs -> ${emails.size} emails`);
  return emails;
}

// ---------- Hacker News "Who is hiring?" (public API) ----------
async function scrapeHackerNews() {
  const emails = new Set();
  const { keywords } = config.hackerNews;
  const get = async (u) => (await fetch(u)).json();

  const stories = await get(
    'https://hn.algolia.com/api/v1/search_by_date?query=%22Who%20is%20hiring%22&tags=story,author_whoishiring&hitsPerPage=3'
  );
  const story = stories.hits.find((h) => /who is hiring/i.test(h.title));
  if (!story) return emails;

  const data = await get(
    `https://hn.algolia.com/api/v1/search?tags=comment,story_${story.objectID}&hitsPerPage=1000`
  );
  const re = new RegExp(keywords.join('|'), 'i');
  for (const c of data.hits) {
    const text = (c.comment_text || '').replace(/<[^>]+>/g, ' ').replace(/&#x2F;/g, '/');
    if (re.test(text)) extractEmails(text).forEach((e) => emails.add(e));
  }
  console.log(`  [hn] "${story.title}" -> ${emails.size} emails`);
  return emails;
}

async function main() {
  const results = {};
  const seen = new Set(); // global uniqueness: an email appears in only one array

  const add = (key, set) => {
    results[key] = results[key] || [];
    for (const e of set) {
      if (!seen.has(e)) { seen.add(e); results[key].push(e); }
    }
  };

  // Save after every step so nothing is lost if something fails later
  const save = () => {
    const out = {
      generatedAt: new Date().toISOString(),
      generatedAtLocal: new Date().toLocaleString(),
      hoursBack: config.hoursBack,
      ...results,
      totalUnique: seen.size,
    };
    fs.writeFileSync(RESULT_FILE, JSON.stringify(out, null, 2));
  };

  // Run one source; a failure only skips that source
  const step = async (key, label, fn) => {
    try { add(key, await fn()); }
    catch (err) { console.log(`  ${label} failed: ${err.message.split('\n')[0]}`); }
    save();
  };

  // Attach to your own real Chrome (started with `npm run chrome`), so Google login works.
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch {
    console.error('Cannot reach Chrome on port 9222. Run `npm run chrome` first, log in to LinkedIn, then run this again.');
    process.exit(1);
  }
  const context = browser.contexts()[0];
  const page = await context.newPage(); // dedicated tab
  await page.bringToFront();

  try {
    // Naukri profile refresh comes first, then everything else
    if (config.naukri.refreshProfile) {
      try { await refreshProfile(page); }
      catch (err) { console.log('  Naukri profile refresh failed:', err.message.split('\n')[0]); }
    }

    await ensureLoggedIn(page);

    if (config.linkedin.jobs || config.linkedin.posts) {
      for (const kw of config.keywords) {
        for (const loc of config.locations) {
          if (page.isClosed()) break;
          console.log(`\nLinkedIn: ${kw.text} in ${loc}`);
          if (config.linkedin.jobs) await step(kw.key, '[linkedin jobs]', () => scrapeJobs(page, kw, loc));
          if (page.isClosed()) break;
          await humanPause(3000, 6000);
          if (config.linkedin.posts) await step(kw.key, '[linkedin posts]', () => scrapePosts(page, kw, loc));
          await humanPause(3000, 6000);
        }
      }
    }

    if (config.naukri.enabled && !page.isClosed()) {
      await page.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded' });
      await ask('\nNaukri: log in to Naukri in the Chrome window if you want (optional), then press ENTER here... ');
      for (const kw of config.keywords) {
        for (const loc of config.locations) {
          if (page.isClosed()) break;
          console.log(`\nNaukri: ${kw.text} in ${loc}`);
          await step(kw.key, '[naukri]', () => scrapeNaukri(page, kw, loc));
        }
      }
    }
  } catch (err) {
    console.log('Browser part stopped:', err.message.split('\n')[0]);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {}); // only disconnects; your Chrome stays open
  }

  if (config.hackerNews.enabled) {
    console.log('\nHacker News');
    await step('hackerNews', '[hn]', scrapeHackerNews);
  }

  save();
  console.log(`\nDone. ${seen.size} unique emails saved to result.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });

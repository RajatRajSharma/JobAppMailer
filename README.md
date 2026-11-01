# JobAppMailer

Two scripts:

1. **`npm run collect`** – finds recruiter / hiring emails and saves them to `result.json`
2. **`npm run send`** – emails your resume to every address in `result.json` (never the same address twice)

## How it works

```
 LinkedIn jobs (24h) ─┐
 LinkedIn posts (24h) ┼─► extract emails ─► dedupe ─► result.json ─► sendEmails ─► Gmail ─► recruiters
 Hacker News hiring  ─┘                                                  │
                                                                         └─► sent.json (skip next time)
```

### Email sources

| # | Source | Status | Why it gives emails |
|---|--------|--------|---------------------|
| 1 | **LinkedIn Jobs** – "Javascript Developer" (on-site/hybrid) and "react Developer", past 24h | Built | Some job descriptions contain "send CV to x@company.com". LinkedIn hides recruiters' own emails, so only a minority of jobs yield one. |
| 2 | **LinkedIn Posts** – "hiring <keywords>", past 24h | Built | Recruiters often post "DM or email your resume to ...". Usually the best LinkedIn yield. |
| 3 | **Hacker News "Who is hiring?"** (public API, no login) | Built | Monthly thread, many posts include a direct hiring email. Not limited to 24h. |
| 4 | Google dorks, e.g. `"hiring" "react developer" "@gmail.com"` / `site:linkedin.com/posts` | Possible | Finds posts/pages LinkedIn search misses. Google blocks bots, so best done by hand or via a search API. |
| 5 | Company career / "contact" pages | Possible | Good for `careers@` / `hr@` addresses; one scraper per site. |
| 6 | Other job boards (Naukri, Indeed, Wellfound, RemoteOK, WeWorkRemotely, Telegram/WhatsApp job groups) | Possible | RemoteOK and WeWorkRemotely have public feeds; Naukri/Indeed block scrapers. |
| 7 | Email-finder services (Hunter.io, Apollo, RocketReach) | Possible, paid/limited free tier | Guess a recruiter's work email from name + company. |

Add or change searches in [config/search.config.js](config/search.config.js).

## Setup

```bash
npm install
npm run setup            # downloads the Chromium browser used for LinkedIn
copy .env.example .env   # then fill GMAIL_APP_PASSWORD
```

1. Put your resume at `resume/resume.pdf`.
2. Edit [config/email.config.js](config/email.config.js): your email, subject, body, delays.
3. Gmail needs an **App Password** (Google Account → Security → 2-Step Verification → App passwords). Your normal password won't work.

## Run

```bash
npm run collect     # opens a browser. First time: log in to LinkedIn, press ENTER in terminal
npm run send:dry    # preview who would get a mail, sends nothing
npm run send        # sends for real
```

Your LinkedIn login is kept in `.browser-profile/`, so later runs don't need a login.

### `result.json` shape

```json
{
  "generatedAt": "2026-11-01T10:00:00.000Z",
  "generatedAtLocal": "11/1/2026, 3:30:00 PM",
  "javascriptDeveloper": ["a@x.com", "b@y.com"],
  "reactDeveloper": ["c@z.com"],
  "hackerNews": ["d@w.com"],
  "totalUnique": 4
}
```

Each email appears in exactly one array.

## Things to know (please read)

- **LinkedIn's terms forbid automated scraping.** Your account can be warned or restricted. The script runs in a visible browser with random pauses and low volume to stay gentle, but the risk is yours. Use a modest number of runs (about once a day).
- LinkedIn changes its page layout often; if jobs return 0 emails, the selectors in `src/getEmails.js` may need updating.
- Expect roughly 5–40 emails per run, not hundreds.
- Cold mail limits: `maxPerRun` (40) and a 30–90s random delay between mails keep Gmail from flagging you as spam. Don't raise them much.
- Emails found are whatever was publicly written in posts; some will be `info@` / `support@` addresses. Skim `result.json` before sending.
- Keep the body short and honest; recruiters in some regions (EU/UK) are covered by anti-spam rules, so send to people who actually advertised a job.

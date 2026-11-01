require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const mail = require('../config/email.config');

const ROOT = path.join(__dirname, '..');
const RESULT_FILE = path.join(ROOT, 'result.json');
const SENT_FILE = path.join(ROOT, 'sent.json');
const DRY = process.argv.includes('--dry');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

function loadJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

async function main() {
  const result = loadJson(RESULT_FILE, null);
  if (!result) throw new Error('result.json not found. Run `npm run collect` first.');

  const reserved = new Set(['generatedAt', 'generatedAtLocal', 'totalUnique']);
  const all = [...new Set(Object.entries(result)
    .filter(([k, v]) => !reserved.has(k) && Array.isArray(v))
    .flatMap(([, v]) => v))];

  const sent = loadJson(SENT_FILE, {});
  const todo = all.filter((e) => !sent[e]).slice(0, mail.maxPerRun);
  console.log(`${all.length} emails in result.json, ${all.length - Object.keys(sent).length} not yet sent, sending ${todo.length}${DRY ? ' (DRY RUN)' : ''}`);
  if (!todo.length) return;

  const resumePath = path.resolve(ROOT, mail.resumePath);
  if (!fs.existsSync(resumePath)) throw new Error(`Resume not found at ${resumePath}`);

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const attachmentName = `${mail.attachmentBaseName}_${dd}_${mm}.pdf`;
  console.log(`Attachment name: ${attachmentName}`);

  let transporter;
  if (!DRY) {
    if (!process.env.GMAIL_APP_PASSWORD) throw new Error('Set GMAIL_APP_PASSWORD in .env');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER || mail.from, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.verify();
  }

  for (let i = 0; i < todo.length; i++) {
    const to = todo[i];
    process.stdout.write(`[${i + 1}/${todo.length}] ${to} ... `);
    if (DRY) { console.log('would send'); continue; }
    try {
      await transporter.sendMail({
        from: `"${mail.fromName}" <${mail.from}>`,
        to,
        subject: mail.subject,
        text: mail.body,
        attachments: [{ filename: attachmentName, path: resumePath }],
      });
      sent[to] = new Date().toISOString();
      fs.writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2));
      console.log('sent');
    } catch (err) {
      console.log('FAILED:', err.message);
    }
    if (i < todo.length - 1) await sleep(rand(mail.delaySecondsMin, mail.delaySecondsMax) * 1000);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

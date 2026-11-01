// Starts your real Chrome with a debug port so getEmails.js can use it.
// Uses its own profile folder (.browser-profile) so your login is remembered after the first time.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];
const chrome = candidates.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('Chrome not found. Install Google Chrome or edit src/openChrome.js with its path.');
  process.exit(1);
}

const profile = path.join(__dirname, '..', '.browser-profile');
spawn(chrome, [
  '--remote-debugging-port=9222',
  `--user-data-dir=${profile}`,
  'https://www.linkedin.com/login',
], { detached: true, stdio: 'ignore' }).unref();

console.log('Chrome opened. Log in to LinkedIn there (Google login works). Keep that window open.');

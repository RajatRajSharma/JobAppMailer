// Edit this file to change what gets sent. No code changes needed elsewhere.
module.exports = {
  from: 'sharmarajatraj1@gmail.com',
  fromName: 'Rajat Sharma',

  subject: 'JavaScript / React / Node.js Developer who can start contributing quickly',

  // Plain-text body, written from the company's point of view: what you get by hiring me.
  // TODO: replace the bracketed parts with real facts from your resume (years, products, numbers).
  body: `Hi,

I saw your hiring post and wanted to reach out directly.

Here is what I can bring to your team:
- Production-ready front-end work in React and modern JavaScript: fast, clean, maintainable UIs.
- Back-end and API development in Node.js, so I can own a feature end to end instead of waiting on hand-offs.
- [X years] of hands-on experience shipping [type of products] - I can ramp up quickly and need little supervision.
- A focus on delivering working features on time and writing code your team can easily build on.

My resume is attached. If there is a fit, I'd be happy to do a quick call or a small task so you can see my work.

Thanks for your time,
Rajat Sharma
sharmarajatraj1@gmail.com`,

  // Resume attached to every mail.
  // The attachment is sent as <attachmentBaseName>_DD_MM.pdf (date added automatically)
  // e.g. Rajat_Raj_Sharma_FullStack_01_11.pdf
  resumePath: './resume/Rajat_Raj_Sharma_Resume_FullStack.docx.pdf',
  attachmentBaseName: 'Rajat_Raj_Sharma_FullStack',

  // Sending safety (Gmail free accounts: ~500/day hard limit, but stay far below to avoid spam flags)
  maxPerRun: 40,
  delaySecondsMin: 30,
  delaySecondsMax: 90,
};

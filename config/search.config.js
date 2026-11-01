module.exports = {
  // How far back to look. Used for LinkedIn jobs, LinkedIn posts and Naukri.
  // 24 = last 24 hours. (LinkedIn posts only support 24h / week / month, so it rounds up.)
  hoursBack: 24,

  // Max job pages opened per keyword+location (LinkedIn) / per search (Naukri)
  maxJobsPerSearch: 100,
  maxPostScrolls: 8, // scrolls on each LinkedIn posts search

  // Skills to search. `key` is the array name in result.json.
  // `variants` = all the ways people write it; LinkedIn is searched with them joined by OR.
  // `text` = main spelling (used for Naukri, which is fuzzy about spelling anyway).
  keywords: [
    { key: 'nodejs', text: 'NodeJS', variants: ['NodeJS', 'Node.js', 'Node JS'] },
    { key: 'javascript', text: 'javascript', variants: ['javascript', 'java script'] },
    { key: 'react', text: 'React', variants: ['React', 'React.js', 'ReactJS', 'React JS'] },
  ],

  // PCMC = Pimpri Chinchwad, so it is searched as "Pimpri Chinchwad".
  locations: ['Pune', 'Pimpri Chinchwad', 'Hyderabad'],

  // No work-type filter: on-site, hybrid and remote are all included.

  linkedin: { jobs: true, posts: true },

  // Naukri runs in the same Chrome. Log in to Naukri there first (optional but shows more contact info).
  // refreshProfile: true -> first thing each run, toggle the trailing dot in your Naukri resume headline
  naukri: { enabled: true, maxPages: 3, refreshProfile: true },

  hackerNews: { enabled: true, keywords: ['javascript', 'react', 'node'] },
};

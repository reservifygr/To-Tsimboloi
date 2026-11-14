// Instagram + events content. NOTHING here is embedded live: cards link out to Instagram (no third-party scripts load).
// Media (photo/video files supplied by the owner) go in public/social/<shortcode>.jpg|mp4; until then a designed
// placeholder card is shown. `posted` is the approximate posting date decoded from the post link's ID
// (Instagram IDs embed a timestamp), NOT an event date.

const ig = (id, posted, group, extra = {}) => ({ id, url: `https://www.instagram.com/p/${id}/`, posted, group, kind: 'unknown', media: null, poster: null, caption: null, ...extra });

/** Recent posts (owner's first list). Newest first. */
export const LATEST_POSTS = [
  ig('DfR7gYrCPV-', '2026-11-03', 'latest', { noEmbed: true, kind: 'image', media: '/images/post-DfR7gYrCPV.webp' }), // Instagram refuses to embed it: owner-supplied screenshot
  ig('DfP5-YgI0jG', '2026-11-02', 'latest'),
  ig('DfCkEp4IoJa', '2026-10-28', 'latest'),
  ig('DevnAweoDB9', '2026-10-21', 'latest'),
  ig('Dee5MvNiGQM', '2026-10-14', 'latest', { noEmbed: true, kind: 'image', media: '/images/post-Dee5MvNiGQM.webp' }), // same
  ig('DeKdjWmoaEV', '2026-10-06', 'latest'),
];

/** Older posts (owner's second list): shown under "Past events". Newest first. */
export const PAST_POSTS = [
  ig('DdlkW7sIVXD', '2026-09-22', 'past'),
  ig('Ddd2AqSoygt', '2026-09-19', 'past'),
  ig('DYzxbTeiE8A', '2026-05-26', 'past'),
  ig('DYNGu6TIQCI', '2026-05-11', 'past'),
  ig('DX6NZTco3qE', '2026-05-04', 'past'),
  ig('DXyb5VyiCfy', '2026-05-01', 'past'),
  ig('DXrbnXaiBUZ', '2026-04-28', 'past'),
  ig('DXMCMZXCGIX', '2026-04-16', 'past'),
];

/**
 * Dated events. Source: the venue's own poster (supplied by the owner). Add new events here (or via the admin
 * "Events" tab in production). An event whose date has passed moves to "Past events" automatically.
 * @typedef {{id:string,date:string,time:string,title:{el:string,en:string},artists:string[],poster:string,source:string}} VenueEvent
 */
export const EVENTS = [
  {
    id: 'live-2026-11-08', date: '2026-11-08', time: '14:00',
    title: { el: 'Ζωντανή μουσική: Κυριακή 8 Νοεμβρίου', en: 'Live music: Sunday 8 November' },
    artists: ['Άρης Κυριακάκης', 'Σπύρος Αλυσσανδράκης', 'Σταύρος Σουλακιώτης'],
    poster: '/images/event-2026-11-08.webp',
    source: 'Venue poster supplied by owner. Spelling of names copied from the poster: NEEDS OWNER VERIFICATION.',
  },
];

/** Athens calendar date (YYYY-MM-DD) for an instant. */
export function athensDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Split events into upcoming (today or later, soonest first) and past (most recent first). */
export function splitEvents(events = EVENTS, now = new Date()) {
  const today = athensDate(now);
  const up = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming: up, past };
}

import { lang, T, $, esc } from './core.js';
import { mountInquiryForm } from './forms.js';
import { initSocial } from './social.js';

initSocial();

// Calendar: month grid with the venue's event days highlighted.
const root = $('#calendar-root');
const eventDays = new Set(JSON.parse(root.dataset.events || '[]'));
let cur = new Date();
cur.setDate(1);
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function draw() {
  const loc = lang === 'el' ? 'el-GR' : 'en-GB';
  const title = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(cur);
  const dows = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
  const lead = (cur.getDay() + 6) % 7; // Monday-first
  const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const today = new Date();
  const cells = [...Array(lead)].map(() => '<span></span>').concat([...Array(days)].map((_, i) => {
    const isToday = today.getFullYear() === cur.getFullYear() && today.getMonth() === cur.getMonth() && today.getDate() === i + 1;
    const isEvent = eventDays.has(ymd(cur.getFullYear(), cur.getMonth(), i + 1));
    return `<span class="day${isToday ? ' today' : ''}${isEvent ? ' has-event' : ''}" ${isToday ? 'aria-current="date"' : ''}>${i + 1}${isEvent ? `<span class="sr-only"> ${esc(T('events.eventDay'))}</span>` : ''}</span>`;
  }));
  root.innerHTML = `<div class="cal"><div class="cal-head"><button class="btn btn-ghost btn-sm" type="button" id="cal-prev" aria-label="${esc(T('events.prev'))}">‹</button><h3 aria-live="polite">${esc(title)}</h3><button class="btn btn-ghost btn-sm" type="button" id="cal-next" aria-label="${esc(T('events.next'))}">›</button></div>
  <div class="cal-grid">${dows.map((d) => `<span class="dow">${esc(d)}</span>`).join('')}${cells.join('')}</div></div>`;
  $('#cal-prev').addEventListener('click', () => { cur.setMonth(cur.getMonth() - 1); draw(); $('#cal-prev').focus(); });
  $('#cal-next').addEventListener('click', () => { cur.setMonth(cur.getMonth() + 1); draw(); $('#cal-next').focus(); });
}
draw();
mountInquiryForm($('#inquiry-root'));

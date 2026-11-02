import { lang, T, $, esc } from './core.js';
import { mountInquiryForm } from './forms.js';

// Calendar shell: shows the month grid. Events appear only when the venue adds dated entries (none are confirmed yet).
const root = $('#calendar-root');
let cur = new Date(); cur.setDate(1);
function draw() {
  const loc = lang === 'el' ? 'el-GR' : 'en-GB';
  const title = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(cur);
  const dows = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
  const lead = (cur.getDay() + 6) % 7; // Monday-first
  const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const today = new Date();
  const cells = [...Array(lead)].map(() => '<span></span>').concat([...Array(days)].map((_, i) => {
    const isToday = today.getFullYear() === cur.getFullYear() && today.getMonth() === cur.getMonth() && today.getDate() === i + 1;
    return `<span class="day ${isToday ? 'today' : ''}" ${isToday ? 'aria-current="date"' : ''}>${i + 1}</span>`;
  }));
  root.innerHTML = `<div class="cal"><div class="cal-head"><button class="btn btn-ghost btn-sm" type="button" id="cal-prev" aria-label="${esc(T('events.prev'))}">‹</button><h3 aria-live="polite">${esc(title)}</h3><button class="btn btn-ghost btn-sm" type="button" id="cal-next" aria-label="${esc(T('events.next'))}">›</button></div>
  <div class="cal-grid" role="grid">${dows.map((d) => `<span class="dow">${esc(d)}</span>`).join('')}${cells.join('')}</div><p class="small muted">${esc(T('events.noDates'))}</p></div>`;
  $('#cal-prev').addEventListener('click', () => { cur.setMonth(cur.getMonth() - 1); draw(); $('#cal-prev').focus(); });
  $('#cal-next').addEventListener('click', () => { cur.setMonth(cur.getMonth() + 1); draw(); $('#cal-next').focus(); });
}
draw();
mountInquiryForm($('#inquiry-root'));

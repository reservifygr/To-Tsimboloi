import { lang, T, $, esc } from './core.js?v=mwg3bo34';
import { mountInquiryForm } from './forms.js?v=mwg3bo34';
import { initSocial } from './social.js?v=mwg3bo34';

initSocial();

// Calendar: month grid with the venue's event days highlighted.
const root = $('#calendar-root');
const eventDays = new Set(JSON.parse(root.dataset.events || '[]'));
const athensToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
let selectedDate = null;
let cur = new Date(`${athensToday().slice(0, 7)}-01T12:00:00`);
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function draw() {
  const loc = lang === 'el' ? 'el-GR' : 'en-GB';
  const title = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(cur);
  const dows = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
  const lead = (cur.getDay() + 6) % 7; // Monday-first
  const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const today = athensToday();
  const cells = [...Array(lead)].map(() => '<span></span>').concat([...Array(days)].map((_, i) => {
    const date = ymd(cur.getFullYear(), cur.getMonth(), i + 1);
    const isToday = date === today;
    const isEvent = eventDays.has(date);
    const selected = date === selectedDate;
    const cls = `day${isToday ? ' today' : ''}${isEvent ? ' has-event' : ''}${selected ? ' selected' : ''}`;
    const label = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
    const eventLabel = isEvent ? (lang === 'el' ? ', ζωντανή μουσική' : ', live music') : '';
    if (date <= today) return `<span class="${cls} past-day" ${isToday ? 'aria-current="date"' : ''} aria-label="${esc(label + eventLabel)}">${i + 1}${isEvent ? '<span class="event-dot" aria-hidden="true"></span>' : ''}</span>`;
    return `<button class="${cls}" type="button" data-cal-date="${date}" aria-label="${esc(label + eventLabel)}" aria-pressed="${selected}" ${isToday ? 'aria-current="date"' : ''}>${i + 1}${isEvent ? '<span class="event-dot" aria-hidden="true"></span>' : ''}</button>`;
  }));
  root.innerHTML = `<div class="cal"><div class="cal-head"><button class="btn btn-ghost btn-sm" type="button" id="cal-prev" aria-label="${esc(T('events.prev'))}">‹</button><h3 aria-live="polite">${esc(title)}</h3><button class="btn btn-ghost btn-sm" type="button" id="cal-next" aria-label="${esc(T('events.next'))}">›</button></div>
  <div class="cal-grid">${dows.map((d) => `<span class="dow">${esc(d)}</span>`).join('')}${cells.join('')}</div><div id="cal-selection" class="cal-selection" aria-live="polite"></div></div>`;
  showSelection();
  $('#cal-prev').addEventListener('click', () => { cur.setMonth(cur.getMonth() - 1); draw(); $('#cal-prev').focus(); });
  $('#cal-next').addEventListener('click', () => { cur.setMonth(cur.getMonth() + 1); draw(); $('#cal-next').focus(); });
}
function showSelection() {
  const panel = $('#cal-selection');
  if (!panel) return;
  if (!selectedDate) {
    panel.textContent = lang === 'el' ? 'Επιλέξτε μια μελλοντική ημερομηνία για να συμπληρωθεί το αίτημα εκδήλωσης.' : 'Select a future date to fill in the event inquiry form.';
    return;
  }
  const dateText = new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(selectedDate + 'T12:00:00Z'));
  const hasEvent = eventDays.has(selectedDate);
  panel.innerHTML = '<strong>' + esc(dateText) + '</strong><p>' + esc(hasEvent ? (lang === 'el' ? 'Υπάρχει προγραμματισμένη ζωντανή μουσική. Δείτε τις λεπτομέρειες της εκδήλωσης πιο πάνω. Η κράτηση γίνεται τηλεφωνικά.' : 'Live music is scheduled. See event details above. Reservations are made by phone.') : (lang === 'el' ? 'Η ημερομηνία προστέθηκε στο αίτημά σας (DEMO). Δεν επιβεβαιώνεται διαθεσιμότητα.' : 'Date added to your inquiry (DEMO). Availability is not confirmed.')) + '</p>' + (hasEvent ? '<a class="link" href="#next-event">' + (lang === 'el' ? 'Προβολή εκδήλωσης' : 'View event details') + '</a>' : '');
}
root.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cal-date]');
  if (!button || !root.contains(button)) return;
  selectedDate = button.dataset.calDate;
  const input = $('#i-date');
  if (input) {
    input.value = selectedDate;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  draw();
  root.querySelector('[data-cal-date="' + selectedDate + '"]')?.focus();
});
mountInquiryForm($('#inquiry-root'));
draw();


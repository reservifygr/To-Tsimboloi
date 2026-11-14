// Editable content fixtures. Everything here is a PLACEHOLDER or CONCEPT until the owner approves.
// Rule: no invented event dates, no fake reviews, no real discounts.

export const VENUE = {
  name: { el: 'Το Τσιμπολόι', en: 'To Tsimboloi' },
  street: 'Αγίου Ιωάννου 71',
  streetEn: 'Agiou Ioannou 71',
  city: 'Αγία Παρασκευή',
  cityEn: 'Agia Paraskevi',
  postal: '153 42', // NEEDS OWNER VERIFICATION (vrisko lists 15342 for this address)
  phoneDisplay: '210 600 5412',
  phoneTel: '+302106005412',
  // Social: Instagram handle comes from the link in a June 2026 in2life.gr review; the profile itself could not be
  // opened (blocked to automated access). Owner must confirm. No Facebook page, Google Business link or rating was found.
  instagram: { handle: 'to.tsimpoloi', url: 'https://www.instagram.com/to.tsimpoloi/', verified: false },
  mapsQuery: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Αγίου Ιωάννου 71, Αγία Παρασκευή'),
  osmQuery: 'https://www.openstreetmap.org/search?query=' + encodeURIComponent('Αγίου Ιωάννου 71, Αγία Παρασκευή'),
};

/** @typedef {{id:string,title:{el:string,en:string},blurb:{el:string,en:string},status:'concept'|'existing_unconfirmed'}} Offer */
/** @type {Offer[]} */
export const OFFERS = [
  {
    id: 'existing-15-card', status: 'existing_unconfirmed',
    title: { el: 'Κάρτα έκπτωσης 15% στον λογαριασμό', en: '15% off-the-bill card' },
    blurb: {
      el: 'Το κατάστημα διαθέτει φυσική κάρτα έκπτωσης 15%. Όροι, διάρκεια ισχύος και συνδυασμός με άλλες προσφορές: προς επιβεβαίωση.',
      en: 'The venue has a physical 15% card. Terms, validity and whether it combines with other offers: to be confirmed.',
    },
  },
  {
    id: 'student-id', status: 'concept',
    title: { el: 'Έκπτωση με φοιτητική ταυτότητα', en: 'Student ID discount' },
    blurb: {
      el: 'Πρόταση: ειδική τιμή για φοιτητές με έγκυρη φοιτητική ταυτότητα. Δεν συνδέεται με κανένα πανεπιστήμιο ή κολέγιο.',
      en: 'Proposal: a special price for students with a valid student ID. Not affiliated with any university or college.',
    },
  },
  {
    id: 'group-meze-2', status: 'concept',
    title: { el: 'Μενού μεζέδων για 2', en: 'Meze menu for 2' },
    blurb: { el: 'Πρόταση: σταθερό μενού μεζέδων για δύο άτομα. Περιεχόμενο και τιμή θα οριστούν από το κατάστημα.', en: 'Proposal: a fixed meze menu for two. Contents and price to be set by the venue.' },
  },
  {
    id: 'group-meze-4', status: 'concept',
    title: { el: 'Μενού μεζέδων για 4', en: 'Meze menu for 4' },
    blurb: { el: 'Πρόταση: σταθερό μενού μεζέδων για παρέες τεσσάρων. Περιεχόμενο και τιμή θα οριστούν από το κατάστημα.', en: 'Proposal: a fixed meze menu for groups of four. Contents and price to be set by the venue.' },
  },
  {
    id: 'early-evening', status: 'concept',
    title: { el: 'Προσφορά πρώιμου απογεύματος', en: 'Early-evening offer' },
    blurb: { el: 'Πρόταση: επιλεγμένα πιάτα σε ειδική τιμή σε συγκεκριμένο ωράριο. Ωράριο και πιάτα θα οριστούν από το κατάστημα.', en: 'Proposal: selected dishes at a special price in a set time window. Window and dishes to be set by the venue.' },
  },
  {
    id: 'weekday-birthday', status: 'concept',
    title: { el: 'Γενέθλια καθημερινής', en: 'Weekday birthday parties' },
    blurb: { el: 'Πρόταση: πακέτο για γενέθλια σε καθημερινές. Χωρίς αυτόματη επιβεβαίωση: κάθε αίτημα ελέγχεται από το κατάστημα.', en: 'Proposal: a birthday package on weekdays. No automatic confirmation: every request is reviewed by the venue.' },
  },
];

/**
 * Coupon architecture (NOT active). A coupon becomes redeemable only when status === 'active' and the server
 * validates it. In the demo every coupon is 'concept', so validateCoupon always refuses and only records intent.
 * @typedef {{code:string,status:'concept'|'active'|'expired',kind:'percent'|'fixed',value:number,stackable:boolean,validFrom?:string,validTo?:string}} Coupon
 */
export const COUPONS = /** @type {Coupon[]} */ ([
  { code: 'STUDENT-CONCEPT', status: 'concept', kind: 'percent', value: 0, stackable: false },
]);

export function validateCoupon(code, coupons = COUPONS) {
  const c = coupons.find((x) => x.code === String(code).trim().toUpperCase());
  if (!c) return { ok: false, reason: 'unknown' };
  if (c.status !== 'active') return { ok: false, reason: 'not_active' };
  return { ok: true, coupon: c };
}

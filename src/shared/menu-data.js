// MENU DATA - DEMO FIXTURE.
// Source: owner's printed menu as transcribed in the build brief (photos of the menu were NOT supplied
// with the build, so every line is unconfirmed). Every item carries verified:false until the owner signs off.
// No dish descriptions, allergens or dietary labels are invented: they are left empty until verified.
//
// Domain types (JSDoc, kept in one place so a production TypeScript port is mechanical):
/**
 * @typedef {{el:string,en:string}} L10n
 * @typedef {{id:string,label:L10n,priceDelta:number}} OptionChoice          priceDelta in euro cents
 * @typedef {{id:string,label:L10n,required:boolean,min:number,max:number,options:OptionChoice[]}} OptionGroup
 * @typedef {{id:string,name:L10n,order:number}} MenuCategory
 * @typedef {{
 *   id:string, cat:string, name:L10n, gloss?:L10n, price:number, available:boolean, verified:boolean,
 *   optionGroups?:OptionGroup[], allergens?:string[], dietary?:string[], photo?:string, note?:string
 * }} MenuItem
 */

/** @type {MenuCategory[]} */
export const CATEGORIES = [
  { id: 'salads', order: 1, name: { el: 'Σαλάτες', en: 'Salads' } },
  { id: 'meze', order: 2, name: { el: 'Μεζέδες', en: 'Meze' } },
  { id: 'sides', order: 3, name: { el: 'Ψωμί & Συνοδευτικά', en: 'Bread & Sides' } },
  { id: 'grill', order: 4, name: { el: 'Ψητά', en: 'From the Grill' } },
  { id: 'platters', order: 5, name: { el: 'Πιατέλες', en: 'Sharing Platters' } },
  { id: 'desserts', order: 6, name: { el: 'Γλυκά', en: 'Desserts' } },
  { id: 'drinks', order: 7, name: { el: 'Αναψυκτικά & Νερό', en: 'Soft Drinks & Water' } },
];

const sizeGroup = (twoToFourDelta, labelEl2 = '2 άτομα', labelEl4 = '4 άτομα') => [
  {
    id: 'size',
    label: { el: 'Μερίδα', en: 'Serving size' },
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'p2', label: { el: labelEl2, en: '2 people' }, priceDelta: 0 },
      { id: 'p4', label: { el: labelEl4, en: '4 people' }, priceDelta: twoToFourDelta },
    ],
  },
];

const I = (id, cat, el, en, price, extra = {}) => ({
  id, cat, name: { el, en }, price, available: true, verified: false, ...extra,
});

/** @type {MenuItem[]} price = euro cents */
export const ITEMS = [
  // Salads
  I('choriatiki', 'salads', 'Χωριάτικη', 'Village salad (Choriatiki)', 1000),
  I('politiki', 'salads', 'Πολίτικη', 'Politiki salad', 850),
  I('tsimboloi-salad', 'salads', 'Σαλάτα Τσιμπολόι', 'Tsimboloi house salad', 1000),
  // Meze
  I('tirokafteri', 'meze', 'Τυροκαυτερή', 'Tirokafteri', 700, { gloss: { el: '', en: 'spicy cheese spread' } }),
  I('tzatziki', 'meze', 'Τζατζίκι', 'Tzatziki', 500),
  I('fava', 'meze', 'Φάβα Παντρεμένη', 'Fava "Pantremeni"', 600),
  I('saganaki', 'meze', 'Σαγανάκι', 'Saganaki', 850, { gloss: { el: '', en: 'pan-fried cheese' } }),
  I('florina-pepper', 'meze', 'Πιπεριά Φλωρίνης', 'Florina pepper', 850),
  I('stuffed-sausage', 'meze', 'Λουκάνικο γεμιστό', 'Stuffed sausage', 950),
  I('cheese-croquettes', 'meze', 'Κροκέτες τυριού', 'Cheese croquettes', 700),
  I('grilled-vegetables', 'meze', 'Λαχανικά σχάρας', 'Grilled vegetables', 800),
  // Sides
  I('bread', 'sides', 'Ψωμί', 'Bread', 120),
  I('fries', 'sides', 'Πατάτες τηγανητές', 'Fries', 450),
  // Grill
  I('beef-patties', 'grill', 'Μπιφτέκια μοσχαρίσια', 'Beef burger patties (Biftekia)', 1450),
  I('pork-fillets', 'grill', 'Χοιρινά φιλέτα', 'Pork fillets', 1400, { note: 'NEEDS OWNER VERIFICATION: exact dish name' }),
  I('chicken-fillet', 'grill', 'Φιλέτο κοτόπουλο', 'Chicken fillet', 1300),
  // Platters (price = 2-person price; 4-person via option delta)
  I('meat-platter', 'platters', 'Ανάμεικτα κρεατικά', 'Mixed meat platter', 2700, { optionGroups: sizeGroup(1200) }),
  I('cheese-platter', 'platters', 'Πλατό τυριών & αλλαντικών', 'Cheese & cold-cut platter', 1600, { optionGroups: sizeGroup(1100) }),
  // Desserts
  I('orange-pie', 'desserts', 'Πορτοκαλόπιτα', 'Orange pie', 600),
  I('dessert-of-day', 'desserts', 'Γλυκό ημέρας', 'Dessert of the day', 500, { note: 'Varies daily; owner must set availability' }),
  // Drinks
  I('water-1l', 'drinks', 'Νερό 1 L', 'Still water 1 L', 150),
  I('sparkling-250', 'drinks', 'Ανθρακούχο νερό 250 ml', 'Sparkling water 250 ml', 250),
  I('cola-250', 'drinks', 'Coca-Cola 250 ml', 'Coca-Cola 250 ml', 250),
  I('soft-drinks', 'drinks', 'Αναψυκτικά διάφορα', 'Assorted soft drinks', 250, { note: 'NEEDS OWNER VERIFICATION: which flavours' }),
  I('pink-grapefruit', 'drinks', 'Ροζ γκρέιπφρουτ σόδα', 'Pink grapefruit soda', 350),
];

/** Beers, wines and spirits are intentionally absent: they were not legible/available to transcribe. */
export const NOT_TRANSCRIBED = ['beers', 'wines', 'tsipouro / raki / spirits', 'coffee & hot drinks (if any)'];

export const MENU = { categories: CATEGORIES, items: ITEMS };

/** @returns {MenuItem|undefined} */
export function findItem(menu, id) {
  return menu.items.find((i) => i.id === id);
}

/**
 * Merge staff overrides (price / availability edited in /admin) onto the base menu.
 * @param {{categories:MenuCategory[],items:MenuItem[]}} menu
 * @param {Record<string,{price?:number,available?:boolean}>} overrides
 */
export function applyOverrides(menu, overrides = {}) {
  return {
    categories: menu.categories,
    items: menu.items.map((it) => {
      const o = overrides[it.id];
      if (!o) return it;
      return {
        ...it,
        price: Number.isInteger(o.price) && o.price >= 0 ? o.price : it.price,
        available: typeof o.available === 'boolean' ? o.available : it.available,
      };
    }),
  };
}

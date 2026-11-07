// MENU DATA - DEMO FIXTURE.
// Source: the two photos of the owner's printed menu (food sheet + "Τσουγκρίσματα" drinks sheet), transcribed 2026-11-03.
// Greek names, descriptions and prices are as printed. English text is our translation. Every item keeps verified:false
// until the owner signs off prices. No allergens or dietary labels are invented.
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

/** @type {MenuCategory[]} Order follows the printed menus (food sheet, then the "Τσουγκρίσματα" drinks sheet). */
export const CATEGORIES = [
  { id: 'start', order: 1, name: { el: 'Για το ξεκίνημα', en: 'To start' } },
  { id: 'salads', order: 2, name: { el: 'Δροσερά Τσιμπολογήματα', en: 'Fresh Salads' } },
  { id: 'dips', order: 3, name: { el: 'Βουτιές με ψωμάκι', en: 'Dips with Bread' } },
  { id: 'fire', order: 4, name: { el: 'Στη φωτιά & στο τηγάνι', en: 'From the Fire & the Pan' } },
  { id: 'grill', order: 5, name: { el: 'Θράκα & Τσουκάλι', en: 'Grill & Clay Pot' } },
  { id: 'desserts', order: 6, name: { el: 'Γλυκολογήματα', en: 'Desserts' } },
  { id: 'water', order: 7, name: { el: 'Νερό', en: 'Water' } },
  { id: 'softs', order: 8, name: { el: 'Αναψυκτικά', en: 'Soft Drinks' } },
  { id: 'beers', order: 9, name: { el: 'Μπύρες', en: 'Beers' } },
  { id: 'ouzo', order: 10, name: { el: 'Ούζο', en: 'Ouzo' } },
  { id: 'tsipouro', order: 11, name: { el: 'Τσίπουρο', en: 'Tsipouro' } },
  { id: 'wine-carafe', order: 12, name: { el: 'Κρασιά (Βαρελίσια 500ml)', en: 'Wine on tap (500 ml)' } },
  { id: 'wine-bottle', order: 13, name: { el: 'Κρασιά (Φιάλες)', en: 'Wine by the bottle' } },
  { id: 'spirits-glass', order: 14, name: { el: 'Αλκοόλ (Ποτήρι)', en: 'Spirits (glass)' } },
  { id: 'spirits-bottle', order: 15, name: { el: 'Αλκοόλ (Φιάλη)', en: 'Spirits (bottle)' } },
];

/** Two-way choice (the UI shows both prices). priceDelta of option B is relative to the item's base price (= option A). */
const twoWay = (id, groupEl, groupEn, aEl, aEn, bEl, bEn, delta) => [
  {
    id,
    label: { el: groupEl, en: groupEn },
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'p2', label: { el: aEl, en: aEn }, priceDelta: 0 },
      { id: 'p4', label: { el: bEl, en: bEn }, priceDelta: delta },
    ],
  },
];
const sizeGroup = (delta) => twoWay('size', 'Μερίδα', 'Serving size', '2 άτομα', '2 people', '4 άτομα', '4 people', delta);
const beerSize = () => twoWay('size', 'Μέγεθος', 'Size', '300ml', '300ml', '500ml', '500ml', 150);

// English names/descriptions are our translation of the printed Greek text (owner to confirm wording).
const I = (id, cat, el, en, price, extra = {}) => ({
  id, cat, name: { el, en }, price, available: true, verified: false, ...extra,
});
const G = (el, en) => ({ gloss: { el, en } });

/** @type {MenuItem[]} price = euro cents. Transcribed from the two menu photos supplied on 2026-11-03. */
export const ITEMS = [
  // To start
  I('bread', 'start', 'Ψωμί', 'Bread', 120, G('Χειροποίητο χωριάτικο καρβέλι από φυσικό προζύμι, με τραγανή κρούστα και αφράτη ψίχα.', 'Handmade village loaf from natural sourdough, crisp crust and soft crumb.')),
  // Salads
  I('choriatiki', 'salads', 'Χωριάτικη', 'Village salad (Choriatiki)', 1000, G('Ντομάτα, αγγούρι, κρεμμύδι, πιπεριά, ελιές, κάπαρη & φέτα.', 'Tomato, cucumber, onion, pepper, olives, capers & feta.')),
  I('politiki', 'salads', 'Πολίτικη', 'Politiki salad', 850, G('Λάχανο άσπρο & κόκκινο, καρότο, κόλιανδρο, σέλερι, μηλόξυδο και μέλι.', 'White & red cabbage, carrot, coriander, celery, apple vinegar and honey.')),
  I('tsimboloi-salad', 'salads', 'Τσιμπολόι', 'Tsimboloi house salad', 1000, G('Λόλα, ρόκα, κοτόπουλο φιλέτο, κρουτόν, ρόδι και σος σαμπάνιας.', 'Lollo lettuce, rocket, chicken fillet, croutons, pomegranate and champagne sauce.')),
  // Dips
  I('tirokafteri', 'dips', 'Τυροκαυτερή (Γνήσια)', 'Tirokafteri (spicy cheese dip)', 700, G('Φέτα Π.Ο.Π., καυτερή πιπεριά & ελαιόλαδο.', 'PDO feta, hot pepper & olive oil.')),
  I('tzatziki', 'dips', 'Τζατζίκι', 'Tzatziki', 500, G('Στραγγιστό γιαούρτι, αγγούρι, σκόρδο και καρότο.', 'Strained yoghurt, cucumber, garlic and carrot.')),
  I('fava', 'dips', 'Φάβα Παντρεμένη', 'Fava "Pantremeni"', 600, G('Φάβα Σαντορίνης, ντοματίνια και κρεμμύδι ξερό.', 'Santorini fava, cherry tomatoes and dry onion.')),
  // Fire & pan
  I('saganaki', 'fire', 'Σαγανάκι', 'Saganaki', 850, G('Κεφαλοτύρι με τραγανή κρούστα & λεμόνι.', 'Kefalotyri cheese with a crisp crust & lemon.')),
  I('fries', 'fire', 'Πατάτες τηγανιτές', 'Fries', 450, G('Φρεσκοκομμένες πατάτες.', 'Freshly cut potatoes.')),
  I('florina-pepper', 'fire', 'Πιπεριά Φλωρίνης', 'Florina pepper', 850, G('Γεμιστή με φέτα, ξινομυζήθρα και ελιές.', 'Stuffed with feta, xinomyzithra cheese and olives.')),
  I('stuffed-sausage', 'fire', 'Λουκάνικο γεμιστό', 'Stuffed sausage', 950, G('Γεμιστό με τυρί ροκφόρ και μπέικον.', 'Stuffed with roquefort cheese and bacon.')),
  I('cheese-croquettes', 'fire', 'Τυροκροκέτες', 'Cheese croquettes', 700, G('Με τσάτνεϊ καρότο.', 'With carrot chutney.')),
  I('grilled-vegetables', 'fire', 'Ποικιλία ψητών λαχανικών', 'Grilled vegetable selection', 800, G('Πολύχρωμες πιπεριές (κόκκινη, κίτρινη, πράσινη), μελιτζάνες, μανιτάρια πλευρώτους.', 'Colourful peppers (red, yellow, green), aubergines, oyster mushrooms.')),
  // Grill & clay pot
  I('beef-patties', 'grill', 'Μπιφτέκια Μοσχαρίσια', 'Beef patties (Biftekia)', 1450, G('Ζουμερά μοσχαρίσια μπιφτέκια με μυρωδικά, συνοδεύεται από φρέσκες πατάτες.', 'Juicy beef patties with herbs, served with fresh potatoes.')),
  I('pork-fillets', 'grill', 'Χοιρινά Φιλετάκια', 'Pork fillets', 1400, G('Τρυφερά φιλετάκια λαιμού στη σχάρα με μυρωδικά, συνοδεύεται από φρέσκες πατάτες.', 'Tender pork-neck fillets on the grill with herbs, served with fresh potatoes.')),
  I('chicken-fillet', 'grill', 'Φιλέτο Κοτόπουλο', 'Chicken fillet', 1300, G('Φιλέτο κοτόπουλο στη σχάρα μαριναρισμένο με μπαχαρικά, συνοδεύεται από φρέσκες πατάτες.', 'Grilled chicken fillet marinated in spices, served with fresh potatoes.')),
  I('meat-platter', 'grill', 'Ποικιλία Κρεατικών', 'Meat platter', 2700, { optionGroups: sizeGroup(1200), ...G('Χοιρινά φιλετάκια, μπιφτέκι μοσχαρίσιο, κοτόπουλο μπούτι φιλέτο, λουκάνικο χωριάτικο, πατάτες τηγανητές.', 'Pork fillets, beef patty, boneless chicken thigh, village sausage, fries.') }),
  I('cheese-platter', 'grill', 'Ποικιλία Τυριών - Αλλαντικών', 'Cheese & cold-cut platter', 1600, { optionGroups: sizeGroup(1100), ...G('Ελληνικά τυριά και εκλεκτά αλλαντικά, συνοδεύεται από κριτσίνια, μαρμελάδα, ντοματίνια και ελιές.', 'Greek cheeses and fine cold cuts, with breadsticks, jam, cherry tomatoes and olives.') }),
  // Desserts
  I('orange-pie', 'desserts', 'Πορτοκαλόπιτα', 'Orange pie', 600, G('Χειροποίητη, μοσχομυριστή, φτιαγμένη με φρέσκα πορτοκάλια.', 'Handmade, fragrant, made with fresh oranges.')),
  I('dessert-of-day', 'desserts', 'Γλυκό ημέρας', 'Dessert of the day', 500, { ...G('Γλυκές εκπλήξεις ανάλογα με την εποχή και την έμπνευση της κουζίνας μας.', 'Sweet surprises depending on the season and the kitchen\'s inspiration.'), note: 'Varies daily; owner sets availability' }),
  // Water
  I('water-1l', 'water', 'Νερό Εμφιαλωμένο 1L', 'Bottled water 1 L', 150),
  I('water-florina', 'water', 'Ξινό Νερό Φλώρινης 250ml', 'Florina sparkling water 250 ml', 250),
  // Soft drinks
  I('cola-250', 'softs', 'Coca Cola Regular / Zero 250ml', 'Coca-Cola Regular / Zero 250 ml', 250),
  I('fanta-250', 'softs', 'Fanta Πορτοκαλάδα 250ml', 'Fanta Orange 250 ml', 250),
  I('sprite-250', 'softs', 'Sprite 250ml', 'Sprite 250 ml', 250),
  I('schweppes-250', 'softs', 'Schweppes Soda 250ml', 'Schweppes Soda 250 ml', 250),
  I('pink-grapefruit', 'softs', 'Pink Grapefruit Soda 250ml', 'Pink Grapefruit Soda 250 ml', 350),
  // Beers
  I('beer-fix-draft', 'beers', 'ΦΙΞ Βαρέλι', 'FIX draught', 350, { optionGroups: beerSize() }),
  I('beer-carlsberg-draft', 'beers', 'Carlsberg Βαρέλι', 'Carlsberg draught', 350, { optionGroups: beerSize() }),
  I('beer-fix-500', 'beers', 'ΦΙΞ 500ml', 'FIX 500 ml', 550),
  I('beer-nisos-500', 'beers', 'Νήσος Pilsner 500ml', 'Nisos Pilsner 500 ml', 550),
  I('beer-mythos-500', 'beers', 'Mythos 500ml', 'Mythos 500 ml', 470),
  I('beer-kaiser-500', 'beers', 'Kaiser 500ml', 'Kaiser 500 ml', 550),
  I('beer-fix-zero-500', 'beers', 'ΦΙΞ Άνευ 500ml', 'FIX Alcohol-free 500 ml', 490),
  // Ouzo
  I('ouzo-plomari', 'ouzo', 'Πλωμάρι 200ml', 'Plomari 200 ml', 1000),
  I('ouzo-varvagianni', 'ouzo', 'Βαρβαγιάννη Πράσινο 200ml', 'Varvagianni Green 200 ml', 1200),
  // Tsipouro
  I('tsipouro-apostolaki', 'tsipouro', 'Αποστολάκη 200ml', 'Apostolaki 200 ml', 1100),
  I('tsipouro-idoniko', 'tsipouro', 'Ηδωνικό 200ml', 'Idoniko 200 ml', 1100),
  // Wine on tap (500 ml)
  I('wine-tap-white', 'wine-carafe', 'Λευκό Σαββατιανό-Ροδίτης', 'White Savatiano-Roditis', 650),
  I('wine-tap-rose', 'wine-carafe', 'Ροζέ Μερλό', 'Rosé Merlot', 700),
  I('wine-tap-red', 'wine-carafe', 'Ερυθρό Αγιωργίτικο', 'Red Agiorgitiko', 650),
  I('wine-tap-red-semi', 'wine-carafe', 'Ερυθρό Αγιωργίτικο Ημίγλυκο', 'Red Agiorgitiko semi-sweet', 700),
  // Wine bottles
  I('wine-nektar-white', 'wine-bottle', 'Αμπέλου Νέκταρ λευκό', 'Ampelou Nektar white', 1800),
  I('wine-nektar-red', 'wine-bottle', 'Αμπέλου Νέκταρ ερυθρό', 'Ampelou Nektar red', 1800),
  I('wine-prorogos-white', 'wine-bottle', 'Πρόρωγος λευκό ημίγλυκο', 'Prorogos white semi-sweet', 2200),
  I('wine-prorogos-red', 'wine-bottle', 'Πρόρωγος ερυθρό ημίγλυκο', 'Prorogos red semi-sweet', 2200),
  I('wine-prorogos-rose', 'wine-bottle', 'Πρόρωγος ροζέ ημίγλυκο', 'Prorogos rosé semi-sweet', 2200),
  I('wine-lazaridi-white', 'wine-bottle', 'NICO LAZARIDI Ντάμα Κούπα λευκό', 'Nico Lazaridi Dama Koupa white', 3000),
  I('wine-lazaridi-red', 'wine-bottle', 'NICO LAZARIDI Ρήγας Κούπα ερυθρό', 'Nico Lazaridi Rigas Koupa red', 3000),
  I('wine-belrose', 'wine-bottle', 'Belrose Mediterranee ροζέ', 'Belrose Mediterranee rosé', 3200, { note: 'Marked *** on the printed menu' }),
  // Spirits by the glass
  I('spirit-glass-simple', 'spirits-glass', 'Απλό', 'Standard', 700),
  I('spirit-glass-special', 'spirits-glass', 'Special', 'Special', 1000),
  I('spirit-glass-premium', 'spirits-glass', 'Premium', 'Premium', 1200),
  I('spirit-shot', 'spirits-glass', 'Σφηνάκι', 'Shot', 250),
  // Spirits by the bottle
  I('spirit-bottle-simple', 'spirits-bottle', 'Απλή', 'Standard', 7000),
  I('spirit-bottle-special', 'spirits-bottle', 'Special', 'Special', 10000),
  I('spirit-bottle-premium', 'spirits-bottle', 'Premium', 'Premium', 12000),
];

export const MENU = { categories: CATEGORIES, items: ITEMS };

/** @returns {MenuItem|undefined} */
export function findItem(menu, id) {
  return menu.items.find((i) => i.id === id);
}

/**
 * Merge staff overrides (price / availability edited in /admin) onto the base menu.
 * @param {{categories:MenuCategory[],items:MenuItem[]}} menu
 * @param {Record<string,{price?:number,available?:boolean,hidden?:boolean}>} overrides
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
        // hidden items vanish from the public menu and ordering; "sold out" items stay visible but cannot be ordered
        hidden: typeof o.hidden === 'boolean' ? o.hidden : (it.hidden ?? false),
      };
    }),
  };
}

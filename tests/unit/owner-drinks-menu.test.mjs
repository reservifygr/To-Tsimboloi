import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../../src/shared/menu-data.js';

// Owner confirmed "ΤΣΟΥΓΚΡΙΣΜΑΤΑ" price list (7 November 2026).
// All values are euro cents and must match the printed menu.
const expected = {
  'water-1l': 200, 'water-florina': 300,
  'cola-250':250, 'fanta-250':250, 'sprite-250':250,'schweppes-250':250,'pink-grapefruit':350,
  'beer-fix-draft':450,'beer-carlsberg-draft':600,'beer-fix-500':600,
  'beer-nisos-500':600,'beer-mythos-500':600,'beer-kaiser-500':600,'beer-fix-zero-500':550,
  'ouzo-plomari':1000,'ouzo-varvagianni':1200,'tsipouro-apostolaki':1100,'tsipouro-idoniko':1100,
  'wine-tap-white':650,'wine-tap-rose':700,'wine-tap-red':650,'wine-tap-red-semi':700,
  'wine-nektar-white':1800,'wine-nektar-red':1800,'wine-prorogos-white':2200,
  'wine-prorogos-red':2200,'wine-prorogos-rose':2200,
  'wine-lazaridi-white':3000,'wine-lazaridi-red':3000,'wine-belrose':3200,
  'spirit-glass-simple':800,'spirit-glass-special':1000,'spirit-glass-premium':1200,
  'spirit-shot':300,'spirit-bottle-simple':8000,'spirit-bottle-special':11000,
  'spirit-bottle-premium':14000,
};

test('owner-confirmed drinks list matches approved PDF prices', () => {
  const drinkItems = ITEMS.filter(i => !['start','salads','dips','fire','grill'].includes(i.cat));
  assert.equal(drinkItems.length, Object.keys(expected).length);
  for (const item of drinkItems) {
    assert.equal(item.price, expected[item.id], item.id + ' price');
    assert.equal(item.verified, true, item.id + ' verified');
  }
});

test('printed beer serving sizes cannot be silently switched at checkout', () => {
  const fanta = ITEMS.find(i=>i.id==='fanta-250');
  assert.match(fanta.name.el, /400ml/);
  const small = ITEMS.find(i=>i.id==='beer-fix-draft');
  const large = ITEMS.find(i=>i.id==='beer-carlsberg-draft');
  assert.match(small.name.en, /300 ml/);
  assert.match(large.name.en, /500 ml/);
  assert.ok(!small.optionGroups?.length);
  assert.ok(!large.optionGroups?.length);
});

const food = { bread:250, choriatiki:1000, politiki:850, 'tsimboloi-salad':1000, 'green-salad':600, 'rocket-parmesan':900,
  tirokafteri:700, tzatziki:500, fava:600, 'aubergine-salad':800, saganaki:850, 'grilled-feta':850, fries:450, 'florina-pepper':850,
  'stuffed-sausage':950, 'cheese-croquettes':700, 'grilled-vegetables':800, 'cheese-platter':1600, 'beef-patties':1450, 'pork-fillets':1400,
  'chicken-fillet':1300, 'meat-platter':2700, 'sausage-portion':1000, 'pork-tomahawk':1600, 'beef-tbone':1800, 'lamb-chops':1600,
  'beef-fillet':1800, 'calf-liver':1600, 'beef-tagliata':2000 };

test('food items match the owner food-menu PDF (prices, nothing missing or extra)', () => {
  const foodItems = ITEMS.filter(i => ['start','salads','dips','fire','grill'].includes(i.cat));
  assert.equal(foodItems.length, Object.keys(food).length);
  for (const i of foodItems) assert.equal(i.price, food[i.id], i.id);
  const mp = ITEMS.find(i => i.id === 'meat-platter');
  assert.equal(mp.price + mp.optionGroups[0].options[1].priceDelta, 3900);
});

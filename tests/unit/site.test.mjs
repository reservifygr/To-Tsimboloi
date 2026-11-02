import test from 'node:test';
import assert from 'node:assert/strict';
import { ctx, renderPage, ROUTES, sitemapXml, robotsTxt } from '../../src/site/render.js';
import { ITEMS } from '../../src/shared/menu-data.js';
import { S } from '../../src/shared/strings.js';

const c = ctx({ SITE_URL: 'https://example.test' });
const html = (lang, route) => renderPage(c, lang, route);

test('i18n: Greek and English string trees have identical keys', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, p + k + '.') : [p + k]));
  assert.deepEqual(keys(S.el).sort(), keys(S.en).sort());
});

test('every route renders in both languages with lang, title, one h1, main landmark', () => {
  for (const lang of ['el', 'en']) for (const r of ROUTES) {
    const h = html(lang, r);
    assert.match(h, new RegExp(`<html lang="${lang}">`), `${lang}/${r}`);
    assert.match(h, /<title>[^<]{10,}<\/title>/);
    assert.equal((h.match(/<h1[ >]/g) || []).length, 1, `${lang}/${r} must have exactly one h1`);
    assert.match(h, /<main id="main"/);
    assert.match(h, /DEMO/);
  }
});

test('hreflang: every page links el, en and x-default with matching canonical', () => {
  for (const r of ROUTES) {
    const el = html('el', r); const en = html('en', r);
    const path = r ? r + '/' : '';
    for (const h of [el, en]) {
      assert.ok(h.includes(`hreflang="el" href="https://example.test/${path}"`));
      assert.ok(h.includes(`hreflang="en" href="https://example.test/en/${path}"`));
      assert.ok(h.includes(`hreflang="x-default" href="https://example.test/${path}"`));
    }
    assert.ok(el.includes(`rel="canonical" href="https://example.test/${path}"`));
    assert.ok(en.includes(`rel="canonical" href="https://example.test/en/${path}"`));
  }
});

test('/menu works as a standalone page without JavaScript: all items and prices are in the HTML', () => {
  for (const lang of ['el', 'en']) {
    const h = html(lang, 'menu');
    for (const i of ITEMS) assert.ok(h.includes(`data-item="${i.id}"`), `${i.id} missing in ${lang}`);
    assert.ok(h.includes(lang === 'el' ? 'Σαγανάκι' : 'Saganaki'));
    assert.match(h, /8,50|8\.50/);
  }
});

test('demo is noindex by default; admin is always noindex; robots/sitemap behave', () => {
  assert.match(html('el', ''), /noindex/);
  assert.match(robotsTxt(c), /Disallow: \//);
  const live = ctx({ SITE_URL: 'https://example.test', INDEXABLE: '1' });
  assert.match(renderPage(live, 'el', ''), /content="index,follow"/);
  assert.match(renderPage(live, 'el', 'admin'), /noindex/);
  assert.match(robotsTxt(live), /Sitemap: https:\/\/example.test\/sitemap.xml/);
  const sm = sitemapXml(live);
  assert.ok(!sm.includes('admin'));
  assert.equal((sm.match(/<url>/g) || []).length, (ROUTES.length - 1) * 2);
});

test('structured data: Restaurant only with verified properties (no hours, rating, reviews, sameAs)', () => {
  const m = html('el', '').match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  const ld = JSON.parse(m[1]);
  assert.equal(ld['@type'], 'Restaurant');
  assert.equal(ld.telephone, '+302106005412');
  for (const bad of ['aggregateRating', 'review', 'openingHours', 'openingHoursSpecification', 'sameAs', 'priceRange', 'servesCuisine', 'geo']) assert.ok(!(bad in ld), bad);
  assert.ok(!html('el', 'menu').includes('application/ld+json'));
});

test('honesty guards: no emojis, no fake review language, offers labelled concept, no logos of institutions', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const lang of ['el', 'en']) for (const r of ROUTES) {
    const h = html(lang, r);
    assert.ok(!emoji.test(h), `emoji on ${lang}/${r}`);
    assert.ok(!/aggregateRating|★|★/.test(h));
    assert.ok(!/deree|acg\b|american college/i.test(h));
  }
  const offers = html('en', 'offers');
  assert.equal((offers.match(/Concept – subject to approval/g) || []).length, 5);
  assert.match(offers, /Existing – terms to be confirmed/);
});

test('contact: click-to-call, directions and demo labelling', () => {
  const h = html('el', 'contact');
  assert.ok(h.includes('href="tel:+302106005412"'));
  assert.ok(h.includes('google.com/maps/search'));
  assert.match(html('el', 'order'), /id="order-root"/);
});

test('mobile action bar and nav toggle exist on every page', () => {
  for (const r of ROUTES) {
    const h = html('en', r);
    assert.match(h, /class="action-bar"/);
    assert.match(h, /data-nav-toggle/);
    assert.match(h, /class="skip-link"/);
  }
});

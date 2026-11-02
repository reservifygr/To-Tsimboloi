// Shared client helpers. DEMO MODE: the adapter persists to this browser only.
import { createAdapter, createStorage } from './shared/adapter.js';
import { t, fmt } from './shared/strings.js';

export const lang = document.documentElement.lang === 'en' ? 'en' : 'el';
export const base = document.body.dataset.base || '';
export const T = (path, vars) => fmt(t(lang, path), vars);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const route = (r) => `${base}${lang === 'en' ? '/en/' : '/'}${r ? r + '/' : ''}${document.body.dataset.relative ? 'index.html' : ''}`;

let backing = null;
try { backing = window.localStorage; backing.getItem('tsb.probe'); } catch { backing = null; }
export const storage = createStorage(backing);
export const adapter = createAdapter('demo', { storage });

/** Mock analytics: records locally ONLY after the visitor accepted analytics. Nothing leaves the browser. */
export function track(name, data = {}) {
  if (storage.get('tsb.consent', null) !== 'analytics') return;
  const log = storage.get('tsb.analytics', []);
  log.unshift({ at: new Date().toISOString(), name, data, path: location.pathname });
  storage.set('tsb.analytics', log.slice(0, 200));
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'k-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function toast(msg, ms = 4000) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

export function fmtTime(iso) {
  return new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
export function fmtDateTime(iso) {
  return new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { timeZone: 'Europe/Athens', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** Show field errors accessibly: sets aria-invalid + message linked via aria-describedby. */
export function setFieldError(input, message) {
  const id = input.id + '-err';
  let err = document.getElementById(id);
  if (!message) { input.removeAttribute('aria-invalid'); err?.remove(); return; }
  input.setAttribute('aria-invalid', 'true');
  if (!err) { err = document.createElement('div'); err.id = id; err.className = 'error'; err.setAttribute('role', 'alert'); input.closest('.field')?.append(err); }
  input.setAttribute('aria-describedby', id);
  err.textContent = message;
}

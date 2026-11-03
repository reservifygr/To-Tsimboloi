// Client-side QR helpers: logo-in-the-middle code, SVG/PNG download, print card.
import { qrSvg } from './shared/qr.js';
import { base } from './core.js';

let logoCache = null;
/** Load the square logo and return a PNG data URI (needed so SVG->PNG export and downloads are self-contained). */
export async function logoDataUri() {
  if (logoCache) return logoCache;
  const img = new Image();
  img.src = `${base}/images/logo-qr.webp`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 560;
  c.height = 288;
  c.getContext('2d').drawImage(img, 0, 0, 560, 288);
  logoCache = c.toDataURL('image/png');
  return logoCache;
}

/** SVG string of the menu QR with the venue logo in the centre (error-correction level H). */
export async function menuQr(url, label = 'QR') {
  const logo = await logoDataUri().catch(() => null); // without a logo the code is still valid (level M)
  return qrSvg(url, { label, logo, dark: '#0b1226', logoRatio: 0.17, logoAspect: 560 / 288 });
}

function saveBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function downloadText(name, text, type = 'image/svg+xml') {
  saveBlob(name, new Blob([text], { type }));
}

export async function downloadPng(name, svg, px = 1024) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, px, px);
  saveBlob(name, await new Promise((r) => c.toBlob(r, 'image/png')));
}

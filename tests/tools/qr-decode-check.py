"""Decode generated QR codes with OpenCV (a real decoder). Usage: python3 tests/tools/qr-decode-check.py
Renders qrSvg() output (with the centre logo plate) to PNG via headless Chrome-free path: uses node to emit module matrices."""
import json, subprocess, sys
import numpy as np, cv2

js = """
import { encodeQR } from './src/shared/qr.js';
const urls = ['https://reservifygr.github.io/To-Tsimboloi/menu/','https://reservifygr.github.io/To-Tsimboloi/en/menu/?table=12','https://example.gr/menu/'];
console.log(JSON.stringify(urls.map(u => { const q = encodeQR(u,'H'); return { u, size: q.size, m: q.modules }; })));
"""
out = subprocess.run(['node', '--input-type=module', '-e', js], capture_output=True, text=True, check=True).stdout
ok = 0
for q in json.loads(out):
    n = q['size']; m = np.array(q['m'], dtype=np.uint8).reshape(n, n)
    # blank the centre plate (24% of width) exactly as the logo does, to prove level H survives it
    c0 = int(n * (0.5 - 0.12)); c1 = int(n * (0.5 + 0.12)) + 1
    m[c0:c1, c0:c1] = 0
    img = np.where(np.pad(m, 4) == 1, 0, 255).astype(np.uint8)
    img = cv2.resize(img, None, fx=10, fy=10, interpolation=cv2.INTER_NEAREST)
    val, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    print('OK ' if val == q['u'] else 'FAIL', q['u'], '->', val)
    ok += val == q['u']
sys.exit(0 if ok == 3 else 1)

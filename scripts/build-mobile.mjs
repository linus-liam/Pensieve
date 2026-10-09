import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
function gitVersion() {
  try { return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return 'local'; }
}
const labVersion = (process.env.VERCEL_GIT_COMMIT_SHA || gitVersion()).slice(0, 8);
const labBuiltAt = new Date().toISOString();
const built = spawnSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build'], {
  cwd: resolve(root, 'frontend'), stdio: 'inherit',
  env: { ...process.env, VITE_MOBILE_MODE: 'true', VITE_LOCAL_MODE: 'false', VITE_LOCAL_TOKEN: '', VITE_API_BASE_URL: '/api', VITE_LAB_VERSION: labVersion, VITE_LAB_BUILT_AT: labBuiltAt },
});
if (built.status !== 0) process.exit(built.status ?? 1);
const output = resolve(root, 'frontend/dist');
await mkdir(output, { recursive: true });
// A functional P app icon, generated without external assets or downloads.
function icon(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const ring = Math.hypot((u - .52) / .19, (v - .39) / .17);
    const mark = (u > .30 && u < .39 && v > .22 && v < .78) || (ring < 1 && ring > .53 && u >= .35);
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    raw.set(mark ? [244, 248, 255, 255] : [37, 57, 79, 255], offset);
  }
  const crc = data => { let c = 0xffffffff; for (const b of data) { c ^= b; for (let i = 0; i < 8; i++) c = c >>> 1 ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (name, data) => { const type = Buffer.from(name); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(Buffer.concat([type, data]))); return Buffer.concat([length, type, data, checksum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const size of [180, 192, 512]) await writeFile(resolve(output, `icon-${size}.png`), icon(size));
await writeFile(resolve(output, 'manifest.webmanifest'), JSON.stringify({ id: '/', name: 'Pensieve Lab', short_name: 'Pensieve Lab', lang: 'zh-CN', start_url: '/', scope: '/', display: 'standalone', background_color: '#fafbfc', theme_color: '#25394f', icons: [192, 512].map(size => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) }));
await writeFile(resolve(output, 'build-info.json'), JSON.stringify({ channel: 'lab', version: labVersion, builtAt: labBuiltAt }));
const index = resolve(output, 'index.html');
let html = await readFile(index, 'utf8');
html = html.replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-180.png"><meta name="theme-color" content="#25394f"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Pensieve Lab"></head>');
html = html.replace('width=device-width, initial-scale=1.0', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
await writeFile(index, html);
const assets = ['/', '/index.html', '/manifest.webmanifest', '/icon-180.png', '/icon-192.png', '/icon-512.png', ...(await readdir(resolve(output, 'assets'))).map(file => `/assets/${file}`)];
const version = createHash('sha256').update(html + assets.join('\n')).digest('hex').slice(0, 16);
await writeFile(resolve(output, 'sw.js'), `const CACHE = 'pensieve-phone-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pensieve-phone-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html'))); return;
  }
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
`);
console.log('Phone build ready: device storage, manifest and offline app shell.');

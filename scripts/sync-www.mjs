/* Salin aset web (sumber asli) ke www/ untuk dibundel oleh Capacitor.
   Jalankan: npm run sync:www */
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const item of ['index.html', 'css', 'js']) {
  cpSync(join(root, item), join(www, item), { recursive: true });
}
console.log(`✓ www/ disinkronkan dari sumber web (${new Date().toISOString()})`);
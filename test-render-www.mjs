/* test-render-www.mjs — buktikan www/index.html (yang DI-INSTALL) benar-benar RENDER, bukan blank */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const html = readFileSync('/workspaces/BOT/www/index.html','utf8');
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/', resources:'usable' });
await new Promise(r=>setTimeout(r,3000));
const { window } = dom; const { document } = window;
let pass=0, fail=0; const ok=(c,m)=>{c?pass++:fail++; console.log((c?'  ✅ ':'  ❌ ')+m);};
console.log('=== RENDER www/index.html (persis yang diinstall) ===');
ok(document.title==='Kasir Pro'||document.title.includes('Kasir'), 'title: "'+document.title+'"');
ok(!!document.querySelector('#app-login, #login-form, .login-box'), 'kontainer login ADA');
ok(!!document.getElementById('login-username'), 'input username ADA');
ok(!!document.getElementById('login-password'), 'input password ADA');
ok(!!document.getElementById('login-btn')||!!document.querySelector('button[type="submit"]'), 'tombol Masuk ADA');
ok(document.body.innerHTML.length>500, 'body ter-render (len='+document.body.innerHTML.length+')');
ok(!/undefined|NaN|TypeError|ReferenceError/.test(document.body.innerHTML), 'tanpa teks error JS');
// cek script cashier load
const scripts=[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src'));
ok(scripts.some(s=>s.includes('cashier')), 'script cashier.js termuat: '+scripts.filter(s=>s.includes('cashier')));
console.log('\n=== HASIL: '+pass+' lulus / '+fail+' gagal ===');
process.exit(fail?1:0);

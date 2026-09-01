import fs from 'node:fs';
import assert from 'node:assert/strict';
function extractObject(source, marker) {
  const start = source.indexOf(marker); assert(start >= 0, `missing marker ${marker}`);
  const open = source.indexOf('{', start); let depth = 0; let quote = null; let escaped = false;
  for (let i = open; i < source.length; i += 1) { const ch = source[i];
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1; if (ch === '}') { depth -= 1; if (depth === 0) return source.slice(open, i + 1); }
  }
  throw new Error(`unclosed object ${marker}`);
}
const homepage = fs.readFileSync('/home/ubuntu/balkanagent-source-package/index.html', 'utf8');
const customer = fs.readFileSync('/home/ubuntu/balkanagent-source-package/customer.html', 'utf8');
const homepageCatalog = Function(`return (${extractObject(homepage, 'const T=')})`)();
const customerCatalog = Function(`return (${extractObject(customer, 'const TR=')})`)();
const requiredHome = [...new Set([...homepage.matchAll(/data-t="([^"]+)"/g)].map(m => m[1]))];
const requiredCustomer = [...new Set([...customer.matchAll(/data-t="([^"]+)"/g)].map(m => m[1]))];
for (const [language, catalog] of Object.entries(homepageCatalog)) for (const key of requiredHome) assert.notEqual(catalog[key], undefined, `${language}.${key}`);
for (const [language, catalog] of Object.entries(customerCatalog)) for (const key of requiredCustomer) assert.notEqual(catalog[key], undefined, `${language}.${key}`);
console.log(`language smoke passed: homepage=${Object.keys(homepageCatalog).length} languages/${requiredHome.length} keys; customer=${Object.keys(customerCatalog).length} languages/${requiredCustomer.length} keys`);

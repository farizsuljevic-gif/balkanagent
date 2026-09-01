import fs from 'node:fs';
import path from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html')).sort();
const assetPattern = /(?:src|href)=["']([^"'#?]+)["']/gi;
const idPattern = /\bid=["']([^"']+)["']/gi;
const failures = [];
for (const file of htmlFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = new Map();
  let match;
  while ((match = idPattern.exec(source))) ids.set(match[1], (ids.get(match[1]) || 0) + 1);
  for (const [id, count] of ids) if (count > 1) failures.push(`${file}: duplicate id=${id}`);
  while ((match = assetPattern.exec(source))) {
    const ref = match[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|\/|#)/i.test(ref)) continue;
    if (!fs.existsSync(path.join(root, ref))) failures.push(`${file}: missing asset ${ref}`);
  }
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter(Boolean);
  fs.writeFileSync(`/tmp/${file}.scripts.mjs`, scripts.join('\n'));
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`html_files=${htmlFiles.length}`);
  console.log('duplicate_ids=0');
  console.log('relative_assets=ok');
}

// Builds the game and writes the shareable files next to the project folder:
//   above-the-clouds.html         one file, desktop (touch buttons appear on touch screens)
//   above-the-clouds-mobile.html  one file, touch buttons always on
//   above-the-clouds-web.zip      index.html for hosting (itch.io, Netlify, GitHub Pages)
// Run: npm run release
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

execSync('npx vite build', { stdio: 'inherit' });
const html = fs.readFileSync('dist/index.html', 'utf8');
const jsFile = fs.readdirSync('dist/assets').filter((f) => f.endsWith('.js'));
if (jsFile.length !== 1) throw new Error(`expected one JS chunk, got ${jsFile}`);
const js = fs.readFileSync(path.join('dist/assets', jsFile[0]), 'utf8').replace(/<\/script/g, '<\\/script');
// Replacements use functions: a plain replacement string would expand "$&",
// "$'" and "$`" sequences that occur in the minified code and corrupt it.
const inline = (extraHead = '') => html
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, () => '')
  .replace('</head>', () => `${extraHead}</head>`)
  .replace('</body>', () => `<script type="module">\n${js}\n</script>\n</body>`);

const check = (doc) => {
  if (!doc.includes(`<script type="module">\n${js}\n</script>`)) throw new Error('inlined script does not match the bundle');
  return doc;
};
const out = path.resolve('..');
fs.writeFileSync(path.join(out, 'above-the-clouds.html'), check(inline()));
fs.writeFileSync(path.join(out, 'above-the-clouds-mobile.html'), check(inline('    <script>window.ATC_MOBILE = true;</script>\n')));
const tmp = fs.mkdtempSync(path.join(fs.realpathSync('/tmp'), 'atc-'));
fs.writeFileSync(path.join(tmp, 'index.html'), check(inline()));
const zip = path.join(out, 'above-the-clouds-web.zip');
fs.rmSync(zip, { force: true });
execSync(`zip -q -j "${zip}" "${path.join(tmp, 'index.html')}"`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Wrote above-the-clouds.html, above-the-clouds-mobile.html, above-the-clouds-web.zip');

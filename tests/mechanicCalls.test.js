import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BiomeMechanics } from '../src/systems/mechanics/index.js';
import { BIOMES } from '../src/data/biomes.js';
import { SeededRandom } from '../src/utils/seededRandom.js';

// The scenes reach the biome rules through mechanics.get('id'). When a rule is
// rewritten, a call to a method it no longer has only blows up in the browser
// (a Bone Garden onClimb() once froze every route pick), so read the scenes
// and check every member they use still exists on that rule.
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : p.endsWith('.js') ? [p] : [];
  });
}

// [{ file, line, id, member }] for mechanics.get('id').member and for
// `const x = ...mechanics.get('id')` followed by x.member in the same method.
function mechanicUses(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const uses = [];
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/mechanics\.get\('(\w+)'\)\.(\w+)/g)) uses.push({ file, line: i + 1, id: m[1], member: m[2] });
    const bind = text.match(/(?:const|let)\s+(\w+)\s*=.*mechanics\.get\('(\w+)'\)/);
    if (!bind) return;
    const [, name, id] = bind;
    for (let j = i + 1; j < lines.length; j++) {
      // Stop at the next method of the class or where the name is bound again.
      if (/^ {2}(?:get |async )?\w+\(.*\)\s*\{\s*$/.test(lines[j])) break;
      if (new RegExp(`(?:const|let)\\s+${name}\\b`).test(lines[j])) break;
      for (const m of lines[j].matchAll(new RegExp(`(?<![.\\w])${name}\\.(\\w+)`, 'g'))) uses.push({ file, line: j + 1, id, member: m[1] });
    }
  });
  return uses;
}

test('mechanics: every member the scenes use exists on that biome rule', () => {
  const mechanics = new BiomeMechanics(new SeededRandom(1));
  // One tick inside each biome, so members set in update() exist too.
  for (const b of Object.values(BIOMES)) mechanics.update(16, { a: b, b, t: 0 });
  const uses = sourceFiles(path.resolve('src')).flatMap(mechanicUses);
  assert.ok(uses.length > 10, 'found the scenes\' calls into the biome rules');
  const missing = uses.filter(({ id, member }) => {
    const impl = mechanics.get(id);
    return !impl || !(member in impl);
  }).map(({ file, line, id, member }) => `${path.relative(process.cwd(), file)}:${line} ${id}.${member}`);
  assert.deepEqual(missing, []);
});

/**
 * gen-locales.mjs
 * Generates src/i18n/locales/<code>.ts from the Flutter l10n .dart files,
 * reusing the exact existing translations. Run: node tools/gen-locales.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const L10N_DIR = join(__dirname, '..', '..', 'flutter_app', 'lib', 'l10n');
const OUT_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');

function unescapeDart(raw) {
  const body = raw.slice(1, -1);
  return body.replace(/\\(.)/g, (_, ch) => {
    if (ch === 'n') return '\n';
    if (ch === 't') return '\t';
    return ch; // \' \" \\ -> ' " \
  });
}

function parseDart(src) {
  const out = {};
  const re = /get\s+(\w+)\s*=>\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*;/g;
  let m;
  while ((m = re.exec(src))) {
    out[m[1]] = unescapeDart(m[2]);
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(L10N_DIR).filter((f) => /^app_localizations_[a-z]+\.dart$/.test(f));
const codes = [];

for (const file of files) {
  const code = file.replace('app_localizations_', '').replace('.dart', '');
  if (code === 'en') continue; // en is hand-authored in en.ts
  const src = readFileSync(join(L10N_DIR, file), 'utf8');
  const map = parseDart(src);
  if (Object.keys(map).length === 0) continue;
  codes.push(code);
  const body =
    `import { Strings } from '../types';\n\n` +
    `// Auto-generated from flutter_app/lib/l10n/${file}\n` +
    `export const ${code}: Partial<Strings> = ${JSON.stringify(map, null, 2)};\n`;
  writeFileSync(join(OUT_DIR, `${code}.ts`), body, 'utf8');
}

const imports = codes.map((c) => `import { ${c} } from './${c}';`).join('\n');
const entries = codes.map((c) => `  ${c},`).join('\n');
const index =
  `import { Strings } from '../types';\n${imports}\n\n` +
  `export const generatedLocales: Partial<Record<string, Partial<Strings>>> = {\n${entries}\n};\n`;
writeFileSync(join(OUT_DIR, 'index.ts'), index, 'utf8');

console.log(`Generated ${codes.length} locales: ${codes.join(', ')}`);

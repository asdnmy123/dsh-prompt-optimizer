/**
 * Minimal Electron ASAR reader — enough to list, grep, and extract files from
 * the DSH checkout without network access or extra dependencies.
 *
 *   node tools/asar.mjs ls <substring>
 *   node tools/asar.mjs cat <exact inner path>
 *   node tools/asar.mjs grep <regex> [substring-filter]
 *
 * Inner paths use forward slashes and no leading slash, e.g.
 *   dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/dist/index.js
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const ASAR =
  process.env.DSH_ASAR ||
  'D:/Software/DeepSeek Harness/resources/app.asar';

const buf = readFileSync(ASAR);
const pickleSize = buf.readUInt32LE(4);
const jsonSize = buf.readUInt32LE(12);
const header = JSON.parse(buf.subarray(16, 16 + jsonSize).toString('utf8'));
const baseOffset = 8 + pickleSize;

const files = new Map(); // inner path -> {offset, size}
(function walk(node, prefix) {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const path = prefix === '' ? name : prefix + '/' + name;
    if (entry.files) walk(entry, path);
    else if (entry.size !== undefined) files.set(path, { offset: Number(entry.offset), size: entry.size });
  }
})(header, '');

const [cmd, arg, extra] = process.argv.slice(2);

function readEntry(path) {
  const entry = files.get(path);
  if (entry === undefined) throw new Error('not in asar: ' + path);
  return buf.subarray(baseOffset + entry.offset, baseOffset + entry.offset + entry.size);
}

if (cmd === 'ls') {
  const needle = arg || '';
  let count = 0;
  for (const path of files.keys()) {
    if (path.includes(needle)) {
      console.log(path);
      count += 1;
    }
  }
  console.error('total files: ' + files.size + ', matched: ' + count);
} else if (cmd === 'cat') {
  const text = readEntry(arg).toString('utf8');
  if (extra) {
    mkdirSync(dirname(extra), { recursive: true });
    writeFileSync(extra, text);
    console.error('wrote ' + text.length + ' chars to ' + extra);
  } else {
    process.stdout.write(text);
  }
} else if (cmd === 'grep') {
  const re = new RegExp(arg, 'g');
  const filter = extra || '';
  let hits = 0;
  for (const path of files.keys()) {
    if (filter !== '' && !path.includes(filter)) continue;
    if (!/\.(js|mjs|cjs|ts|json|md|yml|yaml)$/.test(path)) continue;
    const text = readEntry(path).toString('utf8');
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null && hits < 400) {
      const line = text.slice(Math.max(0, m.index - 220), m.index + 320).replace(/\n/g, '\\n');
      console.log('--- ' + path + ' @' + m.index + '\n' + line + '\n');
      hits += 1;
    }
    re.lastIndex = 0;
  }
  console.error('hits: ' + hits);
} else {
  console.error('usage: ls <substr> | cat <path> [outFile] | grep <regex> [pathFilter]');
  process.exitCode = 2;
}

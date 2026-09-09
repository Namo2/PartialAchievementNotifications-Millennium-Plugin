import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.copyFileSync(path.join(root, 'plugin.json'), path.join(outDir, 'plugin.json'));
fs.cpSync(path.join(root, '.millennium'), path.join(outDir, '.millennium'), { recursive: true });
fs.cpSync(path.join(root, 'backend'), path.join(outDir, 'backend'), { recursive: true });

console.log('Wrote plugin.json, .millennium/, backend/ to out/');

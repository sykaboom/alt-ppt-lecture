const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const templatePath = path.join(root, 'web-src', 'player.html');
const cssPath = path.join(root, 'web-src', 'styles', 'main.css');
const orderPath = path.join(root, 'web-src', 'order.txt');
const outDir = path.join(root, 'web-dist');
const outPlayer = path.join(outDir, 'player.html');

if (!fs.existsSync(templatePath)) {
  throw new Error(`Template not found: ${templatePath}`);
}
if (!fs.existsSync(cssPath)) {
  throw new Error(`CSS not found: ${cssPath}`);
}
if (!fs.existsSync(orderPath)) {
  throw new Error(`Script order not found: ${orderPath}`);
}

const css = fs.readFileSync(cssPath, 'utf8');
const order = fs
  .readFileSync(orderPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

const scripts = order.map((name) => {
  const filePath = path.join(root, 'web-src', name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Script not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
});

const js = scripts.join('\n');
let template = fs.readFileSync(templatePath, 'utf8');

if (!template.includes('/* @inline-style */')) {
  throw new Error('Missing style placeholder in template.');
}
if (!template.includes('/* @inline-script */')) {
  throw new Error('Missing script placeholder in template.');
}

template = template.replace('/* @inline-style */', css.trimEnd());
template = template.replace('/* @inline-script */', js.trimEnd());

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPlayer, template, 'utf8');

console.log(`Built player.html -> ${outPlayer}`);

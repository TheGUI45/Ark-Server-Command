import fs from 'fs';
import path from 'path';
import png2icons from 'png2icons';

const sourcePng = path.resolve('assets', 'dino.png'); // Place your provided image here.
const buildDir = path.resolve('build');

if (!fs.existsSync(sourcePng)) {
  console.error(`Source PNG not found at ${sourcePng}. Please save the provided dinosaur image as dino.png in assets/ before running this script.`);
  process.exit(1);
}

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);

const buf = fs.readFileSync(sourcePng);

// ICO
const ico = png2icons.createICO(buf, png2icons.BICUBIC, false, 0);
if (!ico) {
  console.error('ICO generation failed');
  process.exit(1);
}
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

// ICNS
const icns = png2icons.createICNS(buf, png2icons.BICUBIC, false, 0);
if (!icns) {
  console.error('ICNS generation failed');
  process.exit(1);
}
fs.writeFileSync(path.join(buildDir, 'icon.icns'), icns);

// PNG (fallback for Linux) - write original or resized if needed
fs.writeFileSync(path.join(buildDir, 'icon.png'), buf);

console.log('Icons generated: build/icon.ico, build/icon.icns, build/icon.png');

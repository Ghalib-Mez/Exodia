'use strict';

// Usage: npm run hash <file>  → prints the JSON snippet fields for one mod
//        npm run hash <dir>   → prints entries for every .jar in the dir
// Output: "sha1" and "size" values ready to paste into launcher.json

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    fs.createReadStream(file)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: npm run hash <jar-file-or-folder>');
    process.exit(1);
  }
  const stat = fs.statSync(target);
  const files = stat.isDirectory()
    ? fs.readdirSync(target).filter((f) => f.toLowerCase().endsWith('.jar')).map((f) => path.join(target, f))
    : [target];

  if (!files.length) {
    console.error('No .jar files found.');
    process.exit(1);
  }

  for (const file of files) {
    const sha1 = await sha1File(file);
    const size = fs.statSync(file).size;
    console.log(`--- ${path.basename(file)}`);
    console.log(`"file": ${JSON.stringify(path.basename(file))},`);
    console.log(`"sha1": "${sha1}",`);
    console.log(`"size": ${size},`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

// Usage: node scripts/json-to-base64.js apps/backend/file-service/credentials/tumbabucket.json
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/json-to-base64.js <path-to-json-file>');
  process.exit(1);
}

const jsonPath = path.resolve(process.argv[2]);

try {
  const jsonData = fs.readFileSync(jsonPath);
  const base64 = Buffer.from(jsonData).toString('base64');
  console.log(base64);
} catch (err) {
  console.error('Error reading or encoding file:', err.message);
  process.exit(1);
}

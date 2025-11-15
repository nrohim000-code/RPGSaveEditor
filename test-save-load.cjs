const fs = require('fs');
const { load, dump } = require('@hyrious/marshal');

// Load original file
const savePath = 'D:\\Games\\AmongUs\\LonaRPG_B010310\\LonaRPG\\UserData\\Save01.rvdata2';
const buffer = fs.readFileSync(savePath);
const uint8 = new Uint8Array(buffer);

// Find section 2 (same logic as rvdata2Utils.ts)
const headers = [];
for (let i = 0; i < uint8.length - 1; i++) {
  if (uint8[i] === 0x04 && uint8[i + 1] === 0x08) {
    headers.push(i);
    if (headers.length >= 2) break;
  }
}

console.log('Original file sections:', headers);
console.log('File total size:', uint8.length, 'bytes');

// Show bytes at each header
headers.forEach((offset, i) => {
  const bytes = Array.from(uint8.slice(offset, offset + 10));
  console.log(`Section ${i + 1} at offset ${offset}:`, bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
});

// Load section 2 if multiple sections exist, otherwise section 1
let dataToLoad;
if (headers.length >= 2) {
  console.log('Multi-section file detected, using section 2 at offset', headers[1]);
  dataToLoad = uint8.slice(headers[1]);
} else {
  console.log('Single section file, using section 1 at offset', headers[0]);
  dataToLoad = uint8;
}

const originalData = load(dataToLoad);

console.log('\n=== ORIGINAL DATA STRUCTURE ===');
const symbols = Object.getOwnPropertySymbols(originalData);
console.log('Top-level symbols:');
symbols.forEach(s => console.log('  -', s.description));

// Check actors
const actorsSymbol = symbols.find(s => s.description === 'actors');
if (actorsSymbol) {
  const actors = originalData[actorsSymbol];
  const actorSymbols = Object.getOwnPropertySymbols(actors);
  console.log('\nActors symbols:');
  actorSymbols.forEach(s => console.log('  -', s.description));

  const dataSymbol = actorSymbols.find(s => s.description === '@data');
  if (dataSymbol && actors[dataSymbol] && actors[dataSymbol][1]) {
    const firstActor = actors[dataSymbol][1];
    const firstActorSymbols = Object.getOwnPropertySymbols(firstActor);
    console.log('\nFirst actor has', firstActorSymbols.length, 'symbols');
    console.log('Sample actor symbols:', firstActorSymbols.slice(0, 5).map(s => s.description));
  }
}

// Try to re-encode the ORIGINAL data (without any modifications)
console.log('\n=== TESTING RE-ENCODE ===');
try {
  const reencoded = dump(originalData);
  console.log('Re-encode successful! Size:', reencoded.length, 'bytes');

  // Try to decode it again
  const decoded = load(reencoded);
  const decodedSymbols = Object.getOwnPropertySymbols(decoded);
  console.log('Re-decoded symbols:', decodedSymbols.map(s => s.description).join(', '));
  console.log('Re-encode/decode test PASSED');
} catch (error) {
  console.error('Re-encode failed:', error);
}

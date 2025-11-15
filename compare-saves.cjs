const fs = require('fs');
const { load } = require('@hyrious/marshal');

function analyzeSaveFile(path, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label}: ${path}`);
  console.log('='.repeat(60));

  const buffer = fs.readFileSync(path);
  const uint8 = new Uint8Array(buffer);

  console.log('Total file size:', uint8.length, 'bytes');

  // Find all Marshal headers
  const headers = [];
  for (let i = 0; i < uint8.length - 1; i++) {
    if (uint8[i] === 0x04 && uint8[i + 1] === 0x08) {
      headers.push(i);
    }
  }

  console.log('Marshal headers found:', headers.length);
  headers.forEach((offset, i) => {
    const bytes = Array.from(uint8.slice(offset, offset + 16));
    console.log(`  Section ${i + 1} at offset ${offset}:`, bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  });

  // If multi-section, show section sizes
  if (headers.length >= 2) {
    const section1Size = headers[1] - headers[0];
    const section2Size = uint8.length - headers[1];
    console.log(`Section 1 size: ${section1Size} bytes`);
    console.log(`Section 2 size: ${section2Size} bytes`);

    // Load and analyze section 2
    try {
      const section2Data = load(uint8.slice(headers[1]));
      const symbols = Object.getOwnPropertySymbols(section2Data);
      console.log(`Section 2 top-level symbols (${symbols.length}):`);
      symbols.slice(0, 20).forEach(s => console.log('  -', s.description));

      // Check if actors exists
      const actorsSymbol = symbols.find(s => s.description === 'actors');
      if (actorsSymbol) {
        console.log('\nActors structure:');
        const actors = section2Data[actorsSymbol];
        const actorSymbols = Object.getOwnPropertySymbols(actors);
        console.log('  Actors symbols:', actorSymbols.map(s => s.description).join(', '));
      } else {
        console.log('\nWARNING: No "actors" symbol found!');
      }
    } catch (error) {
      console.error('ERROR loading section 2:', error.message);
    }
  }

  return { fileSize: uint8.length, headers };
}

// Compare both files
const save01Path = 'D:\\Games\\AmongUs\\LonaRPG_B010310\\LonaRPG\\UserData\\Save01.rvdata2';
const save02Path = 'D:\\Games\\AmongUs\\LonaRPG_B010310\\LonaRPG\\UserData\\Save02.rvdata2';

const save01 = analyzeSaveFile(save01Path, 'SAVE01 (CORRUPTED)');
const save02 = analyzeSaveFile(save02Path, 'SAVE02 (WORKING)');

console.log('\n' + '='.repeat(60));
console.log('COMPARISON');
console.log('='.repeat(60));
console.log('File size difference:', save01.fileSize - save02.fileSize, 'bytes');
console.log('Save01 sections:', save01.headers.length);
console.log('Save02 sections:', save02.headers.length);

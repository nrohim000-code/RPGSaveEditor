const fs = require('fs');
const { load } = require('@hyrious/marshal');

const savePath = 'D:\\Games\\AmongUs\\LonaRPG_B010310\\LonaRPG\\UserData\\Save01.rvdata2';
const buffer = fs.readFileSync(savePath);
const uint8 = new Uint8Array(buffer);

// Find Marshal headers
const headers = [];
for (let i = 0; i < uint8.length - 1; i++) {
  if (uint8[i] === 0x04 && uint8[i + 1] === 0x08) {
    headers.push(i);
    if (headers.length >= 2) break;
  }
}

console.log('Marshal headers found at:', headers);

// Load section 2 (game data)
const data = load(uint8.slice(headers[1]));

// Show top-level structure
const symbols = Object.getOwnPropertySymbols(data);
console.log('\nTop-level Symbol properties:');
symbols.forEach(s => console.log('  -', s.description));

// Check switches structure
const switchesSymbol = symbols.find(s => s.description === 'switches');
if (switchesSymbol && data[switchesSymbol]) {
  const switches = data[switchesSymbol];
  console.log('\n=== SWITCHES Structure ===');
  console.log('Type:', typeof switches);
  console.log('Is Array:', Array.isArray(switches));
  const switchSymbols = Object.getOwnPropertySymbols(switches);
  console.log('Symbols:', switchSymbols.map(s => s.description));
  const switchKeys = Object.keys(switches);
  console.log('Keys:', switchKeys.slice(0, 10));
}

const stringKeys = Object.keys(data);
console.log('\nTop-level String properties:');
stringKeys.forEach(k => console.log('  -', k));

// Navigate to actors (symbol is 'actors', not '@actors')
const actorsSymbol = symbols.find(s => s.description === 'actors');
console.log('\nActors symbol found:', !!actorsSymbol);

if (actorsSymbol && data[actorsSymbol]) {
  const actors = data[actorsSymbol];
  console.log('Actors object type:', typeof actors);

  const actorSymbols = Object.getOwnPropertySymbols(actors);
  console.log('\nActors Symbol properties:');
  actorSymbols.forEach(s => console.log('  -', s.description));

  const actorStringKeys = Object.keys(actors);
  console.log('\nActors String properties:');
  actorStringKeys.forEach(k => console.log('  -', k));

  const dataSymbol = actorSymbols.find(s => s.description === '@data');
  console.log('\nData symbol found:', !!dataSymbol);

  if (dataSymbol && actors[dataSymbol]) {
    const actorData = actors[dataSymbol];
    console.log('\nActor data array length:', actorData.length);
    console.log('Is array:', Array.isArray(actorData));

    // Get first non-null actor
    const firstActor = actorData.find(a => a !== null);

    if (firstActor) {
      const props = Object.getOwnPropertySymbols(firstActor);
      console.log('\n=== FIRST ACTOR Symbol properties ===');

      // Find @exp to show its structure
      const expSymbol = props.find(p => p.description === '@exp');
      if (expSymbol) {
        const expObj = firstActor[expSymbol];
        console.log('\n@exp object:', expObj);
        if (typeof expObj === 'object' && expObj !== null) {
          console.log('@exp keys:', Object.keys(expObj));
          console.log('@exp[1]:', expObj[1]);
        }
      }

      // Show key properties
      const levelSymbol = props.find(p => p.description === '@level');
      const nameSymbol = props.find(p => p.description === '@name');
      const hpSymbol = props.find(p => p.description === '@hp');
      const mpSymbol = props.find(p => p.description === '@mp');

      console.log('\n=== KEY PROPERTIES ===');
      console.log('@level:', levelSymbol ? firstActor[levelSymbol] : 'NOT FOUND');
      console.log('@name:', nameSymbol ? firstActor[nameSymbol] : 'NOT FOUND');
      console.log('@hp:', hpSymbol ? firstActor[hpSymbol] : 'NOT FOUND');
      console.log('@mp:', mpSymbol ? firstActor[mpSymbol] : 'NOT FOUND');

      // Also check regular string properties
      const stringProps = Object.keys(firstActor);
      if (stringProps.length > 0) {
        console.log('\n=== FIRST ACTOR String properties ===');
        stringProps.forEach(key => {
          console.log(`  ${key}:`, firstActor[key]);
        });
      }
    } else {
      console.log('No non-null actor found');
    }
  }
} else {
  console.log('Actors not found in data');
}

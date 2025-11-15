import { load, dump } from '@hyrious/marshal';

/**
 * Converts an object with Symbol keys (Ruby instance variables) to regular object
 * Uses a cache to prevent re-processing the same objects (handles circular refs and improves performance)
 * @param obj - Object with Symbol keys
 * @param depth - Current recursion depth
 * @param maxDepth - Maximum recursion depth
 * @param cache - WeakMap cache of already converted objects
 * @returns Object with string keys
 */
function symbolsToObject(obj: any, depth = 0, maxDepth = 30, cache?: WeakMap<any, any>): any {
  // Initialize cache on first call
  if (!cache) {
    cache = new WeakMap();
  }

  if (depth > maxDepth) {
    // Return a marker instead of undefined for deeply nested objects
    return '[Nested]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Check cache to avoid re-processing the same object (handles circular refs and improves performance)
  if (cache.has(obj)) {
    return cache.get(obj);
  }

  // Handle Uint8Array - try to convert to string if it looks like text
  if (obj instanceof Uint8Array) {
    try {
      const text = new TextDecoder('utf-8').decode(obj);
      // If it's short and contains only printable characters, return as string
      if (text.length < 500 && /^[\x20-\x7E\s]*$/.test(text)) {
        return text;
      }
    } catch (e) {
      // Not valid UTF-8, keep as Uint8Array
    }
    // Return array of numbers for binary data (but only first 100 bytes to avoid huge arrays)
    return obj.length > 100 ? `[Binary:${obj.length}bytes]` : Array.from(obj);
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    const result: any[] = [];
    cache.set(obj, result); // Cache before processing to handle circular refs

    // Limit array processing to prevent performance issues
    const limit = Math.min(obj.length, 1000); // Process max 1000 items
    for (let i = 0; i < limit; i++) {
      result[i] = symbolsToObject(obj[i], depth + 1, maxDepth, cache);
    }
    if (obj.length > limit) {
      result.push(`[... ${obj.length - limit} more items]`);
    }
    return result;
  }

  // Handle Objects - convert Symbol keys to string keys
  const result: any = {};
  cache.set(obj, result); // Cache before processing to handle circular refs

  // Process Symbol properties (Ruby instance variables like @name, @id, etc.)
  const symbols = Object.getOwnPropertySymbols(obj);
  symbols.forEach(sym => {
    const key = sym.description || sym.toString();
    const value = obj[sym];
    // Remove @ prefix from Ruby instance variables for cleaner JS objects
    const cleanKey = key.startsWith('@') ? key.substring(1) : key;
    result[cleanKey] = symbolsToObject(value, depth + 1, maxDepth, cache);
  });

  // Also process regular string keys
  const keys = Object.keys(obj);
  keys.forEach(key => {
    result[key] = symbolsToObject(obj[key], depth + 1, maxDepth, cache);
  });

  return result;
}

/**
 * Converts a regular object back to Symbol-keyed object for Ruby Marshal
 * @param obj - Regular JavaScript object
 * @param depth - Current recursion depth
 * @param maxDepth - Maximum recursion depth
 * @param cache - WeakMap cache of already converted objects
 * @returns Object with Symbol keys (Ruby instance variables)
 */
function objectToSymbols(obj: any, depth = 0, maxDepth = 30, cache?: WeakMap<any, any>): any {
  // Initialize cache on first call
  if (!cache) {
    cache = new WeakMap();
  }

  if (depth > maxDepth) {
    // Return the object as-is to prevent infinite recursion
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Check cache to avoid re-processing
  if (cache.has(obj)) {
    return cache.get(obj);
  }

  // Handle Arrays - convert numbers to Uint8Array if needed
  if (Array.isArray(obj)) {
    // Check if this might be a Uint8Array that was converted to array
    if (obj.length > 0 && obj.length <= 100 && obj.every(item => typeof item === 'number' && item >= 0 && item <= 255)) {
      return new Uint8Array(obj);
    }

    const result = obj.map(item => objectToSymbols(item, depth + 1, maxDepth, cache));
    cache.set(obj, result);
    return result;
  }

  // Convert regular object keys to Symbol keys
  const result: any = {};
  cache.set(obj, result);

  Object.keys(obj).forEach(key => {
    // Skip marker strings from conversion
    if (typeof obj[key] === 'string' && (obj[key].startsWith('[Binary:') || obj[key] === '[Nested]')) {
      return; // Skip these
    }

    // Top-level keys (depth 0) should NOT have @ prefix
    // Nested keys (depth > 0) should have @ prefix for instance variables
    let rubyKey: string;
    if (depth === 0) {
      // Top-level: keep as-is (no @ prefix unless already present)
      rubyKey = key;
    } else {
      // Nested: add @ prefix for instance variables (unless already present)
      rubyKey = key.startsWith('@') ? key : `@${key}`;
    }

    const symbol = Symbol(rubyKey);
    result[symbol] = objectToSymbols(obj[key], depth + 1, maxDepth, cache);
  });

  return result;
}

/**
 * Decodes .rvdata2 file (RPG Maker VX Ace save file)
 * These files use Ruby Marshal serialization with Symbol keys
 *
 * Some games (like LonaRPG) store save files with TWO Marshal sections:
 * 1. Section 1 (offset 0): Save slot metadata for display
 * 2. Section 2 (offset ~494): Actual game save data (party, actors, etc.)
 *
 * This function detects multiple sections and decodes the game data section.
 *
 * @param {ArrayBuffer} buffer - Raw binary data from .rvdata2 file
 * @returns {any} - Deserialized object with regular string keys and metadata
 */
export function decodeRvdata2(buffer: ArrayBuffer): any {
  try {
    const uint8Array = new Uint8Array(buffer);

    // Check if this is a multi-section save file
    // Look for Marshal headers (0x04 0x08) in the file
    const marshalHeaders: number[] = [];
    for (let i = 0; i < uint8Array.length - 1; i++) {
      if (uint8Array[i] === 0x04 && uint8Array[i + 1] === 0x08) {
        marshalHeaders.push(i);
        if (marshalHeaders.length >= 2) break; // Only need to find first 2
      }
    }

    let dataToLoad: Uint8Array;
    let section1Data: Uint8Array | null = null;

    if (marshalHeaders.length >= 2) {
      // Multi-section file (e.g., LonaRPG format)
      // Store section 1 for later (we need to preserve it when saving)
      section1Data = uint8Array.slice(marshalHeaders[0], marshalHeaders[1]);

      // Decode the SECOND section which contains the actual game data
      console.log(`Found multi-section .rvdata2 file (${marshalHeaders.length} sections)`);
      console.log(`Decoding game data from section 2 at offset ${marshalHeaders[1]}`);
      dataToLoad = uint8Array.slice(marshalHeaders[1]);
    } else {
      // Standard single-section file
      console.log('Standard single-section .rvdata2 file');
      dataToLoad = uint8Array;
    }

    const decoded = load(dataToLoad);

    // Convert Symbol keys to regular string keys for easier use in JavaScript
    const converted = symbolsToObject(decoded);

    // Attach section 1 metadata if multi-section file
    if (section1Data) {
      (converted as any).__section1__ = section1Data;
    }

    return converted;
  } catch (error) {
    console.error('Error decoding .rvdata2 file:', error);
    throw error;
  }
}

/**
 * Encodes data to .rvdata2 format (Ruby Marshal)
 * @param {any} data - Data with regular string keys
 * @returns {Uint8Array} - Ruby Marshal serialized data
 */
export function encodeRvdata2(data: any): Uint8Array {
  try {
    // Extract section 1 if it exists (multi-section file)
    const section1 = (data as any).__section1__;

    // Remove the section1 metadata before encoding
    const dataToEncode = { ...data };
    delete (dataToEncode as any).__section1__;

    // Convert regular string keys back to Symbol keys
    const symbolData = objectToSymbols(dataToEncode);
    const section2 = dump(symbolData);

    // If multi-section file, concatenate section 1 + section 2
    if (section1 && section1 instanceof Uint8Array) {
      console.log('Preserving multi-section structure');
      const combined = new Uint8Array(section1.length + section2.length);
      combined.set(section1, 0);
      combined.set(section2, section1.length);
      return combined;
    }

    return section2;
  } catch (error) {
    console.error('Error encoding .rvdata2 file:', error);
    throw error;
  }
}

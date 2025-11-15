/**
 * Compatibility layer to convert RPG Maker VX Ace save data format
 * to RPG Maker MV/MZ format so the UI can work with both
 */

/**
 * Wraps an array in MV/MZ format (object with @a property)
 */
function wrapArray(arr: any[]): any {
  if (!Array.isArray(arr)) return arr;
  return { '@a': arr };
}

/**
 * Unwraps MV/MZ array format back to regular array
 */
function unwrapArray(obj: any): any {
  if (obj && typeof obj === 'object' && '@a' in obj && Array.isArray(obj['@a'])) {
    return obj['@a'];
  }
  return obj;
}

/**
 * Converts snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively normalizes actor data from VX Ace to MV/MZ format
 */
function normalizeActor(actor: any): any {
  if (!actor || typeof actor !== 'object') return actor;

  const normalized: any = {};

  // Process all properties
  Object.keys(actor).forEach(key => {
    const value = actor[key];

    // Special mapping for snake_case properties → camelCase with underscore prefix
    if (key.includes('_') && !key.startsWith('_')) {
      // Convert param_plus → _paramPlus
      const camelCase = snakeToCamel(key);
      const mvMzKey = `_${camelCase}`;
      normalized[mvMzKey] = Array.isArray(value) ? wrapArray(value) : value;
    }
    // Regular properties → add underscore prefix
    else if (!key.startsWith('_')) {
      const mvMzKey = `_${key}`;
      normalized[mvMzKey] = Array.isArray(value) ? wrapArray(value) : value;
    }
    // Already has underscore → keep as is but wrap arrays
    else {
      normalized[key] = Array.isArray(value) ? wrapArray(value) : value;
    }
  });

  return normalized;
}

/**
 * Converts VX Ace save data to MV/MZ compatible format
 *
 * VX Ace uses:
 *   - party.items, party.gold, party.weapons, party.armors
 *   - actors.data (plain array)
 *   - actor properties are plain arrays
 *
 * MV/MZ uses:
 *   - party._items, party._gold, party._weapons, party._armors
 *   - actors._data (array wrapped in @a object)
 *   - actor properties wrapped in @a objects
 */
export function normalizeVxAceToMvMz(saveData: any): any {
  if (!saveData) return saveData;

  const normalized = { ...saveData };

  // Preserve section 1 metadata for multi-section files
  const section1 = (saveData as any).__section1__;
  if (section1) {
    (normalized as any).__section1__ = section1;
  }

  // Normalize party data if it exists
  if (normalized.party) {
    const party = normalized.party;

    // Map VX Ace property names to MV/MZ format (add underscores)
    if (party.gold !== undefined && party._gold === undefined) {
      party._gold = party.gold;
    }
    if (party.items !== undefined && party._items === undefined) {
      party._items = party.items;
    }
    if (party.weapons !== undefined && party._weapons === undefined) {
      party._weapons = party.weapons;
    }
    if (party.armors !== undefined && party._armors === undefined) {
      party._armors = party.armors;
    }
  }

  // Normalize actors data if it exists
  if (normalized.actors) {
    const actors = normalized.actors;

    // Map VX Ace property names to MV/MZ format
    let actorData = actors.data || actors._data;

    if (actorData && Array.isArray(actorData)) {
      // Normalize each actor
      const normalizedActors = actorData.map((actor: any) => {
        if (!actor) return actor;
        return normalizeActor(actor);
      });

      // Wrap in MV/MZ format
      actors._data = wrapArray(normalizedActors);
    }
  }

  // Normalize switches data if it exists
  if (normalized.switches) {
    const switches = normalized.switches;
    let switchData = switches.data || switches._data;

    if (switchData && Array.isArray(switchData)) {
      switches._data = wrapArray(switchData);
    }
  }

  // Normalize variables data if it exists
  if (normalized.variables) {
    const variables = normalized.variables;
    let variableData = variables.data || variables._data;

    if (variableData && Array.isArray(variableData)) {
      variables._data = wrapArray(variableData);
    }
  }

  return normalized;
}

/**
 * Converts camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Denormalizes actor data from MV/MZ format back to VX Ace
 */
function denormalizeActor(actor: any): any {
  if (!actor || typeof actor !== 'object') return actor;

  const denormalized: any = {};

  // Process all properties
  Object.keys(actor).forEach(key => {
    const value = actor[key];

    // Properties with underscore prefix → remove prefix
    if (key.startsWith('_')) {
      const withoutUnderscore = key.substring(1);

      // Check if it contains uppercase (camelCase) → convert to snake_case
      if (/[A-Z]/.test(withoutUnderscore)) {
        const snakeCase = camelToSnake(withoutUnderscore);
        denormalized[snakeCase] = unwrapArray(value);
      }
      // No uppercase → just remove underscore
      else {
        denormalized[withoutUnderscore] = unwrapArray(value);
      }
    }
    // No underscore → keep as is
    else {
      denormalized[key] = unwrapArray(value);
    }
  });

  return denormalized;
}

/**
 * Converts MV/MZ save data back to VX Ace format for saving
 * This ensures we save in the correct format
 */
export function denormalizeMvMzToVxAce(saveData: any): any {
  if (!saveData) return saveData;

  const denormalized = { ...saveData };

  // Preserve section 1 metadata for multi-section files
  const section1 = (saveData as any).__section1__;
  if (section1) {
    (denormalized as any).__section1__ = section1;
  }

  // Denormalize party data if it exists
  if (denormalized.party) {
    const party = denormalized.party;

    // Map MV/MZ property names back to VX Ace format (remove underscores)
    if (party._gold !== undefined) {
      party.gold = party._gold;
      delete party._gold; // Remove the MV/MZ version
    }
    if (party._items !== undefined) {
      party.items = party._items;
      delete party._items;
    }
    if (party._weapons !== undefined) {
      party.weapons = party._weapons;
      delete party._weapons;
    }
    if (party._armors !== undefined) {
      party.armors = party._armors;
      delete party._armors;
    }
  }

  // Denormalize actors data if it exists
  if (denormalized.actors) {
    const actors = denormalized.actors;

    // Unwrap the actors array and denormalize each actor
    if (actors._data) {
      const unwrappedData = unwrapArray(actors._data);

      if (Array.isArray(unwrappedData)) {
        const denormalizedActors = unwrappedData.map((actor: any) => {
          if (!actor) return actor;
          return denormalizeActor(actor);
        });

        actors.data = denormalizedActors;
        delete actors._data;
      }
    }
  }

  // Denormalize switches data if it exists
  if (denormalized.switches) {
    const switches = denormalized.switches;

    if (switches._data) {
      const unwrappedData = unwrapArray(switches._data);
      switches.data = unwrappedData;
      delete switches._data;
    }
  }

  // Denormalize variables data if it exists
  if (denormalized.variables) {
    const variables = denormalized.variables;

    if (variables._data) {
      const unwrappedData = unwrapArray(variables._data);
      variables.data = unwrappedData;
      delete variables._data;
    }
  }

  return denormalized;
}

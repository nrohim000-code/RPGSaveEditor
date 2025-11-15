# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RPG Save Editor is a desktop application built with Tauri v2 and React for editing RPG Maker game save files. The app supports both:
- **RPG Maker MV/MZ** (.rpgsave files) - uses LZ-String compression
- **RPG Maker VX Ace** (.rvdata2 files) - uses Ruby Marshal serialization

The app provides a user-friendly interface for modifying game data across different RPG Maker versions.

## Development Commands

### Setup
```bash
npm install
```

### Running the Application
```bash
npm run tauri dev
```
This starts the Vite dev server and launches the Tauri app in development mode.

### Building for Production
```bash
npm run tauri build
```
The built application will be in `src-tauri/target/release`.

### TypeScript Compilation
```bash
npm run build  # Compiles TypeScript and builds Vite bundle
```

### Cleaning Build Cache
If you encounter build issues:
```bash
cd src-tauri
cargo clean
cd ..
npm cache clean --force
```

## Architecture

### Tech Stack
- **Frontend**: React 18 with TypeScript, styled-components for styling
- **Desktop Framework**: Tauri v2 (Rust backend)
- **Build Tool**: Vite
- **Key Libraries**:
  - `lz-string`: For .rpgsave file compression/decompression (RPG Maker MV/MZ)
  - `@hyrious/marshal`: For .rvdata2 file serialization/deserialization (RPG Maker VX Ace)
  - `lodash`: Data manipulation utilities
  - `react-toastify`: Toast notifications
  - `react-hotkeys-hook`: Keyboard shortcuts

### Project Structure

```
src/
├── components/          # React UI components
│   ├── Header.tsx      # Top bar with file actions and theme toggle
│   ├── Sidebar.tsx     # Navigation menu
│   ├── Content.tsx     # Main content router
│   ├── PartyContent.tsx, ItemsContent.tsx, etc.
│   └── ...
├── context/
│   └── ContentContext.tsx  # Global state for save data
├── hooks/
│   └── useActions.ts   # File operations (upload, save, reload)
├── types/              # TypeScript type definitions
│   ├── RPGSave.ts      # Complete .rpgsave file structure
│   ├── SaveData.ts     # Internal save data representation
│   └── Item.ts, Weapon.ts, Armor.ts, System.ts
├── utils/
│   ├── rpgsaveUtils.ts # Encode/decode .rpgsave files (MV/MZ)
│   ├── rvdata2Utils.ts # Encode/decode .rvdata2 files (VX Ace)
│   ├── fileUtils.ts    # Tauri file I/O operations
│   └── saveDataUtils.ts # Conversion between RPGSave/SaveData
├── styles/             # Styled-components style definitions
└── themes/             # Light/dark theme configurations

src-tauri/
├── src/
│   └── main.rs         # Tauri entry point, plugin initialization
├── Cargo.toml          # Rust dependencies
└── tauri.conf.json     # Tauri configuration, updater settings
```

### Key Data Flow

1. **Loading Save Files**:
   - User selects save file via Tauri dialog (`fileUtils.ts`)
   - File type is detected based on extension (`.rpgsave` or `.rvdata2`)
   - **For .rpgsave (MV/MZ)**:
     - File is read as text (Base64-encoded LZ-String compressed data)
     - `decodeRpgsave()` decompresses to JSON and parses into `RPGSave` type
   - **For .rvdata2 (VX Ace)**:
     - File is read as binary (Ruby Marshal serialized data)
     - `decodeRvdata2()` deserializes using `@hyrious/marshal` library
   - Associated JSON files (Items.json, Weapons.json, etc.) are loaded from `www/data/` directory
   - All data stored in `ContentContext` for global access, including `fileType`

2. **Editing Data**:
   - Components read from `ContentContext` using `useContent()` hook
   - Direct mutations to `content.saveData` object
   - React state updates trigger re-renders

3. **Saving Changes**:
   - `useSave()` hook checks `content.fileType` to determine format
   - **For .rpgsave**: Serializes to JSON, then `encodeRpgsave()` compresses to Base64 LZ-String format
   - **For .rvdata2**: `encodeRvdata2()` serializes to Ruby Marshal binary format
   - Writes back to original file path

### Important Implementation Details

**File Path Assumptions**:
The app handles two different RPG Maker directory structures:

**RPG Maker MV/MZ (.rpgsave)**:
```
GameName/
└── www/
    ├── save/
    │   └── file1.rpgsave  # Save file location
    └── data/
        ├── Items.json      # Game data files (JSON format)
        ├── Weapons.json
        ├── Armors.json
        └── System.json
```

**RPG Maker VX Ace (.rvdata2)**:
```
GameName/
├── UserData/  (or Save/)
│   ├── Save01.rvdata2  # Save file location
│   ├── Save02.rvdata2
│   └── ...
└── Data/
    ├── Items.rvdata2    # Game data files (Ruby Marshal format)
    ├── Weapons.rvdata2
    ├── Armors.rvdata2
    └── System.rvdata2
```

The `getDataFilePath()` function in `useActions.ts` automatically detects the file type and navigates to the correct data directory. This logic is currently Windows-specific (uses backslashes) and may need adjustment for cross-platform support.

**File Formats**:
- **.rpgsave files (RPG Maker MV/MZ)**:
  - Text files with LZ-String compression and Base64 encoding
  - Always use `decodeRpgsave()`/`encodeRpgsave()` from `rpgsaveUtils.ts`
  - Do NOT attempt to parse directly as JSON
- **.rvdata2 files (RPG Maker VX Ace)**:
  - Binary files using Ruby Marshal serialization (version 4.8)
  - Always use `decodeRvdata2()`/`encodeRvdata2()` from `rvdata2Utils.ts`
  - Requires `@hyrious/marshal` library for serialization/deserialization
  - Do NOT attempt to parse as text or JSON
  - **Symbol Property Conversion**: Ruby instance variables (stored as Symbols like `Symbol(@name)`) are automatically converted to regular JavaScript properties (like `name`) by removing the `@` prefix. When saving, they're converted back to Symbols with `@` prefix.

**State Management**:
- `ContentContext` stores:
  - `saveData`: Current editable state
  - `originSaveData`: Original loaded state (for reload)
  - `oldSaveData`: Previous game's save (when switching games)
  - `itemData`, `weaponsData`, `armorsData`, `systemData`: Reference data from JSON files
  - `filePath`, `fileName`, `gameName`: Metadata
  - `fileType`: 'rpgsave' | 'rvdata2' - determines which encoder/decoder to use

**Tauri Plugins**:
The Rust backend uses these Tauri plugins:
- `tauri-plugin-fs`: File system operations (read/write)
- `tauri-plugin-dialog`: Native file dialogs
- `tauri-plugin-updater`: Auto-update functionality
- `tauri-plugin-shell`: Shell command execution

## Common Patterns

### Adding a New Content Section
1. Create component in `src/components/` (e.g., `NewContent.tsx`)
2. Add route case in `Content.tsx`
3. Add sidebar item in `Sidebar.tsx`
4. Access save data via `useContent()` hook
5. Update state with `setContent({ ...content, saveData: { ... } })`

### Working with Save Data Types
All save data types are defined in `src/types/`. When adding support for new game data:
1. Define TypeScript interface in `types/`
2. Update `RPGSave.ts` if modifying core save structure
3. Update `ContentContext.tsx` if adding new reference data

### File Operations Pattern
```typescript
// Upload file
const uploadFile = useFileUpload();
await uploadFile();

// Save changes
const save = useSave();
await save();

// Reload from disk
const reload = useReload();
await reload();
```

## Keyboard Shortcuts
Defined in `Hotkeys.tsx` component - check this file for current bindings.

## Build Artifacts
- NSIS installer is the default target (Windows)
- Auto-updater artifacts are generated (configured in `tauri.conf.json`)
- Update manifest: `https://raw.githubusercontent.com/truongthang2211/RPGSaveEditor/main/latest.json`

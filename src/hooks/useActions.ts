import { useCallback } from 'react';
import { ContentType, useContent } from '../context/ContentContext';
import { readFile, selectFile, writeFile, getFileType, readBinaryFileContent, writeBinaryFileContent } from '../utils/fileUtils';
import { exists, readTextFile } from '@tauri-apps/plugin-fs';
import { decodeRpgsave, encodeRpgsave } from '../utils/rpgsaveUtils';
import { decodeRvdata2, encodeRvdata2 } from '../utils/rvdata2Utils';
import { normalizeVxAceToMvMz, denormalizeMvMzToVxAce } from '../utils/vxAceCompat';
import { toast } from 'react-toastify';
import { rpgSaveToSaveData } from '../utils/saveDataUtils';
import { dirname, join } from '@tauri-apps/api/path';


export const useFileUpload = () => {
  const { content, setContent } = useContent();

  const handleReadFile = useCallback(async (filePath: string) => {
    try {
      const fileType = getFileType(filePath);

      if (fileType === 'unknown') {
        return errorNotify('Invalid file type! Please upload a .rpgsave or .rvdata2 file.');
      }

      let decodedContent: any;
      let decodedContent2: any;

      if (fileType === 'rpgsave') {
        // RPG Maker MV/MZ (.rpgsave) - text file with LZ-String compression
        const fileContent = await readFile(filePath);
        decodedContent = decodeRpgsave(fileContent);
        decodedContent2 = decodeRpgsave(fileContent);
      } else {
        // RPG Maker VX Ace (.rvdata2) - binary file with Ruby Marshal serialization
        const fileBuffer = await readBinaryFileContent(filePath);
        const rawVxAce = decodeRvdata2(fileBuffer);
        const rawVxAce2 = decodeRvdata2(fileBuffer);

        // DEBUG: Check raw VX Ace structure before normalization
        console.log('Raw VX Ace actors:', rawVxAce?.actors);
        if (rawVxAce?.actors?.data?.[1]) {
          console.log('First actor raw properties:', Object.keys(rawVxAce.actors.data[1]));
          console.log('First actor raw data:', rawVxAce.actors.data[1]);
        }

        // Normalize VX Ace format to MV/MZ format for UI compatibility
        decodedContent = normalizeVxAceToMvMz(rawVxAce);
        decodedContent2 = normalizeVxAceToMvMz(rawVxAce2);

        // DEBUG: Check normalized structure
        console.log('Normalized actors:', decodedContent?.actors);
        if (decodedContent?.actors?._data?.['@a']?.[1]) {
          console.log('First actor normalized properties:', Object.keys(decodedContent.actors._data['@a'][1]));
          console.log('First actor normalized data:', decodedContent.actors._data['@a'][1]);
        }
      }

      const gameName = getNameOfGame(filePath);

      const contentData: ContentType = {
        ...content,
        oldSaveData: gameName !== content?.gameName ? undefined : content?.originSaveData,
        saveData: rpgSaveToSaveData(decodedContent),
        originSaveData: rpgSaveToSaveData(decodedContent2),
        fileName: filePath.split('\\').pop() || '',
        filePath,
        gameName,
        fileType,
        itemData: await loadJsonData(filePath, 'Items', fileType),
        systemData: await loadJsonData(filePath, 'System', fileType),
        weaponsData: await loadJsonData(filePath, 'Weapons', fileType),
        armorsData: await loadJsonData(filePath, 'Armors', fileType),
      };

      setContent(contentData);
    } catch (error) {
      errorNotify(`Error processing file! \n${error}`);
    }
  }, [content, setContent]);

 const loadJsonData = async (filePath: string, fileName: string, fileType: 'rpgsave' | 'rvdata2') => {
   let path;
   // Check if file exists
   try {
      path = await getDataFilePath(filePath, fileName, fileType);
      const fileExists = await exists(path);
      if (!fileExists) {
        warningNotify(`Missing data file: ${path}`);
        return null;
      }
    } catch (e) {
      console.error('Failed to check file existence for', path, e);
      return null;
    }

    try {
      if (fileType === 'rpgsave') {
        // Load .json file for RPG Maker MV/MZ
        let fileContent = await readTextFile(path);

        // Remove BOM if present
        fileContent = fileContent.replace(/^\uFEFF/, '');

        // Remove control characters (except newline, tab, carriage return)
        fileContent = fileContent.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '');

        return JSON.parse(fileContent);
      } else {
        // Load .rvdata2 file for RPG Maker VX Ace
        const fileBuffer = await readBinaryFileContent(path);
        const decoded = decodeRvdata2(fileBuffer);
        return decoded;
      }

    } catch (error) {
      console.error(`Failed to load data from ${fileName}:`, error);
      warningNotify(`Failed to load data from ${fileName}: ${error}`);
      return null;
    }
  };

  const uploadFile = useCallback(async () => {
    const filePath = await selectFile();
    if (filePath) {
      await handleReadFile(filePath);
    }
  }, [handleReadFile]);

  return uploadFile;
};

export const useReload = () => {
  const { content, setContent } = useContent();

  const handleReadFile = useCallback(async (filePath: string) => {
    try {
      const fileType = getFileType(filePath);
      let decodedContent: any;
      let decodedContent2: any;

      if (fileType === 'rpgsave') {
        const fileContent = await readFile(filePath);
        decodedContent = decodeRpgsave(fileContent);
        decodedContent2 = decodeRpgsave(fileContent);
      } else if (fileType === 'rvdata2') {
        const fileBuffer = await readBinaryFileContent(filePath);
        const rawVxAce = decodeRvdata2(fileBuffer);
        const rawVxAce2 = decodeRvdata2(fileBuffer);

        // Normalize VX Ace format to MV/MZ format
        decodedContent = normalizeVxAceToMvMz(rawVxAce);
        decodedContent2 = normalizeVxAceToMvMz(rawVxAce2);
      } else {
        return errorNotify('Unknown file type!');
      }

      setContent((prev: any) => ({
        ...prev,
        oldSaveData: prev?.originSaveData || undefined,
        saveData: rpgSaveToSaveData(decodedContent),
        originSaveData: rpgSaveToSaveData(decodedContent2),
      }));
      successNotify('File Reloaded!');
    } catch (error) {
      errorNotify(`Error Reloading File Save! \n${error}`);
    }
  }, [setContent]);

  const reload = async () => {
    if (content.filePath) {
      await handleReadFile(content.filePath);
    }
    console.log('Reload triggered');
  };

  return reload;
};

export const useSave = () => {
  const { content } = useContent();

  const save = useCallback(async () => {
    try {
      if (content.filePath && content.saveData) {
        const fileType = content.fileType || getFileType(content.filePath);

        if (fileType === 'rpgsave') {
          // Save as RPG Maker MV/MZ format
          const encodedContent = encodeRpgsave(JSON.stringify(content.saveData));
          await writeFile(content.filePath, encodedContent);
        } else if (fileType === 'rvdata2') {
          // Denormalize from MV/MZ format back to VX Ace format before saving
          const vxAceData = denormalizeMvMzToVxAce(content.saveData);
          const encodedContent = encodeRvdata2(vxAceData);
          await writeBinaryFileContent(content.filePath, encodedContent);
        } else {
          return errorNotify('Unknown file type!');
        }

        successNotify('File Saved!');
      }
      console.log('Save triggered');
      console.log(content);
    } catch (error) {
      errorNotify('Error Saving File! \n' + error);
    }
  }, [content.filePath, content.saveData, content.fileType]);

  return save;
};


/**
 * Gets the path to data files (Items, Weapons, Armors, System)
 * Handles both RPG Maker MV/MZ (.json) and VX Ace (.rvdata2) directory structures
 */
const getDataFilePath = async (originalPath: string, fileName: string, fileType: 'rpgsave' | 'rvdata2'): Promise<string> => {
  try {
    if (fileType === 'rpgsave') {
      // RPG Maker MV/MZ structure:
      // GameName/www/save/file1.rpgsave
      // GameName/www/data/Items.json
      const saveDir = await dirname(originalPath);
      const wwwDir = await dirname(saveDir);
      const dataPath = await join(wwwDir, 'data', `${fileName}.json`);

      return dataPath;
    } else {
      // RPG Maker VX Ace structure:
      // GameName/UserData/Save01.rvdata2 (or GameName/Save/Save01.rvdata2)
      // GameName/Data/Items.rvdata2
      const saveDir = await dirname(originalPath); // UserData or Save directory
      const gameDir = await dirname(saveDir);       // GameName directory
      const dataPath = await join(gameDir, 'Data', `${fileName}.rvdata2`);

      return dataPath;
    }
  } catch (error) {
    const ext = fileType === 'rpgsave' ? '.json' : '.rvdata2';
    warningNotify(`Could not get data file path: ${fileName}${ext}`);
    throw error;
  }
};
function getNameOfGame(originalPath: string): string {
  const pathParts = originalPath.split('\\');
  pathParts.pop() // 'file1.rpgsave'
  pathParts.pop() // 'save'
  pathParts.pop() // 'www'
  const gameName = pathParts.pop();
  console.log(gameName);

  if (gameName) {
    return gameName;
  }
  warningNotify('Could not determine game name from file path.');
  return 'Unknown Game';
}
const successNotify = (text: string) => {
  toast.success(text, {
    position: "bottom-right",
    autoClose: 1000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};
const errorNotify = (text: string) => {
  toast.error(text, {
    position: "bottom-right",
    autoClose: 4000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

const warningNotify = (text: string) => {
  toast.warn(text, {
    position: "bottom-right",
    autoClose: 4000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

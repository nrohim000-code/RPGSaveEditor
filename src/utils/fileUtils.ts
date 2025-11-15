import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readFile as readBinaryFile, writeFile as writeBinaryFile } from '@tauri-apps/plugin-fs';

/**
 * Mở hộp thoại chọn file và trả về đường dẫn file đã chọn.
 */
export async function selectFile(): Promise<string | null> {
  const filePath = await open({
    multiple: false, // Chỉ chọn một file
    filters: [
      { name: 'RPG Save Files', extensions: ['rpgsave', 'rvdata2'] }, // Chấp nhận cả .rpgsave và .rvdata2
      { name: 'RPG Maker MV/MZ', extensions: ['rpgsave'] },
      { name: 'RPG Maker VX Ace', extensions: ['rvdata2'] }
    ],
  });
  return filePath as string | null;
}

/**
 * Đọc nội dung của file từ đường dẫn file.
 * @param filePath - Đường dẫn đến file
 * @returns Nội dung của file dưới dạng chuỗi
 */
export async function readFile(filePath: string): Promise<string> {
  const fileContent = await readTextFile(filePath);
  return fileContent;
}
/**
 * Determines file type based on extension
 * @param filePath - Path to the file
 * @returns 'rpgsave' | 'rvdata2' | 'unknown'
 */
export function getFileType(filePath: string): 'rpgsave' | 'rvdata2' | 'unknown' {
  if (filePath.endsWith('.rpgsave')) return 'rpgsave';
  if (filePath.endsWith('.rvdata2')) return 'rvdata2';
  return 'unknown';
}

// fileUtils.ts
export const saveFile = async (defaultExtension: 'rpgsave' | 'rvdata2' = 'rpgsave'): Promise<string | null> => {
  try {
    // Mở hộp thoại lưu file và nhận đường dẫn file
    const defaultPath = defaultExtension === 'rvdata2' ? 'savefile.rvdata2' : 'savefile.rpgsave';
    const filePath = await save({
      defaultPath,
      filters: [
        { name: 'RPG Save Files', extensions: ['rpgsave', 'rvdata2'] },
        { name: 'RPG Maker MV/MZ', extensions: ['rpgsave'] },
        { name: 'RPG Maker VX Ace', extensions: ['rvdata2'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    return filePath ? filePath.toString() : null;
  } catch (error) {
    console.error('Error opening save file dialog:', error);
    return null;
  }
};

export const writeFile = async (filePath: string, content: string) => {
  try {
    await writeTextFile(filePath, content);
    console.log('File saved successfully.');
  } catch (error) {
    console.error('Error writing file:', error);
  }
};

/**
 * Reads binary file content (for .rvdata2 files)
 * @param filePath - Path to the binary file
 * @returns Binary data as ArrayBuffer
 */
export async function readBinaryFileContent(filePath: string): Promise<ArrayBuffer> {
  try {
    const content = await readBinaryFile(filePath);
    return content.buffer;
  } catch (error) {
    console.error('Error reading binary file:', error);
    throw error;
  }
}

/**
 * Writes binary file content (for .rvdata2 files)
 * @param filePath - Path to write the file
 * @param content - Binary data as Uint8Array
 */
export async function writeBinaryFileContent(filePath: string, content: Uint8Array): Promise<void> {
  try {
    await writeBinaryFile(filePath, content);
    console.log('Binary file saved successfully.');
  } catch (error) {
    console.error('Error writing binary file:', error);
    throw error;
  }
}
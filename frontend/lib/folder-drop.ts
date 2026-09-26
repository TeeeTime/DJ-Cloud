export const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff", ".aif", ".m4a", ".ogg"];
export const MAX_FILE_SIZE = 200 * 1024 * 1024;

export function hasAudioExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export interface FolderBatch {
  id: number;
  folderName: string;
  files: File[];
  oversizedNames: string[];
}

export function collectDroppedEntries(dataTransfer: DataTransfer): {
  fileEntries: FileSystemFileEntry[];
  dirEntries: FileSystemDirectoryEntry[];
  supported: boolean;
} {
  const items = dataTransfer.items;
  if (!items || items.length === 0 || typeof items[0]?.webkitGetAsEntry !== "function") {
    return { fileEntries: [], dirEntries: [], supported: false };
  }

  const fileEntries: FileSystemFileEntry[] = [];
  const dirEntries: FileSystemDirectoryEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind !== "file") continue;
    const entry = items[i].webkitGetAsEntry();
    if (!entry) continue;
    if (entry.isDirectory) dirEntries.push(entry as FileSystemDirectoryEntry);
    else if (entry.isFile) fileEntries.push(entry as FileSystemFileEntry);
  }
  return { fileEntries, dirEntries, supported: true };
}

export function fileEntryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries(batch => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        // readEntries() caps results per call (historically ~100 in Chromium) — loop until empty.
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function walkDirectory(dirEntry: FileSystemDirectoryEntry): Promise<File[]> {
  const entries = await readAllDirectoryEntries(dirEntry.createReader());
  const files: File[] = [];
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await fileEntryToFile(entry as FileSystemFileEntry);
      if (hasAudioExtension(file.name)) files.push(file);
    } else if (entry.isDirectory) {
      files.push(...(await walkDirectory(entry as FileSystemDirectoryEntry)));
    }
  }
  return files;
}

let batchIdCounter = 0;

export async function buildFolderBatch(dirEntry: FileSystemDirectoryEntry): Promise<FolderBatch> {
  const audioFiles = await walkDirectory(dirEntry);
  const files: File[] = [];
  const oversizedNames: string[] = [];
  for (const file of audioFiles) {
    if (file.size > MAX_FILE_SIZE) oversizedNames.push(file.name);
    else files.push(file);
  }
  return { id: batchIdCounter++, folderName: dirEntry.name, files, oversizedNames };
}

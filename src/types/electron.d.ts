export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  selectIcon: () => Promise<string | null>;
  setFolderIcon: (folderPath: string, iconPath: string) => Promise<void>;
  loadEmojis: () => Promise<string[]>;
  getEmojiPath: (index: number) => Promise<string>;
  getPreviews: (iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => Promise<string[]>;
  applyIcon: (folderPath: string, iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
} 
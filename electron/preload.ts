import { contextBridge, ipcRenderer } from 'electron';

// Определяем типы для API
interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  selectIcon: () => Promise<string | null>;
  setFolderIcon: (folderPath: string, iconPath: string) => Promise<void>;
  loadEmojis: () => Promise<string[]>;
  getEmojiPath: (index: number) => Promise<string>;
  getPreviews: (iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => Promise<string[]>;
  applyIcon: (folderPath: string, iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => Promise<void>;
}

// Экспортируем API в глобальный объект window
contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectIcon: () => ipcRenderer.invoke('select-icon'),
  setFolderIcon: (folderPath: string, iconPath: string) => 
    ipcRenderer.invoke('set-folder-icon', folderPath, iconPath),
  loadEmojis: () => ipcRenderer.invoke('load-emojis'),
  getEmojiPath: (index: number) => ipcRenderer.invoke('get-emoji-path', index),
  getPreviews: (iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) =>
    ipcRenderer.invoke('get-previews', iconPath, emojiIndex, hue, saturation, brightness),
  applyIcon: (folderPath: string, iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) =>
    ipcRenderer.invoke('apply-icon', folderPath, iconPath, emojiIndex, hue, saturation, brightness)
});

export {}; 
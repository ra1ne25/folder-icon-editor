import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Добавляем CSP заголовки
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self';",
          "style-src 'self' 'unsafe-inline';",
          "img-src 'self' data:;",
          "connect-src 'self'"
        ].join(' ')
      }
    });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-icon', async () => {
  const result = await dialog.showOpenDialog({
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'ico'] }
    ],
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('set-folder-icon', async (_, folderPath: string, iconPath: string) => {
  try {
    const iconBuffer = await fs.promises.readFile(iconPath);
    const targetPath = path.join(folderPath, 'folder.ico');
    await fs.promises.writeFile(targetPath, iconBuffer);
  } catch (error) {
    console.error('Error setting folder icon:', error);
    throw error;
  }
});

ipcMain.handle('load-emojis', async () => {
  const emojisDir = path.join(__dirname, '../../build/assets/emojis');
  const files = await fs.promises.readdir(emojisDir);
  return files.map(file => path.join(emojisDir, file));
});

ipcMain.handle('get-emoji-path', async (_, index: number) => {
  const emojisDir = path.join(__dirname, '../../build/assets/emojis');
  const files = await fs.promises.readdir(emojisDir);
  return path.join(emojisDir, files[index]);
});

ipcMain.handle('get-previews', async (_, iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => {
  try {
    const iconBuffer = await fs.promises.readFile(iconPath);
    const originalImage = await sharp(iconBuffer).toBuffer();
    
    let modifiedImage = originalImage;
    if (emojiIndex !== null) {
      const emojisDir = path.join(__dirname, '../../build/assets/emojis');
      const files = await fs.promises.readdir(emojisDir);
      const emojiPath = path.join(emojisDir, files[emojiIndex]);
      const emojiBuffer = await fs.promises.readFile(emojiPath);
      modifiedImage = await sharp(emojiBuffer)
        .resize(32, 32)
        .toBuffer();
    }

    modifiedImage = await sharp(modifiedImage)
      .modulate({
        hue,
        saturation,
        brightness
      })
      .toBuffer();

    return [
      `data:image/png;base64,${originalImage.toString('base64')}`,
      `data:image/png;base64,${modifiedImage.toString('base64')}`
    ];
  } catch (error) {
    console.error('Error generating previews:', error);
    throw error;
  }
});

ipcMain.handle('apply-icon', async (_, folderPath: string, iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => {
  try {
    const iconBuffer = await fs.promises.readFile(iconPath);
    let modifiedIcon = iconBuffer;

    if (emojiIndex !== null) {
      const emojisDir = path.join(__dirname, '../../build/assets/emojis');
      const files = await fs.promises.readdir(emojisDir);
      const emojiPath = path.join(emojisDir, files[emojiIndex]);
      const emojiBuffer = await fs.promises.readFile(emojiPath);
      modifiedIcon = await sharp(emojiBuffer)
        .resize(32, 32)
        .toBuffer();
    }

    modifiedIcon = await sharp(modifiedIcon)
      .modulate({
        hue,
        saturation,
        brightness
      })
      .toBuffer();

    const targetPath = path.join(folderPath, 'folder.ico');
    await fs.promises.writeFile(targetPath, modifiedIcon);
  } catch (error) {
    console.error('Error applying icon:', error);
    throw error;
  }
});

async function setFolderAttributes(folderPath: string) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(`attrib +s "${folderPath}"`, (error: Error | null) => {
      if (error) reject(error);
      else resolve(true);
    });
  });
}

async function setFileAttributes(filePath: string) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(`attrib +s +h "${filePath}"`, (error: Error | null) => {
      if (error) reject(error);
      else resolve(true);
    });
  });
} 
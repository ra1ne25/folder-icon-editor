import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
// @ts-ignore
import * as icoEndec from 'ico-endec';
// @ts-ignore
import colorsys from 'colorsys';

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
  const emojisDir = path.join(__dirname, '../../public/assets/emojis');
  const files = await fs.promises.readdir(emojisDir);
  return files.map(file => `/assets/emojis/${file}`);
});

ipcMain.handle('get-emoji-path', async (_, index: number) => {
  const emojisDir = path.join(__dirname, '../../public/assets/emojis');
  const files = await fs.promises.readdir(emojisDir);
  return path.join(emojisDir, files[index]);
});

ipcMain.handle('get-previews', async (_, iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => {
  console.log('get-previews HSB:', hue, saturation, brightness);
  try {
    const iconBuffer = await fs.promises.readFile(iconPath);
    let originalImage;
    
    if (iconPath.toLowerCase().endsWith('.ico')) {
      const decodedIcons = await icoEndec.decode(iconBuffer);
      const firstIcon = decodedIcons[0];
      // Всегда декодируем через sharp для PNG и BMP
      originalImage = await sharp(firstIcon._imageData).png().toBuffer();
    } else {
      originalImage = await sharp(iconBuffer).png().toBuffer();
    }

    // --- Ручной HSB-сдвиг ---
    const { data, info } = await sharp(originalImage).raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i += 4) {
      let r = out[i], g = out[i+1], b = out[i+2], a = out[i+3];
      if (a === 0) continue;
      // Гарантируем диапазон 0-255
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      let { h, s, v } = colorsys.rgb_to_hsv({ r, g, b });
      // Нормализуем оттенок в диапазон 0-1
      h = (h/360 + hue/360) % 1; if (h < 0) h += 1;
      // Нормализуем насыщенность и яркость в диапазон -1 до 1
      s = Math.min(Math.max(s/100 + (saturation - 100)/100, 0), 1);
      v = Math.min(Math.max(v/100 + (brightness - 100)/100, 0), 1);
      const { r: nr, g: ng, b: nb } = colorsys.hsv_to_rgb({ h: h*360, s: s*100, v: v*100 });
      out[i] = Math.round(Math.max(0, Math.min(255, nr)));
      out[i+1] = Math.round(Math.max(0, Math.min(255, ng)));
      out[i+2] = Math.round(Math.max(0, Math.min(255, nb)));
    }
    let modifiedImage = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();

    // --- Наложение эмодзи ---
    if (emojiIndex !== null) {
      const emojisDir = path.join(__dirname, '../../public/assets/emojis');
      const files = await fs.promises.readdir(emojisDir);
      const emojiPath = path.join(emojisDir, files[emojiIndex]);
      const emojiBuffer = await fs.promises.readFile(emojiPath);
      const { width, height } = info;
      const targetSize = Math.min(width || 0, height || 0) / 3;
      const emojiResized = await sharp(emojiBuffer)
        .resize(Math.round(targetSize), Math.round(targetSize), {
          fit: 'inside',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer();
      modifiedImage = await sharp(modifiedImage)
        .composite([{
          input: emojiResized,
          gravity: 'center',
          left: Math.round((info.width - targetSize) / 2),
          top: Math.round((info.height - targetSize) / 2)
        }])
        .png()
        .toBuffer();
    }

    return [
      `data:image/png;base64,${originalImage.toString('base64')}`,
      `data:image/png;base64,${modifiedImage.toString('base64')}`
    ];
  } catch (error) {
    console.error('Error generating previews:', error);
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

ipcMain.handle('apply-icon', async (_, folderPath: string, iconPath: string, emojiIndex: number | null, hue: number, saturation: number, brightness: number) => {
  try {
    console.log('Starting icon application process...');
    console.log('Input parameters:', { folderPath, iconPath, emojiIndex, hue, saturation, brightness });
    
    const iconBuffer = await fs.promises.readFile(iconPath);
    console.log('Original icon loaded, size:', iconBuffer.length);
    
    let modifiedIcon;
    
    if (iconPath.toLowerCase().endsWith('.ico')) {
      console.log('Processing ICO file...');
      const decodedIcons = await icoEndec.decode(iconBuffer);
      console.log('Decoded ICO, found icons:', decodedIcons.length);
      const firstIcon = decodedIcons[0];
      console.log('First icon details:', { 
        width: firstIcon._width, 
        height: firstIcon._height, 
        type: firstIcon._imageType 
      });
      
      if (firstIcon._imageType === 'png') {
        console.log('Converting PNG icon...');
        modifiedIcon = await sharp(firstIcon._imageData)
          .toFormat('png')
          .toBuffer();
      } else {
        console.log('Converting raw icon data...');
        modifiedIcon = await sharp(firstIcon._imageData, {
          raw: {
            width: firstIcon._width,
            height: firstIcon._height,
            channels: 4
          }
        })
          .toFormat('png')
          .toBuffer();
      }
    } else {
      console.log('Processing non-ICO file...');
      modifiedIcon = await sharp(iconBuffer)
        .toFormat('png')
        .toBuffer();
    }
    console.log('Initial conversion complete, size:', modifiedIcon.length);

    // Приводим значения к диапазону sharp
    const hueSharp2 = Math.max(-180, Math.min(180, hue * 180));
    const satSharp2 = Math.max(0, Math.min(2, 1 + saturation));
    const briSharp2 = Math.max(0, Math.min(2, 1 + brightness));
    console.log('HSB values for sharp:', { hueSharp2, satSharp2, briSharp2 });

    // Применяем HSB изменения
    console.log('Applying HSB modifications...');
    modifiedIcon = await sharp(modifiedIcon)
      .modulate({
        hue: hueSharp2,
        saturation: satSharp2,
        brightness: briSharp2
      })
      .toBuffer();
    console.log('HSB modifications applied, size:', modifiedIcon.length);

    // Накладываем эмодзи если выбран
    if (emojiIndex !== null) {
      console.log('Adding emoji overlay...');
      const emojisDir = path.join(__dirname, '../../public/assets/emojis');
      const files = await fs.promises.readdir(emojisDir);
      const emojiPath = path.join(emojisDir, files[emojiIndex]);
      console.log('Selected emoji:', emojiPath);
      
      const emojiBuffer = await fs.promises.readFile(emojiPath);
      const { width, height } = await sharp(modifiedIcon).metadata();
      const targetSize = Math.min(width || 0, height || 0) / 3;
      console.log('Emoji target size:', targetSize);
      
      const emojiResized = await sharp(emojiBuffer)
        .resize(Math.round(targetSize), Math.round(targetSize), {
          fit: 'inside',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer();
      
      modifiedIcon = await sharp(modifiedIcon)
        .composite([{
          input: emojiResized,
          gravity: 'center',
          left: Math.round(((width || 0) - targetSize) / 2),
          top: Math.round(((height || 0) - targetSize) / 2)
        }])
        .toBuffer();
      console.log('Emoji overlay complete, size:', modifiedIcon.length);
    }

    const iconName = 'foldericon.ico';
    const targetPath = path.join(folderPath, iconName);
    console.log('Preparing ICO encoding...');
    
    const { data, info } = await sharp(modifiedIcon)
      .raw()
      .toBuffer({ resolveWithObject: true });
    console.log('Raw image data obtained:', { 
      width: info.width, 
      height: info.height, 
      channels: info.channels,
      dataSize: data.length 
    });
    
    // Создаем новый буфер с правильным форматом
    const pixelData = Buffer.alloc(data.length);
    data.copy(pixelData);
    console.log('Pixel data buffer created, size:', pixelData.length);
    
    // Создаем массив буферов для каждого размера иконки
    const iconBuffers = [{
      width: info.width,
      height: info.height,
      bpp: 32,
      buffer: Buffer.from(pixelData)
    }];
    console.log('Added main icon size:', { width: info.width, height: info.height });

    // Добавляем уменьшенные версии иконки
    const sizes = [48, 32, 16];
    for (const size of sizes) {
      console.log(`Creating ${size}x${size} icon...`);
      const resized = await sharp(modifiedIcon)
        .resize(size, size)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const resizedBuffer = Buffer.from(resized.data);
      console.log(`Created ${size}x${size} buffer, size:`, resizedBuffer.length);
      
      iconBuffers.push({
        width: size,
        height: size,
        bpp: 32,
        buffer: resizedBuffer
      });
    }
    
    console.log('Starting ICO encoding...');
    if (!iconBuffers.every(icon => Buffer.isBuffer(icon.buffer))) {
      throw new Error('Invalid buffer format detected');
    }
    
    const encodedBuffers = iconBuffers.map(icon => ({
      width: icon.width,
      height: icon.height,
      bpp: icon.bpp,
      data: icon.buffer
    }));
    
    const icoArrayBuffer = await icoEndec.encode(encodedBuffers);
    const icoBuffer = Buffer.from(icoArrayBuffer);
    console.log('ICO encoding complete, size:', icoBuffer.length);
    
    console.log('Writing ICO file...');
    await fs.promises.writeFile(targetPath, icoBuffer);
    console.log('ICO file written successfully');

    // Создаем desktop.ini
    console.log('Creating desktop.ini...');
    const iniPath = path.join(folderPath, 'desktop.ini');
    const iniContent = `[.ShellClassInfo]
IconResource=${iconName},0
IconFile=${iconName}
IconIndex=0
`;
    await fs.promises.writeFile(iniPath, iniContent);
    console.log('desktop.ini created');

    // Устанавливаем атрибуты
    console.log('Setting file attributes...');
    await setFileAttributes(iniPath);
    await setFolderAttributes(folderPath);
    console.log('Attributes set successfully');

    console.log('Icon application process completed successfully');
  } catch (error: any) {
    console.error('Error applying icon:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}); 
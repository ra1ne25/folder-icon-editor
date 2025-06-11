import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
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
    
    let modifiedIcons: Buffer[] = [];
    
    if (iconPath.toLowerCase().endsWith('.ico')) {
      console.log('Processing ICO file...');
      const decodedIcons = await icoEndec.decode(iconBuffer);
      console.log('Decoded ICO, found icons:', decodedIcons.length);
      
      // Обрабатываем каждую иконку из ICO файла
      for (const icon of decodedIcons) {
        let modifiedIcon: Buffer;
        
        try {
          // Пробуем через промежуточный формат
          modifiedIcon = await sharp(icon._imageData, {
            raw: {
              width: icon._width,
              height: icon._height,
              channels: 4
            }
          }).toFormat('png').toBuffer();
        } catch (error) {
          console.log('Raw conversion failed, trying direct method...');
          // Если не получилось, пробуем напрямую
          modifiedIcon = await sharp(icon._imageData).png().toBuffer();
        }
        
        // Применяем HSB изменения через ручной сдвиг
        const { data, info } = await sharp(modifiedIcon).raw().toBuffer({ resolveWithObject: true });
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
        modifiedIcon = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
          
        // Накладываем эмодзи если выбран
        if (emojiIndex !== null) {
          const emojisDir = path.join(__dirname, '../../public/assets/emojis');
          const files = await fs.promises.readdir(emojisDir);
          const emojiPath = path.join(emojisDir, files[emojiIndex]);
          
          const emojiBuffer = await fs.promises.readFile(emojiPath);
          const { width, height } = await sharp(modifiedIcon).metadata();
          const targetSize = Math.min(width || 0, height || 0) / 3;
          
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
        }
        
        modifiedIcons.push(modifiedIcon);
      }
    } else {
      console.log('Processing non-ICO file...');
      let modifiedIcon = await sharp(iconBuffer).png().toBuffer();
      
      // Применяем HSB изменения через ручной сдвиг
      const { data, info } = await sharp(modifiedIcon).raw().toBuffer({ resolveWithObject: true });
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
      modifiedIcon = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
        
      // Накладываем эмодзи если выбран
      if (emojiIndex !== null) {
        const emojisDir = path.join(__dirname, '../../public/assets/emojis');
        const files = await fs.promises.readdir(emojisDir);
        const emojiPath = path.join(emojisDir, files[emojiIndex]);
        
        const emojiBuffer = await fs.promises.readFile(emojiPath);
        const { width, height } = await sharp(modifiedIcon).metadata();
        const targetSize = Math.min(width || 0, height || 0) / 3;
        
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
      }
      
      modifiedIcons.push(modifiedIcon);
    }

    const iconName = 'foldericon.ico';
    const targetPath = path.join(folderPath, iconName);
    console.log('Preparing ICO encoding...');
    
    console.log('Starting ICO encoding...');
    const icoBuffer = await pngToIco(modifiedIcons);
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
    
    try {
      // Пробуем удалить существующий файл если он есть
      try {
        await fs.promises.unlink(iniPath);
      } catch (error) {
        // Игнорируем ошибку если файл не существует
      }
      
      // Создаем новый файл
      await fs.promises.writeFile(iniPath, iniContent);
      console.log('desktop.ini created');

      // Устанавливаем атрибуты
      console.log('Setting file attributes...');
      await setFileAttributes(iniPath);
      await setFolderAttributes(folderPath);
      console.log('Attributes set successfully');
    } catch (error) {
      console.error('Error creating desktop.ini:', error);
      // Продолжаем выполнение даже если не удалось создать desktop.ini
    }

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
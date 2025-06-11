const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../build/electron/preload.js');
const targetDir = path.join(__dirname, '../build');
const targetFile = path.join(targetDir, 'preload.js');

// Проверяем существование директории
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Копируем файл
fs.copyFileSync(sourceFile, targetFile);
console.log('preload.js скопирован успешно'); 
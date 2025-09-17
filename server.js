const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

fs.ensureDirSync('uploads');

const usedIds = new Set();

function generateRandomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const minLength = 5;
  const maxLength = 12;

  let result = '';
  let attempts = 0;
  const maxAttempts = 1000;

  do {
    result = '';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    attempts++;
    if (attempts > maxAttempts) {
      result += Date.now().toString().slice(-4);
      break;
    }
  } while (usedIds.has(result));

  usedIds.add(result);
  return result;
}

function calculateExpirationDate(expiration) {
  const now = new Date();
  const hours = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '72h': 72
  };

  now.setTime(now.getTime() + (hours[expiration] || 1) * 60 * 60 * 1000);

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');

  const result = `${year}${month}${day}${hour}`;
  return result;
}

function generateFilename(originalName, settings) {
  const randomId = generateRandomId();
  const expDate = calculateExpirationDate(settings.expiration || '1h');
  const singleDownload = settings.singleDownload ? 'true' : 'false';
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);

  return `${randomId}-${expDate}-${singleDownload}-${baseName}${extension}`;
}

function parseFilename(filename) {
  const parts = filename.split('-');
  if (parts.length < 4) return null;

  const randomId = parts[0];
  const expDate = parts[1];
  const singleDownload = parts[2] === 'true';
  const originalName = parts.slice(3).join('-');

  return {
    randomId,
    expDate,
    singleDownload,
    originalName,
    isExpired: isFileExpired(expDate)
  };
}

function isFileExpired(expDateStr) {
  try {
    const year = parseInt(expDateStr.substr(0, 4));
    const month = parseInt(expDateStr.substr(4, 2)) - 1;
    const day = parseInt(expDateStr.substr(6, 2));
    const hour = parseInt(expDateStr.substr(8, 2));

    const expDate = new Date(Date.UTC(year, month, day, hour));
    const now = new Date();
    const isExpired = now > expDate;

    return isExpired;
  } catch (error) {
    return true;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {

    const tempName = Date.now() + '-temp-' + file.originalname;
    cb(null, tempName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:randomId', (req, res) => {
  const randomId = req.params.randomId;

  fs.readdir('uploads', (err, files) => {
    if (err) {
      return res.status(500).send('Server error');
    }

    const matchingFile = files.find(file => {
      const fileInfo = parseFilename(file);
      return fileInfo && fileInfo.randomId === randomId;
    });

    if (!matchingFile) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>File Not Found</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="container">
                <div class="main-content">
                    <div class="error-page">
                        <h1>File Not Found</h1>
                        <p>The file you're looking for doesn't exist or has expired.</p>
                        <a href="/" class="btn-primary">Go Home</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
      `);
    }

    const fileInfo = parseFilename(matchingFile);

    if (fileInfo.isExpired) {

      fs.unlinkSync(path.join('uploads', matchingFile));
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>File Expired</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="container">
                <div class="main-content">
                    <div class="error-page">
                        <h1>File Expired</h1>
                        <p>This file has expired and is no longer available.</p>
                        <a href="/" class="btn-primary">Go Home</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
      `);
    }

    const stats = fs.statSync(path.join('uploads', matchingFile));
    const fileSize = (stats.size / (1024 * 1024)).toFixed(2);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Download - ${fileInfo.originalName}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="/style.css">
          <link rel="stylesheet" href="/download.css">
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
      </head>
      <body>
          <button class="theme-toggle" onclick="toggleTheme()">
              <i class="fas fa-sun"></i>
              <i class="fas fa-moon"></i>
          </button>
          <div class="container">
              <div class="download-card">
                  <div class="file-icon">
                      <i class="fas fa-file"></i>
                  </div>
                  <h1 class="file-name">${fileInfo.originalName}</h1>
                  <p class="file-size">${fileSize} MB</p>
                  ${fileInfo.singleDownload ? '<div class="warning">⚠️ This file can only be downloaded once</div>' : ''}
                  <a href="/uploads/${matchingFile}" class="download-btn">
                      <i class="fas fa-download"></i>
                      Download File
                  </a>
                  <a href="/" class="back-link">← Back to Upload</a>
              </div>
          </div>
          <script>
              function toggleTheme() {
                  const body = document.body;
                  const currentTheme = body.getAttribute('data-theme');
                  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                  body.setAttribute('data-theme', newTheme);
                  localStorage.setItem('theme', newTheme);
              }

              const savedTheme = localStorage.getItem('theme');
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              const theme = savedTheme || (prefersDark ? 'dark' : 'light');
              document.body.setAttribute('data-theme', theme);
          </script>
      </body>
      </html>
    `);
  });
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const settings = {
    password: req.body.password || null,
    singleDownload: req.body.singleDownload === 'true',
    expiration: req.body.expiration || '1h'
  };

  const newFilename = generateFilename(req.file.originalname, settings);
  const oldPath = req.file.path;
  const newPath = path.join('uploads', newFilename);

  fs.renameSync(oldPath, newPath);

  const fileUrl = `/uploads/${newFilename}`;
  const downloadUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

  const fileInfo = parseFilename(newFilename);
  const shortUrl = `${req.protocol}://${req.get('host')}/${fileInfo.randomId}`;

  res.json({
    success: true,
    filename: req.file.originalname,
    url: shortUrl,
    size: req.file.size,
    settings: settings
  });
});

app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join('uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const fileInfo = parseFilename(filename);

  if (fileInfo && fileInfo.isExpired) {

    fs.unlinkSync(filePath);
    return res.status(404).json({ error: 'File has expired' });
  }

  if (fileInfo && fileInfo.singleDownload) {
    res.download(filePath, fileInfo.originalName, (err) => {
      if (!err) {
        fs.unlink(filePath, (unlinkErr) => {
          if (!unlinkErr) {
            console.log(`Deleted single-download file: ${filename}`);
          }
        });
      }
    });
  } else {
    res.download(filePath, fileInfo ? fileInfo.originalName : filename);
  }
});

app.get('/files', (req, res) => {
  fs.readdir('uploads', (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read files' });
    }

    const fileList = files.map(file => {
      const filePath = path.join('uploads', file);
      const stats = fs.statSync(filePath);
      const fileInfo = parseFilename(file);

      return {
        name: fileInfo ? fileInfo.originalName : file,
        size: stats.size,
        url: `/uploads/${file}`,
        uploadDate: stats.birthtime,
        expired: fileInfo ? fileInfo.isExpired : false,
        singleDownload: fileInfo ? fileInfo.singleDownload : false
      };
    }).filter(file => !file.expired);

    res.json(fileList);
  });
});

function cleanupExpiredFiles() {
  fs.readdir('uploads', (err, files) => {
    if (err) return;

    files.forEach(file => {
      const fileInfo = parseFilename(file);
      if (fileInfo && fileInfo.isExpired) {
        const filePath = path.join('uploads', file);
        fs.unlink(filePath, (unlinkErr) => {
          if (!unlinkErr) {
            console.log(`Deleted expired file: ${file}`);
          }
        });
      }
    });
  });
}

setInterval(cleanupExpiredFiles, 60 * 60 * 1000);

cleanupExpiredFiles();

app.listen(PORT, () => {
  console.log(`FileShare server running on port ${PORT}`);
});
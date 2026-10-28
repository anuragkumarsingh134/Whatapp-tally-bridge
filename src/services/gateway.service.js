const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config');
const { serverLog } = require('./state');
const { stampImage, applyRateCode } = require('./stamp.service');

async function prepareLocalMediaUrl(task, gwConfig) {
  const localPathRaw = task.localPath || task.localpath || task.local_path || task.src || task.filePath || task.filepath;
  if (!localPathRaw) {
    serverLog(`[COPY WARNING] No localPath provided for ${task.fileName || 'photo'}`, 'warn');
    return null;
  }

  const source = path.normalize(localPathRaw.replace(/^["']|["']$/g, ''));
  const publicDir = path.normalize(task.publicPdfDir || gwConfig.publicPdfDir || 'H:\\HTTPSERVER\\PDFS');

  if (!fs.existsSync(source)) {
    serverLog(`[COPY ERROR] Source image file does NOT exist on disk: "${source}"`, 'error');
    return null;
  }

  if (!fs.existsSync(publicDir)) {
    try {
      fs.mkdirSync(publicDir, { recursive: true });
      serverLog(`[DIR CREATED] Created target public directory: "${publicDir}"`);
    } catch (e) {
      serverLog(`[DIR ERROR] Failed to create directory "${publicDir}": ${e.message}`, 'error');
      return null;
    }
  }

  let fileName = task.fileName || task.filename || path.basename(source) || 'photo.jpg';
  let caption = task.caption || '';
  if (task.useRateCode === 'Yes' || task.useratecode === 'Yes') caption = applyRateCode(caption);

  if (task.type === 'stamp' || Boolean(task.stampText || task.stamptext)) {
    const uniqueName = `STAMP_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const stampPath = path.join(publicDir, uniqueName);
    const stampTxt = task.stampText || task.stamptext || 'Unknown';
    const rateOpt = task.useRateCode || task.useratecode;
    serverLog(`[STAMPING] Stamping photo: "${source}" -> "${stampPath}"`);
    if (await stampImage(source, stampPath, stampTxt, rateOpt)) {
      fileName = uniqueName;
      caption = '';
      serverLog(`[STAMP OK] Stamped and copied: "${stampPath}"`);
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      serverLog(`[STAMP ERROR] Stamping failed for "${source}". Falling back to raw copy.`, 'error');
      const dest = path.join(publicDir, fileName);
      try { fs.copyFileSync(source, dest); } catch (_) {}
    }
  } else {
    const dest = path.join(publicDir, fileName);
    try {
      fs.copyFileSync(source, dest);
      serverLog(`[COPY OK] Copied "${source}" -> "${dest}"`);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      serverLog(`[COPY ERROR] Failed copying to "${dest}": ${err.message}`, 'error');
      return null;
    }
  }

  const publicBase = task.publicBaseUrl || `${gwConfig.pdfBaseUrl || 'https://pdf.infinivps.com/'}`;
  const cleanFileName = decodeURIComponent(fileName);
  const publicUrl = `${publicBase.endsWith('/') ? publicBase : publicBase + '/'}${encodeURI(cleanFileName)}`;
  return { publicUrl, fileName, caption };
}

async function buildFinalDispatchUrl(task, taskPriority, currentNumber, baseApiUrl, deviceId, apiKey, gwConfig) {
  if (taskPriority === 2) {
    return `${baseApiUrl}/send-text?deviceId=${encodeURIComponent(deviceId)}&apiKey=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(currentNumber)}&message=${encodeURIComponent(task.message)}`;
  }

  if (taskPriority === 1) {
    const fileName = task.fileName || 'document.pdf';
    let fileUrl = task.fileUrl || task.url || '';
    try { fileUrl = encodeURI(decodeURI(fileUrl)); } catch (_) { fileUrl = encodeURI(fileUrl); }
    return `${baseApiUrl}/send-file?deviceId=${encodeURIComponent(deviceId)}&apiKey=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(currentNumber)}&url=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(fileName)}${task.caption ? '&caption=' + encodeURIComponent(task.caption) : ''}`;
  }

  let targetUrl = '';
  let targetFileName = task.fileName || 'photo.jpg';
  let targetCaption = task.caption || '';

  const localPathVal = task.localPath || task.localpath || task.local_path || task.src || task.filePath || task.filepath;
  if (localPathVal) {
    const prepared = await prepareLocalMediaUrl(task, gwConfig);
    if (prepared) {
      targetUrl = prepared.publicUrl;
      targetFileName = prepared.fileName;
      targetCaption = prepared.caption;
    } else {
      let fileUrl = task.fileUrl || task.url || '';
      if (!fileUrl && task.fileName) {
        const base = task.publicBaseUrl || gwConfig.pdfBaseUrl || 'https://pdf.infinivps.com/';
        fileUrl = `${base.replace(/\/+$/, '')}/${encodeURI(task.fileName)}`;
      }
      try { fileUrl = encodeURI(decodeURI(fileUrl)); } catch (_) { fileUrl = encodeURI(fileUrl); }
      targetUrl = fileUrl;
    }
  } else {
    let fileUrl = task.fileUrl || task.url || '';
    if (!fileUrl && task.fileName) {
      const base = task.publicBaseUrl || gwConfig.pdfBaseUrl || 'https://pdf.infinivps.com/';
      fileUrl = `${base.replace(/\/+$/, '')}/${encodeURI(task.fileName)}`;
    }
    try { fileUrl = encodeURI(decodeURI(fileUrl)); } catch (_) { fileUrl = encodeURI(fileUrl); }
    targetUrl = fileUrl;
  }

  const isImage = targetFileName.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/);
  const endpoint = isImage ? 'send-image' : 'send-file';

  if (endpoint === 'send-image') {
    return `${baseApiUrl}/send-image?deviceId=${encodeURIComponent(deviceId)}&apiKey=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(currentNumber)}&url=${targetUrl}${targetCaption ? '&caption=' + encodeURIComponent(targetCaption) : ''}`;
  }
  return `${baseApiUrl}/send-file?deviceId=${encodeURIComponent(deviceId)}&apiKey=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(currentNumber)}&url=${targetUrl}&fileName=${encodeURIComponent(targetFileName)}${targetCaption ? '&caption=' + encodeURIComponent(targetCaption) : ''}`;
}

module.exports = {
  prepareLocalMediaUrl,
  buildFinalDispatchUrl
};

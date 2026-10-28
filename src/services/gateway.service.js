const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config');
const { serverLog } = require('./state');
const { stampImage, applyRateCode } = require('./stamp.service');

async function prepareLocalMediaUrl(task, gwConfig) {
  const source = path.normalize(task.localPath);
  const publicDir = path.normalize(task.publicPdfDir || gwConfig.publicPdfDir || 'H:\\HTTPSERVER\\PDFS');

  if (!fs.existsSync(publicDir)) {
    try { fs.mkdirSync(publicDir, { recursive: true }); } catch (_) {}
  }

  let fileName = task.fileName || path.basename(source) || 'photo.jpg';
  let caption = task.caption || '';
  if (task.useRateCode === 'Yes') caption = applyRateCode(caption);

  if (task.type === 'stamp' || Boolean(task.stampText)) {
    const uniqueName = `STAMP_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const stampPath = path.join(publicDir, uniqueName);
    if (await stampImage(source, stampPath, task.stampText || 'Unknown', task.useRateCode)) {
      fileName = uniqueName;
      caption = '';
      await new Promise((r) => setTimeout(r, 1000));
    }
  } else {
    const dest = path.join(publicDir, fileName);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(source, dest);
      await new Promise((r) => setTimeout(r, 500));
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

  if (task.localPath) {
    const prepared = await prepareLocalMediaUrl(task, gwConfig);
    targetUrl = prepared.publicUrl;
    targetFileName = prepared.fileName;
    targetCaption = prepared.caption;
  } else {
    let fileUrl = task.fileUrl || task.url || '';
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


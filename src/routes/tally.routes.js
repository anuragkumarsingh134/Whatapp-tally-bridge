const express = require('express');
const router = express.Router();
const path = require('path');
const CONSTANTS = require('../config/constants');
const { getConfig } = require('../config');
const { serverLog, addHistoryRecord, state } = require('../services/state');
const { enqueueTask } = require('../services/queue.worker');
const { extractPhoneNumber } = require('../utils/phone');

function handleSendFile(req, res) {
  const params = { ...req.query, ...req.body };
  const cleanNumber = extractPhoneNumber(params);
  const config = getConfig().gateway;

  const apiKey = (params.apiKey || params.apikey || params.api_key || config.apiKey || '').trim();
  const deviceId = (params.deviceId || params.deviceid || params.device_id || params.deviceID || config.deviceId || '').trim();
  const apiUrl = (params.apiUrl || params.apiurl || params.api_url || config.apiUrl || 'https://api.infinivps.com/api/messages').trim();
  const pdfBaseUrl = (params.pdfBaseUrl || params.pdfbaseurl || params.pdf_base_url || config.pdfBaseUrl || 'https://pdf.infinivps.com/').trim();
  const cleanPdfBase = pdfBaseUrl.endsWith('/') ? pdfBaseUrl : `${pdfBaseUrl}/`;

  let fileUrl = (params.fileLink || params.filelink || params.file_link || params.url || params.fileUrl || params.fileurl || params.file_url || params.link || params.pdfUrl || params.pdfurl || '').trim();
  let fileName = (params.fileName || params.filename || params.file_name || params.name || '').trim();

  if (!fileUrl && fileName) {
    fileUrl = `${cleanPdfBase}${fileName}`;
  }

  if (!fileName && fileUrl) {
    try {
      const parsedUrl = new URL(fileUrl);
      fileName = decodeURIComponent(path.basename(parsedUrl.pathname));
    } catch (_) {
      fileName = decodeURIComponent(fileUrl.split('/').pop().split('?')[0]);
    }
  }

  if (!cleanNumber) {
    const errorMsg = 'Missing recipient phone number parameter (number/mobile/phone)';
    serverLog(`[FILE ERROR] ${errorMsg}`, 'error');
    return res.status(400).json({ success: false, status: 'failed', error: errorMsg });
  }

  if (!fileUrl && !fileName) {
    const errorMsg = 'Missing file parameter: provide fileLink/url or fileName in request';
    serverLog(`[FILE ERROR] ${errorMsg}`, 'error');
    return res.status(400).json({ success: false, status: 'failed', error: errorMsg });
  }

  let cleanFileUrl = fileUrl;
  try { cleanFileUrl = encodeURI(decodeURI(cleanFileUrl)); } catch (_) { cleanFileUrl = encodeURI(cleanFileUrl); }

  let cleanFileName = fileName || path.basename(cleanFileUrl);
  // Auto-detect PDF if invoked via document endpoints or extension
  const isPdf = req.path.includes('file') || req.path.includes('pdf') || cleanFileName.toLowerCase().endsWith('.pdf') || cleanFileUrl.toLowerCase().includes('.pdf');
  if (isPdf && !cleanFileName.toLowerCase().endsWith('.pdf') && !cleanFileName.includes('.')) {
    cleanFileName += '.pdf';
  }
  if (isPdf && !cleanFileUrl.toLowerCase().endsWith('.pdf') && !cleanFileUrl.split('?')[0].includes('.')) {
    cleanFileUrl += '.pdf';
  }
  const type = isPdf ? 'pdf' : 'file';
  const priority = isPdf ? 1 : 3;

  const historyId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const item = String(params.item || params.itemId || params.itemName || params.catalog || params.catalogId || '').trim();
  const task = {
    ...params,
    id: historyId,
    historyId,
    type,
    priority,
    number: cleanNumber,
    deviceId,
    apiKey,
    apiUrl,
    fileUrl: cleanFileUrl,
    url: cleanFileUrl,
    fileName: cleanFileName,
    caption: params.caption || '',
    item,
    retryCount: 0,
    createdAt: Date.now()
  };

  enqueueTask(task);
  addHistoryRecord({
    id: historyId,
    time: new Date().toLocaleString(),
    to: cleanNumber,
    from: deviceId || 'Tally-ERP',
    file: cleanFileName,
    status: 'Queued',
    error: '',
    taskData: task
  });

  return res.status(200).json({
    success: true,
    status: 'Queued for WhatsApp',
    message: isPdf ? 'PDF queued with Priority 1 (High)' : 'File queued with Priority 3',
    priority: isPdf ? 'PDF (Priority 1)' : 'File (Priority 3)',
    queuePosition: state.imageQueue.length,
    deviceId: deviceId || 'configured-default',
    number: cleanNumber,
    fileName: cleanFileName,
    fileLink: cleanFileUrl
  });
}

function handleSendText(req, res) {
  const params = { ...req.query, ...req.body };
  const cleanNumber = extractPhoneNumber(params);
  const config = getConfig().gateway;

  const apiKey = (params.apiKey || params.apikey || params.api_key || config.apiKey || '').trim();
  const deviceId = (params.deviceId || params.deviceid || params.device_id || params.deviceID || config.deviceId || '').trim();
  const apiUrl = (params.apiUrl || params.apiurl || params.api_url || config.apiUrl || 'https://api.infinivps.com/api/messages').trim();

  let message = (params.message || params.text || params.msg || params.textMessage || params.text_message || params.body || '').trim();
  if (!message && (params.type === 'sales' || params.type === 'review')) {
    message = CONSTANTS.DEFAULT_REVIEW_MSG;
  }

  if (!cleanNumber) {
    const errorMsg = 'Missing recipient phone number parameter (number/mobile/phone)';
    serverLog(`[TEXT ERROR] ${errorMsg}`, 'error');
    return res.status(400).json({ success: false, status: 'failed', error: errorMsg });
  }

  if (!message) {
    const errorMsg = 'Missing message parameter (message/text/msg)';
    serverLog(`[TEXT ERROR] ${errorMsg}`, 'error');
    return res.status(400).json({ success: false, status: 'failed', error: errorMsg });
  }

  const historyId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const task = {
    ...params,
    id: historyId,
    historyId,
    type: 'text',
    priority: 2,
    number: cleanNumber,
    deviceId,
    apiKey,
    apiUrl,
    message,
    retryCount: 0,
    createdAt: Date.now()
  };

  enqueueTask(task);
  addHistoryRecord({
    id: historyId,
    time: new Date().toLocaleString(),
    to: cleanNumber,
    from: deviceId || 'Tally-ERP',
    file: 'Text',
    status: 'Queued',
    error: '',
    taskData: task
  });

  return res.status(200).json({
    success: true,
    status: 'Queued for WhatsApp',
    message: 'Text queued with Priority 2 (Medium)',
    priority: 'Text (Priority 2)',
    queuePosition: state.imageQueue.length,
    deviceId: deviceId || 'configured-default',
    number: cleanNumber,
    text: message
  });
}

// Route Mappings
router.all(['/api/messages/send-file', '/api/send-file', '/send-file', '/api/send-pdf-review', '/send-pdf'], handleSendFile);
router.all(['/api/messages/send-text', '/api/send-text', '/send-text', '/send-message'], handleSendText);

module.exports = router;


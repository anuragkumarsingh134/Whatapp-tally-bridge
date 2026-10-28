const express = require('express');
const router = express.Router();
const { enqueueTask } = require('../services/queue.worker');
const { addHistoryRecord } = require('../services/state');
const { extractPhoneNumber } = require('../utils/phone');
const { getTaskPriority } = require('../utils/priority');

router.all(['/send-image', '/api/messages/send-image'], (req, res) => {
  const params = { ...req.query, ...req.body };
  const cleanNumber = extractPhoneNumber(params);
  const mediaUrl = params.url || params.image || params.fileUrl || params.mediaUrl;

  if (!cleanNumber || !mediaUrl) {
    return res.status(400).json({ error: 'Missing required parameters: number and url' });
  }

  const historyId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const task = {
    ...params,
    id: historyId,
    historyId,
    type: 'image',
    priority: getTaskPriority({ ...params, type: 'image' }),
    number: cleanNumber,
    fileUrl: mediaUrl,
    url: mediaUrl,
    retryCount: 0,
    createdAt: Date.now()
  };

  enqueueTask(task);
  addHistoryRecord({
    id: historyId,
    time: new Date().toLocaleString(),
    to: cleanNumber,
    from: task.deviceId || 'External',
    file: task.fileName || 'Image',
    status: 'Queued',
    error: '',
    taskData: task
  });

  res.json({ success: true, taskId: historyId, status: 'queued' });
});

module.exports = router;

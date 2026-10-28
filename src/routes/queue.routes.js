const express = require('express');
const router = express.Router();
const { state, addHistoryRecord } = require('../services/state');
const { enqueueTask } = require('../services/queue.worker');
const { extractPhoneNumber } = require('../utils/phone');
const { getTaskPriority, getPriorityLabel } = require('../utils/priority');

function handleQueueMessage(req, res, forceType) {
  const params = { ...req.query, ...req.body };
  const cleanNumber = extractPhoneNumber(params);

  let type = forceType || params.type;
  if (!type) {
    if (params.stampText) type = 'stamp';
    else if (params.message && !params.fileName && !params.localPath) type = 'text';
    else {
      const fn = String(params.fileName || '').toLowerCase();
      if (fn.endsWith('.pdf')) type = 'pdf';
      else type = 'file';
    }
  }

  const priority = getTaskPriority({ ...params, type });
  const priorityName = getPriorityLabel(priority);
  const historyId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const item = String(params.item || params.itemId || params.itemName || params.catalog || params.catalogId || '').trim();
  const task = {
    ...params,
    id: historyId,
    historyId,
    number: cleanNumber,
    item,
    type,
    priority,
    retryCount: 0,
    createdAt: Date.now()
  };

  enqueueTask(task);
  addHistoryRecord({
    id: historyId,
    time: new Date().toLocaleString(),
    to: cleanNumber,
    from: task.deviceId || 'Queue-API',
    file: type === 'text' ? 'Text' : (task.fileName || 'File'),
    status: 'Queued',
    error: '',
    taskData: task
  });

  res.send({ status: 'Queued', priority: priorityName, queuePosition: state.imageQueue.length });
}

router.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'whatsapp-bridge', queue: state.imageQueue.length });
});

router.all('/queue', (req, res) => handleQueueMessage(req, res));
router.all('/queue-image', (req, res) => handleQueueMessage(req, res));
router.all('/queue-stamp', (req, res) => handleQueueMessage(req, res, 'stamp'));
router.all('/queue-text', (req, res) => handleQueueMessage(req, res, 'text'));

module.exports = router;


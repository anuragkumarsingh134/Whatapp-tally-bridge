const express = require('express');
const router = express.Router();
const path = require('path');
const { getConfig, saveConfig } = require('../config');
const {
  state,
  serverLog,
  broadcastQueueUpdate,
  addSseClient,
  removeSseClient,
  clearPendingQueue,
  clearHistoryRecords
} = require('../services/state');
const { processQueue, retryHistoryTask } = require('../services/queue.worker');

router.get(['/', '/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

router.get('/api/status', (req, res) => {
  const config = getConfig();
  res.json({
    queueLength: state.imageQueue.length,
    isProcessing: state.isProcessing,
    isPaused: state.isPaused,
    uptime: Math.floor((Date.now() - state.stats.uptimeStart) / 1000),
    port: config.port,
    stats: { ...state.stats, pending: state.imageQueue.length },
    queueCount: state.imageQueue.length,
    historyCount: state.messageHistory.length
  });
});

router.get('/api/history', (req, res) => {
  res.json(state.messageHistory);
});

router.get('/api/queue', (req, res) => {
  res.json({ queue: state.imageQueue, history: state.messageHistory });
});

router.post('/api/control/:command', (req, res) => {
  const cmd = req.params.command;
  if (cmd === 'pause') {
    state.isPaused = true;
    serverLog('[CONTROL] Queue has been PAUSED.', 'warn');
  } else if (cmd === 'resume') {
    state.isPaused = false;
    serverLog('[CONTROL] Queue has been RESUMED.', 'info');
    if (!state.isProcessing) processQueue();
  } else if (cmd === 'clear') {
    clearPendingQueue();
    serverLog('[CONTROL] Pending queue cleared.', 'info');
  } else if (cmd === 'clear-history') {
    clearHistoryRecords();
    serverLog('[CONTROL] History cleared.', 'info');
  }
  broadcastQueueUpdate();
  res.json({ success: true, isPaused: state.isPaused });
});

router.post('/api/queue/pause', (req, res) => {
  state.isPaused = !state.isPaused;
  serverLog(state.isPaused ? 'Queue has been PAUSED.' : 'Queue has been RESUMED.', 'warn');
  if (!state.isPaused && !state.isProcessing) processQueue();
  broadcastQueueUpdate();
  res.json({ isQueuePaused: state.isPaused });
});

router.post('/api/queue/clear', (req, res) => {
  const cleared = clearPendingQueue();
  serverLog(`Cleared ${cleared.length} pending tasks from queue.`, 'info');
  broadcastQueueUpdate();
  res.json({ success: true, clearedCount: cleared.length });
});

router.post('/api/retry/:id', (req, res) => {
  const success = retryHistoryTask(req.params.id);
  if (!success) return res.status(404).json({ error: 'Task not found in history' });
  serverLog(`Manually retried task ${req.params.id}`, 'info');
  res.json({ success: true });
});

router.post('/api/queue/:id/retry', (req, res) => {
  const success = retryHistoryTask(req.params.id);
  if (!success) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});

router.get('/api/logs', (req, res) => {
  res.json({ logs: state.logs });
});

router.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addSseClient(res);
  const initPayload = {
    type: 'init',
    data: {
      logs: state.logs,
      history: state.messageHistory.slice(0, 50),
      stats: { ...state.stats, pending: state.imageQueue.length }
    }
  };
  res.write(`data: ${JSON.stringify(initPayload)}\n\n`);

  req.on('close', () => removeSseClient(res));
});

router.get('/api/config', (req, res) => {
  res.json(getConfig());
});

router.post('/api/config', (req, res) => {
  const updated = saveConfig(req.body);
  serverLog('Configuration updated successfully.', 'info');
  res.json({ success: true, config: updated });
});

module.exports = router;

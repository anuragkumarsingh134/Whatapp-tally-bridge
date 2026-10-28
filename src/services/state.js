const fs = require('fs');
const path = require('path');
const CONSTANTS = require('../config/constants');

const historyFilePath = path.join(process.cwd(), 'whatsapp_history.json');

function loadMessageHistory() {
  if (fs.existsSync(historyFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
    } catch (_) {}
  }
  return [];
}

const state = {
  imageQueue: [],
  localCopyQueue: [],
  messageHistory: loadMessageHistory(),
  logs: [],
  sseClients: [],
  isProcessing: false,
  isPaused: false,
  isCopying: false,
  stats: { totalSent: 0, totalFailed: 0, uptimeStart: Date.now() }
};

function saveHistory() {
  if (state.messageHistory.length > CONSTANTS.MAX_HISTORY_ITEMS) {
    state.messageHistory = state.messageHistory.slice(0, CONSTANTS.MAX_HISTORY_ITEMS);
  }
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(state.messageHistory, null, 2));
  } catch (err) {
    console.error('[HISTORY ERROR] Failed to save history:', err.message);
  }
}

function updateHistory(id, status, errorMsg = '') {
  const record = state.messageHistory.find((r) => r.id === id);
  if (record) {
    record.status = status;
    record.error = errorMsg;
    record.time = new Date().toLocaleString();
    saveHistory();
  }
}

function addHistoryRecord(record) {
  state.messageHistory.unshift(record);
  saveHistory();
}

function serverLog(message, type = 'info', meta = null) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substring(2, 6),
    time: timestamp,
    level: type === 'error' ? 'error' : type,
    message,
    meta
  };

  state.logs.push(logEntry);
  if (state.logs.length > CONSTANTS.MAX_LOG_ITEMS) state.logs.shift();

  if (type === 'error') console.error(`[${timestamp}] [ERROR] ${message}`);
  else console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);

  const sseData = `data: ${JSON.stringify({ type: 'log', data: logEntry, time: timestamp, message, level: type })}\n\n`;
  state.sseClients.forEach((res) => {
    try { res.write(sseData); } catch (_) {}
  });
}

function broadcastQueueUpdate() {
  const sseData = `data: ${JSON.stringify({
    type: 'queue',
    data: {
      pending: state.imageQueue.length,
      queue: state.imageQueue.slice(0, 50),
      stats: { ...state.stats, pending: state.imageQueue.length }
    }
  })}\n\n`;
  state.sseClients.forEach((res) => {
    try { res.write(sseData); } catch (_) {}
  });
}

function addSseClient(res) {
  state.sseClients.push(res);
}

function removeSseClient(res) {
  state.sseClients = state.sseClients.filter((c) => c !== res);
}

function toggleQueuePause() {
  state.isPaused = !state.isPaused;
  return state.isPaused;
}

function clearPendingQueue() {
  return state.imageQueue.splice(0, state.imageQueue.length);
}

function clearHistoryRecords() {
  state.messageHistory = [];
  saveHistory();
}

module.exports = {
  state,
  saveHistory,
  updateHistory,
  addHistoryRecord,
  serverLog,
  broadcastQueueUpdate,
  addSseClient,
  removeSseClient,
  toggleQueuePause,
  clearPendingQueue,
  clearHistoryRecords
};

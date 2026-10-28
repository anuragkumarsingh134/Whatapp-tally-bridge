const CONSTANTS = require('../config/constants');
const { getConfig } = require('../config');
const { state, serverLog, updateHistory, broadcastQueueUpdate } = require('./state');
const { getTaskPriority, getPriorityLabel } = require('../utils/priority');
const { buildFinalDispatchUrl } = require('./gateway.service');
const { resetRecipientTracking, processCatalogTracking, decrementPhotoCounter } = require('./catalog.service');

function getNextTask() {
  if (state.imageQueue.length === 0) return null;
  let bestIndex = 0;
  let bestPriority = getTaskPriority(state.imageQueue[0]);

  for (let i = 1; i < state.imageQueue.length; i++) {
    const p = getTaskPriority(state.imageQueue[i]);
    if (p < bestPriority) {
      bestPriority = p;
      bestIndex = i;
      if (bestPriority === 1) break;
    }
  }
  return state.imageQueue.splice(bestIndex, 1)[0];
}

async function processQueue() {
  state.isProcessing = true;

  while (state.imageQueue.length > 0) {
    if (state.isPaused) {
      state.isProcessing = false;
      return;
    }

    const task = getNextTask();
    if (!task) break;

    broadcastQueueUpdate();

    const currentNumber = String(task.number).trim();
    const taskPriority = getTaskPriority(task);
    const priorityName = taskPriority === 1 ? 'PDF' : (taskPriority === 2 ? 'TEXT' : 'PHOTO');
    const isPhoto = (taskPriority === 3);

    resetRecipientTracking(currentNumber);

    try {
      const gwConfig = getConfig().gateway;
      const apiKey = (task.apiKey || gwConfig.apiKey || '').trim();
      const deviceId = (task.deviceId || gwConfig.deviceId || '').trim();

      // Prevent loopback to localhost:5555 if TDL passes targetBaseUrl = http://localhost:5555/send-image
      let candidateUrl = (task.apiUrl || task.targetBaseUrl || '').trim();
      if (!candidateUrl || candidateUrl.includes('localhost') || candidateUrl.includes('127.0.0.1') || candidateUrl.includes(':5555')) {
        candidateUrl = gwConfig.apiUrl || gwConfig.baseUrl || 'https://api.infinivps.com/api/messages';
      }

      if (!apiKey || !deviceId) {
        throw new Error('Missing apiKey or deviceId. Provide in request or configure in config.json / rpc-core.config.json');
      }

      const baseApiUrl = candidateUrl.split('/api/messages')[0].replace(/\/+$/, '') + '/api/messages';
      const finalUrl = await buildFinalDispatchUrl(task, taskPriority, currentNumber, baseApiUrl, deviceId, apiKey, gwConfig);

      serverLog(`[PRIORITY ${taskPriority}: ${priorityName}] Sending ${task.fileName || task.type || 'message'} to ${currentNumber} using Device ${deviceId}...`);
      serverLog(`[DISPATCH] URL: ${finalUrl}`);

      const response = await fetch(finalUrl);
      const resText = await response.text();
      serverLog(`[DISPATCH] Status: HTTP ${response.status} | Response: ${resText.slice(0, 200)}`);

      let resData = {};
      try { resData = JSON.parse(resText); } catch (_) {}

      if (!response.ok || resData.success === false) {
        if (resData.error && resData.error.includes('CHECK constraint failed')) {
          serverLog(`[SUCCESS] Delivered ${priorityName} to ${currentNumber} [Error Bypassed]`);
          updateHistory(task.historyId, 'Delivered');
          state.stats.totalSent++;
        } else {
          throw new Error(resData.error || resData.message || `HTTP ${response.status}`);
        }
      } else {
        serverLog(`[SUCCESS] Delivered ${priorityName} to ${currentNumber}`);
        updateHistory(task.historyId, 'Delivered');
        state.stats.totalSent++;
      }

      if (isPhoto) {
        await processCatalogTracking(task, currentNumber, baseApiUrl, deviceId, apiKey);
      }

      broadcastQueueUpdate();

      const delay = (taskPriority === 1 || taskPriority === 2)
        ? CONSTANTS.HIGH_PRIORITY_DELAY
        : Math.random() * (CONSTANTS.MAX_DELAY - CONSTANTS.MIN_DELAY) + CONSTANTS.MIN_DELAY;
      await new Promise((r) => setTimeout(r, delay));

    } catch (error) {
      if (isPhoto) decrementPhotoCounter();
      serverLog(`[TASK ERROR] [${priorityName}] ${currentNumber}: ${error.message}`, 'error');

      if (task.retryCount < CONSTANTS.MAX_RETRIES) {
        task.retryCount = (task.retryCount || 0) + 1;
        state.imageQueue.push(task);
        broadcastQueueUpdate();
        await new Promise((r) => setTimeout(r, CONSTANTS.ERROR_DELAY));
      } else {
        state.stats.totalFailed++;
        updateHistory(task.historyId, 'Failed', error.message);
        broadcastQueueUpdate();
      }
    }
  }

  state.isProcessing = false;
  serverLog('Queue empty.');
  broadcastQueueUpdate();
}

function enqueueTask(taskData) {
  state.imageQueue.push(taskData);
  broadcastQueueUpdate();
  if (!state.isProcessing && !state.isPaused) {
    processQueue();
  }
}

function retryHistoryTask(id) {
  const record = state.messageHistory.find((r) => r.id === id);
  if (record && record.taskData) {
    const task = { ...record.taskData, retryCount: 0, createdAt: Date.now() };
    enqueueTask(task);
    updateHistory(record.id, 'Queued');
    return true;
  }
  return false;
}

module.exports = {
  getNextTask,
  processQueue,
  enqueueTask,
  retryHistoryTask
};


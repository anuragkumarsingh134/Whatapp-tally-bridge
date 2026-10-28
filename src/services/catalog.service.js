const path = require('path');
const CONSTANTS = require('../config/constants');
const { state, serverLog } = require('./state');
const { getTaskPriority } = require('../utils/priority');

let lastSentNumber = null;
let photoCounter = 0;
let currentItemKey = null;
let currentItemPhotoCount = 0;

function getTaskItemKey(task) {
  const explicit = task.item || task.itemId || task.itemName || task.catalog || task.catalogId;
  if (explicit) return String(explicit).trim();

  if (task.stampText && task.stampText.trim()) {
    return 'stamp:' + task.stampText.trim();
  }

  if (task.localPath) {
    try {
      const parentDir = path.basename(path.dirname(path.normalize(task.localPath)));
      if (parentDir && parentDir !== '.' && parentDir.length > 1) {
        return 'dir:' + parentDir;
      }
    } catch (_) {}
  }

  if (task.fileName) {
    const nameWithoutExt = path.parse(task.fileName).name;
    const match = nameWithoutExt.match(/^(.+?)[_\s\-\(]+(\d+)\)?$/);
    if (match && match[1]) {
      return 'prefix:' + match[1].trim();
    }
  }

  return 'item_' + (task.historyId || task.id || Date.now());
}

function resetRecipientTracking(currentNumber) {
  if (lastSentNumber !== currentNumber) {
    lastSentNumber = currentNumber;
    photoCounter = 0;
    currentItemKey = null;
    currentItemPhotoCount = 0;
  }
}

async function processCatalogTracking(task, currentNumber, baseApiUrl, deviceId, apiKey) {
  photoCounter++;

  const taskItemKey = getTaskItemKey(task);
  if (currentItemKey === taskItemKey) {
    currentItemPhotoCount++;
  } else {
    currentItemKey = taskItemKey;
    currentItemPhotoCount = 1;
  }

  const hasMoreForThisItem = state.imageQueue.some((t) =>
    getTaskPriority(t) === 3 &&
    String(t.number).trim() === currentNumber &&
    getTaskItemKey(t) === currentItemKey
  );

  if (!hasMoreForThisItem) {
    if (currentItemPhotoCount > CONSTANTS.CATALOG_THRESHOLD) {
      serverLog(`[CATALOG COMPLETED] Item "${currentItemKey}" had ${currentItemPhotoCount} photos (> ${CONSTANTS.CATALOG_THRESHOLD}). Sending separator "!!!" to ${currentNumber}...`);
      const breakUrl = `${baseApiUrl}/send-text?deviceId=${encodeURIComponent(deviceId)}&apiKey=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(currentNumber)}&message=${encodeURIComponent('!!!')}`;
      try {
        await fetch(breakUrl);
        serverLog(`[SUCCESS] Separator "!!!" delivered to ${currentNumber} for item "${currentItemKey}".`);
      } catch (e) {
        serverLog(`[ERROR] Separator "!!!" failed: ${e.message}`, 'error');
      }
      photoCounter = 0;
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      serverLog(`[ITEM COMPLETED] Item "${currentItemKey}" had ${currentItemPhotoCount} photo(s) (<= ${CONSTANTS.CATALOG_THRESHOLD}). No separator needed.`);
    }
    currentItemKey = null;
    currentItemPhotoCount = 0;
  }

  if (photoCounter >= CONSTANTS.PHOTO_BATCH_LIMIT) {
    serverLog(`[BATCH BREAK] ${CONSTANTS.PHOTO_BATCH_LIMIT} photos reached without item break. Sending "!!!"...`);
    const breakUrl = `${baseApiUrl}/send-text?deviceId=${encodeURIComponent(deviceId)}&apiKey=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(currentNumber)}&message=${encodeURIComponent('!!!')}`;
    try {
      await fetch(breakUrl);
      serverLog('[SUCCESS] Safety separator "!!!" delivered.');
    } catch (e) {
      serverLog(`[ERROR] Break failed: ${e.message}`, 'error');
    }
    photoCounter = 0;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

function decrementPhotoCounter() {
  if (photoCounter > 0) photoCounter--;
}

module.exports = {
  getTaskItemKey,
  resetRecipientTracking,
  processCatalogTracking,
  decrementPhotoCounter
};


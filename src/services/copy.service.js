const fs = require('fs');
const path = require('path');
const { state, serverLog } = require('./state');
const { stampImage } = require('./stamp.service');

async function processLocalCopyQueue() {
  state.isCopying = true;
  while (state.localCopyQueue.length > 0) {
    const task = state.localCopyQueue.shift();
    try {
      const success = await stampImage(task.src, task.dest, task.stampText, task.useRateCode);
      if (success) {
        serverLog(`[STAMP & COPY OK] Stamped and copied to: ${task.dest}`);
      } else {
        serverLog(`[STAMP & COPY ERROR] Stamping failed for: ${task.dest}`, 'error');
      }
    } catch (err) {
      serverLog(`[STAMP & COPY ERROR] Exception: ${err.message}`, 'error');
    }
  }
  state.isCopying = false;
}

function handleCopy(req, res, forceMode) {
  const params = { ...req.query, ...req.body };
  const { src, dest, stampText, useRateCode } = params;

  if (!src || !dest) {
    if (req.path === '/copy') return res.status(400).send('Missing paths');
    return res.status(400).json({ success: false, error: 'Missing src or dest path' });
  }

  const sourcePath = path.normalize(src);
  const destPath = path.normalize(dest);

  if (!fs.existsSync(path.dirname(destPath))) {
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
    } catch (_) {}
  }

  if (stampText || forceMode === 'stamp') {
    if (!stampText) {
      return res.status(400).json({ success: false, error: 'Missing stampText for stamping' });
    }
    state.localCopyQueue.push({ src: sourcePath, dest: destPath, stampText, useRateCode });
    if (!state.isCopying) processLocalCopyQueue();
    if (req.path === '/copy') return res.send('Queued for stamping');
    return res.json({ success: true, message: 'Queued for background processing' });
  }

  fs.copyFile(sourcePath, destPath, (err) => {
    if (err) {
      if (req.path === '/copy') return res.status(500).send('Copy failed');
      return res.status(500).json({ success: false, error: 'Copy failed' });
    }
    serverLog(`[LOCAL COPY OK] Copied: ${path.basename(sourcePath)}`);
    if (req.path === '/copy') return res.send('Success');
    return res.json({ success: true, message: 'Copied successfully' });
  });
}

module.exports = {
  processLocalCopyQueue,
  handleCopy
};


const BridgeStream = {
  connect(onQueueUpdate) {
    const evtSource = new EventSource('/api/stream');

    evtSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') {
          if (msg.data.logs) msg.data.logs.forEach(BridgeStream.appendLog);
          BridgeStream.updateStats(msg.data.stats);
          if (typeof onQueueUpdate === 'function') {
            onQueueUpdate([], msg.data.history || []);
          }
        } else if (msg.type === 'log') {
          BridgeStream.appendLog(msg.data || msg);
        } else if (msg.type === 'queue') {
          BridgeStream.updateStats(msg.data.stats);
          if (typeof onQueueUpdate === 'function') {
            onQueueUpdate(msg.data.queue, []);
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      setTimeout(() => BridgeStream.connect(onQueueUpdate), 3000);
    };
  },

  appendLog(log) {
    const terminal = document.getElementById('terminalLogs');
    if (!terminal) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    const time = log.time || new Date().toLocaleTimeString();
    const lvl = (log.level || log.type || 'info').toLowerCase();
    const text = log.message || '';

    line.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-${lvl}">[${lvl.toUpperCase()}]</span>
      <span>${text}</span>
    `;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  },

  updateStats(stats) {
    if (!stats) return;
    const pendingEl = document.getElementById('statPending');
    const sentEl = document.getElementById('statSent');
    const failedEl = document.getElementById('statFailed');
    if (pendingEl) pendingEl.textContent = stats.pending || 0;
    if (sentEl) sentEl.textContent = stats.totalSent || 0;
    if (failedEl) failedEl.textContent = stats.totalFailed || 0;
  }
};

window.BridgeStream = BridgeStream;

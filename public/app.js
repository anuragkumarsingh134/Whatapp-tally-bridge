// Main Frontend Controller
window.retryTask = function(id) {
  BridgeAPI.retryTask(id);
};

async function loadInitialData() {
  const config = await BridgeAPI.getConfig();
  BridgeUI.populateSettings(config);

  const history = await BridgeAPI.getHistory();
  BridgeUI.renderQueue([], history);
}

function bindFormEvents() {
  const sendType = document.getElementById('sendType');
  const mediaGroup = document.getElementById('mediaUrlGroup');
  const msgGroup = document.getElementById('messageGroup');

  sendType?.addEventListener('change', () => {
    const val = sendType.value;
    if (mediaGroup) mediaGroup.style.display = (val === 'text') ? 'none' : 'block';
    if (msgGroup) msgGroup.style.display = (val === 'text') ? 'block' : 'none';
    BridgeUI.updateUrlPreview();
  });

  document.getElementById('sendNumber')?.addEventListener('input', BridgeUI.updateUrlPreview);
  document.getElementById('sendMediaUrl')?.addEventListener('input', BridgeUI.updateUrlPreview);

  document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      gateway: {
        baseUrl: document.getElementById('cfgBaseUrl').value.trim(),
        imageEndpoint: document.getElementById('cfgImageEndpoint').value.trim(),
        textEndpoint: document.getElementById('cfgTextEndpoint').value.trim(),
        defaultDeviceId: document.getElementById('cfgDeviceId').value.trim(),
        defaultApiKey: document.getElementById('cfgApiKey').value.trim(),
        method: 'GET'
      },
      queue: {
        delayBetweenMs: parseInt(document.getElementById('cfgDelay').value, 10),
        maxRetries: parseInt(document.getElementById('cfgMaxRetries').value, 10)
      }
    };
    await BridgeAPI.saveConfig(payload);
    await loadInitialData();
    alert('Settings saved successfully!');
  });

  document.getElementById('testSendForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: sendType.value,
      priority: document.getElementById('sendPriority').value,
      number: document.getElementById('sendNumber').value,
      url: document.getElementById('sendMediaUrl').value,
      message: document.getElementById('sendMessage').value
    };
    const data = await BridgeAPI.sendTestMessage(payload);
    if (data.success || data.status === 'Queued' || data.status === 'queued') {
      alert('Message Enqueued successfully!');
    }
  });

  document.getElementById('btnPause')?.addEventListener('click', async () => {
    const data = await BridgeAPI.togglePause();
    const btn = document.getElementById('btnPause');
    if (btn) {
      btn.innerHTML = data.isPaused
        ? '<i class="fa-solid fa-play"></i> Resume Queue'
        : '<i class="fa-solid fa-pause"></i> Pause Queue';
    }
  });

  document.getElementById('btnClear')?.addEventListener('click', async () => {
    if (confirm('Clear all pending items from queue?')) {
      await BridgeAPI.clearQueue();
    }
  });

  document.getElementById('btnClearLogs')?.addEventListener('click', () => {
    const term = document.getElementById('terminalLogs');
    if (term) term.innerHTML = '';
  });
}

function startUptimePolling() {
  setInterval(async () => {
    try {
      const data = await BridgeAPI.getStatus();
      const up = data.uptime || 0;
      const m = Math.floor(up / 60);
      const s = up % 60;
      const display = document.getElementById('uptimeDisplay');
      if (display) display.textContent = `${m}m ${s}s`;
    } catch (_) {}
  }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  BridgeUI.initTabs();
  bindFormEvents();
  loadInitialData();
  BridgeStream.connect(BridgeUI.renderQueue);
  startUptimePolling();
});

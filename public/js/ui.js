const BridgeUI = {
  currentConfig: {},

  initTabs() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  },

  updateUrlPreview() {
    const sendType = document.getElementById('sendType');
    const typeVal = sendType ? sendType.value : 'image';
    const cfg = BridgeUI.currentConfig;
    const base = (cfg.gateway?.baseUrl || 'https://api.infinivps.com').replace(/\/+$/, '');

    let ep = '/api/messages/send-image';
    if (typeVal === 'text') ep = '/api/messages/send-text';
    else if (typeVal === 'pdf') ep = '/api/messages/send-file';

    const num = document.getElementById('sendNumber')?.value || '919603761820';
    const url = document.getElementById('sendMediaUrl')?.value || 'https://pdf.infinivps.com/sample.jpeg';
    const devId = cfg.gateway?.defaultDeviceId || '918919007019';
    const apiKey = cfg.gateway?.defaultApiKey || 'TOKEN';

    const preview = `${base}${ep}?deviceId=${devId}&apiKey=${apiKey}&number=${num}&url=${encodeURIComponent(url)}`;
    const previewEl = document.getElementById('urlPreview');
    if (previewEl) previewEl.textContent = preview;
  },

  renderQueue(queue, history) {
    const tbody = document.getElementById('queueTableBody');
    if (!tbody) return;
    const allTasks = [...(queue || []), ...(history || [])];

    if (allTasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Queue and history are empty</td></tr>';
      return;
    }

    tbody.innerHTML = allTasks.map((task) => {
      const isFailed = task.status === 'failed' || task.status === 'Failed';
      const typeIcon = task.type === 'pdf' ? 'fa-file-pdf' : (task.type === 'text' ? 'fa-font' : 'fa-image');
      const payloadText = task.fileName || task.mediaUrl || task.fileUrl || task.url || task.message || task.file || '';

      return `
        <tr>
          <td><strong>P${task.priority || 3}</strong></td>
          <td><i class="fa-solid ${typeIcon}"></i> ${task.type || 'file'}</td>
          <td>${task.number || task.to || '-'}</td>
          <td title="${payloadText}">${payloadText.slice(0, 30)}${payloadText.length > 30 ? '...' : ''}</td>
          <td>${task.deviceId || task.from || '-'}</td>
          <td><span class="status-pill ${(task.status || 'pending').toLowerCase()}">${task.status || 'pending'}</span></td>
          <td>
            ${isFailed ? `<button class="btn btn-secondary btn-sm" onclick="BridgeAPI.retryTask('${task.historyId || task.id}')"><i class="fa-solid fa-rotate-right"></i> Retry</button>` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  },

  populateSettings(config) {
    BridgeUI.currentConfig = config;
    document.getElementById('cfgBaseUrl').value = config.gateway?.baseUrl || '';
    document.getElementById('cfgImageEndpoint').value = config.gateway?.imageEndpoint || '';
    document.getElementById('cfgTextEndpoint').value = config.gateway?.textEndpoint || '';
    document.getElementById('cfgDeviceId').value = config.gateway?.defaultDeviceId || '';
    document.getElementById('cfgApiKey').value = config.gateway?.defaultApiKey || '';
    document.getElementById('cfgDelay').value = config.queue?.delayBetweenMs || 5000;
    document.getElementById('cfgMaxRetries').value = config.queue?.maxRetries || 3;
    const delayEl = document.getElementById('statDelay');
    if (delayEl) delayEl.textContent = ((config.queue?.delayBetweenMs || 5000) / 1000) + 's';
    BridgeUI.updateUrlPreview();
  }
};

window.BridgeUI = BridgeUI;

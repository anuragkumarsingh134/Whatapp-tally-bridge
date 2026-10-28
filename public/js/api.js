const BridgeAPI = {
  async getConfig() {
    const res = await fetch('/api/config');
    return res.json();
  },

  async saveConfig(payload) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async sendTestMessage(payload) {
    let endpoint = '/send-text';
    if (payload.type === 'image' || payload.type === 'stamp') {
      endpoint = '/send-image';
    } else if (payload.type === 'pdf') {
      endpoint = '/send-file';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async togglePause() {
    const res = await fetch('/api/control/pause', { method: 'POST' });
    const data = await res.json();
    if (data.isPaused === undefined) {
      const alt = await fetch('/api/control/resume', { method: 'POST' });
      return alt.json();
    }
    return data;
  },

  async clearQueue() {
    const res = await fetch('/api/control/clear', { method: 'POST' });
    return res.json();
  },

  async clearHistory() {
    const res = await fetch('/api/control/clear-history', { method: 'POST' });
    return res.json();
  },

  async retryTask(id) {
    const res = await fetch(`/api/retry/${id}`, { method: 'POST' });
    return res.json();
  },

  async getStatus() {
    const res = await fetch('/api/status');
    return res.json();
  },

  async getHistory() {
    const res = await fetch('/api/history');
    return res.json();
  }
};

window.BridgeAPI = BridgeAPI;

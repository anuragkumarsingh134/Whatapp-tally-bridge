const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config.json');

const DEFAULT_CONFIG = {
  port: 5555,
  gateway: {
    baseUrl: 'https://api.infinivps.com',
    apiUrl: 'https://api.infinivps.com/api/messages',
    imageEndpoint: '/api/messages/send-image',
    textEndpoint: '/api/messages/send-text',
    fileEndpoint: '/api/messages/send-file',
    pdfBaseUrl: 'https://pdf.infinivps.com/',
    publicPdfDir: 'H:\\HTTPSERVER\\PDFS',
    defaultDeviceId: '918919007019',
    defaultApiKey: '25a532f3b1f4f698ca4769fd9fb073341db741a0aea2fd6b03f3c9dac8e33518',
    method: 'GET'
  },
  queue: {
    delayBetweenMs: 5000,
    maxRetries: 3
  }
};

let currentConfig = loadConfig();

function loadExternalConfig() {
  let wag = {};
  let wa = {};

  try {
    const centralConfigManager = require('../../main/config-manager');
    if (centralConfigManager && typeof centralConfigManager.get === 'function') {
      wag = centralConfigManager.get('whatsAppGateway') || {};
      wa = centralConfigManager.get('whatsapp') || {};
    }
  } catch (_) {}

  if (!wag.apiKey && !wa.apiKey) {
    const candidatePaths = [
      path.join(process.cwd(), 'rpc-core.config.json'),
      path.join(__dirname, '..', '..', 'rpc-core.config.json'),
      path.join(__dirname, '..', '..', '..', 'rpc-core.config.json'),
      path.join(path.dirname(process.execPath), 'rpc-core.config.json')
    ];
    for (const file of candidatePaths) {
      if (fs.existsSync(file)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (parsed.whatsAppGateway || parsed.whatsapp) {
            wag = parsed.whatsAppGateway || {};
            wa = parsed.whatsapp || {};
            break;
          }
        } catch (_) {}
      }
    }
  }

  return { wag, wa };
}

function loadConfig() {
  let fileConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[CONFIG] Failed to load config.json, using defaults.');
  }

  const { wag, wa } = loadExternalConfig();

  const merged = {
    port: fileConfig.port || DEFAULT_CONFIG.port,
    gateway: {
      ...DEFAULT_CONFIG.gateway,
      ...(fileConfig.gateway || {}),
      apiUrl: wag.apiUrl || fileConfig.gateway?.apiUrl || DEFAULT_CONFIG.gateway.apiUrl,
      apiKey: wag.apiKey || wa.apiKey || fileConfig.gateway?.defaultApiKey || '',
      defaultApiKey: fileConfig.gateway?.defaultApiKey || wag.apiKey || wa.apiKey || '',
      deviceId: wag.deviceId || wa.deviceId || fileConfig.gateway?.defaultDeviceId || '',
      defaultDeviceId: fileConfig.gateway?.defaultDeviceId || wag.deviceId || wa.deviceId || '',
      pdfBaseUrl: wag.pdfBaseUrl || fileConfig.gateway?.pdfBaseUrl || DEFAULT_CONFIG.gateway.pdfBaseUrl,
      publicPdfDir: wag.publicPdfDir || wag.publicDir || fileConfig.gateway?.publicPdfDir || ''
    },
    queue: { ...DEFAULT_CONFIG.queue, ...(fileConfig.queue || {}) }
  };

  return merged;
}

function saveConfig(newConfig) {
  currentConfig = { ...currentConfig, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
  return currentConfig;
}

function getConfig() {
  return currentConfig;
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig
};

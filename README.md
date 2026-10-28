# WhatsApp Tally Bridge

A high-performance standalone WhatsApp Bridge with Priority Queue Management, Jimp Image Stamping, Tally ERP 9 / Prime Integration, and Real-Time Web Dashboard.

## Key Features

- **Tally ERP Integration**: Instant unfreeze responses for `/send-file` and `/send-text`.
- **Priority Queue Worker**:
  - **Priority 1 (PDF)**: Dispatched immediately (600ms).
  - **Priority 2 (Text)**: High speed review & notifications (600ms).
  - **Priority 3 (Photos)**: Randomized throttling (1000–2000ms) to avoid spam detection.
- **Automated Catalog Separator**: Groups photos by item and dispatches `"!!!"` delimiter if count > 4.
- **Jimp Banner Stamping**: Dynamic bottom banner with rate code cipher masking (`applyRateCode`).
- **Disk Persistence**: Stores message transaction logs in `whatsapp_history.json`.
- **Live Web Dashboard**: Real-time SSE logs, queue control, manual retry, and gateway configuration.

## Project Structure

```text
├── config.json                     # Bridge & gateway configuration
├── server.js                       # Bootstrapper with crash prevention
├── src/
│   ├── app.js                      # Express middleware & route assembly
│   ├── config/                     # Configuration & constants
│   ├── routes/                     # Tally, dispatch, queue & dashboard routes
│   ├── services/                   # Queue worker, gateway, stamp & catalog services
│   └── utils/                      # Phone normalizer & priority resolver
└── public/                         # Web dashboard assets & client scripts
```

## Setup & Running

```bash
# Install dependencies
npm install

# Start the bridge server
npm start
```

Web Dashboard opens at: `http://localhost:5555`

## Core TDL Endpoints

- `GET /send-file` - Invoices and PDF vouchers
- `GET /send-text` - Review and sales feedback
- `GET /copy` - Local image file copy & banner stamping
- `GET /queue` - WhatsApp image queue
- `GET /health` - Server health check


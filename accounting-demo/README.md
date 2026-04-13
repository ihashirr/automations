# AuditBot - Accounting Automation Demo

AuditBot is a frontend, browser-run demonstration showcasing an automated invoice data extraction and validation pipeline. It allows users to upload actual PDF invoices, immediately parses the raw text locally in the browser, extracts key financial information using heuristic regular expressions, and performs a mathematical validation audit to flag anomalies for human review.

This repository was designed specifically as a highly aesthetic, client-facing interactive demonstration to showcase automation capabilities.

## Features

- **Live PDF Extraction:** Runs Mozilla's `pdf.js` directly within the browser, extracting text layer structures locally without transmitting files to an external server.
- **Smart Data Heuristics:** Employs advanced regex rules built to handle unpredictable PDF text flows, disjoint bounding boxes, and non-standard unicode characters.
- **Compliance Validation Engine:** Analyzes subtotal, VAT rates, and total payable amounts to ensure mathematical integrity. Auto-flags missing fields or mismatched data (e.g. `Subtotal + VAT != Total`).
- **Interactive UI Flows:** Supports dragging-and-dropping PDFs, an embedded document preview IFrame, and animated multi-step flows transitioning from upload to intelligence audit.
- **Mock Data Failsafes:** Provides one-click buttons to load perfectly correct or intentionally incorrect "mock" invoices to instantly demo the validation engine's flags without needing an actual file.

## Getting Started

Because this is a Vite-based single-page application (SPA), getting it running is extremely fast.

### Prerequisites

- Node.js (v16+)
- npm (Node Package Manager)

### Installation

1. Navigate to the project directory:
   ```bash
   cd accounting-demo
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Boot the local development server:
   ```bash
   npm run dev
   ```
4. Open the localhost URL provided in your terminal (usually `http://localhost:5173/`).

## Project Structure

```text
accounting-demo/
├── index.html            # Main HTML structure and UI scaffolding
├── package.json          # Node dependencies (Vite)
└── src/
    ├── main.js           # Entrypoint and event wiring
    ├── render.js         # DOM manipulation and step transitions 
    ├── style.css         # Styling system, responsive grid layouts
    ├── extraction.js     # PDF.js implementation and Regex heuristics
    ├── validation.js     # Mathematical audit and compliance rules
    └── mock-data.js      # Hard-coded demo datasets (Correct/Incorrect)
```

# Technical Architecture & Workflow

This document explicitly outlines the data flow, internal parsing logic, and validation architecture for the AuditBot Accounting Automation Demonstration.

## 1. Zero-Server Architecture

To maximize setup speed and ensure data privacy during demonstrations, the entire application executes client-side. The architecture relies on Vite to bundle standard ES modules (`import`/`export`).

There is **no backend database** and **no API routing**.

## 2. PDF Parsing Pipeline (`extraction.js`)

When a user drops an invoice into the application, the file undergoes a multi-layer extraction pipeline:

1. **ArrayBuffer Conversion**: The application uses the native browser `FileReader` API to read the PDF as a binary `Uint8Array`.
2. **Text Layer Extraction**: The `pdf.js` worker thread ingests the binary and iterates through all pages (`pdf.numPages`). It invokes `page.getTextContent()` which pulls every geometric text block (`textContent.items`) from the specific page.
3. **Normalization**: The raw array of text items is joined into a giant unstructured string. A normalizer (`text.replace(/\s+/g, ' ')`) converts arbitrary tabs, newlines, and trailing spaces into single spaces.

### Heuristic Rule Matching
Traditional PDF engines often scramble layout structures (for example, placing a label "Due Date" chronologically between "Invoice Date" and its respective value). To combat this, the extraction engine utilizes highly tolerant regex algorithms with lookahead arrays and lazy loading.

* **Invoice Date Resolution**: 
  `/(?:Invoice\s*Date|Date)[\s\S]{0,50}?([0-9]{1,2}[-\/\.\s\u2010-\u2015]+[A-Za-z]{3,10}[-\/\.\s\u2010-\u2015]+[0-9]{4}...)/i`
  This specifically commands the engine to find the label, ignore up to 50 characters of garbage or bounding-box-clutter, and capture the nearest valid date formatted correctly, accounting for unicode dashes (like `En-Dash`).

## 3. Mathematical Validation Engine (`validation.js`)

After the regex heuristics isolate core variables, they are piped into the Validation Matrix.

### Required Fields Audit
A strict gatekeeper check is run ensuring `invoiceNumber`, `invoiceDate`, `subtotal`, `vatRate`, `vatAmount`, and `total` are truthy numbers and exist. 
* *Failure Scenario*: If the OCR engine misses a value due to poor resolution, the math fails to calculate. It immediately short-circuits the audit and flags **"Low Confidence Extraction" - Needs Human Review**.

### Ledger Discrepancy Checks
If the required fields exist, two primary compliance routes run:

1. **VAT Check**: `AbsoluteValue(Subtotal * VAT Rate)` vs `Extracted VAT`. 
2. **Total Check**: `Subtotal + VAT` vs `Invoice Total`.

Because VAT logic occasionally results in inverse floating-point math on "Credit Notes" (where subtotals are negative but VAT is listed purely positively), the validation engine performs contextual geometric matching (e.g. `signedVatAmount = fields.subtotal < 0 ? -Math.abs(fields.vatAmount) : Math.abs(fields.vatAmount)`).

If a calculated limit varies by `<= $0.05` between the extracted total and internal calculation, it is flagged as a `Review: Rounding Difference` instead of a catastrophic `Fail`.

## 4. UI Rendering (`render.js`)

Dom transition logic manually injects specific state classes (`.hidden`, `.active`) across different components.
- Values failing extraction are visually injected as `<span class="missing">Missing</span>`.
- Total statuses (`pass`, `fail`, `review`) dynamically map to CSS utility classes outlining the final Summary Card UI.

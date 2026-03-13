# Backend

Node.js + Express server for PDF generation using Puppeteer, now with job queue support for asynchronous PDF rendering.

## Architecture

The backend uses a **layered architecture** for maintainability:

```
HTTP Request
    ↓
Controller (routes/pdfRoute.js)
    ↓
Application (app/pdfApp.js) — orchestrates workflow
    ↓
Services (services/htmlService.js) — HTML logic
    ↓
Infrastructure (infrastructure/) — Puppeteer, Sharp, fs
    ↓
PDF Queue (pdfQueue.js) — manages async job processing
    ↓
PDF Response
```

### Layer Responsibilities

1. **Controller** (`routes/pdfRoute.js`)
   - Handles HTTP request/response
   - Basic validation
   - Can enqueue jobs or return PDF results
   - Calls application layer

2. **Application** (`app/pdfApp.js`)
   - Orchestrates PDF generation workflow
   - Coordinates HTML sanitization, image inlining, Puppeteer rendering
   - Loads and injects Tailwind CSS

3. **Services** (`services/htmlService.js`)
   - `sanitizeHtml()` — converts form inputs to plain text
   - `inlineLocalImages()` — finds, compresses, and base64-encodes images from filesystem
   - `hideUiOnly()` — hides UI-only elements marked with `data-ui-only`

4. **Infrastructure**
   - `infrastructure/imageInfra.js` — wraps Sharp for image compression
   - `infrastructure/puppeteerInfra.js` — wraps Puppeteer for PDF rendering

5. **PDF Queue (pdfQueue.js)**
   - Manages a queue of PDF jobs for async generation
   - Each job has a unique ID, status (queued, processing, done, error), and result
   - Processes jobs sequentially to avoid Puppeteer overload
   - Supports polling from frontend: GET /job/:id

## Image Inlining

- Images are **not** fetched from HTTP URLs; instead, local filesystem paths are resolved relative to the frontend folder.
- All images are compressed and converted to base64 data URIs before Puppeteer renders the PDF.
- This ensures images are embedded in the PDF and don't require external file access.
- **Important:** `inlineLocalImages()` is async and must be awaited to complete before rendering.


## PDF Queue / Async Generation
- PDFs can now be queued to prevent Puppeteer overload or timeout on free-tier hosting.

### Workflow

Frontend POST /generate-pdf
    ↓
PDF Job Enqueued (pdfQueue.js)
    ↓
Job Status: queued → processing → done/error
    ↓
Frontend polls GET /job/:id
    ↓
PDF Blob returned once ready

- Each job has a jobId returned immediately for polling.
- iPad / iOS users can safely open PDF once job is done (no data: top-frame navigation issues).

---

## Running Locally

```bash
cd backend
npm install
node server.js
```

Server runs on http://localhost:3000

- **Auto-injects Tailwind CSS v4** (compiled from frontend)
- **Automatic image compression**:
  - PNG/JPG → resized + Base64
  - SVG → rasterized or inline data URI
- **Flexible image path resolution** with `FRONTEND_ROOT` env (Docker-ready)
- **Font loading** support (Google Fonts + system fonts)
- **High-quality A4 PDF** output (full color, print-background)
- Async queue ensures Puppeteer stability under load

---

## **Features**

- Accepts HTML content from a frontend via a POST request.
- Automatically wraps the HTML with your compiled **Tailwind CSS v4**
- Waits for all images to load
- Compresses local images automatically:
  - `.png` / `.jpg` → resized + compressed with **sharp**
  - `.svg` → rasterized into PNG (sharp)

- Handles images from:
  - `/picture/...`
  - `/src/asset/...`
  - `/public/...`

- Outputs a high-quality **A4 PDF** (with ackground colors and margins)
- Returns the PDF inline for preview or as a downloadable file.
- Async job queue for large PDFs or slow connections
- Job polling via `GET /job/:id`
-	Safe PDF preview on iOS/iPadOS using blob URLs in <iframe>

---

## **Tech Stack**

- **Node.js** + Express
- **Puppeteer** (Chromium)
- **Sharp** (image compression)
- **JSDOM** (HTML parsing)
- **Tailwind CSS v4**
- CORS for frontend communication

---

## **Project Setup**

1. **Install dependencies**

```bash
npm install express puppeteer cors fs path sharp jsdom
```

2. **Compile Tailwind CSS v4**

Make sure Tailwind CSS is compiled and accessible from the backend:

```bash
npx @tailwindcss/cli -i ./src/asset/styles/style.css -o ./public/css/tailwind.css --minify
```

- Adjust the `input.css` and output path as needed.

3. **Project structure example**

```
project/
├─ backend/
|  ├─ app/  
|  ├─ infrastructure/  
|  ├─ routes/  
|  ├─ services/ 
│  └─ server.js
├─ frontend/
│  ├─ src/
│  │  └─ asset
│  │    └─ styles
│  │     │   └─ style.css
│  │     └── svg/
│  └─ public/
│     ├── picture/
│     └─ css/
│        └─ tailwind.css
└─ package.json
```

Both `src/assets/...` and `public/...` images are supported.

---

## **Usage**

1. Start the backend:

```bash
cd backend/
node server.js
```

2. POST HTML to enqueue PDF:

```ts
const htmlContent = `<div class="p-4 bg-gray-100 border border-gray-400">Hello PDF!</div>`

const response = await fetch(`${API}/generate-pdf`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html: htmlContent }),
})

const { jobId } = await response.json()
```

3. Poll job status:

``` ts
let pdfReady = false
while (!pdfReady) {
  const res = await fetch(`${API}/job/${jobId}`)
  if (res.headers.get('content-type') === 'application/pdf') {
    const blob = await res.blob()
    pdfReady = true
    // Open or download PDF
  } else {
    const status = await res.json()
    console.log('PDF status:', status.status)
    await new Promise(r => setTimeout(r, 2000))
  }
}
```

---

## **Notes / Tips**

- Tailwind CSS must include all classes used in backend HTML, or the PDF will not be styled.
- Puppeteer requires inline CSS (`<style>`) or injected `<style>` tags, Linking local CSS files (`<link>`) will **not work**.
- Images must be inlined (PNG/JPG) or rasterized (SVG) for PDF reliability
- Async queue prevents Puppeteer crashes under load
- Blob URLs inside <iframe> are used for iOS/iPad preview

---

## Summary

This backend is designed for REAL production PDFs:

- Fully production-ready backend for MenuGen PDF generation
-	Async job queue for large PDFs or free-tier hosts
- Tailwind-styled layouts with embedded images
- Pixel-perfect PDF output
- Cross-platform safe, including iOS/iPadOS
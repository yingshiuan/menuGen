# Backend

Node.js + Express server for PDF generation using Puppeteer.

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
PDF Response
```

### Layer Responsibilities

1. **Controller** (`routes/pdfRoute.js`)
   - Handles HTTP request/response
   - Basic validation
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

## Image Inlining

- Images are **not** fetched from HTTP URLs; instead, local filesystem paths are resolved relative to the frontend folder.
- All images are compressed and converted to base64 data URIs before Puppeteer renders the PDF.
- This ensures images are embedded in the PDF and don't require external file access.
- **Important:** `inlineLocalImages()` is async and must be awaited to complete before rendering.

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

2. Send a POST request from your frontend with HTML content:

```ts
const htmlContent = `<div class="p-4 bg-gray-100 border border-gray-400">Hello PDF!</div>`

const response = await fetch('http://localhost:3000/generate-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html: htmlContent }),
})

const blob = await response.blob()
const url = URL.createObjectURL(blob)
window.open(url, '_blank') // Preview PDF in browser
```

---

## **Notes / Tips**

- Make sure **Tailwind CSS includes all classes used in your backend HTML**, or the PDF will not be styled.
- Puppeteer requires inline CSS (`<style>`). Linking local CSS files (`<link>`) will **not work**.

- Puppeteer cannot load local files directly—so the backend automatically:
  - finds images
  - compresses them
  - inlines them as Base64

- This guarantees **100% reliable rendering** inside the PDF.

---

## Summary

This backend is designed for REAL production PDFs:

- Beautiful Tailwind-styled layouts
- Guaranteed image loading
- No broken icons
- No missing SVGs
- Smaller PDF size thanks to compression

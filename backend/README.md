# Backend

Node.js + Express server for PDF generation using Puppeteer, now with job queue support for asynchronous PDF rendering.

## Architecture

The backend uses a **layered architecture** for maintainability:

```
HTTP Request
    ↓
Controller (routes/pdfRoute.js) — enqueues, returns a jobId immediately
    ↓
PDF Queue (infrastructure/pdfQueue.js) — one job at a time
    ↓
Application (app/pdfApp.js) — orchestrates workflow
    ↓
  ① shrinkInlineImages(html) — resize photos while the page is still a string
    ↓
  ② Services (services/htmlService.js) — DOM work, now on a small payload
    ↓
  ③ Infrastructure (infrastructure/) — Puppeteer, Sharp, fs
    ↓
PDF collected by the frontend from GET /job/:id
```

Stage ① exists for memory reasons and must stay ahead of ②. See
[Resource Budget](#resource-budget-512mb--01-cpu) below.

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
   - `shrinkInlineImages()` — resizes every base64 photo **before** the DOM is built
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

## Resource Budget (512MB / 0.1 CPU)

The service runs on a Render free instance: **512MB of RAM and 0.1 CPU, shared
between Node and a Chromium process**, sleeping after 15 minutes of inactivity.
Export failed there in two different ways before the pipeline was shaped around
that budget. Both are worth understanding before changing this code, because the
obvious way to write each step is the one that breaks.

### What the pipeline actually costs

Measured on a 20-photo menu, rendering the same PDF either way:

| stage                          | before  | after     |
| ------------------------------ | ------- | --------- |
| incoming payload               | 11.4MB  | 11.4MB    |
| `new JSDOM(html)`              | +344MB  | **+26MB** |
| peak heap (Node)               | 468MB   | **90MB**  |
| peak RSS (Node, Chromium extra)| 726MB   | **275MB** |
| serialized output              | 0.5MB   | 0.5MB     |

Nothing about the output changed. The 344MB was spent parsing photos into a DOM
that then threw them away, because the resize happened a few lines later.

### The rule this turns into

**Shrink a payload while it is still a string.** The same bytes cost about 1x as
a string and about **30x** as a DOM. Any transformation that makes the page
smaller has to run before parsing, not during traversal — which is why
`shrinkInlineImages()` is a regex pass over the raw HTML rather than another
`querySelectorAll('img')` loop. It is not a micro-optimization; it is the
difference between fitting in the instance and not.

Three consequences worth keeping in mind:

- **Compress at the earliest point you control, which is the browser.** Uploads
  are capped at 600px in `frontend/src/composables/imageCompression.ts` — between
  10x and 50x smaller than a raw phone photo, depending on the source. That work
  costs the visitor's CPU instead of the 0.1 CPU you are paying for, and it
  shrinks the request as well as the render.
- **`process.memoryUsage()` is not your budget.** It reports Node only and never
  sees the Chromium child process. The 512MB covers Node's heap, Node's
  overhead, and Chrome's whole process tree together.
- **Give every wait on something external its own budget.** `networkidle0` waits
  for total network silence; pointed at a CDN it is effectively unbounded, and
  it is what produced the 60s navigation timeouts. `STYLESHEET_BUDGET_MS` in
  `puppeteerInfra.js` bounds the one remaining outbound wait, and a timeout
  there degrades to the fallback font instead of failing the export. **An
  optional resource must never be able to fail a required output.**

### Where each limit lives

| limit                   | value  | where                                     | raise it when                              |
| ----------------------- | ------ | ----------------------------------------- | ------------------------------------------ |
| request body            | 50mb   | `server.js` — `express.json`              | menus legitimately exceed it               |
| Node heap               | 256MB  | `package.json` — `start` script           | you move off the free instance             |
| upload dimension        | 600px  | frontend `imageCompression.ts`            | you want larger photos in the PDF          |
| server-side resize      | 300px  | `htmlService.js` / `imageInfra.js`        | printed photos look soft                   |
| stylesheet wait         | 20s    | `puppeteerInfra.js`                       | webfonts routinely miss the budget         |
| page / navigation       | 60s    | `puppeteerInfra.js`                       | large menus time out                       |
| job retention           | 5 min  | `pdfQueue.js` — `JOB_TTL`                 | clients poll slower than that              |

`npm start` is what applies the heap cap, and it is what Render runs. Starting
the server with `node server.js` skips it.

### Reading a crash

The three failure modes look different in the logs and have different fixes:

| log                                                        | meaning                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `Reached heap limit ... JavaScript heap out of memory` + a native stack trace | **Node's V8 heap.** Too much data held in-process — parse less, or parse later |
| process dies with no JS error at all                        | **The container's OOM killer.** Total RSS, Chromium included, exceeded 512MB |
| `Navigation timeout of N ms exceeded` inside `setContent`   | **A lifecycle wait that never completed**, almost always an external resource |
| `Stylesheets did not load in time`                          | Not a failure. The webfont missed its budget; the PDF still rendered |

### Deliberately not done

- **Reusing one browser across requests.** It would save the launch cost on every
  export, but a resident Chromium holds 150-250MB permanently out of 512MB.
  Launching per request gives that memory back between renders, which matters
  more here than the CPU saved. On a paid instance, reverse this.
- **Anything about the ~50s cold start.** The instance sleeps after 15 minutes
  and wakes slowly; that is the plan, not the code. An external keepalive
  pinging `/ping` every 10 minutes is what removes it.

---

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
npm start
```

Server runs on http://localhost:3000

Use `npm start`, not `node server.js`: the start script sets the Node heap cap
that keeps the process inside a 512MB instance. See
[Resource Budget](#resource-budget-512mb--01-cpu).

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
- Safe PDF preview on iOS/iPadOS using blob URLs in <iframe>

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

3. **Project structure**

```
backend/
├── app/
│   └── pdfApp.js              # Application layer orchestrator
├── infrastructure/
│   ├── imageInfra.js          # Sharp image compression wrapper
│   ├── pdfQueue.js            # Async job queue manager
│   └── puppeteerInfra.js      # Puppeteer PDF rendering wrapper
├── routes/
│   ├── oldpdf.js              # Legacy PDF route
│   ├── pdfRoute.js            # Main PDF generation route
│   └── uploadRoute.js         # File upload route (unused)
├── services/
│   └── htmlService.js         # HTML sanitization and image inlining
├── server.js                  # Express server entry point
├── package.json
└── README.md
```

---

## **Usage**

1. Start the backend:

```bash
cd backend/
npm start
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

```ts
const giveUpAt = Date.now() + 3 * 60 * 1000

while (Date.now() < giveUpAt) {
  const res = await fetch(`${API}/job/${jobId}`)

  // done
  if (res.headers.get('content-type')?.includes('application/pdf')) {
    const blob = await res.blob()
    // open or download the PDF
    break
  }

  // a failed render answers 500 with { status: 'error', error }, and a job
  // past its TTL answers 404 with plain text — neither carries a pollable
  // status, so both have to end the loop
  if (!res.ok) {
    showRetry(res.status === 404 ? 'That export expired.' : 'PDF generation failed.')
    break
  }

  const status = await res.json()
  if (status.status === 'error') {
    showRetry('PDF generation failed.')
    break
  }

  await new Promise((r) => setTimeout(r, 2000))
}
```

Every outcome has to end the loop, including the deadline. Polling only for
`status === 'error'` leaves a failed export spinning indefinitely, because the
failure arrives as an HTTP status rather than in the body.

---

## **Notes / Tips**

- Tailwind CSS must include all classes used in backend HTML, or the PDF will not be styled.
- **Local** CSS files linked with `<link>` will not work — Tailwind is injected as an inline `<style>` block for that reason.
- **Remote** stylesheets (Google Fonts) do work, but only if the render waits for
  them. `setContent` with `waitUntil: 'domcontentloaded'` returns before any
  stylesheet is fetched, which silently produced fallback-font PDFs for a long
  time: 0 registered `@font-face` rules, against 525 once the sheet loads.
  `waitUntil: 'load'` is what fetches it.
- Images must be inlined (PNG/JPG) or rasterized (SVG) for PDF reliability
- Async queue prevents Puppeteer crashes under load
- Blob URLs inside <iframe> are used for iOS/iPad preview

---

## Summary

This backend is designed for REAL production PDFs:

- Fully production-ready backend for MenuGen PDF generation
- Async job queue for large PDFs or free-tier hosts
- Tailwind-styled layouts with embedded images
- Pixel-perfect PDF output
- Cross-platform safe, including iOS/iPadOS

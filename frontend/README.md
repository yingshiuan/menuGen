# MenuGen — Smart Menu Builder

### CSV → Editable Menu UI → PDF Export (with Puppeteer backend)

MenuGen is an interactive **menu creation tool** that converts a CSV file into an editable menu interface. Users can modify items visually and export a **pixel-perfect PDF** using a backend powered by Puppeteer + Tailwind CSS v4.

Visit [MenuGen](https://menugen.insdash.ch/) to try it out.

## Technologies

- **Vue 3** + TypeScript
- **Vite** for build tooling
- **Tailwind CSS v4** for responsive layouts
- **Pinia** for state management
- **PapaParse** for CSV parsing
- **Vitest** for unit testing

# Features

### CSV Import

Upload a CSV file and instantly convert it into structured menu items with auto-numbering and category grouping.

### Live Editable UI

- Inline editing of all fields: No, Name, ChineseName, Measure, Price, Description, Category, Icons
- Drag-and-drop item reordering
- Add/delete items dynamically
- Color and font customization (Google Fonts support)
- Image upload and cropping for pictures, icons, and logos

### Tailwind-powered Layout

Fully responsive layout using Tailwind CSS v4, with auto-layout for single or two-page previews.

### Smart Image Handling

- Image upload with compression and cropping
- Google Icons integration
- Reusable `ImageUploader` component with variants (`logo`, `cover`, `avatar`)
- SVGs auto-inlined or rasterized before PDF export
- Ensures that **all images render in the final PDF**

### Pixel-Perfect PDF Export (via backend)

Frontend sends HTML → backend renders it in headless Chrome (Puppeteer) → returns accurate PDF with async job queue.

# Project Structure (Frontend)

```
frontend/
├── public/
│   ├── css/
│   │   └── tailwind.css        # compiled Tailwind used for PDF
│   ├── data/
│   │   ├── afatt-menu/
│   │   ├── downCSV/
│   │   └── afatt_ menu.numbers
│   ├── demo/
│   │   ├── gif/
│   │   └── webp/
│   └── picture/
├── src/
│   ├── __tests__/
│   ├── asset/
│   │   ├── png/
│   │   ├── styles/
│   │   │   └── style.css
│   │   └── svg/
│   ├── components/
│   │   ├── AddIcon.vue
│   │   ├── AddLogo.vue
│   │   ├── CoverLogo.vue
│   │   ├── CsvUpload.vue
│   │   ├── GeneratePdf.vue
│   │   ├── ImageCropper.vue
│   │   ├── ImageUploader.vue
│   │   ├── MultiImageUpload.vue
│   │   ├── TopBanner.vue
│   │   ├── archive/
│   │   ├── controls/
│   │   │   ├── ColorPicker.vue
│   │   │   ├── FontSelector.vue
│   │   │   ├── ItemSpacingControl.vue
│   │   │   ├── ItemsPerCategorySelector.vue
│   │   │   ├── MenuPage.vue
│   │   │   ├── PageSizeSelector.vue
│   │   │   ├── ScaleControl.vue
│   │   │   └── TwoPage.vue
│   │   └── layouts/
│   │       ├── MenuCover.vue
│   │       ├── MenuItem.vue
│   │       ├── MenuPreview.vue
│   │       └── MeunInfo.vue
│   ├── composables/
│   │   ├── useIcons.ts
│   │   ├── useImageCropper.ts
│   │   ├── useImageUpload.ts
│   │   └── useMultiImageUpload.ts
│   ├── router/
│   │   └── index.ts
│   ├── stores/
│   │   └── menu.ts
│   ├── types/
│   │   ├── papaparse.d.ts
│   │   └── types.ts
│   ├── views/
│   │   └── MenuCreate.vue
│   ├── App.vue
│   ├── main.ts
│   └── vite.config.ts
├── Dockerfile
├── Dockerfile.dev
├── eslint.config.ts
├── index.html
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.vitest.json
├── vite.config.ts
└── vitest.config.ts
```

# Install Dependencies

```bash
npm install
```

---

# Compile Tailwind CSS (used for PDF rendering)

The backend loads **your compiled Tailwind from `public/css/tailwind.css`**.

**Whenever new TailwindCSS classes are added to the layout, you need to rebuild the CSS.**

Build it with:

```bash
npx @tailwindcss/cli -i ./src/asset/styles/style.css -o ./public/css/tailwind.css --minify
```

Make sure this file exists before exporting PDFs.

---

# PDF Export Flow

When user clicks **Export PDF**, the frontend:

1. Captures the menu's **fully rendered HTML**
2. Sends it to the backend via POST to enqueue a PDF job:

```js
const response = await fetch('http://localhost:3000/generate-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html }),
})

const { jobId } = await response.json()
```

3. Polls the job status until complete:

```js
let pdfReady = false
while (!pdfReady) {
  const res = await fetch(`http://localhost:3000/job/${jobId}`)
  if (res.headers.get('content-type') === 'application/pdf') {
    const blob = await res.blob()
    pdfReady = true
    // Open or download PDF
  } else {
    const status = await res.json()
    console.log('PDF status:', status.status)
    await new Promise((r) => setTimeout(r, 2000)) // poll every 2s
  }
}
```

4. Backend processes the job asynchronously:
   - Parses HTML
   - Detects `<img>` tags
   - Compresses PNG/JPG, handles SVGs
   - Injects Tailwind CSS
   - Generates PDF using Puppeteer
   - Updates job status to 'done'

5. Frontend receives the PDF as a Blob and opens/downloads it.

---

# Example Frontend PDF Export Code

```ts
async function exportPDF(html: string) {
  // Enqueue PDF job
  const enqueueRes = await fetch('http://localhost:3000/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })

  const { jobId } = await enqueueRes.json()

  // Poll for completion
  let pdfBlob: Blob | null = null
  while (!pdfBlob) {
    const statusRes = await fetch(`http://localhost:3000/job/${jobId}`)
    if (statusRes.headers.get('content-type') === 'application/pdf') {
      pdfBlob = await statusRes.blob()
    } else {
      const status = await statusRes.json()
      if (status.status === 'error') {
        throw new Error('PDF generation failed')
      }
      await new Promise((r) => setTimeout(r, 2000)) // wait 2s before polling again
    }
  }

  // Download or open PDF
  const url = URL.createObjectURL(pdfBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'menu.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
```

---

# Notes

### ✔ The backend now automatically:

- Compresses **PNG/JPG** with Sharp
- Converts **SVG → PNG** or inlines SVGs
- Ensures _all images appear_ in the PDF via base64 inlining
- Uses async job queue to prevent overload

### ✔ The frontend does NOT need to handle image compression

Just send the original HTML — backend takes care of it.

### ✔ Keep images in:

```
/public/picture/
/src/asset/picture/
/src/asset/svg/
```

So backend can find and process them.

### ✔ PDF generation is asynchronous

Use job polling for reliable PDF delivery, especially on mobile devices.

---

# Status: PDF Export System is Complete

Your frontend + backend now work together to produce:

- Pixel-perfect PDFs matching the Tailwind-based live preview
- Responsive layouts with proper pagination
- Embedded images and fonts
- Async processing for stability

---

# Running Locally

```bash
npm run dev
```

Default: [http://localhost:5173](http://localhost:5173)

For LAN/mobile access:

```bash
npm run dev -- --host
```

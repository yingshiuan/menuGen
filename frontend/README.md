# MenuGen — Smart Menu Builder

### CSV → Editable Menu UI → PDF Export (with Puppeteer backend)

MenuGen is an interactive **menu creation tool** that converts a CSV file into an editable menu interface. Users can modify items visually and export a **pixel-perfect PDF** using a backend powered by Puppeteer + Tailwind CSS v4.


# Features

### CSV Import

Upload a CSV file and instantly convert it into structured menu items.

### Live Editable UI (coming soon)

Update titles, images, categories, and pricing directly in the preview.

### Tailwind-powered Layout

Fully responsive layout using Tailwind CSS v4.

### Smart Image Handling

* Images uploaded from frontend are stored locally
* Large images/icons automatically compressed in backend
* SVGs auto-inlined before PDF export
* Ensures that **all images render in the final PDF**

### Pixel-Perfect PDF Export (via backend)

Your frontend sends HTML → the backend renders it in headless Chrome (Puppeteer) → returns an accurate PDF.



# Project Structure (Frontend)

```
frontend/
├── public/
│   ├── picture/
│   ├── data/
│   └── css/
│       └── tailwind.css        # compiled Tailwind used for PDF
├── src/
│   ├── asset/
│   │   ├── picture/            # uploaded/used images
│   │   └── svg/                # local SVG icons
│   │   └── styles/
│   │       └── style.css     
│   ├── components/             # menu builder UI components
│   ├── views/                  # main view
│   ├── stores/
│   ├── router/
│   ├── App.vue
│   └── main.ts
│   └── index.html
└── package.json
```



# Install Dependencies

```bash
npm install
```

---

# Compile Tailwind CSS (used for PDF rendering)

The backend loads **your compiled Tailwind from `public/css/tailwind.css`**.

Build it with:

```bash
npx @tailwindcss/cli -i ./src/asset/styles/style.css -o ./public/css/tailwind.css --minify
```

Make sure this file exists before exporting PDFs.

---

# PDF Export Flow

When user clicks **Export PDF**, the frontend:

1. Captures your menu’s **fully rendered HTML**
2. Sends it to the backend:

```js
await fetch("http://localhost:3000/generate-pdf", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ html }),
});
```

3. Backend:

   * Parses HTML
   * Detects `<img>` tags
   * Compresses PNG/JPG
   * Converts SVG → PNG or inline SVG
   * Injects Tailwind CSS
   * Generates PDF using Puppeteer
   * Returns the PDF

4. Frontend receives the PDF as a Blob and opens/downloads it.

---

# Example Frontend PDF Export Code

```ts
async function exportPDF(html) {
  const response = await fetch("http://localhost:3000/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  window.open(url, "_blank"); // display PDF in new tab
}
```

---

# Notes

### ✔ The backend now automatically:

* compresses **PNG/JPG**
* converts **SVG → PNG**
* inlines SVGs when needed
* ensures *all images appear* in the PDF

### ✔ The frontend does NOT need to handle image compression

Just send the original HTML — backend takes care of it.

### ✔ Keep images in:

```
/src/asset/picture/
/src/asset/svg/
```
or
```
/public/picture
```

So backend can find and compress them.

---


# Status: PDF Export System is Complete

Your frontend + backend now work together to produce:

* pixel-perfect
* styled
* image-safe
* Tailwind-compatible

PDFs exactly matching your Vue UI.

---






TODO LIST

# Screenshot /Demo GIFs

- Uploading a CSV
- Auto layout preview
- Editing inline
- Exporting PDF

Perfect! If you choose **Option B (Puppeteer / headless Chrome)**, your workflow will allow **pixel-perfect PDFs that exactly match your Tailwind-based live preview**. Here’s a detailed plan and what you need to set up:

---

## **1. Architecture**

Since Puppeteer is **Node.js based**, your app will have two parts:

1. **Frontend (Vue + Tailwind)**

   * Upload CSV → Vue state
   * Live editing + preview
   * Display menu with Tailwind classes
   * Send the current menu state to the backend when “Export PDF” is clicked

2. **Backend (Node.js + Puppeteer)**

   * Receives menu data from frontend (JSON or rendered HTML)
   * Loads a Vue-rendered page or generates an HTML template using the menu data
   * Uses Puppeteer to render the HTML page and generate PDF
   * Returns PDF to the frontend for download

---

## **2. Data flow**

1. User uploads CSV → parsed into **Vue reactive state**
2. User edits menu → updates Vue state
3. User clicks “Export PDF” → frontend sends **current menu JSON** to backend
4. Backend builds **HTML page using Tailwind** (can use same Vue components or template engine)
5. Puppeteer opens page → waits for fonts and Tailwind CSS → generates PDF
6. PDF sent back → browser downloads file

---

## **3. Puppeteer setup**

**Install Puppeteer:**

```bash
npm install puppeteer
```

**Example Node.js server endpoint (Express):**

```js
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
app.use(express.json());

app.post('/export-pdf', async (req, res) => {
  const menuData = req.body; // menu JSON

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // You can either:
  // 1) Load a static HTML page and inject menuData via query or JS
  // 2) Generate HTML string directly
  const html = generateMenuHTML(menuData); // function that returns full HTML with Tailwind

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready); // ensure fonts loaded

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  });

  await browser.close();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename=menu.pdf',
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## **4. Frontend Vue Example**

```ts
async function exportPDF() {
  await fetch('/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(menuCsv.value),
  })
    .then((res) => res.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    });
}
```

* The frontend sends the **current menu JSON** to the backend.
* Backend renders PDF using Tailwind exactly as seen on screen.

---

## **5. Benefits of this approach**

* Pixel-perfect PDF with all Tailwind styles, fonts, colors, and layout.
* Works with multi-page menus (Puppeteer handles page breaks).
* No need to duplicate Tailwind styles in a hidden PDF container.
* Easy to maintain: your live preview and PDF can share the same layout logic.

---

## **6. Considerations**

* Puppeteer cannot run fully in the browser; you need **Node.js backend**.
* Hosting: if deploying to serverless (Vercel, Netlify), you need a **Puppeteer-compatible environment** (some require chromium flags).
* For local development, `npm run dev` + backend server works fine.

---

If you want, I can **rewrite your Vue menu builder + Puppeteer backend example** so that:

* CSV upload → Vue editing → live Tailwind preview
* Click “Export PDF” → Puppeteer backend generates **pixel-perfect PDF**

This would be a complete working solution for your app.

Do you want me to do that
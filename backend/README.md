# PDF Generator Backend

### **Puppeteer + Tailwind CSS v4 + Automatic Image Compression**

This backend service allows you to generate PDF files from HTML content using **Puppeteer** while applying **Tailwind CSS v4** styles.

It automatically:

- Injects Tailwind CSS
- Loads all images
- Compresses PNG/JPG images
- Converts SVG files to PNG
- Inlines images as Base64 for perfect rendering in PDFs

---

## **Features**

* Accepts HTML content from a frontend via a POST request.
* Automatically wraps the HTML with your compiled **Tailwind CSS v4**
* Waits for all images to load
* Compresses local images automatically:

  * `.png` / `.jpg` → resized + compressed with **sharp**
  * `.svg` → rasterized into PNG (sharp)
* Handles images from:

  * `/picture/...`
  * `/src/asset/...`
  * `/public/...`
* Outputs a high-quality **A4 PDF** (with ackground colors and margins)
* Returns the PDF inline for preview or as a downloadable file.

---

## **Tech Stack**

* **Node.js** + Express
* **Puppeteer** (Chromium)
* **Sharp** (image compression)
* **JSDOM** (HTML parsing)
* **Tailwind CSS v4**
* CORS for frontend communication

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

* Adjust the `input.css` and output path as needed.


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
const htmlContent = `<div class="p-4 bg-gray-100 border border-gray-400">Hello PDF!</div>`;

const response = await fetch("http://localhost:3000/generate-pdf", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ html: htmlContent }),
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);
window.open(url, "_blank"); // Preview PDF in browser
```

---

## **Notes / Tips**

* Make sure **Tailwind CSS includes all classes used in your backend HTML**, or the PDF will not be styled.
* Puppeteer requires inline CSS (`<style>`). Linking local CSS files (`<link>`) will **not work**.

* Puppeteer cannot load local files directly—so the backend automatically:

  * finds images
  * compresses them
  * inlines them as Base64
* This guarantees **100% reliable rendering** inside the PDF.

---

## Summary

This backend is designed for REAL production PDFs:

* Beautiful Tailwind-styled layouts
* Guaranteed image loading
* No broken icons
* No missing SVGs
* Smaller PDF size thanks to compression
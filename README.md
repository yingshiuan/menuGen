# MenuGen

### CSV → Editable UI → Tailwind Preview → Pixel-Perfect PDF Generator

MenuGen is a smart menu-building tool that transforms a CSV file into an editable Vue interface and generates **pixel-perfect PDFs** using a Node.js backend powered by **Puppeteer**.

It supports:

✔ CSV Parsing
✔ Inline Editing -- coming soon
✔ Auto Layout (Tailwind CSS v4)
✔ Icon & Image Upload
✔ Automatic image/SVG compression
✔ Perfect PDF Export (exact same look as the on-screen preview)

---
# ✅ TODO List (Roadmap)

### Core Features
- [x] CSV Upload + Parsing  
- [x] Tailwind-based Live Preview  
- [x] Image + SVG auto compression on backend  
- [x] Pixel-perfect Puppeteer PDF generator  
- [x] Inline editing UI (name, price, description, options, picture)  
- [ ] Section grouping + manual ordering  
- [x] Multi-page layout rules (page breaks), Section grouping by 9 items
- [ ] Multi-page layout rules and dynamic layout
- [x] Upload image   
- [ ] Drag-and-drop image/icon replacement  
- [x] Export Multi-page pdf  
- [ ] Preview two pages 
- [x] Allow users to set custom width and height for the menu PDF
- [ ] Add common size for users to select

### UI Improvements
- [ ] Dark/Light theme toggle  
- [x] 6 fonts selection  
- [ ] Custom font selection  
- [ ] Auto-fit long descriptions  
- [ ] Category templates (e.g., Drinks, Starters, Specials)

### Export / Import
- [x] Export menu as csv
- [ ] Export menu as JSON
- [ ] Import JSON back into editor  
- [ ] Export as high-res PNG images (front/back)

### Icons & Images
- [x] Detect local images automatically  
- [x] Compress + rasterize large SVGs  
- [x] Built-in library of dietary icons (GF, Vegan, Spicy, etc.)  
- [ ] Allow uploading user’s own icon pack  

### Backend Enhancements
- [ ] Cache processed images to speed up repeated exports  
- [ ] Headless Chrome optimization flags  
- [ ] Enable “Print-ready bleed & margins” mode  
- [ ] CLI: `menugen generate menu.json` → PDF

### 🚀 Deployment
- [ ] Docker support  
- [ ] Production build guide for Railway / Render  
- [ ] Vercel-compatible Puppeteer build (edge-compatible optional)

---
# Features

### **Frontend (Vue + Tailwind CSS v4)**

* Upload CSV → auto-structured menu items
* Inline editable UI (names, description, price, categories, icons)
* Upload custom images or SVG icons
* Live Tailwind-styled preview
* Sends HTML directly to backend for PDF generation

### **Backend (Node.js + Puppeteer)**

* Wraps incoming HTML with Tailwind CSS
* Inlines & compresses:

  * PNG / JPG images → compressed Base64
  * SVG → converted to PNG (96–200px) or inlined SVG
* Waits for images + fonts to load
* Exports **A4, full-color, print-background PDF**
* Returns PDF inline or downloadable
* Fully CORS enabled

---

# Project Structure

```
menu-gen/
│
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ views/
│  │  ├─ asset/
│  │  │  ├─ svg/
│  │  │  ├─ pictures/
│  │  │  └─ styles/
│  │  │     └── style.css  
│  ├─ public/
│  │  ├── picture/
│  │  ├── data/
│  │  └─ css/
│  │     └─ tailwind.css
│  └─ README.md (Frontend)
│
├─ backend/
│  ├─ server.js
│  ├─ package.json
│  ├─ svg/ (optional shared folder)
│  └─ README.md (Backend)
│
└─ README.md  ← (This combined documentation)
```

---

# Installation & Setup

## **1. Clone Repo**

```bash
git clone https://github.com/yourname/menu-gen.git
cd menu-gen
```

---

## **2. Install Frontend**

```bash
cd frontend
npm install
```

### Build Tailwind CSS v4:

**Whenever new TailwindCSS classes are added to the layout, you need to rebuild the CSS.**

```bash
npx @tailwindcss/cli \
  -i ./src/asset/styles/style.css \
  -o ./public/css/tailwind.css \
  --minify
```

---

## **3. Install Backend**

```bash
cd ../backend
npm install
```

Includes:

* express
* puppeteer
* jsdom
* sharp
* cors

---

# Running the App

## **Frontend**

```bash
cd frontend
npm run dev
```

Default:
👉 [http://localhost:5173/](http://localhost:5173/)

## **Backend**

```bash
cd backend
node server.js
```

Default:
👉 [http://localhost:3000/](http://localhost:3000/)

---

# Workflow

## **1. Upload CSV**

User uploads a CSV file like:

```
No,Price,Name,ChineseName,Description,Recommend,Spicy,Vegan,Vegetarian,Gluten Free
1,12.99,Pizza,披萨,Cheese and tomato sauce,true,false,false,false,true
```

Frontend parses → structured menu → editable state.

---

## **2. User Edits Inline** (coming soon)

* Change text
* Add images/icons
* Reorder items
* Modify sections
* Live Tailwind preview

---

## **3. Export to PDF**

Frontend sends:

```json
{
  "html": "<div>...full menu HTML...</div>"
}
```

to:

```
POST http://localhost:3000/generate-pdf
```

---

# PDF Export Pipeline (Backend)

### Backend server flow:

#### **1. Parse incoming HTML**

```js
const dom = new JSDOM(html);
const document = dom.window.document;
```

#### **2. Detect all `<img>` elements**

Handles:

* `/src/assets/...`
* `public/...`
* `<img src="data:image/...">`
* SVG icons

#### **3. Compress everything**

| Type      | How it's processed                   |
| --------- | ------------------------------------ |
| PNG/JPG   | compress → resize → Base64           |
| Large SVG | rasterize using Sharp → PNG → Base64 |
| Small SVG | inline SVG text → Base64             |

#### **4. Puppeteer loads optimized HTML**

```js
await page.setContent(optimizedHtml, { waitUntil: "networkidle0" });
```

#### **5. Ensure all images and fonts load**

```js
await page.evaluate(() => document.fonts.ready);
```

#### **6. Generate PDF**

```js
const pdf = await page.pdf({
  format: "A4",
  printBackground: true,
});
```

#### **7. Send PDF back**

```js
res.set({
  "Content-Type": "application/pdf",
  "Content-Disposition": "inline; filename='menu.pdf'"
});
```

---

# Image & SVG Handling

## **Image compression (PNG/JPG)**

* If user uploads a 5MB PNG → backend compresses automatically
* Target size: 96–200px (configurable)
* Converted to Base64 for Puppeteer rendering

## **SVG handling**

Backend uses 2 strategies:

### 1. For simple SVG (< 50 KB)

Inline SVG directly:

```
data:image/svg+xml;base64,PHN2Z...
```

### 2. For complex or large SVG (> 50 KB)

Rasterize to PNG via Sharp:

```js
const optimizedBuffer = await sharp(buffer)
  .resize(96, 96, { fit: "contain" })
  .png({ quality: 100 })
  .toBuffer();
```

This ensures:

* No missing SVG in PDF
* Perfect rendering
* Shrinks file size massively

---

# API Endpoints

### `POST /generate-pdf`

| Field | Type   | Description                        |
| ----- | ------ | ---------------------------------- |
| html  | string | full HTML string exported from Vue |

### Example:

```ts
await fetch("http://localhost:3000/generate-pdf", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ html }),
});
```

---

# Troubleshooting

### **PDF missing images**

Make sure your image paths use:

```
/src/asset/...
```

or convert them to Base64 before sending.

### **Tailwind styles missing**

Rebuild Tailwind CSS:

```bash
npx @tailwindcss/cli ...
```

### **SVG not rendering**

Ensure icon name matches file in `public/svg/`.

---

# License

This project is licensed under the MIT License.

---

## Author

Created by [Ying-Shiuan Chen](https://github.com/yingshiuan/)

# Product Roadmap

## Phase 1 – Polish & Usability (Next Release)
- [x] Preview two pages side-by-side
- [ ] Add common page size presets (A4, Letter, etc.)
- [ ] Offer multiple cover layout templates
- [ ] Auto-fit long descriptions
- [ ] Dark / Light theme toggle

## Phase 2 – Data & Export Improvements
- [ ] Export as JSON
- [ ] Import JSON back into editor
- [ ] Export high-res PNG (front/back)
- [ ] Cache processed images for faster exports

## Phase 3 – Print & Production Features
- [ ] Print-ready bleed & margin mode
- [ ] Headless Chrome optimization flags
- [ ] CLI: `menugen generate menu.json → PDF`

## Phase 4 – Deployment & Scaling
- [x] Docker support
- [ ] Production deployment guide (Railway / Render)
- [ ] Vercel-compatible Puppeteer build


## AI Features
- [ ] One-click menu translation (multi-language support)
- [ ] Bilingual layout mode
- [ ] AI description enhancement
- [ ] Bulk translate entire m

---

## TODO

### Core Features
- [x] CSV Upload + Parsing  
- [x] Tailwind-based Live Preview  
- [x] Image + SVG auto compression on backend  
- [x] Pixel-perfect Puppeteer PDF generator  
- [x] Inline editing UI (No, Name, ChineseName, Price, Description, options, picture, Category)  
- [X] Section grouping
- [X] Manual ordering, adding, deleting item.
- [x] Multi-page layout rules (page breaks), Section grouping by 9 items
- [x] Multi-page layout rules and dynamic layout
- [x] Upload image   
- [X] Drag-and-drop image replacement  
- [X] Drag-and-drop icon replacement  
- [x] Export Multi-page pdf  
- [x] Preview two pages 
- [x] Allow users to set custom width and height for the menu PDF
- [ ] Add common page size for users to select
- [x] Set cover layout styles
- [ ] Offer few cover layout

### UI Improvements
- [ ] Dark/Light theme toggle  
- [x] 6 fonts selection  
- [x] Support Google Fonts (paste font name to load dynamically)
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
- [X] Allow uploading user’s own picture
- [X] Allow uploading user’s own icon pack  

### Backend Enhancements
- [ ] Cache processed images to speed up repeated exports  
- [ ] Headless Chrome optimization flags  
- [ ] Enable “Print-ready bleed & margins” mode  
- [ ] CLI: `menugen generate menu.json` → PDF

### Deployment
- [ ] Docker support  
- [ ] Production build guide for Railway / Render  
- [ ] Vercel-compatible Puppeteer build (edge-compatible optional)

---
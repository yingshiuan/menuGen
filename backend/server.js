import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';


const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // allow requests from frontend
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true })); // parse JSON from frontend

const cssPath = path.resolve('../frontend/public/css/tailwind.css');
const tailwindCSS = fs.readFileSync(cssPath, 'utf-8');

// Helper: compress local image and return base64
async function compressImage(filePath, width = 200, height = 200) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const optimizedBuffer = await sharp(buffer)
    .resize(width, height, { fit: 'inside' })
    .png({ quality: 100 })
    .toBuffer();
  return `data:image/png;base64,${optimizedBuffer.toString('base64')}`;
}

async function compressSvg(filePath, width = 96, height = 96) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const optimizedBuffer = await sharp(buffer)
    .resize(width, height, { fit: 'contain' })
    .png({ quality: 100 })
    .toBuffer();
  return `data:image/png;base64,${optimizedBuffer.toString('base64')}`;
}

// POST /generate-pdf
app.post('/generate-pdf', async (req, res) => {
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).send('HTML content is required');
    }
    const dom = new JSDOM(html);
    const document = dom.window.document;

   document.querySelectorAll('input, textarea, select').forEach(el => {
      const span = document.createElement('span');
      span.textContent = el.value || '';
      el.replaceWith(span);
    });

    // ======= REMOVE UNSELECTED ICONS HERE =======
    document.querySelectorAll('img[data-selected]').forEach(img => {
      if (img.getAttribute('data-selected') !== 'true') {
        img.remove();
      } else {
        // remove the attribute so it won't appear in PDF
        img.removeAttribute('data-selected');
      }
    });

    // Parse HTML
    const images = Array.from(document.querySelectorAll('img'));
    for (const img of images) {
      const src = img.getAttribute('src');
      if (!src) continue;

      // Remove query string (?v=1)
      const cleanSrc = src.split('?')[0];

      let filePath;
      if (cleanSrc.startsWith('/picture/')) {
        filePath = path.resolve('../frontend/public', cleanSrc.replace(/^\/+/, ''));
      } else {
        filePath = path.resolve('../frontend/public', cleanSrc.replace(/^\/+/, ''));
      }

      if (!fs.existsSync(filePath)) {
        img.setAttribute('data-missing', 'true');
        continue;
      }

      let base64 = null;
      if (filePath.endsWith('.svg')) {
        base64 = await compressSvg(filePath, 96, 96);
      } else {
        base64 = await compressImage(filePath, 200, 200);
      }

      if (base64) img.setAttribute('src', base64);
    }

    // Remove circles with empty <img> after conversion
    document.querySelectorAll('span').forEach(span => {
      if (span.textContent?.trim() === 'Upload') {
        span.remove();
      }
    });


    const optimizedHtml = `
      <html>
        <head>
          <style>${tailwindCSS}</style>
        </head>
        <body>${document.body.innerHTML}</body>
      </html>
    `;

    // Launch Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    

    // Set the HTML content
    await page.setContent(optimizedHtml, { waitUntil: 'networkidle0' });

    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => (img.onload = img.onerror = resolve));
        })
      );
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      // margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    await browser.close();

    // Return PDF to frontend
    // res.set({
    //   'Content-Type': 'application/pdf',
    //   'Content-Disposition': 'attachment; filename="document.pdf"',
    // });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="document.pdf"',
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).send('Failed to generate PDF');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

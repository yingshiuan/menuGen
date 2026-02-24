import express from 'express'
import { generatePdfFromHtml } from '../app/pdfApp.js'

const router = express.Router()

// POST /generate-pdf
router.post('/generate-pdf', async (req, res) => {
  try {
    const { html, width, height, font } = req.body

    if (!html) return res.status(400).send('HTML content is required')

    const pdfBuffer = await generatePdfFromHtml({ html, width, height, font })

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="document.pdf"', // "attachment" to force download, "inline" to display in browser
    })
    res.send(pdfBuffer)
  } catch (err) {
    console.error('PDF generation error:', err)
    res.status(500).send('Failed to generate PDF')
  }
})

export default router

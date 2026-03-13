import express from 'express'
import { enqueuePdfJob, getJob } from '../infrastructure/pdfQueue.js'

const router = express.Router()

// POST /generate-pdf
router.post('/generate-pdf', async (req, res) => {
  const { html, width, height, font } = req.body

  if (!html) {
    return res.status(400).send('HTML content is required')
  }

  const jobId = enqueuePdfJob({ html, width, height, font })

  res.json({ jobId })
})

router.get('/job/:id', (req, res) => {
  const job = getJob(req.params.id)

  if (!job) {
    return res.status(404).send('Job not found')
  }

  if (job.status === 'done') {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="document.pdf"', // "attachment" to force download, "inline" to display in browser
    })
    return res.send(job.result)
  }

  if (job.status === 'error') { 
    return res.status(500).json({ error: job.error })
  }

  res.json({
    status: job.status,
  })
})

export default router

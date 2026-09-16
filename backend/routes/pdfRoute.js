import express from 'express'
import rateLimit from 'express-rate-limit'
import { enqueuePdfJob, getJob } from '../infrastructure/pdfQueue.js'

const router = express.Router()

/* Starting a render is the expensive request: it launches a browser on an
   instance with 0.1 CPU, and the endpoint is open to anyone. Polling is not
   limited -- the client asks every 2s for up to three minutes, which is the
   design rather than abuse -- so this sits on the POST alone. Generous enough
   that iterating on a menu never trips it. */
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many exports from this address. Please try again shortly.' },
})

// POST /generate-pdf
router.post('/generate-pdf', exportLimiter, async (req, res) => {
  const { html, width, height, font } = req.body

  if (!html) {
    return res.status(400).send('HTML content is required')
  }

  const jobId = enqueuePdfJob({ html, width, height, font })

  // A full queue is refused rather than accepted, so the caller finds out now
  // instead of polling a job that will not be reached inside its own deadline.
  if (!jobId) {
    res.set('Retry-After', '30')
    return res.status(503).json({ error: 'The export queue is full. Please try again shortly.' })
  }

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
    // Carries `status` like the in-progress reply below, so a client can read
    // one field for every outcome instead of special-casing this body shape.
    return res.status(500).json({ status: 'error', error: job.error })
  }

  res.json({
    status: job.status,
  })
})

export default router

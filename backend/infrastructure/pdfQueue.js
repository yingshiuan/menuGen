import crypto from 'crypto'
import { generatePdfFromHtml } from '../app/pdfApp.js'

const queue = []
const jobs = {}

let processing = false

export function enqueuePdfJob(payload) {
  const jobId = crypto.randomUUID()

  jobs[jobId] = {
    status: 'queued',
    result: null,
    error: null,
    createdAt: Date.now()
  }

  queue.push({
    jobId,
    payload
  })

  processQueue()

  return jobId
}

export function getJob(jobId) {
  return jobs[jobId]
}

async function processQueue() {
  if (processing) return
  if (queue.length === 0) return

  processing = true

  const job = queue.shift()

  try {
    jobs[job.jobId].status = 'processing'

    const pdfBuffer = await generatePdfFromHtml(job.payload)

    jobs[job.jobId].status = 'done'
    jobs[job.jobId].result = pdfBuffer
  } catch (err) {
    console.error('Queue PDF error:', err)

    jobs[job.jobId].status = 'error'
    jobs[job.jobId].error = err.message
  }

  processing = false

  processQueue()
}

/* auto cleanup memory */
setInterval(() => {
  const TTL = 5 * 60 * 1000
  const now = Date.now()

  for (const id in jobs) {
    if (now - jobs[id].createdAt > TTL) {
      delete jobs[id]
    }
  }
}, 300000)
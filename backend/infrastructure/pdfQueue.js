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

  // Hold the record instead of looking it up again after the await. If it ever
  // goes missing, writing through the lookup throws -- and it threw from inside
  // the catch block too, so the rejection escaped with nothing to handle it and
  // took the process down, losing the queue with it.
  const record = jobs[job.jobId]

  try {
    if (record) record.status = 'processing'

    const pdfBuffer = await generatePdfFromHtml(job.payload)

    if (record) {
      record.status = 'done'
      record.result = pdfBuffer
    }
  } catch (err) {
    console.error('Queue PDF error:', err)

    if (record) {
      record.status = 'error'
      record.error = err.message
    }
  } finally {
    // Both statements belong here: whatever happened above, the queue has to
    // free up and then drain whatever arrived while this job was running.
    processing = false
    processQueue()
  }
}

/* auto cleanup memory: drop settled jobs once the client has had time to
   collect them. Jobs still queued or rendering are left alone -- deleting a
   live record is what used to wedge processQueue above. Sweeping every minute
   rather than every five keeps the effective retention close to the TTL
   instead of stretching it to ten minutes. */
const JOB_TTL = 5 * 60 * 1000

setInterval(() => {
  const now = Date.now()

  for (const id in jobs) {
    const settled = jobs[id].status === 'done' || jobs[id].status === 'error'

    if (settled && now - jobs[id].createdAt > JOB_TTL) {
      delete jobs[id]
    }
  }
}, 60000)
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../../server.js'

/**
 * These are the shapes the browser branches on, and getting one wrong is what
 * left a failed export polling forever: the client has to be able to tell "still
 * working" from "never coming" without guessing. So each status code and body is
 * pinned rather than just the happy path.
 *
 * The real server app is used, not a rebuilt one, so the CORS allow-list and the
 * /ping route are covered too and the test app cannot drift from the shipped one.
 * server.js only binds a port when it is the entrypoint, so importing it here is
 * free.
 *
 * Unlike the frontend specs this file uses vi.mock: the backend has no dependency
 * injection and only static ESM imports, so the module path is the only seam.
 */
const enqueuePdfJob = vi.hoisted(() => vi.fn())
const getJob = vi.hoisted(() => vi.fn())
vi.mock('../../infrastructure/pdfQueue.js', () => ({ enqueuePdfJob, getJob }))

beforeEach(() => {
  enqueuePdfJob.mockReset().mockReturnValue('job-1')
  getJob.mockReset()
})

describe('POST /generate-pdf', () => {
  it('queues the job and answers with its id straight away', async () => {
    const res = await request(app)
      .post('/generate-pdf')
      .send({ html: '<p>Soup</p>', width: '148mm', height: '210mm', font: 'Inter' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ jobId: 'job-1' })
    expect(enqueuePdfJob).toHaveBeenCalledWith({
      html: '<p>Soup</p>',
      width: '148mm',
      height: '210mm',
      font: 'Inter',
    })
  })

  it('rejects a payload with no html rather than queueing an empty render', async () => {
    const res = await request(app).post('/generate-pdf').send({ width: '210mm' })

    expect(res.status).toBe(400)
    expect(res.text).toBe('HTML content is required')
    expect(enqueuePdfJob).not.toHaveBeenCalled()
  })

  // A queue this instance cannot drain inside the client's own deadline is worse
  // than a refusal: the caller polls for three minutes and then gives up anyway,
  // while the payload sits in a 256MB heap the whole time.
  it('refuses with 503 and a Retry-After when the queue is full', async () => {
    enqueuePdfJob.mockReturnValue(null)

    const res = await request(app).post('/generate-pdf').send({ html: '<p>Soup</p>' })

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
    expect(res.body.error).toMatch(/queue is full/i)
    expect(res.body.jobId).toBeUndefined() // nothing to poll for
  })
})

describe('GET /job/:id', () => {
  it('reports progress while the render is still queued', async () => {
    getJob.mockReturnValue({ status: 'queued', result: null, error: null })

    const res = await request(app).get('/job/job-1')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'queued' })
  })

  it('sends the PDF inline once the job is done', async () => {
    getJob.mockReturnValue({ status: 'done', result: Buffer.from('%PDF-1.4 body') })

    const res = await request(app).get('/job/job-1')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe('inline; filename="document.pdf"')
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF')
  })

  // A failed render answers with a status code, not just a body field. A client
  // that only checks `status === 'error'` in the JSON keeps polling forever.
  it('answers a failed render with 500 and the reason', async () => {
    getJob.mockReturnValue({ status: 'error', error: 'Navigation timeout of 60000 ms exceeded' })

    const res = await request(app).get('/job/job-1')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({
      status: 'error',
      error: 'Navigation timeout of 60000 ms exceeded',
    })
  })

  // The TTL sweep drops settled jobs, so a slow client can ask for one that is
  // already gone. That is a dead end, not a retry.
  it('answers 404 for a job that was never issued or has expired', async () => {
    getJob.mockReturnValue(undefined)

    const res = await request(app).get('/job/gone')

    expect(res.status).toBe(404)
    expect(res.text).toBe('Job not found') // res.send of a string, so text not body
  })
})

describe('GET /ping', () => {
  it('answers without touching the queue, so a keepalive costs nothing', async () => {
    const res = await request(app).get('/ping')

    expect(res.status).toBe(200)
    expect(res.text).toBe('pong')
    expect(getJob).not.toHaveBeenCalled()
  })
})

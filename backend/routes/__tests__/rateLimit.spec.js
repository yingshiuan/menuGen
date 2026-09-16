import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

/**
 * Starting a render launches a browser on an instance with 0.1 CPU, and the
 * endpoint needs no credentials, so the cost of asking has to be capped.
 *
 * The limit that matters most here is the one that is NOT applied: the client
 * polls /job/:id every two seconds for up to three minutes, so limiting that
 * would break a normal export rather than an abusive one.
 *
 * The limiter keeps its counters in module scope, so each test re-imports the
 * server to start from an empty window.
 */
const enqueuePdfJob = vi.hoisted(() => vi.fn())
const getJob = vi.hoisted(() => vi.fn())
vi.mock('../../infrastructure/pdfQueue.js', () => ({ enqueuePdfJob, getJob }))

const LIMIT = 20

let app

beforeEach(async () => {
  vi.resetModules() // a fresh limiter, and so an empty window, per test
  enqueuePdfJob.mockReset().mockReturnValue('job-1')
  getJob.mockReset()
  app = (await import('../../server.js')).default
})

/** Post one export request. */
const exportOnce = () => request(app).post('/generate-pdf').send({ html: '<p>Soup</p>' })

describe('export rate limit', () => {
  it('lets a whole session of exports through before it bites', async () => {
    for (let i = 0; i < LIMIT; i++) {
      expect((await exportOnce()).status).toBe(200)
    }
  })

  it('refuses another export from the same address once the window is spent', async () => {
    for (let i = 0; i < LIMIT; i++) await exportOnce()

    const res = await exportOnce()

    expect(res.status).toBe(429)
    expect(res.body.error).toMatch(/too many exports/i)
    expect(enqueuePdfJob).toHaveBeenCalledTimes(LIMIT) // the refused one never reached the queue
  })

  it('advertises the budget so a client can see how much is left', async () => {
    const res = await exportOnce()

    // draft-7 is a single combined field, not the draft-6 RateLimit-* trio
    expect(res.headers['ratelimit']).toBe(`limit=${LIMIT}, remaining=${LIMIT - 1}, reset=900`)
    expect(res.headers['x-ratelimit-limit']).toBeUndefined() // legacyHeaders off
  })

  // A three minute export at one poll every two seconds is ~90 requests. Counting
  // those against the same budget would fail the export it is meant to protect.
  it('does not count polling, which a single export does ninety times', async () => {
    getJob.mockReturnValue({ status: 'processing' })

    for (let i = 0; i < 90; i++) {
      expect((await request(app).get('/job/job-1')).status).toBe(200)
    }

    expect((await exportOnce()).status).toBe(200) // budget untouched
  })

  it('leaves the keepalive alone', async () => {
    for (let i = 0; i < 30; i++) {
      expect((await request(app).get('/ping')).status).toBe(200)
    }
  })
})

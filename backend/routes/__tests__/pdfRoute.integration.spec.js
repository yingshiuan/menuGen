import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

/**
 * The unit specs each mock their neighbour, which leaves the seams between them
 * untested -- an id that the route reads differently from how the queue writes it
 * would pass every one of them. This drives the whole POST -> poll -> PDF loop the
 * browser actually performs, with only the renderer stubbed.
 *
 * The renderer is the one thing still faked: launching Chromium here would make
 * the suite depend on a browser that CI deliberately does not install.
 *
 * pdfQueue starts its cleanup interval at module scope, so the fake clock has to
 * be installed before the dynamic import and the modules re-imported per test.
 */
const renderPdf = vi.hoisted(() => vi.fn())
vi.mock('../../app/pdfApp.js', () => ({ generatePdfFromHtml: renderPdf }))

/** A promise whose settlement the test controls, to hold a render open. */
function deferred() {
  let resolve
  const promise = new Promise((res) => {
    resolve = res
  })
  return { promise, resolve }
}

let app

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  renderPdf.mockReset()
  app = (await import('../../server.js')).default
})

afterEach(() => {
  vi.useRealTimers()
})

/** Let the queue's microtask chain settle without moving the clock. */
const flush = () => vi.advanceTimersByTimeAsync(0)

describe('export lifecycle', () => {
  it('carries a menu from POST through polling to PDF bytes', async () => {
    const render = deferred()
    renderPdf.mockReturnValueOnce(render.promise)

    const queued = await request(app).post('/generate-pdf').send({ html: '<p>Szechuan Soup</p>' })
    expect(queued.status).toBe(200)
    const { jobId } = queued.body

    const inProgress = await request(app).get(`/job/${jobId}`)
    expect(inProgress.body).toEqual({ status: 'processing' })

    render.resolve(Buffer.from('%PDF-1.4 real bytes'))
    await flush()

    const finished = await request(app).get(`/job/${jobId}`)
    expect(finished.headers['content-type']).toBe('application/pdf')
    expect(finished.body.toString()).toBe('%PDF-1.4 real bytes')

    // the page settings reached the renderer through the queue untouched
    expect(renderPdf).toHaveBeenCalledWith({
      html: '<p>Szechuan Soup</p>',
      width: undefined,
      height: undefined,
      font: undefined,
    })
  })

  it('surfaces a render failure as a 500 the client can stop on', async () => {
    renderPdf.mockRejectedValueOnce(new Error('Navigation timeout of 60000 ms exceeded'))

    const { body } = await request(app).post('/generate-pdf').send({ html: '<p>Soup</p>' })
    await flush()

    const res = await request(app).get(`/job/${body.jobId}`)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Navigation timeout of 60000 ms exceeded')
  })

  it('turns a collected job into a 404 once the sweep has taken it', async () => {
    renderPdf.mockResolvedValueOnce(Buffer.from('%PDF-1.4'))

    const { body } = await request(app).post('/generate-pdf').send({ html: '<p>Soup</p>' })
    await flush()
    expect((await request(app).get(`/job/${body.jobId}`)).status).toBe(200)

    await vi.advanceTimersByTimeAsync(6 * 60 * 1000) // past the 5 minute TTL

    const res = await request(app).get(`/job/${body.jobId}`)
    expect(res.status).toBe(404)
    expect(res.text).toBe('Job not found')
  })

  it('renders two menus one after another, never side by side', async () => {
    const first = deferred()
    const second = deferred()
    renderPdf.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const one = (await request(app).post('/generate-pdf').send({ html: 'ONE' })).body.jobId
    const two = (await request(app).post('/generate-pdf').send({ html: 'TWO' })).body.jobId

    expect(renderPdf).toHaveBeenCalledOnce() // TWO is waiting, not rendering
    expect((await request(app).get(`/job/${two}`)).body).toEqual({ status: 'queued' })

    first.resolve(Buffer.from('%PDF-ONE'))
    await flush()

    expect((await request(app).get(`/job/${one}`)).body.toString()).toBe('%PDF-ONE')
    expect((await request(app).get(`/job/${two}`)).body).toEqual({ status: 'processing' })

    second.resolve(Buffer.from('%PDF-TWO'))
    await flush()

    expect((await request(app).get(`/job/${two}`)).body.toString()).toBe('%PDF-TWO')
  })
})

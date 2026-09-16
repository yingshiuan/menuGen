import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The queue exists because the free instance has 0.1 CPU and cannot render two
 * menus at once. Its serialization and its cleanup sweep are the whole point, so
 * those are what these tests pin rather than the happy path.
 *
 * Two mechanics are load-bearing here and easy to get wrong:
 *
 *   - pdfQueue registers its sweep `setInterval` at module scope, so the fake
 *     clock has to exist BEFORE the import, and the module has to be re-imported
 *     per test to re-register. Import first and `vi.getTimerCount()` is 0 and the
 *     sweep cannot be driven at all.
 *   - a `vi.mock` factory runs once per file and does NOT re-run on
 *     `vi.resetModules()`, so a `vi.fn()` created inside one silently accumulates
 *     calls across tests. `vi.hoisted` gives a stable handle to reset instead.
 *
 * Unlike the frontend specs this file uses vi.mock: the backend has no dependency
 * injection and only static ESM imports, so the module path is the only seam.
 */
const renderPdf = vi.hoisted(() => vi.fn())
vi.mock('../../app/pdfApp.js', () => ({ generatePdfFromHtml: renderPdf }))

const JOB_TTL_MS = 5 * 60 * 1000
const SWEEP_MS = 60 * 1000

/** A promise whose settlement the test controls, to hold a render open. */
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let queue

beforeEach(async () => {
  vi.resetModules() // drop the cached module so its body -- and its interval -- re-runs
  vi.useFakeTimers() // must precede the import; the interval binds to the clock that exists then
  renderPdf.mockReset()
  renderPdf.mockResolvedValue(Buffer.from('%PDF-1.4'))
  queue = await import('../pdfQueue.js')
})

afterEach(() => {
  vi.useRealTimers() // otherwise each test's fake interval piles up on the next
})

/** Let the queue's microtask chain settle without moving the clock. */
const flush = () => vi.advanceTimersByTimeAsync(0)

/** Advance in whole sweep ticks, which is the only granularity the sweep reacts to. */
const sweep = (ms) => vi.advanceTimersByTimeAsync(ms)

describe('pdfQueue', () => {
  it('returns a job id synchronously, without waiting for the render', async () => {
    const { promise } = deferred()
    renderPdf.mockReturnValueOnce(promise) // never settles during this test

    const jobId = queue.enqueuePdfJob({ html: '<p>menu</p>' })

    expect(jobId).toMatch(/^[0-9a-f-]{36}$/)
    // processQueue runs synchronously as far as its first await, so the render is
    // already handed off by the time the caller gets the id back. That is what
    // lets the route answer immediately instead of holding the request open.
    expect(queue.getJob(jobId).status).toBe('processing')
    expect(renderPdf).toHaveBeenCalledOnce()
  })

  it('carries the rendered buffer through to done', async () => {
    const jobId = queue.enqueuePdfJob({ html: '<p>menu</p>' })

    await flush()

    expect(queue.getJob(jobId).status).toBe('done')
    expect(queue.getJob(jobId).result.toString()).toBe('%PDF-1.4')
    expect(renderPdf).toHaveBeenCalledWith({ html: '<p>menu</p>' })
  })

  it('renders queued jobs strictly in order and never concurrently', async () => {
    const first = deferred()
    const second = deferred()
    const started = []
    // non-async arrows: returning the promise directly keeps the microtask depth
    // shallow enough that one flush() settles each step
    renderPdf
      .mockImplementationOnce((payload) => {
        started.push(payload.html)
        return first.promise
      })
      .mockImplementationOnce((payload) => {
        started.push(payload.html)
        return second.promise
      })

    const one = queue.enqueuePdfJob({ html: 'ONE' })
    const two = queue.enqueuePdfJob({ html: 'TWO' })
    await flush()

    expect(started).toEqual(['ONE']) // TWO has not been handed to the renderer
    expect(renderPdf).toHaveBeenCalledTimes(1) // the concurrency proof
    expect(queue.getJob(two).status).toBe('queued')

    first.resolve(Buffer.from('PDF-ONE'))
    await flush()

    expect(started).toEqual(['ONE', 'TWO'])
    expect(queue.getJob(one).result.toString()).toBe('PDF-ONE')

    second.resolve(Buffer.from('PDF-TWO'))
    await flush()

    expect(queue.getJob(two).result.toString()).toBe('PDF-TWO')
  })

  it('keeps only the message when a render throws', async () => {
    renderPdf.mockRejectedValueOnce(new Error('Navigation timeout of 60000 ms exceeded'))

    const jobId = queue.enqueuePdfJob({ html: '<p>menu</p>' })
    await flush()

    const job = queue.getJob(jobId)
    expect(job.status).toBe('error')
    expect(job.error).toBe('Navigation timeout of 60000 ms exceeded') // no stack, no code
    expect(job.result).toBeNull()
  })

  it('drains the next job after one fails instead of wedging', async () => {
    renderPdf
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(Buffer.from('PDF-TWO'))

    const one = queue.enqueuePdfJob({ html: 'ONE' })
    const two = queue.enqueuePdfJob({ html: 'TWO' })
    await flush()

    expect(queue.getJob(one).status).toBe('error')
    expect(queue.getJob(two).status).toBe('done') // the finally freed `processing`
  })

  it('has no record for an id it never issued', () => {
    expect(queue.getJob('not-a-job')).toBeUndefined()
  })

  // Each waiting payload is a string held in memory and express accepts up to
  // 50mb of them, against a 256MB heap. Accepting without limit is how an open
  // endpoint turns into an OOM.
  describe('backpressure', () => {
    /** Fill the queue: one job renders while MAX_PENDING_JOBS wait behind it. */
    function saturate() {
      const held = deferred()
      renderPdf.mockReturnValue(held.promise) // nothing ever finishes
      const ids = []
      for (let i = 0; i <= queue.MAX_PENDING_JOBS; i++) {
        ids.push(queue.enqueuePdfJob({ html: `job ${i}` }))
      }
      return ids
    }

    it('refuses a job once the queue is full instead of accepting it', () => {
      saturate()

      expect(queue.enqueuePdfJob({ html: 'one too many' })).toBeNull()
    })

    it('accepts everything up to the limit', () => {
      const ids = saturate()

      expect(ids).toHaveLength(queue.MAX_PENDING_JOBS + 1) // the renderer plus the waiters
      expect(ids.every((id) => typeof id === 'string')).toBe(true)
    })

    it('takes work again once the queue drains', async () => {
      const held = deferred()
      renderPdf.mockReturnValue(held.promise)
      for (let i = 0; i <= queue.MAX_PENDING_JOBS; i++) {
        queue.enqueuePdfJob({ html: `job ${i}` })
      }
      expect(queue.enqueuePdfJob({ html: 'rejected' })).toBeNull()

      held.resolve(Buffer.from('%PDF-1.4'))
      await flush() // one job leaves the queue

      expect(queue.enqueuePdfJob({ html: 'now accepted' })).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('refuses before doing any of the work of accepting', () => {
      saturate()
      const callsWhenFull = renderPdf.mock.calls.length

      expect(queue.enqueuePdfJob({ html: 'rejected' })).toBeNull()

      // no id issued, no record created, and nothing handed to the renderer
      expect(renderPdf.mock.calls.length).toBe(callsWhenFull)
    })
  })

  it('hands back the live record, which is what lets the route send the buffer', async () => {
    const jobId = queue.enqueuePdfJob({ html: '<p>menu</p>' })
    const before = queue.getJob(jobId)

    await flush()

    // same object, now mutated -- pdfRoute.js reads job.result off this aliasing
    expect(queue.getJob(jobId)).toBe(before)
    expect(before.status).toBe('done')
  })

  describe('cleanup sweep', () => {
    it('drops a settled job once it is past the TTL', async () => {
      const jobId = queue.enqueuePdfJob({ html: '<p>menu</p>' })
      await flush()
      expect(queue.getJob(jobId).status).toBe('done')

      await sweep(JOB_TTL_MS)
      expect(queue.getJob(jobId)).toBeDefined() // `>` is strict: exactly TTL survives

      await sweep(SWEEP_MS)
      expect(queue.getJob(jobId)).toBeUndefined()
    })

    it('leaves a job that is still rendering alone', async () => {
      const { promise, resolve } = deferred()
      renderPdf.mockReturnValueOnce(promise)

      const jobId = queue.enqueuePdfJob({ html: '<p>menu</p>' })
      await flush()
      expect(queue.getJob(jobId).status).toBe('processing')

      await sweep(JOB_TTL_MS + SWEEP_MS * 2) // well past the TTL

      expect(queue.getJob(jobId)).toBeDefined() // the `settled` guard held
      resolve(Buffer.from('%PDF-1.4'))
      await flush()
      expect(queue.getJob(jobId).status).toBe('done')
    })

    // Retention is measured from enqueue, not from settling, so a slow render is
    // collectable sooner after it finishes than a fast one. Past five minutes it
    // collapses to the 60s sweep cadence -- a job can vanish a minute after
    // becoming available. The 60s navigation timeout keeps real renders well
    // inside this, but the asymmetry is surprising enough to pin.
    it('gives a slow render less time after settling than a fast one', async () => {
      const slow = deferred()
      renderPdf.mockReturnValueOnce(slow.promise)

      const jobId = queue.enqueuePdfJob({ html: '<p>menu</p>' })
      await sweep(4 * 60 * 1000) // render takes four minutes
      slow.resolve(Buffer.from('%PDF-1.4'))
      await flush()
      expect(queue.getJob(jobId).status).toBe('done')

      await sweep(SWEEP_MS) // five minutes since enqueue: not yet `> TTL`
      expect(queue.getJob(jobId)).toBeDefined()

      await sweep(SWEEP_MS) // six minutes since enqueue, two since it settled
      expect(queue.getJob(jobId)).toBeUndefined()
    })

    // Deleting a live record is what used to take the process down: the write
    // after the await went through `jobs[job.jobId]`, which by then was gone, so
    // it threw from inside the catch and the rejection escaped with nothing to
    // handle it. Holding the record across the await is the fix.
    //
    // The write has to be observed through that held reference. Asserting the
    // render merely "does not throw" cannot see this: the TypeError surfaces as
    // an unhandled rejection, the finally still frees the queue, and the next job
    // still drains -- so the bug reproduces with every such assertion passing.
    it('writes through the record it held, not a lookup that may be gone', async () => {
      const held = deferred()
      renderPdf.mockReturnValueOnce(held.promise)

      const jobId = queue.enqueuePdfJob({ html: 'ONE' })
      await flush()
      const record = queue.getJob(jobId) // the same object processQueue is holding

      record.status = 'error' // settled, so the sweep is willing to take it
      await sweep(JOB_TTL_MS + SWEEP_MS)
      expect(queue.getJob(jobId)).toBeUndefined() // gone from the map, mid-render

      held.resolve(Buffer.from('%PDF-1.4'))
      await flush()

      // reached the orphaned record; a lookup-based write would have thrown first
      expect(record.result.toString()).toBe('%PDF-1.4')
      expect(record.status).toBe('done')

      // and the queue still drains afterwards
      const next = queue.enqueuePdfJob({ html: 'TWO' })
      await flush()
      expect(queue.getJob(next).status).toBe('done')
    })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GeneratePdf from '@/components/GeneratePdf.vue'

/**
 * GeneratePdf talks to the network and to browser APIs jsdom does not implement.
 * Everything it touches is stubbed here so each test can drive the flow deterministically:
 *   fetch                -> vi.fn() returning canned Responses
 *   URL.createObjectURL  -> not implemented in jsdom
 *   window.open          -> jsdom logs "not implemented" and would pollute output
 *   anchor.click()       -> would trigger a jsdom navigation error
 */
const fetchMock = vi.fn()
const openMock = vi.fn()
const alertMock = vi.fn()
const createObjectURL = vi.fn(() => 'blob:menu-pdf')
const revokeObjectURL = vi.fn()
const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

// the component logs job progress and caught errors; keep the test output readable
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('alert', alertMock)
  vi.stubGlobal('open', openMock)
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

/** Minimal stand-ins for the Response shapes the component branches on. */
function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response
}

/**
 * An HTTP failure from the job endpoint. The backend answers a failed render
 * with 500 and an expired record with 404 and a plain-text body, so passing no
 * body here makes json() reject the way a text body really does.
 */
function errorResponse(status: number, body?: unknown, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    'content-type': body === undefined ? 'text/html' : 'application/json',
    ...extraHeaders,
  }
  return {
    ok: false,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected token J in JSON')
      return body
    },
  } as unknown as Response
}

function pdfResponse() {
  return {
    ok: true,
    headers: { get: () => 'application/pdf' },
    blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
  } as unknown as Response
}

function mountPdf(contentRef: HTMLElement | null = document.createElement('div'), noCsv = false) {
  if (contentRef) contentRef.innerHTML = '<p>Menu body</p>'
  return mount(GeneratePdf, {
    attachTo: document.body, // Teleport targets <body>, so the overlays need a real one
    props: { contentRef, pageWidth: '210mm', pageHeight: '297mm', fontFamily: 'Inter', noCsv },
  })
}

function overlayButton(label: string) {
  return [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
}

/** Let pending timers and the promise chain they unblock settle. */
async function flush(ms = 100) {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

/** How many times the job endpoint has been polled. */
function pollCount() {
  return fetchMock.mock.calls.filter((call) => String(call[0]).includes('/job/')).length
}

describe('GeneratePdf', () => {
  it('refuses to export when there is no content element', async () => {
    const wrapper = mountPdf(null)

    await wrapper.get('button').trigger('click')
    await flush()

    expect(alertMock).toHaveBeenCalledWith('No content to export')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the element innerHTML and the page settings to /generate-pdf', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValueOnce(pdfResponse())
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush()

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/generate-pdf')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      width: '210mm',
      height: '297mm',
      font: 'Inter',
    })
    expect(JSON.parse(init.body).html).toContain('<p>Menu body</p>')
  })

  it('shows the exporting overlay while the job runs and clears it afterwards', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValueOnce(pdfResponse())
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await nextTick()

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(document.body.textContent).toContain('Exporting PDF, please wait')

    await flush()

    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    expect(document.body.querySelector('.loader-overlay')).toBeNull()
  })

  it('polls the job endpoint every 2s until the PDF is ready, then downloads it', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' })) // enqueue
      .mockResolvedValueOnce(jsonResponse({ status: 'processing' })) // poll 1
      .mockResolvedValueOnce(jsonResponse({ status: 'processing' })) // poll 2
      .mockResolvedValueOnce(pdfResponse()) // poll 3
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush() // enqueue + first poll
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await flush(2000) // second poll
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2]![0]).toContain('/job/job-1')

    await flush(2000) // third poll returns the PDF
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(openMock).toHaveBeenCalledWith('blob:menu-pdf', '_blank', 'noopener')
    expect(anchorClick).toHaveBeenCalledOnce()

    await flush(10_000) // the delayed cleanup
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:menu-pdf')
  })

  it('stops polling and offers a retry when the job reports an error', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'error' }))
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush(5000)

    expect(alertMock).toHaveBeenCalledWith('PDF generation failed')
    expect(fetchMock).toHaveBeenCalledTimes(2) // no further polls
    expect(document.body.textContent).toContain('PDF generation failed')
    expect(document.body.textContent).toContain('Retry Export PDF')
  })

  it('stops polling when a failed render answers 500 with no status field', async () => {
    // The shape the deployed backend actually returns for a timed-out render.
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValueOnce(
        errorResponse(500, { error: 'Navigation timeout of 60000 ms exceeded' }),
      )
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush(10_000) // well past several poll intervals

    expect(fetchMock).toHaveBeenCalledTimes(2) // no further polls
    expect(document.body.textContent).toContain('PDF generation failed')
    expect(document.body.textContent).toContain('Retry Export PDF')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it('stops polling when the job record has already expired', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValueOnce(errorResponse(404)) // 'Job not found', as plain text
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush(10_000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('expired')
    expect(document.body.textContent).toContain('Retry Export PDF')
  })

  it('gives up once the poll deadline passes instead of polling forever', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValue(jsonResponse({ status: 'processing' })) // never settles
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush(60_000)

    expect(document.body.textContent).toContain('Exporting PDF, please wait') // still going
    expect(pollCount()).toBeGreaterThan(20)

    await flush(3 * 60 * 1000) // past the 3 minute deadline

    expect(document.body.textContent).toContain('taking longer than expected')
    expect(document.body.querySelector('.loader-overlay')).not.toBeNull() // the retry overlay
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()

    const settled = pollCount()
    await flush(30_000)
    expect(pollCount()).toBe(settled) // and it really stopped
  })

  it('offers a retry when the server refuses to start the job', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, { error: 'no instance' }))
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush()

    expect(fetchMock).toHaveBeenCalledOnce() // never began polling
    expect(document.body.textContent).toContain('could not start the export')
    expect(document.body.textContent).toContain('Retry Export PDF')
  })

  it('says the queue is full when the server refuses with Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(503, { error: 'The export queue is full.' }, { 'retry-after': '30' }),
    )
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(document.body.textContent).toContain('the queue is full')
    expect(document.body.textContent).toContain('Retry Export PDF')
  })

  it('asks the user to slow down when the export rate limit is hit', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(429, { error: 'Too many exports' }))
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush()

    expect(document.body.textContent).toContain('wait a few minutes')
    expect(document.body.textContent).toContain('Retry Export PDF')
  })

  it('tells the user when their export is waiting behind another one', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'queued' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'processing' }))
      .mockResolvedValueOnce(pdfResponse())
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush()
    expect(document.body.textContent).toContain('waiting in line')

    await flush(2000) // its turn comes
    expect(document.body.textContent).not.toContain('waiting in line')
    expect(document.body.textContent).toContain('Exporting PDF, please wait')

    await flush(2000)
    expect(createObjectURL).toHaveBeenCalledOnce()
  })

  it('surfaces a retryable error overlay when the request throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush()

    expect(document.body.textContent).toContain('An error occurred while generating PDF')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined() // recoverable

    // "Back to Edit" dismisses the overlay without starting a new job
    const dismiss = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Back to Edit',
    )
    dismiss?.click()
    await nextTick()

    expect(document.body.querySelector('.loader-overlay')).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('retries the export from the error overlay', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-2' }))
      .mockResolvedValueOnce(pdfResponse())
    const wrapper = mountPdf()

    await wrapper.get('button').trigger('click')
    await flush()

    const retry = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Retry Export PDF',
    )
    retry?.click()
    await flush()

    expect(fetchMock.mock.calls[1]![0]).toContain('/generate-pdf')
    expect(createObjectURL).toHaveBeenCalledOnce()
  })

  describe('without an uploaded CSV', () => {
    it('warns before exporting the sample menu', async () => {
      const wrapper = mountPdf(undefined, true)

      await wrapper.get('button').trigger('click')
      await flush()

      expect(document.body.textContent).toContain('You haven’t uploaded a CSV file yet')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('exports once the user chooses Export Anyway', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
        .mockResolvedValueOnce(pdfResponse())
      const wrapper = mountPdf(undefined, true)

      await wrapper.get('button').trigger('click')
      await nextTick()
      overlayButton('Export Anyway')?.click()
      await flush()

      expect(fetchMock.mock.calls[0]![0]).toContain('/generate-pdf')
      expect(createObjectURL).toHaveBeenCalledOnce()
      expect(document.body.textContent).not.toContain('You haven’t uploaded a CSV file yet')
    })

    it('goes back to editing without exporting', async () => {
      const wrapper = mountPdf(undefined, true)

      await wrapper.get('button').trigger('click')
      await nextTick()
      overlayButton('Back to Edit')?.click()
      await flush()

      expect(document.body.querySelector('.loader-overlay')).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})

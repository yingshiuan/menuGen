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

/** Minimal stand-ins for the two Response shapes the component branches on. */
function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response
}

function pdfResponse() {
  return {
    ok: true,
    headers: { get: () => 'application/pdf' },
    blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
  } as unknown as Response
}

function mountPdf(contentRef: HTMLElement | null = document.createElement('div')) {
  if (contentRef) contentRef.innerHTML = '<p>Menu body</p>'
  return mount(GeneratePdf, {
    attachTo: document.body, // Teleport targets <body>, so the overlays need a real one
    props: { contentRef, pageWidth: '210mm', pageHeight: '297mm', fontFamily: 'Inter' },
  })
}

/** Let pending timers and the promise chain they unblock settle. */
async function flush(ms = 100) {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
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
    fetchMock.mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' })).mockResolvedValueOnce(pdfResponse())
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
    fetchMock.mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' })).mockResolvedValueOnce(pdfResponse())
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
})

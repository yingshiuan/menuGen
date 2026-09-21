<script lang="ts" setup>
import { reactive, nextTick } from 'vue'

const props = defineProps<{
  contentRef: HTMLElement | null
  pageWidth: string
  pageHeight: string
  fontFamily: string
}>()

interface PdfState {
  uploading: boolean
  readonly: boolean
  errorMessage: null | string
}

const pdfState = reactive<PdfState>({
  uploading: false,
  readonly: false,
  errorMessage: null,
})

const API = import.meta.env.VITE_API_URL

const POLL_INTERVAL_MS = 2000
// The backend gives a render 60s before it times out, and a sleeping free-tier
// instance can spend ~40s waking up first. Three minutes is comfortably past
// both, so reaching it means nothing is coming.
const POLL_TIMEOUT_MS = 3 * 60 * 1000

async function generatePDF(): Promise<void> {
  pdfState.errorMessage = null
  const element = props.contentRef
  if (!element) {
    alert('No content to export')
    return
  }

  pdfState.readonly = true
  pdfState.uploading = true
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 50))

  // only html content without <head>
  const htmlContent = `
        ${element.innerHTML}
  `

  try {
    // send PDF Job
    const res: Response = await fetch(`${API}/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: htmlContent,
        width: props.pageWidth,
        height: props.pageHeight,
        font: props.fontFamily,
      }),
    })

    if (!res.ok) {
      reportFailure('The server could not start the export. Please try again.')
      return
    }

    const { jobId } = await res.json().catch(() => ({ jobId: null }))

    if (!jobId) {
      reportFailure('The server did not return an export job. Please try again.')
      return
    }

    console.log('PDF job queued:', jobId)

    // require pdf status
    await waitForPdf(jobId)
  } catch (err) {
    console.error('Error generating PDF:', err)
    pdfState.errorMessage =
      'An error occurred while generating PDF. Don’t worry — you can try again by clicking the button.'
    // alert('An error occurred while generating PDF')
  } finally {
    pdfState.readonly = false
    pdfState.uploading = false
  }
}

/**
 * Poll the job until the PDF arrives, treating every other outcome as an end
 * state. A failed render answers 500 with {error} and an expired record answers
 * 404 with plain text, so neither carries the status field this used to look
 * for: an unrecognized reply kept the loop polling and the overlay up until a
 * later response happened to throw.
 */
async function waitForPdf(jobId: string) {
  const giveUpAt = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < giveUpAt) {
    const res = await fetch(`${API}/job/${jobId}`)

    if (res.headers.get('content-type')?.includes('application/pdf')) {
      downloadPdf(await res.blob(), jobId)
      return
    }

    if (res.status === 404) {
      reportFailure('The export expired before it could be downloaded. Please try again.')
      return
    }

    if (!res.ok) {
      reportFailure(
        'PDF generation failed. Don’t worry — you can try again by clicking the button.',
      )
      return
    }

    // A body that will not parse tells us as little as a failed one, so stop
    // rather than poll on in the hope that the next reply makes sense.
    const status = await res.json().catch(() => null)
    console.log('PDF status:', status?.status)

    if (!status || status.status === 'error') {
      reportFailure(
        'PDF generation failed. Don’t worry — you can try again by clicking the button.',
      )
      return
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  reportFailure(
    'The export is taking longer than expected — the server may still be waking up. Please try again.',
  )
}

function reportFailure(message: string) {
  alert('PDF generation failed')
  pdfState.errorMessage = message
  //If it doesn’t work the first time, don’t be afraid to try again — it’s normal!
}

function downloadPdf(blob: Blob, jobId: string) {
  const url: string = URL.createObjectURL(blob)

  if (isIOS()) {
    window.location.href = url // Convert Blob to Base64 and use a data URL for immediate download
  } else {
    window.open(url, '_blank', 'noopener') // Desktop: open in new tab

    const a = document.createElement('a') // And trigger download
    a.href = url
    a.download = `${jobId}-menu.pdf`

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10000)
}

function isIOS(): boolean {
  // Detect iPhone / iPad / iPod reliably
  const ua = navigator.userAgent || navigator.vendor || ''
  const isIPhone = /iPhone|iPod/i.test(ua)
  const isIPad = /iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /MacIntel/i.test(ua))
  return isIPhone || isIPad
}

function retryPDF() {
  if (pdfState.uploading) return
  pdfState.errorMessage = null
  generatePDF()
}
</script>

<template>
  <div class="flex">
    <!-- Generate PDF Button: the panel's main action, full width -->
    <button
      @click="generatePDF"
      :disabled="pdfState.uploading"
      class="relative w-full flex items-center justify-center gap-2 p-1 bg-blue-500 text-white rounded-lg hover:bg-blue-700 border border-blue-500 transition-colors duration-200 shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span v-if="!pdfState.uploading">Generate PDF</span>

      <span v-else class="flex flex-col items-center gap-2">
        Exporting...<span class="loader"></span>
      </span>
    </button>
  </div>

  <Teleport to="body">
    <!-- Uploading overlay -->
    <div v-if="pdfState.uploading" class="loader-overlay">
      <div class="loader-container">
        <div class="loader"></div>
        <p class="text-m">
          Exporting PDF, please wait...<br />
          The first export may take up to 60 seconds while the server starts. Thanks for your
          patience!<br />
        </p>
      </div>
    </div>

    <!-- Error overlay -->
    <div v-else-if="pdfState.errorMessage" class="loader-overlay">
      <div class="loader-container">
        <p class="text-m">
          {{ pdfState.errorMessage }}
        </p>
        <div class="flex gap-2 justify-center mt-4">
          <!-- Retry PDF Export -->
          <button @click="retryPDF" class="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-700">
            Retry Export PDF
          </button>

          <!-- Back to Edit -->
          <button
            @click="pdfState.errorMessage = null"
            class="p-2 rounded-lg bg-white text-black hover:bg-gray-200"
          >
            Back to Edit
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Preview of the generated HTML content -->
  <!-- <div v-if="htmlPreview" class="mt-4 p-4 border rounded-md shadow-md">
    <h3 class="text-lg font-bold mb-2">HTML Content Preview:</h3>
    <div v-html="htmlPreview" class="preview-container" />
  </div> -->
</template>

<style>
/* Full-screen overlay */
.loader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

/* Centered loader container */
.loader-container {
  text-align: center;
  color: white;
}

.loader {
  margin: auto;
  border: 0.25rem solid var(--primary-color);
  border-top: 0.25rem solid white;
  border-radius: 50%;
  width: 1rem;
  height: 1rem;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

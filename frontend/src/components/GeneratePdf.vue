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
}

const pdfState = reactive<PdfState>({
  uploading: false,
  readonly: false,
})

const API = import.meta.env.VITE_API_URL

async function generatePDF(): Promise<void> {
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
      alert('Failed to enqueue PDF')
      return
    }

    const { jobId } = await res.json()
    console.log('PDF job queued:', jobId)

    // require pdf status
    await waitForPdf(jobId)
  } catch (err) {
    console.error('Error generating PDF:', err)
    alert('An error occurred while generating PDF')
  } finally {
    pdfState.readonly = false
    pdfState.uploading = false
  }
}

// require pdf status
async function waitForPdf(jobId: string) {
  while (true) {
    const res = await fetch(`${API}/job/${jobId}`)

    if (res.headers.get('content-type') === 'application/pdf') {
      const blob: Blob = await res.blob()
      const url: string = URL.createObjectURL(blob)

      const a: HTMLAnchorElement = document.createElement('a')
      a.href = url

      if (import.meta.env.DEV) {
        window.open(url, '_blank') // Preview PDF in browser
      } else {
        const a = document.createElement('a')
        a.href = url

        if (isMobile()) {
          a.download = `${jobId}_menu.pdf`
          a.click()
        } else {
          a.target = '_blank'
        }
      }

      // if (isMobile()) {
      //   // Convert Blob to Base64 and use a data URL for immediate download
      //   const reader = new FileReader()
      //   reader.onloadend = () => {
      //     const a = document.createElement('a')
      //     a.href = reader.result as string // data URL
      //     a.download = 'menu.pdf'
      //   }
      //   reader.readAsDataURL(blob)
      // } else {
      //   // Desktop: open in new tab
      //   a.target = '_blank'
      //   // a.download = 'menu.pdf'
      // }

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      break
    }

    const status = await res.json()
    console.log('PDF status:', status.status)

    if (status.status === 'error') {
      alert('PDF generation failed')
      break
    }

    await new Promise((r) => setTimeout(r, 2000)) // every 2 second check it
  }
}

function isMobile(): boolean {
  return (
    /iPhone|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /MacIntel/i.test(navigator.platform))
  ) // modern iPad
}
</script>

<template>
  <div class="max-w-xl mx-auto flex justify-center">
    <!-- Generate PDF Button -->
    <button
      @click="generatePDF"
      :disabled="pdfState.uploading"
      class="relative flex items-center gap-2 p-1 bg-blue-500 text-white rounded-lg hover:bg-blue-700 border-2 border-blue-500 transition-colors duration-200 shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span v-if="!pdfState.uploading">Generate PDF</span>

      <span v-else class="flex flex-col items-center gap-2">
        Exporting...<span class="loader"></span>
      </span>
    </button>
  </div>

  <Teleport to="body">
    <div v-if="pdfState.uploading" class="loader-overlay">
      <div class="loader-container">
        <div class="loader"></div>
        <p class="text-m">Exporting PDF, please wait...<br />First export may take up to 60s</p>
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

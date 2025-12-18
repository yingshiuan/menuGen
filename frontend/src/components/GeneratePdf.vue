<script lang="ts" setup>
import { defineProps, reactive, nextTick, ref } from 'vue'

const props = defineProps<{
  contentRef: HTMLElement | null
  pageWidth: string
  pageHeight: string
}>();

interface PdfState {
  uploading: boolean
  readonly: boolean
} 

const pdfState = reactive<PdfState>({
  uploading: false,
  readonly: false
})

// const htmlPreview = ref<string>("");

async function generatePDF(): Promise<void> {
  const element = props.contentRef
  if (!element) {
    alert('No content to export')
    return
  }
  
  pdfState.readonly = true
  pdfState.uploading = true;
  await nextTick()
  
  await new Promise(resolve => setTimeout(resolve, 50));

  // only html content without <head>
  const htmlContent = `
        ${element.innerHTML}
  `;

  //  htmlPreview.value = htmlContent;
   
  try {
    const response: Response = await fetch("http://localhost:3000/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        html: htmlContent,
        width: props.pageWidth,
        height: props.pageHeight,
      }),
    });

    if (!response.ok) {
      alert("Failed to generate PDF");
      return;
    }

    const blob: Blob = await response.blob();
    const url: string = URL.createObjectURL(blob);

    window.open(url, "_blank"); // Preview PDF in browser

    // const a: HTMLAnchorElement = document.createElement("a");
    // a.href = url;
    // a.download = "file.pdf";
    // a.click();

    // URL.revokeObjectURL(url); // clean up
  } catch (err) {
    console.error("Error generating PDF:", err);
    alert("An error occurred while generating PDF");
  } finally {
    pdfState.readonly = false
    pdfState.uploading = false
  }
};
</script>

<template>
  

  <div class="max-w-xl mx-auto flex justify-center">
    <!-- Generate PDF Button -->
    <button
      @click="generatePDF"
      :disabled="pdfState.uploading"
      class="relative flex items-center gap-2 p-2 bg-blue-500 text-white rounded-lg 
            hover:bg-blue-700 border-2 border-blue-500 transition-colors duration-200 
            shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span v-if="!pdfState.uploading">Generate PDF</span>

      <span v-else class="flex items-center gap-2">
         Exporting...<span class="loader"></span>
      </span>
    </button>
  </div>

  <!-- Preview of the generated HTML content -->
  <!-- <div v-if="htmlPreview" class="mt-4 p-4 border rounded-md shadow-md">
    <h3 class="text-lg font-bold mb-2">HTML Content Preview:</h3>
    <div v-html="htmlPreview" class="preview-container" />
  </div> -->
</template>

<style>
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


<script lang="ts" setup>
import { defineProps } from 'vue'
import { nextTick, ref } from 'vue'

interface Props {
  contentRef: HTMLElement | null
}

const uploading = ref(false);

const props = defineProps<Props>()
const pdfReadonly = ref(false)

const generatePDF = async (): Promise<void> => {
  const element = props.contentRef
  if (!element) {
    alert('No content to export')
    return
  }
  
  pdfReadonly.value = true
  uploading.value = true;
  await nextTick()
  
  // only html content without <haed>
  const htmlContent = `
        ${element.innerHTML}
  `;

  try {
    const response: Response = await fetch("http://localhost:3000/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlContent }),
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
    pdfReadonly.value = false
    uploading.value = false
  }
};
</script>

<template>
  

  <div class="max-w-xl mx-auto flex justify-center">
    <!-- Generate PDF Button -->
    <button
      @click="generatePDF"
      :disabled="uploading"
      class="relative flex items-center gap-2 p-2 bg-blue-500 text-white rounded-lg 
            hover:bg-blue-700 border-2 border-blue-500 transition-colors duration-200 
            shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span v-if="!uploading">Generate PDF</span>

      <span v-else class="flex items-center gap-2">
         Exporting...<span class="loader"></span>
      </span>
    </button>

    
  </div>
</template>

<style>
.loader {
  margin: auto;
  border: 0.25rem solid var(--primary-color);
  border-top: 0.25rem solid white;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>


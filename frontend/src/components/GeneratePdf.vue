<script lang="ts" setup>
import { defineProps } from 'vue'

interface Props {
  contentRef?: HTMLElement | null
}

const props = defineProps<Props>()

const generatePDF = async (): Promise<void> => {
  const element = props.contentRef
  if (!element) {
    alert('No content to export')
    return
  }

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
  }
};
</script>

<template>
  <div class="p-6 max-w-xl mx-auto">
    <h1 class="text-3xl font-bold mb-4">Generate PDF</h1>
    <p class="mb-4">Click the button below to download a PDF generated from this content:</p>
    <button @click="generatePDF" class="bg-blue-500 text-white px-4 py-2 rounded">
      Download PDF
    </button>
  </div>
</template>

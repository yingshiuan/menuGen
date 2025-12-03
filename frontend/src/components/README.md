# Vue Frontend: GeneratePdf.vue

This frontend snippet demonstrates sending HTML content to the backend PDF generator and previewing the resulting PDF in the browser.

---

## **Setup**

1. Make sure your Vue project uses **Tailwind CSS v4**.
2. Ensure the backend is running at `http://localhost:3000`.
3. No need to include `<link>` to Tailwind CSS in this snippet — the backend injects it into the PDF.

---

## **Example Component**

```vue
<script lang="ts" setup>
import { ref } from 'vue';

const htmlContent = ref(`
  <div class="p-6 space-y-4 border border-gray-400 bg-gray-100">
    <h2 class="text-xl font-bold mb-4 border-b">Category</h2>
    <p>This content will appear styled in the PDF.</p>
  </div>
`);

const generatePDF = async (): Promise<void> => {
  try {
    const response = await fetch("http://localhost:3000/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlContent.value }),
    });

    if (!response.ok) {
      alert("Failed to generate PDF");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Open PDF in a new browser tab (inline preview)
    window.open(url, "_blank");

    // Optional: download PDF
    // const a = document.createElement("a");
    // a.href = url;
    // a.download = "document.pdf";
    // a.click();

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error generating PDF:", err);
    alert("An error occurred while generating PDF");
  }
};
</script>

<template>
  <div class="p-6 max-w-xl mx-auto">
    <h1 class="text-3xl font-bold mb-4">Generate PDF</h1>
    <p class="mb-4">
      Click the button below to generate and preview a PDF from this content:
    </p>
    <button
      @click="generatePDF"
      class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
    >
      Preview PDF
    </button>
  </div>
</template>
```

---

## **Notes**

* The PDF backend expects **raw HTML strings**, not Vue component objects.
* Tailwind CSS classes in the HTML must exist in your compiled `tailwind.css`; otherwise, the PDF will render unstyled.
* You can **edit `htmlContent` dynamically** to generate PDFs with different content.

---

This setup allows you to **preview the PDF in-browser** without downloading it, while keeping Tailwind styles intact.

---
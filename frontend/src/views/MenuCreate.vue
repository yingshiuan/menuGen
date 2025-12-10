<script lang="ts" setup>
import { reactive, ref } from 'vue'
import type { MenuItem } from '@/types/types'
import MenuPreview from '@/components/MenuPreview.vue'
import GeneratePdf from '@/components/GeneratePdf.vue'
import CsvUpload from '@/components/CsvUpload.vue'
import FontSelector from '@/components/FontSelector.vue'
import ColorPicker from '@/components/ColorPicker.vue'

type FontValue = 'sans-serif' | 'serif' | 'monospace' | "'Courier New', monospace" | "'Arial', sans-serif" | "'Times New Roman', serif"

// const csvData = ref<MenuItem[]>([])

interface MenuState {
  menuCsv: MenuItem[]
  pdfReadonly: boolean
  selectedFont: FontValue
  bgColor: string
  textColor: string
}

// Create reactive state
const state = reactive<MenuState>({
  menuCsv: [],
  pdfReadonly: false,
  selectedFont: 'sans-serif',
  bgColor: '#ffffff',
  textColor: '#000000',
})

const menuPreviewRef = ref<HTMLElement | null>(null)

function handleCsvLoaded(items: MenuItem[]) {
  state.menuCsv = items
}

</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-2">Menu Builder (CSV to PDF)</h1>
    <div class="flex flex-col md:flex-row gap-2">
      <!-- Left side: controls -->
      <div class="flex-1 space-y-4">
        <!-- Drag & Drop CSV and Generate PDF side by side -->
        <div class="flex gap-2">
          <CsvUpload @csvLoaded="handleCsvLoaded" :items="state.menuCsv" class="flex-3" />
          <GeneratePdf :contentRef="menuPreviewRef" class="flex-1" />
        </div>

        <!-- Font selector and color pickers stacked below -->
        <FontSelector v-model:font="state.selectedFont" />
        <ColorPicker type="bg" v-model:color="state.bgColor" />
        <ColorPicker type="text" v-model:color="state.textColor" />
      </div>

      <!-- Right side: preview -->
      <div class="flex-1">
        <div class="menu-preview-wrapper" ref="menuPreviewRef" v-if="state.menuCsv.length">
          <MenuPreview
            :items="state.menuCsv"
            :fontFamily="state.selectedFont"
            :bgColor="state.bgColor"
            :textColor="state.textColor"
            :readonly="state.pdfReadonly"
          />
        </div>
        <div v-else class="a4-preview">
          <p class="text-gray-400 text-center text-2xl">
            No menu data loaded. Please upload a CSV file.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.a4-preview {
  width: 210mm; /* A4 width */
  height: 297mm; /* A4 height */
  border: 1px solid #ccc;
  padding: 2rem;
  box-sizing: border-box;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

@media screen {
  .a4-preview {
    transform: scale(0.75);
    transform-origin: top center;
  }
}
</style>

<script lang="ts" setup>
import { reactive, ref, computed, watch } from 'vue'
import type { MenuItem } from '@/types/types'
import MenuPreview from '@/components/MenuPreview.vue'
import GeneratePdf from '@/components/GeneratePdf.vue'
import CsvUpload from '@/components/CsvUpload.vue'
import FontSelector from '@/components/FontSelector.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import MenuPage from '@/components/MenuPage.vue'

type FontValue = 'sans-serif' | 'serif' | 'monospace' | "'Courier New', monospace" | "'Arial', sans-serif" | "'Times New Roman', serif"

// const csvData = ref<MenuItem[]>([])

interface MenuState {
  menuCsv: MenuItem[]
  pdfReadonly: boolean
  selectedFont: FontValue
  bgColor: string
  textColor: string
}

interface MeunPage {
  currentPage: number
  itemsPerPage: number
}

const menuPage = reactive<MeunPage>({
  currentPage: 0,
  itemsPerPage: 9,
})

// Create reactive state
const state = reactive<MenuState>({
  menuCsv: [],
  pdfReadonly: false,
  selectedFont: 'sans-serif',
  bgColor: '#ffffff',
  textColor: '#000000',
})

const menuPreviewRef = ref<HTMLElement | null>(null)
const pdfRenderRef = ref<HTMLElement | null>(null)

const pdfRenderKey = ref(0);

const totalPages = computed(() => Math.ceil(state.menuCsv.length / menuPage.itemsPerPage))

function handleCsvLoaded(items: MenuItem[]) {
  state.menuCsv = items
  menuPage.currentPage = 0
}


// watch(
//   state.menuCsv,
//   () => {
//     pdfRenderKey.value++; // trigger PDF ref re-render
//   },
//   { deep: true }
// );

// watch each items deeply
watch(
  () =>
    state.menuCsv.map(item => ({
      No: item.No,
      Name: item.Name,
      ChineseName: item.ChineseName,
      Description: item.Description,
      Price: item.Price,
      Options: [...item.Options],
      pictureBase64: item.pictureBase64
    })),
  () => {
    pdfRenderKey.value++
  },
  { deep: true }
)

</script>

<template>
  <div class="p-4">
    <div class="flex mb-2">
      <h1 class="w-1/2 text-2xl font-bold">Menu Builder (CSV to PDF)</h1>
      <div class="w-1/2">
        <MenuPage
          v-if="state.menuCsv.length"
          :current-page="menuPage.currentPage"
          :total-pages="totalPages"
          @update:page="menuPage.currentPage = $event"
        />
      </div>
    </div>
    <div class="flex gap-2">
      <!-- Left side: controls -->
      <div class="w-1/2 space-y-4">
        <!-- Drag & Drop CSV and Generate PDF side by side -->
        <div class="flex gap-2">
          <CsvUpload @csvLoaded="handleCsvLoaded" :items="state.menuCsv" class="basis-3/4" />
          <GeneratePdf :contentRef="pdfRenderRef" class="basis-1/4" />
        </div>

        <!-- Font selector and color pickers stacked below -->
        <FontSelector v-model:font="state.selectedFont" />
        <ColorPicker type="bg" v-model:color="state.bgColor" />
        <ColorPicker type="text" v-model:color="state.textColor" />
      </div>

      <!-- Right side: preview -->
      <div class="w-1/2 flex justify-center items-center ">
        <div class="menu-preview-wrapper" ref="menuPreviewRef" v-if="state.menuCsv.length" >
          <MenuPreview
            :items="state.menuCsv"
            :fontFamily="state.selectedFont"
            :bgColor="state.bgColor"
            :textColor="state.textColor"
            :readonly="state.pdfReadonly"
            :current-page="menuPage.currentPage"
            :items-per-page="menuPage.itemsPerPage"
          class="relative flex-1"
           />
        </div>
        <div v-else class="a4-preview ">
          <p class="text-gray-400 text-center text-2xl">
            No menu data loaded. Please upload a CSV file.
          </p>
        </div>
      </div>
      <div style="display:none">
        <div ref="pdfRenderRef" :key="pdfRenderKey">
          <div
            v-for="page in totalPages"
            :key="page"
            class="pdf-page"
          >
            <MenuPreview
              :items="state.menuCsv"
              :fontFamily="state.selectedFont"
              :bgColor="state.bgColor"
              :textColor="state.textColor"
              :readonly="state.pdfReadonly"
              :current-page="page - 1"
              :items-per-page="menuPage.itemsPerPage"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.a4-preview {
  width: 210mm; /* A4 width */
  min-height: 297mm; /* A4 height */
  border: 1px solid #ccc;
  /* padding: 2rem; */
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

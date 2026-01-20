<script lang="ts" setup>
import { reactive, ref, computed, watch, onMounted } from 'vue'
import type { MenuItem } from '@/types/types'
import MenuPreview from '@/components/MenuPreview.vue'
import GeneratePdf from '@/components/GeneratePdf.vue'
import CsvUpload from '@/components/CsvUpload.vue'
import FontSelector from '@/components/FontSelector.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import PageSizeSelector from '@/components/PageSizeSelector.vue'
import ScaleControl from '@/components/ScaleControl.vue'
import MenuPage from '@/components/MenuPage.vue'
import ItemsPerCategorySelector from '@/components/ItemsPerCategorySelector.vue'
import MultiImageUpload from '@/components/MultiImageUpload.vue'

type FontValue =
  | 'sans-serif'
  | 'serif'
  | 'monospace'
  | "'Courier New', monospace"
  | "'Arial', sans-serif"
  | "'Times New Roman', serif"

// const csvData = ref<MenuItem[]>([])

interface MenuState {
  menuCsv: MenuItem[]
  pdfReadonly: boolean
  selectedFont: FontValue
  bgColor: string
  textColor: string
  footerText: string
  logoBase64: string | null
}

interface MeunPage {
  currentPage: number
  itemsPerPage: number
  width: string
  height: string
  keepCategoryTogether: boolean
}

const menuPage = reactive<MeunPage>({
  currentPage: 0,
  itemsPerPage: 9,
  width: '210mm',
  height: '297mm',
  keepCategoryTogether: true,
})

// Create reactive state
const state = reactive<MenuState>({
  menuCsv: [],
  pdfReadonly: false,
  selectedFont: 'sans-serif',
  bgColor: '#ffffff',
  textColor: '#000000',
  footerText: 'All prices are in CHF, including VAT',
  logoBase64: null,
})

const demoMenu: MenuItem[] = [
  {
    No: '1',
    Price: '00.00',
    Name: 'Sample 1',
    Measure: '1',
    ChineseName: '中文菜名 1',
    Description: 'Sample description 1',
    Options: ['Recommend', 'Spicy', 'Vegetarian'],
    Category: 'Sample Category',
  },
  {
    No: '2',
    Price: '18.00',
    Name: 'Sample 2',
    Measure: '',
    ChineseName: '中文菜名 2',
    Description: 'Sample description 2',
    Options: ['Vegan', 'Gluten Free'],
    Category: 'Sample Category',
  },
]

const scale = ref(0.8)
const csvKey = ref(0)

const menuPreviewRef = ref<HTMLElement | null>(null)
const pdfRenderRef = ref<HTMLElement | null>(null)

const pdfRenderKey = ref(0)

const totalPages = computed(() => Math.ceil(state.menuCsv.length / menuPage.itemsPerPage))

onMounted(() => {
  loadSampleMenu()
})

function handleCsvLoaded(items: MenuItem[]) {
  state.menuCsv = items
  menuPage.currentPage = 0
}

function loadSampleMenu() {
  state.menuCsv = demoMenu.map((item) => ({ ...item }))
  menuPage.currentPage = 0
  csvKey.value++
}

function onItemUpdated(updated: MenuItem) {
  // First try to find by Name
  let idx = state.menuCsv.findIndex((it) => it.Name === updated.Name)

  // If not found by Name, fallback to match by No
  if (idx === -1 && updated.No != null) {
    idx = state.menuCsv.findIndex((it) => it.No === updated.No)
  }

  if (idx >= 0) {
    state.menuCsv.splice(idx, 1, { ...updated })
  } else {
    state.menuCsv.push({ ...updated })
  }
}

// Helpers for preview actions
function createNewItem(defaultNo?: string, defaultCategory?: string) {
  const no = defaultNo ?? (state.menuCsv.length + 1).toString()
  return {
    No: no,
    Price: '',
    Name: `New Item ${no}`,
    Measure: '',
    ChineseName: '',
    Description: '',
    Options: [],
    Category: defaultCategory ?? 'Uncategorized',
  } as MenuItem
}

function addItemBefore(No: string) {
  const idx = state.menuCsv.findIndex((it) => it.No === No)
  const category = state.menuCsv[idx]?.Category ?? 'Uncategorized'
  const newItem = createNewItem(undefined, category)
  if (idx === -1) state.menuCsv.push(newItem)
  else state.menuCsv.splice(idx, 0, newItem)
}

function addItemAfter(No: string) {
  const idx = state.menuCsv.findIndex((it) => it.No === No)
  const category = state.menuCsv[idx]?.Category ?? 'Uncategorized'
  const newItem = createNewItem(undefined, category)
  if (idx === -1) state.menuCsv.push(newItem)
  else state.menuCsv.splice(idx + 1, 0, newItem)
}

function deleteItemByNo(No: string) {
  const idx = state.menuCsv.findIndex((it) => it.No === No)
  if (idx >= 0) state.menuCsv.splice(idx, 1)
}

function reorderItems(fromNo: string, toNo: string) {
  const from = state.menuCsv.findIndex((it) => it.No === fromNo)
  const to = state.menuCsv.findIndex((it) => it.No === toNo)
  if (from === -1 || to === -1 || from === to) return
  const removed = state.menuCsv.splice(from, 1)
  const item = removed[0]
  if (!item) return

  const targetIndex = from < to ? to - 1 : to
  const clamped = Math.max(0, Math.min(state.menuCsv.length, targetIndex))
  state.menuCsv.splice(clamped, 0, item)
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
  () => ({
    items: state.menuCsv.map((item) => ({
      No: item.No,
      Name: item.Name,
      ChineseName: item.ChineseName,
      Description: item.Description,
      Price: item.Price,
      Options: [...item.Options],
      mainImageBase64: item.mainImageBase64,
    })),
    logo: state.logoBase64,
  }),
  (newVal) => {
    console.log('Watch triggered - logo:', newVal.logo ? 'present' : 'empty')
    pdfRenderKey.value++
  },
  { deep: true },
)
</script>

<template>
  <div class="">
    <div class="flex gap-2 p-2 items-center">
      <h1 class="w-1/4 text-xl font-bold p-1">Menu Gen (CSV to PDF)</h1>
      <div class="w-2/4">
        <MenuPage
          v-if="state.menuCsv.length"
          :current-page="menuPage.currentPage"
          :total-pages="totalPages"
          @update:page="menuPage.currentPage = $event"
        />
      </div>
    </div>
    <div class="flex gap-2 divide-x divide-gray-300">
      <!-- Left side: controls -->
      <div class="w-1/4 divide-y divide-gray-300 px-2">
        <!-- Drag & Drop CSV and Generate PDF side by side -->
        <div class="flex gap-2 py-2">
          <CsvUpload :key="csvKey" @csvLoaded="handleCsvLoaded" :items="state.menuCsv" class="" />
          <GeneratePdf
            :contentRef="pdfRenderRef"
            :page-width="menuPage.width"
            :page-height="menuPage.height"
            class=""
          />
        </div>
        <div class="py-2">
          <button
            @click="loadSampleMenu"
            class="bg-blue-500 w-full p-1 text-white rounded-lg hover:bg-blue-700 hover:text-white border-2 border-blue-500 transition-colors duration-200 shadow-md"
          >
            Load Sample Menu
          </button>
        </div>
        <!-- Font selector and color pickers stacked below -->
        <div class="py-2"><FontSelector v-model:font="state.selectedFont" /></div>
        <div class="py-2"><ColorPicker type="bg" v-model:color="state.bgColor" /></div>
        <div class="py-2"><ColorPicker type="text" v-model:color="state.textColor" /></div>
        <div class="py-2">
          <PageSizeSelector v-model:width="menuPage.width" v-model:height="menuPage.height" />
        </div>
        <div class="py-2"><ScaleControl v-model="scale" label="Scale" /></div>
        <div class="py-2">
          <ItemsPerCategorySelector
            v-model:itemsPerPage="menuPage.itemsPerPage"
            v-model:keepCategoryTogether="menuPage.keepCategoryTogether"
          />
        </div>

        <div class="py-2">
          <MultiImageUpload :menuItems="state.menuCsv" @update:item="onItemUpdated" />
        </div>
      </div>

      <!-- Right side: preview -->
      <div class="w-2/4 flex justify-center">
        <div
          class="menu-preview-wrapper md:menu-md lg:menu-lg"
          ref="menuPreviewRef"
          v-if="state.menuCsv.length"
          :style="{ '--ui-scale': scale }"
        >
          <MenuPreview
            v-model:footerText="state.footerText"
            :items="state.menuCsv"
            :font-family="state.selectedFont"
            :bg-color="state.bgColor"
            :text-color="state.textColor"
            :readonly="state.pdfReadonly"
            :current-page="menuPage.currentPage"
            :items-per-page="menuPage.itemsPerPage"
            :page-width="menuPage.width"
            :page-height="menuPage.height"
            :keep-category-together="menuPage.keepCategoryTogether"
            :default-src="state.logoBase64 || undefined"
            class="relative flex-1"
            @add-before="(p) => addItemBefore(p.No)"
            @add-after="(p) => addItemAfter(p.No)"
            @delete-item="(p) => deleteItemByNo(p.No)"
            @reorder="(p) => reorderItems(p.fromNo, p.toNo)"
            @update:logo="(base64: string) => (state.logoBase64 = base64)"
          />
        </div>
        <div
          v-else
          class="a4-preview"
          :style="{
            width: menuPage.width,
            height: menuPage.height,
          }"
        >
          <p class="text-gray-400 text-center text-2xl italic">
            No menu data loaded. Please upload a CSV file.
          </p>
        </div>
      </div>
      <!-- PDF DOM-->
      <div style="display: none">
        <div ref="pdfRenderRef" :key="pdfRenderKey">
          <div v-for="page in totalPages" :key="page" class="pdf-page">
            <MenuPreview
              v-model:footerText="state.footerText"
              :items="state.menuCsv"
              :fontFamily="state.selectedFont"
              :bgColor="state.bgColor"
              :textColor="state.textColor"
              :readonly="state.pdfReadonly"
              :current-page="page - 1"
              :items-per-page="menuPage.itemsPerPage"
              :page-width="menuPage.width"
              :page-height="menuPage.height"
              :keep-category-together="menuPage.keepCategoryTogether"
              :default-src="state.logoBase64 || undefined"
              @update:logo="(base64: string) => (state.logoBase64 = base64)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.a4-preview {
  border: 1px solid #ccc;
  box-sizing: border-box;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.menu-preview-wrapper {
  transform: scale(var(--ui-scale));
  transform-origin: top center;
}

@media screen {
  .a4-preview {
    /* transform: scale(0.8); */
    transform-origin: top center;
  }
}
</style>

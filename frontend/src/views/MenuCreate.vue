<script lang="ts" setup>
import { reactive, ref, watch, onMounted, computed } from 'vue'
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
import ItemSpacingControl from '@/components/ItemSpacingControl.vue'
import type { ItemSpacing } from '@/components/ItemSpacingControl.vue'
import MenuCover from '@/components/MenuCover.vue'
import AddIcon from '@/components/AddIcon.vue'
import TwoPage from '@/components/TwoPage.vue'

/* Type & Interface */
type FontValue = string

// const csvData = ref<MenuItem[]>([])

interface MenuState {
  menuCsv: MenuItem[]
  pdfReadonly: boolean
  selectedFont: FontValue
  bgColor: string
  textColor: string
  scalePage: number
  footerText: string
  logoBase64: string | null
  itemSpacing: ItemSpacing
  coverTitle: string
  coverSubtitle: string
  coverLogoBase64: string | null
}

interface PageState {
  currentPage: number
  itemsPerPage: number
  totalPages: number
  width: string
  height: string
  keepCategoryTogether: boolean
}

/* State */
const pageState = reactive<PageState>({
  currentPage: 0,
  itemsPerPage: 9,
  totalPages: 1,
  width: '210mm',
  height: '297mm',
  keepCategoryTogether: true,
})

const menuState = reactive<MenuState>({
  menuCsv: [],
  pdfReadonly: false,
  selectedFont: 'sans-serif',
  bgColor: '#ffffff',
  textColor: '#000000',
  scalePage: 0.8,
  footerText: 'All prices are in CHF, including VAT',
  logoBase64: null,
  itemSpacing: 'fill',
  coverTitle: 'Menu',
  coverSubtitle: 'Welcome to our restaurant',
  coverLogoBase64: null,
})

const uiState = reactive({
  showTwoPage: false,
  pdfRenderKey: 0,
  csvKey: 0,
  previewRenderKey: 0,
})

/* Demo Data */
const demoMenu: MenuItem[] = [
  {
    id: '0',
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
    id: '1',
    No: '2',
    Price: '18.00',
    Name: 'Sample 2',
    Measure: '',
    ChineseName: '中文菜名 2',
    Description: 'Sample description 2',
    Options: ['Vegan', 'Gluten Free'],
    Category: 'Sample Category',
  },
  {
    id: '2',
    No: '3',
    Price: '18.00',
    Name: 'Sample 3',
    Measure: '',
    ChineseName: '中文菜名 3',
    Description: 'Sample description 3',
    Options: ['Vegan', 'Gluten Free'],
    Category: 'Sample Category 2',
  },
  {
    id: '3',
    No: '4',
    Price: '18.00',
    Name: 'Sample 4',
    Measure: '',
    ChineseName: '中文菜名 4',
    Description: 'Sample description 4',
    Options: ['Vegan', 'Gluten Free'],
    Category: 'Sample Category 2',
  },
]

// const itemSpacing = ref<ItemSpacing>('fill')
const menuPreviewRef = ref<HTMLElement | null>(null)
const pdfRenderRef = ref<HTMLElement | null>(null)
const twoPageRef = ref<HTMLElement | null>(null)

// const showTwoPage = ref(false)
// const pdfRenderKey = ref(0)
// const csvKey = ref(0)

/* Computed */
const computedTotalPages = computed(() => {
  const itemsCount = menuState.menuCsv.length
  const itemsPerPage = pageState.itemsPerPage
  const pages = uiState.showTwoPage
    ? Math.ceil(itemsCount / (itemsPerPage * 2))
    : Math.ceil(itemsCount / itemsPerPage)
  return Math.max(1, pages) + 1
})

const pdfTotalPages = computed(() => {
  const totalItems = menuState.menuCsv.length
  return Math.max(1, Math.ceil(totalItems / pageState.itemsPerPage))
})

onMounted(() => {
  loadSampleMenu()
})

/* Application Action */
function handleCsvLoaded(items: MenuItem[]) {
  menuState.menuCsv = items
  pageState.currentPage = 1
}

function loadSampleMenu() {
  menuState.menuCsv = demoMenu.map((item) => ({ ...item }))
  pageState.currentPage = 1
  uiState.csvKey++
}

/* Domain */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function getNextNo(category?: string): string {
  // Get all numeric No. values globally
  const globalUsedNumbers = new Set<number>()
  menuState.menuCsv.forEach((item) => {
    const num = parseInt(item.No, 10)
    if (!isNaN(num)) {
      globalUsedNumbers.add(num)
    }
  })

  // If no items exist, start from 1
  if (globalUsedNumbers.size === 0) return '1'

  // If category provided, prioritize filling gaps within category's range
  if (category) {
    const categoryItems = menuState.menuCsv.filter((item) => item.Category === category)
    let minInCategory = Infinity
    let maxInCategory = 0

    categoryItems.forEach((item) => {
      const num = parseInt(item.No, 10)
      if (!isNaN(num)) {
        minInCategory = Math.min(minInCategory, num)
        maxInCategory = Math.max(maxInCategory, num)
      }
    })

    // If category has items, check for gaps within its range first
    if (maxInCategory > 0) {
      for (let i = minInCategory; i <= maxInCategory; i++) {
        if (!globalUsedNumbers.has(i)) {
          return i.toString()
        }
      }

      // No gaps found in range, add after max
      let nextNum = maxInCategory + 1
      while (globalUsedNumbers.has(nextNum)) {
        nextNum++
      }
      return nextNum.toString()
    }
  }

  // No category or category has no items, find first global gap
  const sortedGlobal = Array.from(globalUsedNumbers).sort((a, b) => a - b)

  // Check for gaps in the global sequence
  for (let i = 0; i < sortedGlobal.length - 1; i++) {
    if (sortedGlobal[i + 1]! - sortedGlobal[i]! > 1) {
      return (sortedGlobal[i]! + 1).toString()
    }
  }

  // No gaps found, return next number after the maximum
  return (sortedGlobal[sortedGlobal.length - 1]! + 1).toString()
}

function createNewItem(defaultNo?: string, defaultCategory?: string) {
  const no = defaultNo ?? getNextNo(defaultCategory)
  return {
    id: generateId(),
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

function onItemUpdated(updated: MenuItem) {
  let idx = -1

  if (updated.id) {
    idx = menuState.menuCsv.findIndex((it) => it.id === updated.id)
  }

  // Fallback to Name if no ID
  if (idx === -1) {
    idx = menuState.menuCsv.findIndex((it) => it.Name === updated.Name)
  }

  // Final fallback to No
  if (idx === -1 && updated.No != null) {
    idx = menuState.menuCsv.findIndex((it) => it.No === updated.No)
  }

  if (idx >= 0) {
    menuState.menuCsv.splice(idx, 1, { ...updated })
  } else {
    menuState.menuCsv.push({ ...updated })
  }
  uiState.previewRenderKey++
}

/* Application Action */
function addItemBefore(No: string) {
  const idx = menuState.menuCsv.findIndex((it) => it.No === No)
  const category = menuState.menuCsv[idx]?.Category ?? 'Uncategorized'
  const newItem = createNewItem(undefined, category)
  if (idx === -1) menuState.menuCsv.push(newItem)
  else menuState.menuCsv.splice(idx, 0, newItem)
}

function addItemAfter(No: string) {
  const idx = menuState.menuCsv.findIndex((it) => it.No === No)
  const category = menuState.menuCsv[idx]?.Category ?? 'Uncategorized'
  const newItem = createNewItem(undefined, category)
  if (idx === -1) menuState.menuCsv.push(newItem)
  else menuState.menuCsv.splice(idx + 1, 0, newItem)
}

function deleteItemByNo(No: string) {
  const idx = menuState.menuCsv.findIndex((it) => it.No === No)
  if (idx >= 0) menuState.menuCsv.splice(idx, 1)
}

function reorderItems(fromNo: string, toNo: string) {
  const from = menuState.menuCsv.findIndex((it) => it.No === fromNo)
  const to = menuState.menuCsv.findIndex((it) => it.No === toNo)
  if (from === -1 || to === -1 || from === to) return
  const removed = menuState.menuCsv.splice(from, 1)
  const item = removed[0]
  if (!item) return

  const targetIndex = from < to ? to - 1 : to
  const clamped = Math.max(0, Math.min(menuState.menuCsv.length, targetIndex))
  menuState.menuCsv.splice(clamped, 0, item)
}

/* Infrastructure / Side Effect */

// watch(
//   state.menuCsv,
//   () => {
//     pdfRenderKey.value++; // trigger PDF ref re-render
//   },
//   { deep: true }
// );

watch([() => menuState.menuCsv.length, uiState.showTwoPage, () => pageState.itemsPerPage], () => {
  pageState.totalPages = computedTotalPages.value
  if (pageState.currentPage >= pageState.totalPages) {
    pageState.currentPage = pageState.totalPages - 1
  }
})

watch(
  () => uiState.showTwoPage,
  (newVal) => {
    if (newVal) {
      // Single → two page
      pageState.currentPage = Math.max(1, pageState.currentPage)
      pageState.currentPage = Math.floor(pageState.currentPage / 2)
    } else {
      // Two → single page
      pageState.currentPage = pageState.currentPage * 2
    }
    pageState.totalPages = computedTotalPages.value
  },
)

watch(
  () => pageState.totalPages,
  (newTotal) => {
    if (pageState.currentPage >= newTotal) {
      pageState.currentPage = Math.max(0, newTotal - 1)
    }
  },
)

watch(
  () => ({
    items: menuState.menuCsv.map((item) => ({
      No: item.No,
      Name: item.Name,
      ChineseName: item.ChineseName,
      Description: item.Description,
      Price: item.Price,
      Options: [...item.Options],
      mainImageBase64: item.mainImageBase64,
    })),
    logo: menuState.logoBase64,
  }),
  () => {
    uiState.pdfRenderKey++
  },
  { deep: true },
)
</script>

<template>
  <div class="">
    <div class="flex gap-2 p-2 items-center border-b border-gray-300">
      <h1 class="w-1/4 text-xl font-bold p-1">Menu Gen (CSV to PDF)</h1>
      <div class="w-2/4">
        <MenuPage
          :current-page="pageState.currentPage"
          :total-pages="pageState.totalPages"
          @update:page="pageState.currentPage = $event"
        />
      </div>
      <div class="w-1/4 flex justify-start">
        <button
          @click="uiState.showTwoPage = !uiState.showTwoPage"
          class="border-blue-500 px-3 py-1 rounded-lg hover:bg-blue-50 hover:text-blue-500 border-2 transition-colors duration-200 shadow-md disabled:opacity-50"
        >
          {{ uiState.showTwoPage ? 'Show Single Page' : 'Show Two Page' }}
        </button>
      </div>
    </div>
    <div class="flex gap-2 divide-x divide-gray-300">
      <!-- Left side: controls -->
      <div class="w-1/4 divide-y divide-gray-300 px-2">
        <!-- Drag & Drop CSV and Generate PDF side by side -->
        <div class="flex gap-2 py-2">
          <CsvUpload
            :key="uiState.csvKey"
            @csvLoaded="handleCsvLoaded"
            :items="menuState.menuCsv"
            class=""
          />
          <GeneratePdf
            :contentRef="pdfRenderRef"
            :page-width="pageState.width"
            :page-height="pageState.height"
            :font-family="menuState.selectedFont"
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
        <div class="py-2"><FontSelector v-model:font="menuState.selectedFont" /></div>
        <div class="py-2"><ColorPicker type="bg" v-model:color="menuState.bgColor" /></div>
        <div class="py-2"><ColorPicker type="text" v-model:color="menuState.textColor" /></div>
        <div class="py-2">
          <PageSizeSelector v-model:width="pageState.width" v-model:height="pageState.height" />
        </div>
        <div class="py-2"><ScaleControl v-model="menuState.scalePage" label="Scale" /></div>
        <div class="py-2">
          <ItemSpacingControl v-model="menuState.itemSpacing" />
        </div>
        <div class="py-2">
          <ItemsPerCategorySelector
            v-model:itemsPerPage="pageState.itemsPerPage"
            v-model:keepCategoryTogether="pageState.keepCategoryTogether"
          />
        </div>
        <div class="py-2">
          <AddIcon />
        </div>

        <div class="py-2">
          <MultiImageUpload
            :menuItems="menuState.menuCsv"
            @update:item="onItemUpdated"
            @update:menuItems="menuState.menuCsv = $event"
          />
        </div>
      </div>

      <!-- Right side: preview -->
      <div class="w-3/4 flex pt-2">
        <!-- Single-page menu preview -->
        <div
          class="menu-preview-wrapper"
          v-show="!uiState.showTwoPage"
          ref="menuPreviewRef"
          :style="{ '--ui-scale': menuState.scalePage }"
        >
          <!-- COVER PAGE -->
          <MenuCover
            v-if="pageState.currentPage === 0"
            v-model:title="menuState.coverTitle"
            v-model:subtitle="menuState.coverSubtitle"
            v-model:coverLogo="menuState.coverLogoBase64"
            :bg-color="menuState.bgColor"
            :text-color="menuState.textColor"
            :font-family="menuState.selectedFont"
            :style="{ width: pageState.width, height: pageState.height }"
          />

          <!-- Single-page MENU PREVIEW -->
          <MenuPreview
            v-else
            :key="uiState.previewRenderKey"
            v-model:footerText="menuState.footerText"
            :items="menuState.menuCsv"
            :font-family="menuState.selectedFont"
            :bg-color="menuState.bgColor"
            :text-color="menuState.textColor"
            :item-spacing="menuState.itemSpacing"
            :readonly="menuState.pdfReadonly"
            :current-page="pageState.currentPage - 1"
            :items-per-page="pageState.itemsPerPage"
            :page-width="pageState.width"
            :page-height="pageState.height"
            :keep-category-together="pageState.keepCategoryTogether"
            :default-src="menuState.logoBase64 || undefined"
            @add-before="(p) => addItemBefore(p.No)"
            @add-after="(p) => addItemAfter(p.No)"
            @delete-item="(p) => deleteItemByNo(p.No)"
            @reorder="(p) => reorderItems(p.fromNo, p.toNo)"
            @update:totalPages="(val) => (pageState.totalPages = val + 1)"
            @update:logo="(base64: string) => (menuState.logoBase64 = base64)"
          />
        </div>

        <!-- Two-page menu preview -->
        <div
          class="menu-preview-wrapper"
          v-show="uiState.showTwoPage"
          ref="twoPageRef"
          :style="{ '--ui-scale': menuState.scalePage }"
        >
          <!-- COVER PAGE (Two-page mode) -->
          <MenuCover
            v-if="pageState.currentPage === 0"
            v-model:title="menuState.coverTitle"
            v-model:subtitle="menuState.coverSubtitle"
            v-model:coverLogo="menuState.coverLogoBase64"
            :bg-color="menuState.bgColor"
            :text-color="menuState.textColor"
            :font-family="menuState.selectedFont"
            :style="{ width: pageState.width, height: pageState.height }"
          />

          <!-- Two-page MENU PREVIEW -->
          <TwoPage
            v-else-if="pageState.currentPage > 0"
            :items="menuState.menuCsv"
            :font-family="menuState.selectedFont"
            :bg-color="menuState.bgColor"
            :text-color="menuState.textColor"
            :item-spacing="menuState.itemSpacing"
            :current-page="pageState.currentPage - 1"
            :items-per-page="pageState.itemsPerPage"
            :page-width="pageState.width"
            :page-height="pageState.height"
            :keep-category-together="pageState.keepCategoryTogether"
            :footer-text="menuState.footerText"
            :default-src="menuState.logoBase64 || undefined"
            :readonly="menuState.pdfReadonly"
            @add-before="(p) => addItemBefore(p.No)"
            @add-after="(p) => addItemAfter(p.No)"
            @delete-item="(p) => deleteItemByNo(p.No)"
            @reorder="(p) => reorderItems(p.fromNo, p.toNo)"
            @update:logo="(base64: string) => (menuState.logoBase64 = base64)"
            @update:totalPages="() => (pageState.totalPages = computedTotalPages)"
          />

          <!-- EMPTY STATE -->
          <div
            v-else
            class="a4-preview flex items-center justify-center"
            :style="{ width: pageState.width, height: pageState.height }"
          >
            <p class="text-gray-400 text-center text-2xl italic">
              No menu data loaded. Please upload a CSV file.
            </p>
          </div>
        </div>
      </div>
      <!-- PDF DOM-->
      <div style="display: none">
        <div ref="pdfRenderRef" :key="uiState.pdfRenderKey">
          <!-- COVER PAGE -->
          <div class="pdf-page">
            <MenuCover
              :title="menuState.coverTitle"
              :subtitle="menuState.coverSubtitle"
              :bg-color="menuState.bgColor"
              :text-color="menuState.textColor"
              :font-family="menuState.selectedFont"
              :coverLogo="menuState.coverLogoBase64 || undefined"
              :style="{
                width: pageState.width,
                height: pageState.height,
              }"
            />
          </div>

          <!-- MENU PAGES -->
          <div v-for="page in pdfTotalPages" :key="page" class="pdf-page">
            <MenuPreview
              :footerText="menuState.footerText"
              :items="menuState.menuCsv"
              :fontFamily="menuState.selectedFont"
              :bgColor="menuState.bgColor"
              :text-color="menuState.textColor"
              :item-spacing="menuState.itemSpacing"
              :readonly="true"
              :current-page="page - 1"
              :items-per-page="pageState.itemsPerPage"
              :page-width="pageState.width"
              :page-height="pageState.height"
              :keep-category-together="pageState.keepCategoryTogether"
              :default-src="menuState.logoBase64 || undefined"
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
  transform-origin: top left;
}

@media screen {
  .a4-preview {
    /* transform: scale(0.8); */
    transform-origin: top left;
  }
}
</style>

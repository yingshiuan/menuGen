<script lang="ts" setup>
import { reactive, ref, watch, onMounted, computed } from 'vue'
import type { MenuItem } from '@/types/types'
import { useIcons } from '@/composables/useIcons'
import { useMenuLang } from '@/composables/useMenuLang'
import {
  categoryLabel,
  cloneMenuItem,
  createMenuItem,
  emptyDietary,
  generateId,
  isDietaryKey,
  pickText,
} from '@/domain/menuItem'
import { paginateMenu } from '@/domain/menuPages'
import { clampSize, uniformPhotoSize } from '@/domain/sizes'
import { PHOTO_SIZE_RANGE, useMenuPhoto } from '@/composables/useMenuPhoto'
import MenuPreview from '@/components/layouts/MenuPreview.vue'
import GeneratePdf from '@/components/GeneratePdf.vue'
import CsvUpload from '@/components/CsvUpload.vue'
import FontSelector from '@/components/controls/FontSelector.vue'
import MenuLanguageSelector from '@/components/controls/MenuLanguageSelector.vue'
import TextSizeControl from '@/components/controls/TextSizeControl.vue'
import PhotoSizeControl from '@/components/controls/PhotoSizeControl.vue'
import ColorPicker from '@/components/controls/ColorPicker.vue'
import PageSizeSelector from '@/components/controls/PageSizeSelector.vue'
import ScaleControl from '@/components/controls/ScaleControl.vue'
import MenuPage from '@/components/controls/MenuPage.vue'
import ItemsPerCategorySelector from '@/components/controls/ItemsPerCategorySelector.vue'
import MultiImageUpload from '@/components/MultiImageUpload.vue'
import ItemSpacingControl from '@/components/controls/ItemSpacingControl.vue'
import type { ItemSpacing } from '@/components/controls/ItemSpacingControl.vue'
import MenuCover from '@/components/layouts/MenuCover.vue'
import AddIcon from '@/components/AddIcon.vue'
import TwoPage from '@/components/controls/TwoPage.vue'
import TopBanner from '@/components/TopBanner.vue'

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
  selectedFont: 'Sans-serif',
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
  showMobileControls: false,
})

/* Demo Data */
function demoItem(n: number, category: number, dietary: Partial<MenuItem['dietary']>) {
  return createMenuItem({
    id: String(n - 1),
    no: String(n),
    price: '18.00',
    name: { en: `Sample ${n}`, de: `Beispiel ${n}`, zh: `中文菜名 ${n}` },
    description: {
      en: `Sample description ${n}`,
      de: `Beispielbeschreibung ${n}`,
    },
    category:
      category === 1
        ? { en: 'Sample Category', de: 'Beispielkategorie' }
        : { en: 'Sample Category 2', de: 'Beispielkategorie 2' },
    dietary: { ...emptyDietary(), ...dietary },
  })
}

const demoMenu: MenuItem[] = [
  {
    ...demoItem(1, 1, { recommend: true, spicy: true, vegetarian: true }),
    price: '00.00',
    measure: '1',
    mainImageBase64: '/data/2_Sample2.png',
  },
  demoItem(2, 1, { vegan: true, gluten_free: true }),
  demoItem(3, 2, { vegan: true, gluten_free: true }),
  demoItem(4, 2, { vegan: true, gluten_free: true }),
]

const { iconMap } = useIcons()
const { primary, extraLangs } = useMenuLang()
const customOptionKeys = computed(() => Object.keys(iconMap.value).filter((k) => !isDietaryKey(k)))

// const itemSpacing = ref<ItemSpacing>('fill')
const menuPreviewRef = ref<HTMLElement | null>(null)
const pdfRenderRef = ref<HTMLElement | null>(null)
const twoPageRef = ref<HTMLElement | null>(null)

// const showTwoPage = ref(false)
// const pdfRenderKey = ref(0)
// const csvKey = ref(0)

/* Computed */
// Menu pages as the preview lays them out. Keeping categories together leaves pages
// part-empty, so this can be more than items ÷ itemsPerPage.
const menuPages = computed(() =>
  paginateMenu(
    menuState.menuCsv,
    pageState.itemsPerPage,
    pageState.keepCategoryTogether,
    primary.value,
  ),
)
const menuPageCount = computed(() => Math.max(1, menuPages.value.length))

// "Fill page" photo size: the largest the fullest page can fit (most dishes and headers
// for the room the on-screen page measured), so every page shows photos the same size.
// It is the photo size box's maximum.
const { photoSize, maxPhotoSize, followMax, pageLayout } = useMenuPhoto()

const uniformMaxPhoto = computed(() => {
  if (!pageLayout.areaHeight) return null
  const pages = menuPages.value.map((page) => ({
    dishes: page.length,
    // Categories are contiguous on a page, so each distinct one there has a header
    headers: new Set(page.map((e) => e.category)).size,
  }))
  const size = uniformPhotoSize(pageLayout, pages)
  return clampSize(size, PHOTO_SIZE_RANGE, PHOTO_SIZE_RANGE.min)
})

watch(
  uniformMaxPhoto,
  (max) => {
    if (max === null) return
    maxPhotoSize.value = max
    if (followMax.value || photoSize.value > max) photoSize.value = max
  },
  { immediate: true },
)

// Choosing "Fill page" starts at the maximum
watch(
  () => menuState.itemSpacing,
  (spacing) => {
    if (spacing !== 'fill') return
    followMax.value = true
    photoSize.value = maxPhotoSize.value
  },
)

// Menu pages (or two-page spreads) plus the cover
const computedTotalPages = computed(() => {
  const pages = uiState.showTwoPage ? Math.ceil(menuPageCount.value / 2) : menuPageCount.value
  return pages + 1
})

const pdfTotalPages = menuPageCount

onMounted(() => {
  loadSampleMenu()
})

const isMobile = window.matchMedia('(max-width: 1024px)').matches

onMounted(() => {
  if (isMobile) {
    menuState.scalePage = 0.6
  }
})

/* Application Action */
function handleCsvLoaded(items: MenuItem[]) {
  // Custom icons come from the CSV cells, so each dish keeps its own tags
  menuState.menuCsv = items
  pageState.currentPage = 1
}

function loadSampleMenu() {
  menuState.menuCsv = demoMenu.map(cloneMenuItem)
  pageState.currentPage = 1
  uiState.csvKey++
}

/* Domain */
const sameCategory = (item: MenuItem, category: string) =>
  categoryLabel(item, primary.value) === category

function getNextNo(category?: string): string {
  // Get all numeric No. values globally
  const globalUsedNumbers = new Set<number>()
  menuState.menuCsv.forEach((item) => {
    const num = parseInt(item.no, 10)
    if (!isNaN(num)) {
      globalUsedNumbers.add(num)
    }
  })

  // If no items exist, start from 1
  if (globalUsedNumbers.size === 0) return '1'

  // If category provided, prioritize filling gaps within category's range
  if (category) {
    const categoryItems = menuState.menuCsv.filter((item) => sameCategory(item, category))
    let minInCategory = Infinity
    let maxInCategory = 0

    categoryItems.forEach((item) => {
      const num = parseInt(item.no, 10)
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

// `neighbor` is the dish the new one is inserted next to; it shares its category
function createNewItem(neighbor?: MenuItem) {
  const no = getNextNo(neighbor ? categoryLabel(neighbor, primary.value) : undefined)
  return createMenuItem({
    id: generateId(),
    no,
    name: { [primary.value]: `New Item ${no}` },
    category: neighbor ? { ...neighbor.category } : {},
  })
}

function onItemUpdated(updated: MenuItem) {
  let idx = -1

  if (updated.id) {
    idx = menuState.menuCsv.findIndex((it) => it.id === updated.id)
  }
  if (idx === -1) {
    const name = pickText(updated.name, primary.value)
    idx = menuState.menuCsv.findIndex((it) => pickText(it.name, primary.value) === name)
  }
  if (idx === -1 && updated.no != null) {
    idx = menuState.menuCsv.findIndex((it) => it.no === updated.no)
  }

  if (idx >= 0) {
    menuState.menuCsv.splice(idx, 1, cloneMenuItem(updated))
  } else {
    menuState.menuCsv.push(cloneMenuItem(updated))
  }
  uiState.previewRenderKey++
}

/* Application Action */
// Dishes are found by id: a number can be empty or shared (side dishes, desserts),
// and looking those up by number would act on the first such dish in the menu
const indexOfId = (id: string) => menuState.menuCsv.findIndex((it) => it.id === id)

function addItemBefore(id: string) {
  const idx = indexOfId(id)
  const newItem = createNewItem(menuState.menuCsv[idx])
  if (idx === -1) menuState.menuCsv.push(newItem)
  else menuState.menuCsv.splice(idx, 0, newItem)
}

function addItemAfter(id: string) {
  const idx = indexOfId(id)
  const newItem = createNewItem(menuState.menuCsv[idx])
  if (idx === -1) menuState.menuCsv.push(newItem)
  else menuState.menuCsv.splice(idx + 1, 0, newItem)
}

function deleteItem(id: string) {
  const idx = indexOfId(id)
  if (idx >= 0) menuState.menuCsv.splice(idx, 1)
}

function reorderItems(fromId: string, toId: string) {
  const from = indexOfId(fromId)
  const to = indexOfId(toId)
  if (from === -1 || to === -1 || from === to) return
  const removed = menuState.menuCsv.splice(from, 1)
  const item = removed[0]
  if (!item) return

  const targetIndex = from < to ? to - 1 : to
  const clamped = Math.max(0, Math.min(menuState.menuCsv.length, targetIndex))
  menuState.menuCsv.splice(clamped, 0, item)
}

function handleRenameOption(oldLabel: string, newLabel: string) {
  menuState.menuCsv = menuState.menuCsv.map((item) => ({
    ...item,
    tags: item.tags.map((tag) => (tag === oldLabel ? newLabel : tag)),
  }))
}

/* Infrastructure / Side Effect */

// watch(
//   state.menuCsv,
//   () => {
//     pdfRenderKey.value++; // trigger PDF ref re-render
//   },
//   { deep: true }
// );

watch(
  computedTotalPages,
  (total) => {
    pageState.totalPages = total
    if (pageState.currentPage >= pageState.totalPages) {
      pageState.currentPage = pageState.totalPages - 1
    }
  },
  { immediate: true },
)

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
      no: item.no,
      price: item.price,
      measure: item.measure,
      name: { ...item.name },
      description: { ...item.description },
      category: { ...item.category },
      dietary: { ...item.dietary },
      tags: [...item.tags],
      mainImageBase64: item.mainImageBase64,
    })),
    lang: [primary.value, ...extraLangs.value],
    logo: menuState.logoBase64,
  }),
  () => {
    uiState.pdfRenderKey++
  },
  { deep: true },
)

watch(
  () => uiState.showMobileControls,
  (open) => {
    if (open) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = scrollBarWidth + 'px'
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  },
)

// A newly added custom icon starts switched on for every dish
watch(customOptionKeys, (newKeys, oldKeys) => {
  const added = newKeys.filter((k) => !oldKeys.includes(k))
  if (!added.length) return
  menuState.menuCsv = menuState.menuCsv.map((item) => ({
    ...item,
    tags: [...item.tags, ...added.filter((tag) => !item.tags.includes(tag))],
  }))
})
</script>

<template>
  <div class="">
    <TopBanner />
    <div class="flex flex-col lg:flex-row lg:gap-2 p-2 items-center border-b border-gray-300">
      <h1 class="w-full lg:w-1/4 text-xl font-bold p-1">Menu Gen (CSV to PDF)</h1>
      <div class="w-full flex lg:contents flex-col lg:flex-row">
        <div class="w-full lg:w-2/4">
          <MenuPage
            :current-page="pageState.currentPage"
            :total-pages="pageState.totalPages"
            @update:page="pageState.currentPage = $event"
          />
        </div>
        <div class="flex w-full gap-2 lg:hidden p-1">
          <!-- Show Controls button: half width -->
          <div class="w-1/2">
            <button
              @click="uiState.showMobileControls = true"
              class="w-full border-gray-500 border px-2 py-1 rounded-lg font-medium"
            >
              ☰ Controls
            </button>
          </div>

          <!-- Two Page toggle button: half width -->
          <div class="w-1/2">
            <button
              @click="uiState.showTwoPage = !uiState.showTwoPage"
              class="w-full border-blue-500 px-2 py-1 rounded-lg hover:bg-blue-700 hover:text-white border transition-colors duration-200 shadow-md disabled:opacity-50"
            >
              {{ uiState.showTwoPage ? 'Show Single Page' : 'Show Two Page' }}
            </button>
          </div>
        </div>

        <!-- Desktop Two Page button -->
        <div class="hidden lg:flex lg:w-1/4 lg:justify-start justify-center">
          <button
            @click="uiState.showTwoPage = !uiState.showTwoPage"
            class="border-blue-500 px-3 py-1 rounded-lg hover:bg-blue-700 hover:text-white border transition-colors duration-200 shadow-md disabled:opacity-50"
          >
            {{ uiState.showTwoPage ? 'Show Single Page' : 'Show Two Page' }}
          </button>
        </div>
      </div>
    </div>

    <div
      class="flex flex-col lg:flex-row flex-1 overflow-hidden gap-2 lg:divide-x lg:divide-gray-300"
    >
      <!-- Left side: controls -->
      <div
        v-if="uiState.showMobileControls"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
        @click="uiState.showMobileControls = false"
      ></div>
      <div
        class="fixed lg:static top-0 left-0 h-full lg:h-auto w-3/4 max-w-sm lg:max-w-none bg-white z-50 transform transition-transform duration-300 lg:translate-x-0 lg:w-1/4 overflow-y-auto px-3"
        :class="{
          '-translate-x-full lg:translate-x-0': !uiState.showMobileControls,
          'translate-x-0': uiState.showMobileControls,
        }"
      >
        <div @click.stop class="divide-y divide-gray-300">
          <!-- Drag & Drop CSV and Generate PDF side by side -->
          <div class="flex gap-2 py-2">
            <CsvUpload
              :key="uiState.csvKey"
              @csvLoaded="handleCsvLoaded"
              :items="menuState.menuCsv"
            />
            <GeneratePdf
              :contentRef="pdfRenderRef"
              :page-width="pageState.width"
              :page-height="pageState.height"
              :font-family="menuState.selectedFont"
            />
          </div>

          <div class="py-2">
            <button
              @click="loadSampleMenu"
              class="border-blue-500 w-full p-1 rounded-lg hover:bg-blue-700 hover:text-white border transition-colors duration-200 shadow-md"
            >
              Load Sample Menu
            </button>
          </div>
          <!-- Font selector and color pickers stacked below -->
          <div class="py-2">
            <div>Typography</div>
            <FontSelector v-model:font="menuState.selectedFont" />
            <div class="mt-2">Text Size</div>
            <TextSizeControl />
          </div>
          <div class="py-2">
            <div>Language</div>
            <MenuLanguageSelector />
          </div>
          <div class="py-2">
            <div>Color</div>
            <ColorPicker type="bg" v-model:color="menuState.bgColor" />
            <ColorPicker type="text" v-model:color="menuState.textColor" />
          </div>
          <div class="py-2">
            <div>Layout</div>
            <PageSizeSelector v-model:width="pageState.width" v-model:height="pageState.height" />
          </div>
          <div class="py-2"><ScaleControl v-model="menuState.scalePage" label="Scale" /></div>
          <div class="py-2">
            <div>Items</div>
            <ItemSpacingControl v-model="menuState.itemSpacing" />
            <PhotoSizeControl :disabled="menuState.itemSpacing !== 'fill'" />
            <ItemsPerCategorySelector
              v-model:itemsPerPage="pageState.itemsPerPage"
              v-model:keepCategoryTogether="pageState.keepCategoryTogether"
            />
          </div>
          <div class="py-2">
            <AddIcon @rename-option="handleRenameOption" />
          </div>

          <div class="py-2">
            <MultiImageUpload
              :menuItems="menuState.menuCsv"
              @update:item="onItemUpdated"
              @update:menuItems="menuState.menuCsv = $event"
            />
          </div>
        </div>
      </div>

      <!-- Right side: preview -->
      <div class="w-full lg:w-3/4 flex p-2 overflow-x-auto">
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
            @add-before="(p) => addItemBefore(p.id)"
            @add-after="(p) => addItemAfter(p.id)"
            @delete-item="(p) => deleteItem(p.id)"
            @reorder="(p) => reorderItems(p.fromId, p.toId)"
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
            @add-before="(p) => addItemBefore(p.id)"
            @add-after="(p) => addItemAfter(p.id)"
            @delete-item="(p) => deleteItem(p.id)"
            @reorder="(p) => reorderItems(p.fromId, p.toId)"
            @update:logo="(base64: string) => (menuState.logoBase64 = base64)"
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

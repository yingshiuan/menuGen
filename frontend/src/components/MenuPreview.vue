<script lang="ts" setup>
import { computed, ref, reactive, watch } from 'vue'
import type { MenuItem } from '@/types/types'
import MenuItemComponent from '@/components/MenuItem.vue'
import LogoUpload from '@/components/AddLogo.vue'
import MeunInfo from '@/components/MeunInfo.vue'
import type { ItemSpacing } from '@/components/ItemSpacingControl.vue'

/* Props & Emits */
const props = defineProps<{
  items: MenuItem[]
  footerText: string
  fontFamily: string
  bgColor: string
  textColor: string
  itemSpacing: ItemSpacing
  readonly: boolean
  currentPage: number
  itemsPerPage: number
  defaultSrc?: string
  pageWidth: string
  pageHeight: string
  keepCategoryTogether?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:footerText', value: string): void
  (e: 'update:logo', base64: string): void
  (e: 'add-before', payload: { No: string }): void
  (e: 'add-after', payload: { No: string }): void
  (e: 'delete-item', payload: { No: string }): void
  (e: 'reorder', payload: { fromNo: string; toNo: string }): void
  (e: 'update:totalPages', value: number): void
}>()

/* State */
interface PageEntry {
  category: string
  item: MenuItem
}

const dragState = reactive<{ draggingIndex: number | null; dragOverIndex: number | null }>({
  draggingIndex: null,
  dragOverIndex: null,
})

const logoBase64 = ref<string | null>(props.defaultSrc ?? null)

/* Domain / Computed */
// Group items by category
function groupItems(items: MenuItem[]): Record<string, MenuItem[]> {
  const grouped: Record<string, MenuItem[]> = {}
  items.forEach((item) => {
    const cat = item.Category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  })
  return grouped
}

// Pagination logic
function paginateItems(
  items: MenuItem[],
  itemsPerPage: number,
  keepCategoryTogether?: boolean
): PageEntry[][] {
  const grouped = groupItems(items) 

  const result: PageEntry[][] = []
  let currentPage: PageEntry[] = []

  if (keepCategoryTogether) {
    for (const [category, items] of Object.entries(grouped)) {
      const categoryEntries = items.map(item => ({ category, item }))
      const categoryLength = categoryEntries.length

      if (categoryLength > 11) {
        if (currentPage.length) {
          result.push(currentPage)
          currentPage = []
        }
        for (let i = 0; i < categoryLength; i += 11) {
          result.push(categoryEntries.slice(i, i + 11))
        }
        continue
      }

      if (currentPage.length > 0 && currentPage.length + categoryLength > 10) {
        result.push(currentPage)
        currentPage = []
      }

      currentPage.push(...categoryEntries)
      if (currentPage.length >= 10) {
        result.push(currentPage)
        currentPage = []
      }
    }
  } else {
    for (const [category, items] of Object.entries(grouped)) {
      items.forEach(item => {
        if (currentPage.length >= itemsPerPage) {
          result.push(currentPage)
          currentPage = []
        }
        currentPage.push({ category, item })
      })
    }
  }

  if (currentPage.length > 0) result.push(currentPage)
  return result
}

const pages = computed(() =>
  paginateItems(props.items, props.itemsPerPage, props.keepCategoryTogether),
)
const totalPages = computed(() => pages.value.length)
const clampedPage = computed(() => Math.min(Math.max(props.currentPage, 0), totalPages.value - 1))
const pageItems = computed(() => pages.value[clampedPage.value] ?? [])

// Sync total pages with parent
watch(totalPages, (val) => emit('update:totalPages', val), { immediate: true })

/* Infrastructure / Helpers */
watch(
  () => props.defaultSrc,
  (val) => {
    logoBase64.value = val ?? null
  },
  { immediate: true },
)

function shouldShowCategoryHeader(index: number) {
  const current = pageItems.value[index]
  const prev = pageItems.value[index - 1]
  if (!current) return false
  return index === 0 || current.category !== prev?.category
}

// Drag & Drop
function onDragStart(e: DragEvent, index: number) {
  dragState.draggingIndex = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))

  const ghost = document.createElement('div')
  ghost.style.width = '8rem'
  ghost.style.height = '4rem'
  ghost.style.background = 'rgba(0,0,0,0.1)'
  ghost.style.border = '0.1rem solid #aaa'
  ghost.style.borderRadius = '0.2rem'
  ghost.style.position = 'absolute'
  ghost.style.top = '-9999px'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 50, 20)
  setTimeout(() => document.body.removeChild(ghost), 0)
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dragState.dragOverIndex = e.clientY < rect.top + rect.height / 2 ? index : index + 1
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const from = dragState.draggingIndex
  const to = dragState.dragOverIndex
  dragState.draggingIndex = null
  dragState.dragOverIndex = null
  if (from === null || to === null || from === to) return
  const fromItem = pageItems.value[from]?.item
  const toItem =
    pageItems.value[to > pageItems.value.length - 1 ? pageItems.value.length - 1 : to]?.item
  if (!fromItem || !toItem) return
  emit('reorder', { fromNo: fromItem.No, toNo: toItem.No })
}

/* UI */
const styleObject = computed(() => ({
  fontFamily: props.fontFamily ?? 'sans-serif',
  backgroundColor: props.bgColor ?? '#ffffff',
  color: props.textColor ?? '#000000',
}))

const itemFlexClass = computed(() => (props.itemSpacing === 'fill' ? 'flex-1' : 'flex-none'))

const itemSpacingClass = computed(() => {
  switch (props.itemSpacing) {
    case 'compact':
      return 'mb-0'
    case 'normal':
      return 'mb-1'
    case 'spacious':
      return 'mb-1.5'
    default:
      return ''
  }
})
</script>

<template>
  <div
    class="a4-preview p-6 flex flex-col relative"
    :style="{
      ...styleObject,
      width: props.pageWidth ?? '210mm',
      height: props.pageHeight ?? '297mm',
    }"
  >
    <!-- Logo Section -->
    <div class="flex items-start justify-end">
      <LogoUpload
        :default-src="logoBase64 || undefined"
        :readonly="readonly"
        @update:logo="
          (base64: string) => {
            logoBase64 = base64
            emit('update:logo', base64)
          }
        "
      />
    </div>

    <!-- Menu Items Section -->
    <div
      v-for="(entry, index) in pageItems"
      :key="`${clampedPage}-${entry.category}-${entry.item.No || 'item'}-${index}`"
      class="group relative"
      :class="[itemFlexClass, itemSpacingClass]"
      :draggable="!props.readonly"
      @dragstart="(e) => onDragStart(e, index)"
      @dragover="(e) => onDragOver(e, index)"
      @drop="onDrop"
    >
      <h2 v-if="shouldShowCategoryHeader(index)" class="text-xl font-bold mb-1 border-b-1">
        {{ entry.category }}
      </h2>

      <div
        v-if="dragState.dragOverIndex === index"
        data-ui-only
        class="absolute top-0 left-0 w-full h-0.5 bg-blue-500 z-20"
      ></div>

      <div
        class="relative transition-all duration-150 rounded-md group-hover:scale-102 group-hover:shadow-sm"
        :class="[
          'transition-all duration-200 ease-in-out',
          dragState.draggingIndex === index ? 'scale-90 opacity-60 z-10' : '',
        ]"
      >
        <MenuItemComponent
          :item="entry.item"
          :readonly="readonly"
          :text-color="props.textColor"
          @update:item="(updated) => Object.assign(entry.item, updated)"
        />

        <!-- Overlay Controls -->
        <div
          v-if="!props.readonly"
          data-ui-only
          class="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150"
        >
          <button
            class="w-5 h-5 flex items-center justify-center rounded-full shadow-sm hover:bg-blue-500 hover:text-white cursor-pointer"
            @click.stop.prevent="() => emit('add-before', { No: entry.item.No })"
            title="Add item before"
          >
            ＋
          </button>
        </div>
        <div
          v-if="!props.readonly"
          data-ui-only
          class="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150"
        >
          <button
            class="w-5 h-5 flex items-center justify-center rounded-full shadow-sm hover:bg-blue-500 hover:text-white cursor-pointer"
            @click.stop.prevent="() => emit('add-after', { No: entry.item.No })"
            title="Add item after"
          >
            ＋
          </button>
        </div>
        <div
          v-if="!props.readonly"
          data-ui-only
          class="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150"
        >
          <button
            class="w-5 h-5 flex items-center justify-center text-red-500 rounded-full shadow-sm hover:bg-blue-500 hover:text-white cursor-pointer"
            @click.stop.prevent="() => emit('delete-item', { No: entry.item.No })"
            title="Delete item"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <!-- Footer Section -->
    <div class="mt-auto bottom-0 left-0 w-full">
      <MeunInfo
        :footer-text="props.footerText"
        :readonly="readonly"
        show-all
        @update:footerText="(text) => emit('update:footerText', text)"
      />
    </div>
  </div>
</template>

<style>
.a4-preview {
  /* width: 210mm;
  min-height: 297mm; */
  /* border: 1px solid #ccc; */
  /* box-shadow: 0 0 10px rgba(0,0,0,0.2); */
}

@media screen {
  .a4-preview {
    /* transform: scale(0.8); */
    transform-origin: top center;
  }
}

@media print {
  .a4-preview {
    /* width: 210mm;
    min-height: 297mm;
    transform: none !important; */
  }
}
</style>

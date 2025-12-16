<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { MenuItem } from '@/types/types'
import MenuItemComponent from '@/components/MenuItem.vue'
import LogoUpload from '@/components/AddLogo.vue'
import Info from '@/components/MeunInfo.vue'

const props = defineProps<{
  items: MenuItem[]
  fontFamily?: string
  bgColor?: string
  textColor?: string
  readonly?: boolean
  currentPage: number
  itemsPerPage: number
  defaultSrc?: string
}>()

const logoBase64 = ref<string | null>(null)

const styleObject = computed(() => ({
  fontFamily: props.fontFamily ?? 'sans-serif',
  backgroundColor: props.bgColor ?? '#ffffff',
  color: props.textColor ?? '#000000',
}))

interface PageEntry {
  category: string
  item: MenuItem
}

const pages = computed<PageEntry[][]>(() => {
  const grouped: Record<string, MenuItem[]> = {}
  props.items.forEach((item) => {
    const cat = item.Category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  })

  const result: PageEntry[][] = []
  let currentPage: PageEntry[] = []

  for (const [category, items] of Object.entries(grouped)) {
    items.forEach((item) => {
      // Start a new page if current is full
      if (currentPage.length >= props.itemsPerPage) {
        result.push(currentPage)
        currentPage = []
      }
      currentPage.push({ category, item })
    })
  }

  if (currentPage.length > 0) result.push(currentPage)
  return result
})

const totalPages = computed(() => pages.value.length)

const clampedPage = computed(() =>
  Math.min(Math.max(props.currentPage, 0), Math.max(totalPages.value - 1, 0)),
)

const pageItems = computed(() => pages.value[clampedPage.value] ?? [])

function shouldShowCategoryHeader(index: number) {
  const current = pageItems.value[index]
  const prev = pageItems.value[index - 1]
  if (!current) return false
  return index === 0 || current.category !== prev?.category
}
</script>

<template>
  <div
    class="a4-preview p-6 flex flex-col relative"
    :style="styleObject"
    style="width: 210mm; height: 297mm"
  >
    <!-- Logo Section -->
    <div class="flex items-start justify-end">
      <LogoUpload
        :default-src="logoBase64 || undefined"
        :readonly="readonly"
        @update:logo="(base64: string) => (logoBase64 = base64)"
      />
    </div>

    <!-- Menu Items Section -->
    <div
      v-for="(entry, index) in pageItems"
      :key="`${clampedPage}-${entry.category}-${entry.item.No}`"
      class="flex-1"
    >
      <h2 v-if="shouldShowCategoryHeader(index)" class="text-xl font-bold mb-2 border-b-1">
        {{ entry.category }}
      </h2>
      <MenuItemComponent
        :item="entry.item"
        :readonly="readonly"
        :text-color="props.textColor"
        @update:item="(updated) => Object.assign(entry.item, updated)"
      />
    </div>
    <!-- Footer Section (Info Component) -->
    <div class="absolute bottom-0 left-0 w-full p-6">
      <Info :readonly="readonly" show-all />
    </div>
  </div>
</template>

<style>
.a4-preview {
  width: 210mm;
  min-height: 297mm;
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
    width: 210mm;
    min-height: 297mm;
    transform: none !important;
  }
}
</style>

<script lang="ts" setup>
import { computed, ref, reactive, watch } from 'vue'
import type { MenuItem } from '@/types/types'
import MenuItemComponent from './MenuItem.vue'


// Props: receive already-parsed CSV data
const props = defineProps<{
  items: MenuItem[]
  fontFamily?: string
  bgColor?: string
  textColor?: string
  readonly?: boolean
}>()

const styleObject = computed(() => ({
  fontFamily: props.fontFamily || 'sans-serif',
  backgroundColor: props.bgColor || '#ffffff',
  color: props.textColor || '#000000'
}))

// Group items by category for both preview and PDF
const grouped = computed(() => {
  const groups: Record<string, MenuItem[]> = {}
  props.items.forEach((item) => {
    const cat = item.Category || 'Uncategorized'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  })
  return groups
})

// --- Add the split function here ---
function splitItemsByPage(items: MenuItem[], maxItemsPerPage = 8): MenuItem[][] {
  const pages: MenuItem[][] = []
  for (let i = 0; i < items.length; i += maxItemsPerPage) {
    pages.push(items.slice(i, i + maxItemsPerPage))
  }
  return pages
}


</script> 

<template>
  <div class="space-y-6">
    <!-- Live Screen Preview -->
    <div
      class="a4-preview mx-auto border shadow-lg p-6"
      :style="styleObject"
    >
      <div v-for="(items, category) in grouped" :key="category" class="mb-8">
        <h2 class="text-xl font-bold pb-1 mb-4 border-b">
          {{ category }}
        </h2>
        <div class="space-y-3">
          <MenuItemComponent v-for="item in items" :key="item.No" :item="item" :readonly="readonly" @update:item="updated => Object.assign(item, updated)"/>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.a4-preview {
  width: 210mm;
  height: 297mm;
  border: 1px solid #ccc;
  padding: 2rem;
  box-sizing: border-box;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);

  /* Scroll if content exceeds height */
  overflow-y: auto;
}

/* Optional: make text scale nicely on screen */
  @media screen {
    .a4-preview {
      transform: scale(0.8); /* shrink for screen preview */
      transform-origin: top center;
    }
  }
</style>

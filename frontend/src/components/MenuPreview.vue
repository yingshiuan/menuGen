<script lang="ts" setup>
import { computed } from 'vue'
import type { MenuItem } from '@/types/types'
import MenuItemComponent from './MenuItem.vue'


// Props: receive already-parsed CSV data
const props = defineProps<{ items: MenuItem[] }>()

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

    <!-- Split View: Web Preview + Hidden PDF -->
    <div class="split-view">
      <!-- Live Screen Preview -->
      <div class="web-preview space-y-4 p-4 border border-gray-400 bg-gray-100">
        <div v-for="(items, category) in grouped" :key="category" class="mb-8">
          <h2 class="text-xl font-bold pb-1 mb-4 border-b-1">
            {{ category }}
          </h2>
          <div class="space-y-3">
            <MenuItemComponent v-for="item in items" :key="item.No" :item="item" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<style>

</style>

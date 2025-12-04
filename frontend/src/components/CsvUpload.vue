<script lang="ts" setup>
import { ref, defineEmits } from 'vue'
import Papa from 'papaparse'
import type { MenuItem, MenuOption } from '@/types/types'

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  (e: 'csvLoaded', items: MenuItem[]): void
}>()

function getOptionsFromRow(row: Record<string, string>): MenuOption[] {
  const map: Record<string, MenuOption> = {
    Recommend: 'Recommend',
    Spicy: 'Spicy',
    Vegan: 'Vegan',
    Vegetarian: 'Vegetarian',
    GlutenFree: 'GlutenFree',
  }

  return Object.entries(map)
    .filter(([key]) => row[key]?.trim())
    .map(([, value]) => value)
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  parseCsvFile(file)
}


function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function parseCsvFile(file: File) {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete: (result) => {
      let currentCategory = ''
      const processed: MenuItem[] = []

      result.data.forEach((row) => {
        if (!row['No.'] && !row['Price'] && row['Name']) {
          currentCategory = row['Name']?.trim() ?? ''
        } else {
          processed.push({
            No: row['No.'] ?? '',
            Price: row['Price'] ?? '',
            Name: row['Name'] ?? '',
            ChineseName: row['Chinese Name'] ?? '',
            Description: row['Description'] ?? '',
            Options: getOptionsFromRow(row),
            Category: currentCategory || 'Uncategorized',
          })
        }
      })

      emit('csvLoaded', processed) // send data to parent
    },
  })
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) parseCsvFile(file)
}
</script>

<template>
  <div
    class="border-2 border-dashed rounded-lg p-1 cursor-pointer flex flex-col items-center justify-center gap-4 
           hover:bg-blue-500 transition-colors group"
    :class="isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
    @click="fileInput?.click()" 
  >
    <!-- Text -->
    <p class="text-gray-600 text-center group-hover:text-white transition-colors">
      Drag & drop your CSV here, or click to browse
    </p>

    <!-- Browse Button (optional, still clickable) -->
    <!-- <button
      type="button"
      class="p-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition-colors"
      @click.stop="fileInput?.click()"
    >
      Browse CSV
    </button> -->

    <!-- Hidden File Input -->
    <input
      type="file"
      accept=".csv"
      ref="fileInput"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>



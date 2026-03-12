<script lang="ts" setup>
import { ref, reactive, computed, nextTick } from 'vue'
import Papa from 'papaparse'
import type { MenuItem, MenuOption } from '@/types/types'
import { useMenuStore } from '@/stores/menu'
import { useIcons, UndefinedIcon } from '@/composables/useIcons'

const props = defineProps<{
  items: MenuItem[]
}>()

const emit = defineEmits<{
  (e: 'csvLoaded', items: MenuItem[]): void
}>()

interface CsvState {
  isDragging: boolean
}

const csvState = reactive<CsvState>({
  isDragging: false,
})

const fileInput = ref<HTMLInputElement | null>(null) // DOM uses ref
const fileName = ref<string | null>(null)
const menuStore = useMenuStore()

const { iconMap, renamedLabels } = useIcons()
const allOptions = computed(() => Object.keys(iconMap.value))

const DATA_COLUMNS = new Set(['No.', 'Price', 'Name', 'Measure', 'Chinese Name', 'Description'])

/* Helpers */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function getOptionsFromRow(row: Record<string, string>): MenuOption[] {
  return Object.entries(row)
    .filter(([key, val]) => !DATA_COLUMNS.has(key) && val?.trim() !== '')
    .map(([key]) => key)
}

/* CSV Handling */
function handleDrop(e: DragEvent) {
  e.preventDefault()
  csvState.isDragging = false

  const file = e.dataTransfer?.files?.[0]
  if (!file) return

  fileName.value = file.name
  parseCsvFile(file)
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  csvState.isDragging = true
}

function handleDragLeave() {
  csvState.isDragging = false
}

function parseCsvFile(file: File) {
  const { addCustomOption } = useIcons()
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (result) => {
      // Register any unknown option columns from CSV into iconMap
      const knownOptions = Object.keys(iconMap.value)
      const csvOptionColumns = (
        (result as Papa.ParseResult<Record<string, string>>).meta?.fields ?? []
      ).filter((f) => !DATA_COLUMNS.has(f) && f.trim() !== '' && !knownOptions.includes(f))
      for (const opt of csvOptionColumns) {
        addCustomOption(opt, UndefinedIcon['Undefined']!)
      }

      await nextTick()

      let currentCategory = ''
      const processed: MenuItem[] = []

      result.data.forEach((row) => {
        if (!row['No.'] && !row['Price'] && row['Name']) {
          currentCategory = row['Name']?.trim() ?? ''
        } else {
          processed.push({
            id: generateId(),
            No: row['No.'] ?? '',
            Price: row['Price'] ?? '',
            Name: row['Name'] ?? '',
            Measure: row['Measure'] ?? '',
            ChineseName: row['Chinese Name'] ?? '',
            Description: row['Description'] ?? '',
            Options: getOptionsFromRow(row),
            Category: currentCategory || 'Uncategorized',
          })
        }
      })

      emit('csvLoaded', processed)
      menuStore.items = processed
    },
  })
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = null
  fileName.value = file.name
  parseCsvFile(file)
  if (fileInput.value) fileInput.value.value = ''
}

// function escapeCSVField(value: string) {
//   // wrap in quotes if it contains a comma or quote
//   if (value.includes(',') || value.includes('"')) {
//     return `"${value.replace(/"/g, '""')}"`
//   }
//   return value
// }

function downloadCSV() {
  if (!props.items?.length) return alert('No data to export')

  const csv = menuStore.exportToCSV(props.items, allOptions.value, renamedLabels.value)

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'menu-output.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex gap-2">
    <div
      class="border-2 border-dashed rounded-lg p-1 cursor-pointer flex flex-col items-center justify-center gap-4 hover:bg-blue-500 transition-colors group"
      :class="csvState.isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="fileInput?.click()"
    >
      <!-- Text -->
      <div class="text-container">
        <div class="text-gray-600 text-center group-hover:text-white transition-colors text-sm">
          <p>
            {{ fileName ? fileName : 'Please upload a CSV file.' }}
          </p>
          <p>
            {{ 'Drag & drop your CSV here, or click to browse' }}
          </p>
        </div>

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
    </div>
    <!-- Export CVS-->
    <div class="max-w-xl mx-auto flex justify-center">
      <button
        @click="downloadCSV"
        class="bg-blue-500 p-1 text-white rounded-lg hover:bg-blue-700 hover:text-white border-2 border-blue-500 transition-colors duration-200 shadow-md"
      >
        Export CSV
      </button>
    </div>
  </div>
</template>

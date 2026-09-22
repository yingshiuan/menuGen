<script lang="ts" setup>
import { ref, reactive, computed, nextTick } from 'vue'
import Papa from 'papaparse'
import type { MenuItem } from '@/types/types'
import { useMenuStore } from '@/stores/menu'
import { useIcons, UndefinedIcon } from '@/composables/useIcons'
import { generateId, isDietaryKey } from '@/domain/menuItem'
import { parseMenuRows } from '@/domain/menuCsv'

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

const { iconMap } = useIcons()
const customTags = computed(() => Object.keys(iconMap.value).filter((k) => !isDietaryKey(k)))

/* CSV Handling */
function handleDrop(e: DragEvent) {
  e.preventDefault()
  csvState.isDragging = false

  const file = e.dataTransfer?.files?.[0]
  if (!file) return

  loadFile(file)
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  csvState.isDragging = true
}

function handleDragLeave() {
  csvState.isDragging = false
}

// `accept=".csv,text/csv"` only filters the file picker, and a drop skips it, so every file is
// checked here. By extension: browsers report a CSV as text/csv, application/vnd.ms-excel
// or nothing at all.
function csvFileProblem(file: File): string | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return null
  if (name.endsWith('.numbers')) {
    return 'Numbers files can’t be read. In Numbers, choose File → Export To → CSV, then upload that file.'
  }
  if (/\.xlsx?$/.test(name)) {
    return 'Excel files can’t be read. In Excel, choose File → Save As → CSV UTF-8, then upload that file.'
  }
  return `“${file.name}” is not a CSV file. Please upload a .csv file.`
}

function loadFile(file: File) {
  const problem = csvFileProblem(file)
  if (problem) {
    alert(problem)
    return
  }
  fileName.value = file.name
  parseCsvFile(file)
}

function parseCsvFile(file: File) {
  const { addCustomOption } = useIcons()
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (result) => {
      const fields = (result as Papa.ParseResult<Record<string, string>>).meta?.fields ?? []
      const { items: processed, customTags: csvTags } = parseMenuRows(
        result.data,
        fields,
        generateId,
      )

      // Register any unknown option columns from CSV into iconMap
      const knownOptions = Object.keys(iconMap.value)
      for (const tag of csvTags.filter((t) => !knownOptions.includes(t))) {
        addCustomOption(tag, UndefinedIcon['Undefined']!)
      }

      await nextTick()

      emit('csvLoaded', processed)
      menuStore.items = processed
    },
  })
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  loadFile(file)
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

  const csv = menuStore.exportToCSV(props.items, customTags.value)

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
  <div class="flex gap-2 flex-1 min-w-0">
    <div
      class="flex-1 min-w-0 border-2 border-dashed rounded-lg px-2 py-1 cursor-pointer flex flex-col items-center justify-center hover:bg-blue-500 transition-colors group"
      :class="csvState.isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="fileInput?.click()"
      :title="fileName ?? 'Click to choose a CSV file, or drop one here'"
    >
      <!-- Text -->
      <div class="text-container min-w-0 w-full">
        <div class="text-gray-600 text-center group-hover:text-white transition-colors text-sm">
          <p class="truncate">
            {{ fileName ? fileName : 'Upload CSV' }}
          </p>
          <p class="text-xs">or drop it here</p>
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
          accept=".csv,text/csv"
          ref="fileInput"
          class="hidden"
          @change="handleFileChange"
        />
      </div>
    </div>
    <!-- Export CVS-->
    <div class="flex">
      <button
        @click="downloadCSV"
        class="border-blue-500 px-2 py-1 rounded-lg hover:bg-blue-700 hover:text-white border transition-colors duration-200 shadow-md"
      >
        Export CSV
      </button>
    </div>
  </div>
</template>

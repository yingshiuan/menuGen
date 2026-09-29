<script lang="ts" setup>
import { ref, reactive, computed, nextTick, shallowRef } from 'vue'
import Papa from 'papaparse'
import type { MenuItem } from '@/types/types'
import { useMenuStore } from '@/stores/menu'
import { useIcons, UndefinedIcon } from '@/composables/useIcons'
import { generateId, isDietaryKey } from '@/domain/menuItem'
import { parseMenuRows } from '@/domain/menuCsv'
import { isSpreadsheet, readWorkbook, type Workbook } from '@/domain/menuSheet'

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

// `accept` only filters the file picker, and a drop skips it, so every file is checked here.
// By extension: browsers report a CSV as text/csv, application/vnd.ms-excel or nothing at all.
function fileProblem(file: File): string | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || isSpreadsheet(name)) return null
  return `“${file.name}” is not a menu sheet. Please upload a .csv, .xlsx or .numbers file.`
}

// A multi-sheet workbook stays open so another sheet can be picked without re-uploading
const workbook = shallowRef<Workbook | null>(null)
const sheetName = ref('')

type Rows = Papa.ParseResult<Record<string, string>>

const parseConfig = {
  header: true,
  skipEmptyLines: true,
  complete: (result: { data: Record<string, string>[] }) => applyRows(result as Rows),
}

async function loadFile(file: File) {
  const problem = fileProblem(file)
  if (problem) {
    alert(problem)
    return
  }
  workbook.value = null
  if (!isSpreadsheet(file.name)) {
    fileName.value = file.name
    Papa.parse<Record<string, string>>(file, parseConfig)
    return
  }

  let wb: Workbook
  try {
    wb = await readWorkbook(file)
  } catch {
    alert(
      `“${file.name}” couldn’t be read. Re-save it in a current version of Numbers or Excel, or export it as CSV.`,
    )
    return
  }
  if (!wb.sheetNames.length) {
    alert(`“${file.name}” has no filled sheet.`)
    return
  }
  fileName.value = file.name
  workbook.value = wb
  loadSheet(wb.sheetNames[0]!)
}

function loadSheet(name: string) {
  if (!workbook.value) return
  sheetName.value = name
  Papa.parse<Record<string, string>>(workbook.value.toCsv(name), parseConfig)
}

async function applyRows(result: Rows) {
  const { addCustomOption } = useIcons()
  const fields = result.meta?.fields ?? []
  const { items: processed, customTags: csvTags } = parseMenuRows(result.data, fields, generateId)

  // Register any unknown option columns from CSV into iconMap
  const knownOptions = Object.keys(iconMap.value)
  for (const tag of csvTags.filter((t) => !knownOptions.includes(t))) {
    addCustomOption(tag, UndefinedIcon['Undefined']!)
  }

  await nextTick()

  emit('csvLoaded', processed)
  menuStore.items = processed
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
  <div class="flex flex-col gap-1.5 flex-1 min-w-0">
    <div class="flex gap-2 min-w-0">
      <div
        class="flex-1 min-w-0 border-2 border-dashed rounded-lg px-2 py-1 cursor-pointer flex flex-col items-center justify-center hover:bg-blue-500 transition-colors group"
        :class="csvState.isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="fileInput?.click()"
        :title="fileName ?? 'Click to choose a CSV, Excel or Numbers file, or drop one here'"
      >
        <!-- Text -->
        <div class="text-container min-w-0 w-full">
          <div class="text-gray-600 text-center group-hover:text-white transition-colors text-sm">
            <p class="truncate">
              {{ fileName ? fileName : 'Upload menu' }}
            </p>
            <p class="text-xs">{{ fileName ? 'or drop another' : 'CSV, Excel or Numbers' }}</p>
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
            accept=".csv,text/csv,.xlsx,.xls,.numbers"
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

    <!-- Sheet tabs of a multi-sheet workbook; picking another reloads the menu from it -->
    <div
      v-if="workbook && workbook.sheetNames.length > 1"
      role="tablist"
      aria-label="Sheet"
      class="flex gap-0.5 p-0.5 rounded-lg bg-gray-100 border border-gray-200 overflow-x-auto"
    >
      <button
        v-for="name in workbook.sheetNames"
        :key="name"
        type="button"
        role="tab"
        :aria-selected="name === sheetName"
        :title="name"
        class="flex-1 min-w-0 max-w-40 truncate px-2 py-0.5 text-xs rounded-md transition-colors"
        :class="
          name === sheetName
            ? 'bg-white text-blue-600 font-medium shadow-sm'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
        "
        @click="name !== sheetName && loadSheet(name)"
      >
        {{ name }}
      </button>
    </div>
  </div>
</template>

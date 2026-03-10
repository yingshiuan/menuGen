<script lang="ts" setup>
import { computed, reactive, onMounted } from 'vue'

const { width, height } = defineProps<{ width: string; height: string }>()
const emit = defineEmits<{
  (e: 'update:width', value: string): void
  (e: 'update:height', value: string): void
}>()

const pageState = reactive({
  startX: 0,
  startValue: 0,
  active: null as 'width' | 'height' | null,
  minWidth: 125,
  maxWidth: 841,
  minHeight: 150,
  maxHeight: 1189,
  isCustom: false,
  selectedPaper: 'A4',
})

const paperSizes = [
  // A series
  { name: 'A5', width: 148, height: 210 },
  { name: 'A4', width: 210, height: 297 },
  { name: 'A3', width: 297, height: 420 },
  { name: 'A2', width: 420, height: 594 },
  { name: 'A1', width: 594, height: 841 },
  { name: 'A0', width: 841, height: 1189 },

  // B series
  { name: 'B5', width: 176, height: 250 },
  { name: 'B4', width: 250, height: 353 },
  { name: 'B3', width: 353, height: 500 },
  { name: 'B2', width: 500, height: 707 },
  { name: 'B1', width: 707, height: 1000 },
  { name: 'B0', width: 1000, height: 1414 },
]

function parseValue(val: string) {
  return parseInt(val.replace('mm', '').trim()) || 0
}

// --- Drag logic ---
function startDrag(e: PointerEvent, field: 'width' | 'height') {
  pageState.active = field
  pageState.startX = e.clientX
  pageState.startValue = parseValue(field === 'width' ? width : height)

  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag)
}

function onDrag(e: PointerEvent) {
  if (!pageState.active || !pageState.isCustom) return // only allow drag in custom mode
  const delta = e.clientX - pageState.startX
  const next =
    pageState.active === 'width'
      ? Math.max(
          pageState.minWidth,
          Math.min(pageState.maxWidth, pageState.startValue + Math.round(delta / 5)),
        )
      : Math.max(
          pageState.minHeight,
          Math.min(pageState.maxHeight, pageState.startValue + Math.round(delta / 5)),
        )

  if (pageState.active === 'width') emit('update:width', next + 'mm')
  else emit('update:height', next + 'mm')
}

function stopDrag() {
  pageState.active = null
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
}

// --- Computed v-models ---
const widthNumber = computed({
  get: () => parseValue(width),
  set: (val: number) => emit('update:width', val + 'mm'), // don't clamp yet
})

const heightNumber = computed({
  get: () => parseValue(height),
  set: (val: number) => emit('update:height', val + 'mm'),
})

// --- Clamp size on blur / Enter ---
function clampWidth(e: Event | KeyboardEvent) {
  if (e instanceof KeyboardEvent && e.key !== 'Enter') return
  const input = e.target as HTMLInputElement
  let val = parseInt(input.value) || 0
  val = Math.min(pageState.maxWidth, Math.max(pageState.minWidth, val))
  emit('update:width', val + 'mm')
}

function clampHeight(e: Event | KeyboardEvent) {
  if (e instanceof KeyboardEvent && e.key !== 'Enter') return
  const input = e.target as HTMLInputElement
  let val = parseInt(input.value) || 0
  val = Math.min(pageState.maxHeight, Math.max(pageState.minHeight, val))
  emit('update:height', val + 'mm')
}

function selectPaperSize() {
  const paper = paperSizes.find((p) => p.name === pageState.selectedPaper)
  if (paper) {
    emit('update:width', paper.width + 'mm')
    emit('update:height', paper.height + 'mm')
    pageState.isCustom = false
  }
}

onMounted(() => {
  selectPaperSize()
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Paper size selector -->
    <div class="flex items-center gap-2">
      <label>Paper Size</label>
      <select
        v-model="pageState.selectedPaper"
        @change="selectPaperSize"
        :disabled="pageState.isCustom"
        class="border p-1 rounded"
      >
        <option value="">Select</option>
        <option v-for="p in paperSizes" :key="p.name" :value="p.name">
          {{ p.name }} ({{ p.width }} × {{ p.height }} mm)
        </option>
      </select>
    </div>

    <div class="flex gap-2 items-center">
      <input type="checkbox" class="w-4 h-4" v-model="pageState.isCustom" />
      <label>Custom</label>
      <!-- Width -->
      <label class="flex items-center select-none gap-1">
        <span
          class="cursor-ew-resize"
          v-if="pageState.isCustom"
          @pointerdown.prevent="(e) => startDrag(e, 'width')"
        >
          W
        </span>

        <input
          type="number"
          v-model.number="widthNumber"
          @blur="clampWidth"
          @keyup.enter="clampWidth"
          :min="pageState.minWidth"
          :max="pageState.maxWidth"
          :readonly="!pageState.isCustom"
          class="border p-1 rounded"
        />

        <span>mm</span>
      </label>

      <!-- Height -->
      <label class="flex items-center select-none gap-1">
        <span
          class="cursor-ew-resize"
          v-if="pageState.isCustom"
          @pointerdown.prevent="(e) => startDrag(e, 'height')"
        >
          H
        </span>

        <input
          type="number"
          v-model.number="heightNumber"
          @blur="clampHeight"
          @keyup.enter="clampHeight"
          :min="pageState.minHeight"
          :max="pageState.maxHeight"
          :readonly="!pageState.isCustom"
          class="border p-1 rounded"
        />

        <span>mm</span>
      </label>
    </div>
  </div>
</template>

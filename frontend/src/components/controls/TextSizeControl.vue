<script lang="ts" setup>
import { clampSize } from '@/domain/sizes'
import {
  DEFAULT_TEXT_SIZES,
  TEXT_SIZE_RANGES,
  useMenuTypography,
  type TextSizeKey,
} from '@/composables/useMenuTypography'

const { textSizes, resetTextSizes } = useMenuTypography()

const rows: { key: TextSizeKey; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'name', label: 'Dish name' },
  { key: 'description', label: 'Description' },
]

function clamp(key: TextSizeKey) {
  textSizes[key] = clampSize(textSizes[key], TEXT_SIZE_RANGES[key], DEFAULT_TEXT_SIZES[key])
}
</script>

<template>
  <div class="flex flex-col gap-1 text-sm">
    <label v-for="row in rows" :key="row.key" class="flex items-center gap-2">
      <span class="w-24 shrink-0">{{ row.label }}</span>
      <input
        type="number"
        v-model.number="textSizes[row.key]"
        :min="TEXT_SIZE_RANGES[row.key].min"
        :max="TEXT_SIZE_RANGES[row.key].max"
        step="0.5"
        @change="clamp(row.key)"
        class="border p-1 rounded w-20"
      />
      pt
    </label>
    <div class="pl-26">
      <button
        type="button"
        @click="resetTextSizes"
        class="p-1 bg-gray-200 rounded hover:bg-gray-300"
      >
        Reset
      </button>
    </div>
  </div>
</template>

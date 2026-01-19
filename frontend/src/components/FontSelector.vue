<script lang="ts" setup>
import { ref, watch } from 'vue'

const emit = defineEmits<{
  (e: 'update:font', font: string): void
}>()

interface FontOption {
  label: string
  value: string
}

const fonts: FontOption[] = [
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Arial', value: "'Arial', sans-serif" },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
]

const selectedFont = ref<string>(fonts[0]?.value || 'sans-serif')

watch(selectedFont, (newFont) => emit('update:font', newFont))

</script>

<template>
  <div class="flex items-center gap-2">
    <label for="fontSelect" class="font-medium">Select font</label>
    <select
      id="fontSelect"
      v-model="selectedFont"
      class="border px-2 py-1 rounded"
      :style="{ fontFamily: selectedFont }"
    >
      <option
        v-for="font in fonts"
        :key="font.value"
        :value="font.value"
        :style="{ fontFamily: font.value }"
      >
        {{ font.label }}
      </option>
    </select>
  </div>
</template>



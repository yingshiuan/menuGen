<script lang="ts" setup>
import { defineEmits } from 'vue'

const { width, height } = defineProps<{ width: string; height: string }>()

const emit = defineEmits<{
  (e: 'update:width', value: string): void
  (e: 'update:height', value: string): void
}>()

function onWidthInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:width', target.value)
}

function onHeightInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:height', target.value)
}
</script>

<template>
  <div class="flex gap-2 items-center mb-4">
    <label class="flex items-center gap-1">
      Width:
      <input
        type="text"
        :value="width"
        @input="onWidthInput"
        class="border p-1 rounded"
      />
    </label>

    <label class="flex items-center gap-1">
      Height:
      <input
        type="text"
        :value="height"
        @input="onHeightInput"
        class="border p-1 rounded"
      />
    </label>
  </div>
</template>

<style scoped>
input {
  width: 80px;
}
</style>

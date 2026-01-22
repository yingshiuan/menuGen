<script lang="ts" setup>

export type ItemSpacing = 'compact' | 'normal' | 'spacious' | 'fill'

const props = defineProps<{
  modelValue: ItemSpacing
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ItemSpacing): void
}>()

// Options for item spacing, matching MenuPreview.vue
const options: { label: string; value: ItemSpacing }[] = [
  { label: 'Compact', value: 'compact' },
//   { label: 'Normal', value: 'normal' },
//   { label: 'Spacious', value: 'spacious' },
  { label: 'Fill page', value: 'fill' },
]
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="font-medium">Item spacing</label>

    <select
      class="border rounded px-2 py-1"
      :value="props.modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as ItemSpacing)"
    >
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

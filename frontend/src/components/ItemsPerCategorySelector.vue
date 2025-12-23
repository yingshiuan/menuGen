<script lang="ts" setup>
const props = defineProps<{
  itemsPerPage: number
  keepCategoryTogether?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:itemsPerPage', value: number): void
  (e: 'update:keepCategoryTogether', value: boolean): void
}>()

function handleChange(value: string) {
  const num = parseInt(value, 10)
  if (!isNaN(num) && num > 0) {
    emit('update:itemsPerPage', num)
  }
}

function handleCategoryToggle(value: boolean) {
  emit('update:keepCategoryTogether', value)
}
</script>

<template>
  <div class="flex flex-row gap-2">
    <div class="flex items-center">
      <label>Items Per Page:</label>
      <input
        type="number"
        :value="props.itemsPerPage"
        min="1"
        max="20"
        class="border rounded p-1"
        @change="(e) => handleChange((e.target as HTMLInputElement).value)"
      />
      <!-- <p class="text-xs text-gray-500">Current: {{ props.itemsPerPage }} items per page</p> -->
    </div>

    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        id="keepCategoryTogether"
        :checked="props.keepCategoryTogether"
        class="w-4 h-4"
        @change="(e) => handleCategoryToggle((e.target as HTMLInputElement).checked)"
      />
      <label for="keepCategoryTogether">Keep category together on page</label>
    </div>
  </div>
</template>

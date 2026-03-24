<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  itemsPerPage: number
  keepCategoryTogether?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:itemsPerPage', value: number): void
  (e: 'update:keepCategoryTogether', value: boolean): void
}>()

const itemsPerPageModel = computed({
  get: () => props.itemsPerPage,
  set: (value: number) => {
    let num = value

    if (num < 1) num = 1
    if (num > 11) num = 10

    emit('update:itemsPerPage', num)
  },
})

const keepCategoryModel = computed({
  get: () => props.keepCategoryTogether,
  set: (value: boolean) => {
    emit('update:keepCategoryTogether', value)
  },
})

</script>

<template>
  <div class="flex flex-col gap-2 text-sm mt-1">
    <div class="flex items-center gap-2">
      <label>Items Per Page</label>
      <input
        type="number"
        v-model.number="itemsPerPageModel"
        min="1"
        max="11"
        class="border rounded p-1"
      />
      <!-- <p class="text-xs text-gray-500">Current: {{ props.itemsPerPage }} items per page</p> -->
    </div>

    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        v-model="keepCategoryModel"
        id="keepCategoryTogether"
        class="w-4 h-4"
      />
      <label for="keepCategoryTogether text-xs">Keep items together on the same page</label>
    </div>
  </div>
</template>

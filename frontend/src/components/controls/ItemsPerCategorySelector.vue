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
  <div class="flex flex-col gap-2 text-sm">
    <label class="pl-26 flex items-center gap-2">
      <input
        type="checkbox"
        v-model="keepCategoryModel"
        id="keepCategoryTogether"
        class="w-4 h-4"
      />
      Keep categories together
    </label>

    <!-- Keeping categories together ignores this limit, so it is locked meanwhile -->
    <label
      class="flex items-center gap-2"
      :class="{ 'opacity-50': keepCategoryModel }"
      :title="keepCategoryModel ? 'Not used while categories are kept together' : undefined"
    >
      <span class="w-24 shrink-0">Per page</span>
      <input
        type="number"
        v-model.number="itemsPerPageModel"
        min="1"
        max="11"
        :disabled="keepCategoryModel"
        class="border rounded p-1 w-20"
      />
      dishes
    </label>
  </div>
</template>

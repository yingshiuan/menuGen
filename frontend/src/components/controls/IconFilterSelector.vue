<script lang="ts" setup>
import { computed } from 'vue'
import type { MenuItem } from '@/types/types'
import { filterByIcons } from '@/domain/menuItem'
import { useIcons } from '@/composables/useIcons'

const props = defineProps<{
  modelValue: string[]
  items: MenuItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

// The icons and labels as the menu prints them, so a custom icon or rename shows here too
const { iconMap, getDisplayLabel } = useIcons()
const options = computed(() => Object.keys(iconMap.value))

const count = (key: string) => filterByIcons(props.items, [key]).length
const shownCount = computed(() => filterByIcons(props.items, props.modelValue).length)

function toggle(key: string, checked: boolean) {
  emit(
    'update:modelValue',
    checked ? [...props.modelValue, key] : props.modelValue.filter((k) => k !== key),
  )
}
</script>

<template>
  <div class="flex items-start gap-2 text-sm">
    <span class="w-24 shrink-0">Show only</span>
    <div class="flex flex-col gap-1 min-w-0">
      <div class="flex flex-wrap gap-x-3 gap-y-1">
        <label v-for="key in options" :key="key" class="flex items-center gap-1">
          <input
            type="checkbox"
            class="w-4 h-4"
            :checked="modelValue.includes(key)"
            @change="toggle(key, ($event.target as HTMLInputElement).checked)"
          />
          <img :src="iconMap[key]" alt="" class="w-4 h-4" />
          {{ getDisplayLabel(key) }}
          <span class="text-gray-500">{{ count(key) }}</span>
        </label>
      </div>
      <p v-if="modelValue.length" class="text-xs text-gray-500">
        Dishes with any ticked icon: {{ shownCount }} of {{ items.length }}
      </p>
    </div>
  </div>
</template>

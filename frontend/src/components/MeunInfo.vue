<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue'
import type { MenuOption } from '@/types/types'

import RecommendedIcon from '@/asset/svg/recommend.svg'
import SpicyIcon from '@/asset/svg/spicy.svg'
import VeganIcon from '@/asset/svg/vegan.svg'
import VegetarianIcon from '@/asset/svg/vegetarian.svg'
import GlutenFreeIcon from '@/asset/svg/glutenfree.svg'

const props = defineProps<{
  modelValue?: MenuOption[]
  footerText: string
  readonly?: boolean
  showAll: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: MenuOption[]): void
  (e: 'update:footerText', value: string): void
}>()

const iconMap: Record<MenuOption, string> = {
  Recommend: RecommendedIcon,
  Spicy: SpicyIcon,
  Vegan: VeganIcon,
  Vegetarian: VegetarianIcon,
  'Gluten Free': GlutenFreeIcon,
}

const allOptions = Object.keys(iconMap) as MenuOption[]
const selected = ref<MenuOption[]>(props.modelValue?.length ? props.modelValue : [...allOptions])
const infoText = ref(props.footerText)
const editingInfo = ref(false)

watch(
  selected,
  (val) => {
    emit('update:modelValue', val)
  },
  { deep: true },
)

function toggle(option: MenuOption) {
  if (props.readonly) return
  const idx = selected.value.indexOf(option)
  idx >= 0 ? selected.value.splice(idx, 1) : selected.value.push(option)
}


watch(
  () => props.footerText,
  (val) => {
    infoText.value = val 
  },
  { immediate: true },
)


watch(infoText, (newText) => {
  emit('update:footerText', newText)
})

function startEditingInfo() {
  if (props.readonly) return
  editingInfo.value = true
  nextTick(() => {
    const el = document.getElementById('infoText')
    el?.focus()
  })
}

function stopEditingInfo() {
  editingInfo.value = false
}
</script>

<template>
  <div class="flex flex-col w-full text-xs">
    <!-- ICON + INFO ROW -->
    <div class="flex flex-wrap justify-between items-center w-full gap-2">
      <!-- ICONS -->
      <div class="flex gap-4 items-center flex-wrap">
        <div v-for="opt in allOptions" :key="opt" class="flex items-center gap-1">
          <img
            :src="iconMap[opt]"
            class="w-4 h-4 cursor-pointer transition-opacity"
            :class="{
              'opacity-100': selected.includes(opt),
              'opacity-30': !selected.includes(opt),
              'pointer-events-none': readonly,
            }"
            @click="toggle(opt)"
            :title="opt"
          />
          <span>{{ opt }}</span>
        </div>
      </div>

      <!-- INFO TEXT -->
      <div class="flex flex-grow justify-end">
        <!-- readonly or not editing -->
        <span
          v-if="props.readonly || !editingInfo"
          @click="startEditingInfo"
          :title="props.readonly ? '' : 'Click to edit'"
        >
          {{ infoText }}
        </span>

        <!-- editing -->
        <textarea
          v-else
          id="infoText"
          v-model="infoText"
          rows="1"
          class="text-xs border w-full max-w-xs whitespace-nowrap"
          @blur="stopEditingInfo"
          @keyup.enter="stopEditingInfo"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import type { MenuOption } from '@/types/types'
import { useIcons } from '@/composables/useIcons.ts'
import ImageCropper from '@/components/ImageCropper.vue'

const icons = useIcons()
const { setUserIcon, resetIcon, userIcons } = icons

onMounted(() => {
  const saved = localStorage.getItem('menu-user-icons')
  if (saved) {
    Object.assign(userIcons.value, JSON.parse(saved))
  }
})

const options = Object.keys(icons.iconMap.value) as MenuOption[]
// Store defaults BEFORE any user icons are applied
const defaultIcons = { ...icons.iconMap.value } as Record<MenuOption, string>
const resetCounters = reactive<Partial<Record<MenuOption, number>>>({})


interface IconState {
  isExpanded: boolean
}

const iconState = reactive<IconState>({
  isExpanded: false,
})

function toggleExpand() {
  iconState.isExpanded = !iconState.isExpanded
}

function handleIconChange(opt: MenuOption, val: string | null) {
  if (val) setUserIcon(opt, val)
}

function handleReset(opt: MenuOption) {
  resetIcon(opt)
  resetCounters[opt] = (resetCounters[opt] ?? 0) + 1 
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center">
      <button
        @click="toggleExpand"
        class="flex items-center gap-1"
        title="Click to customize icons"
      >
        <span>{{ iconState.isExpanded ? '▼' : '▶' }}</span>
        <span>Customize Icons</span>
      </button>
    </div>

    <!-- Icon Uploads -->
    <div
      v-if="iconState.isExpanded"
      class="space-y-3 p-1 transition-all duration-200 border rounded bg-gray-50 overflow-y-scroll"
    >
      <div v-for="opt in options" :key="opt" class="flex items-center gap-3">
        <!-- Label -->
        <span class="text-xs w-20 shrink-0">{{ opt }}</span>

        <!-- Current icon preview -->
        <!-- <img :src="icons.iconMap.value[opt]" class="w-6 h-6 shrink-0" /> -->

        <!-- Default icon (original) -->
        <div class="shrink-0 flex flex-col items-center gap-0.5">
          <img :src="defaultIcons[opt]" class="w-5 h-5 opacity-100" :title="`Default: ${opt}`" />
          <!-- <span class="text-[9px] text-gray-400">default</span> -->
        </div>

        <!-- Arrow -->
        <span class="text-xs shrink-0">→</span>

        <!-- ImageCropper for this icon -->
        <div class="h-6 flex items-center">
          <ImageCropper
            :key="`${opt}-${resetCounters[opt] ?? 0}`"
            :model-value="icons.iconMap.value[opt]"
            variant="icon"
            :aspect-ratio="1"
            :crop-width="24"
            :crop-height="24"
            @update:model-value="(val) => handleIconChange(opt, val)"
          />
        </div>

        <!-- Reset Button -->
        <button
          class="p-1 text-xs bg-gray-200 rounded hover:bg-gray-300 shrink-0 ml-auto"
          @click="handleReset(opt)"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

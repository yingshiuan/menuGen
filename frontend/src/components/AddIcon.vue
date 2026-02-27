<script setup lang="ts">
import { reactive } from 'vue'
import type { MenuOption } from '@/types/types'
import { useIcons } from '@/composables/useIcons.ts'
import { useImageUpload } from '@/composables/useImageUpload.ts'

// Grab icons composable
const icons = useIcons() as {
  iconMap: import('vue').ComputedRef<Record<MenuOption, string>>
  setUserIcon: (option: MenuOption, base64: string) => void
  resetIcon: (option: MenuOption) => void
}
const { setUserIcon, resetIcon } = icons
const options = Object.keys(icons.iconMap.value) as MenuOption[]

// Keep track of expanded state & active drag option
interface IconState {
  isExpanded: boolean
  draggingOption: MenuOption | null
}

const iconState = reactive<IconState>({
  isExpanded: false,
  draggingOption: null,
})

// Initialize useImageUpload per MenuOption
const uploads: Record<MenuOption, ReturnType<typeof useImageUpload>> = {} as Record<
  MenuOption,
  ReturnType<typeof useImageUpload>
>

options.forEach((opt) => {
  uploads[opt] = useImageUpload(
    icons.iconMap.value[opt], // initial value
    false, // readonly
    (val) => setUserIcon(opt, val), // emit updates iconMap
    (dragging) => (iconState.draggingOption = dragging ? opt : null) // update active dropzone
  )
})

function toggleExpand() {
  iconState.isExpanded = !iconState.isExpanded
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center">
      <button
        @click="toggleExpand"
        class="flex items-center gap-1"
        title="Click to upload the icon"
      >
        <span>{{ iconState.isExpanded ? '▼' : '▶' }}</span>
        <span>Customize Icons</span>
      </button>
    </div>

    <!-- Icon Uploads -->
    <div
      v-if="iconState.isExpanded"
      class="space-y-2 p-1 transition-all duration-200 border rounded bg-gray-50 overflow-y-scroll"
    >
      <div v-for="opt in options" :key="opt" class="flex items-center gap-3">
        <!-- Dropzone -->
        <div
          class="flex items-center gap-4 p-1 flex-1 rounded border border-dashed transition-colors cursor-pointer group"
          :class="{
            'border-blue-500 bg-blue-50': iconState.draggingOption === opt,
            'border-gray-300 hover:bg-blue-50 hover:border-blue-500':
              iconState.draggingOption !== opt,
          }"
          @dragover.prevent="uploads[opt].handleDragOver"
          @dragleave="uploads[opt].handleDragLeave"
          @drop.prevent="uploads[opt].handleDrop"
          @click="uploads[opt].triggerUpload"
        >
          <!-- Icon Image -->
          <img :src="uploads[opt].displayedPicture.value" class="w-6 h-6" />

          <!-- Instruction -->
          <p class="text-sm text-center text-gray-600 flex-1 group-hover:text-blue-500">
            Drag & drop or click to upload
          </p>

          <!-- Hidden File Input -->
          <input
            type="file"
            class="hidden"
            accept="image/*"
            :ref="el => (uploads[opt].fileInputRef.value = el as HTMLInputElement)"
            @change="uploads[opt].uploadPicture"
          />
        </div>

        <!-- Reset Button -->
        <button
          class="p-1 bg-gray-200 rounded hover:bg-gray-300"
          @click="
            resetIcon(opt);
            uploads[opt].setPicture(icons.iconMap.value[opt])
          "
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>
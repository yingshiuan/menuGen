<script setup lang="ts">
import { reactive } from 'vue'
import type { MenuOption } from '@/types/types'
import { useIcons } from '@/composables/useIcons'

const { iconMap, setUserIcon, resetIcon } = useIcons()

const options = Object.keys(iconMap.value) as MenuOption[]

interface IconState {
  isExpanded: boolean
  draggingOption: MenuOption | null
}

const iconState = reactive<IconState>({
  isExpanded: false,
  draggingOption: null,
})

function uploadIcon(option: MenuOption, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    setUserIcon(option, reader.result as string)
  }

  reader.readAsDataURL(file)
}

function toggleExpand() {
  iconState.isExpanded = !iconState.isExpanded
}

// ----- Drag & Drop functions -----
function onDragOver(option: MenuOption, event: DragEvent) {
  event.preventDefault()
  iconState.draggingOption = option
}

function onDragLeave(option: MenuOption) {
  if (iconState.draggingOption === option) iconState.draggingOption = null
}

function onDrop(option: MenuOption, event: DragEvent) {
  event.preventDefault()
  iconState.draggingOption = null

  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    setUserIcon(option, reader.result as string)
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div>
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

    <div
      v-if="iconState.isExpanded"
      class="space-y-2 p-2 transition-all duration-200 border rounded bg-gray-50 overflow-y-scroll"
    >
      <div
        v-for="opt in options"
        :key="opt"
        class="flex items-center gap-4 p-1 rounded border border-dashed transition-colors"
        :class="{
          'border-blue-500 bg-blue-50': iconState.draggingOption === opt,
          'border-gray-300': iconState.draggingOption !== opt,
        }"
        @dragover="(e) => onDragOver(opt, e)"
        @dragleave="() => onDragLeave(opt)"
        @drop="(e) => onDrop(opt, e)"
      >
        <img :src="iconMap[opt]" class="w-6 h-6" />

        <label
          class="bg-blue-500 p-1 text-sm text-white rounded hover:bg-blue-700 hover:text-white transition-colors duration-200 shadow-md"
        >
          Upload
          <input type="file" class="hidden" accept="image/*" @change="(e) => uploadIcon(opt, e)" />
        </label>

        <button class="p-1 text-sm bg-gray-200 rounded hover:bg-gray-300" @click="resetIcon(opt)">
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

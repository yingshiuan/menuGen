<script setup lang="ts">
import { reactive, ref } from 'vue'
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

const fileInputs = ref<Record<MenuOption, HTMLInputElement | null>>(
  {} as Record<MenuOption, HTMLInputElement | null>,
)

function handleFile(option: MenuOption, file: File) {
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

function uploadIcon(option: MenuOption, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  handleFile(option, file)
}

function toggleExpand() {
  iconState.isExpanded = !iconState.isExpanded
}

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

  handleFile(option, file)
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
          @dragover="(e) => onDragOver(opt, e)"
          @dragleave="() => onDragLeave(opt)"
          @drop="(e) => onDrop(opt, e)"
          @click="fileInputs[opt]?.click()"
        >
          <!-- Icon -->
          <img :src="iconMap[opt]" class="w-6 h-6" />
          <!-- Text -->
          <p class="text-sm text-center text-gray-600 flex-1 group-hover:text-blue-500">Drag & drop or click to upload</p>
          <!-- Hidden File Input -->
          <input
            type="file"
            class="hidden"
            accept="image/*"
            :ref="(el) => (fileInputs[opt] = el as HTMLInputElement)"
            @change="(e) => uploadIcon(opt, e)"
          />
        </div>
        <!-- Reset Button (Outside Dropzone) -->
        <button class="p-1 bg-gray-200 rounded hover:bg-gray-300" @click="resetIcon(opt)">
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

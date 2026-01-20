<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import type { MenuItem } from '@/types/types'

// Props
const props = defineProps<{
  menuItems: MenuItem[]
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:item', item: MenuItem): void
}>()

interface ImageState {
  isDragging: boolean
  isExpanded: boolean
  isUploading: boolean
}

const imageState = reactive<ImageState>({
  isDragging: false,
  isExpanded: false,
  isUploading: false,
})

const inputRef = ref<HTMLInputElement | null>(null)
const uploadingFiles = ref<Set<string>>(new Set())

const allPictures = computed(() =>
  props.menuItems.flatMap((item) =>
    (item.images ?? []).map((img) => ({
      ...img,
      key: `${item.No ?? item.Name}-${img.name}`,
    })),
  ),
)

function triggerUpload() {
  inputRef.value?.click()
}

async function compressImage(
  file: File,
  maxWidth = 200,
  maxHeight = 200,
  quality = 1,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = () => {
      img.src = reader.result as string
    }

    img.onload = () => {
      let { width, height } = img

      // Maintain aspect ratio
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const base64 = canvas.toDataURL('image/jpeg', quality) // JPEG compression
      resolve(base64)
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleFiles(files: FileList | File[]) {
  const updatedItems: Set<MenuItem> = new Set()
  imageState.isUploading = true

  const promises = Array.from(files).map(async (file) => {
    if (!file.type.startsWith('image/')) return

    // Add file to uploading state
    uploadingFiles.value.add(file.name)

    try {
      const base64 = await compressImage(file)
      const filename = file.name.replace(/\.[^/.]+$/, '')

      const matched = props.menuItems.find(
        (item) =>
          item.Name === filename ||
          (item.No && filename === `${item.No.toString().padStart(2, '0')}_${item.Name}`),
      )
      if (!matched) return

      const pictures = matched.images ?? []
      const existing = pictures.find((p) => p.name === filename)
      if (existing) existing.base64 = base64
      else pictures.push({ name: filename, base64 })
      matched.images = pictures

      matched.mainImageBase64 = base64
      matched.lastUpdated = Date.now()
      emit('update:item', matched)
      updatedItems.add(matched)
    } finally {
      // Remove file from uploading state
      uploadingFiles.value.delete(file.name)
    }
  })

  await Promise.all(promises)

  if (inputRef.value) inputRef.value.value = ''
  imageState.isUploading = false
}

function onFilesSelected(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  handleFiles(files)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  imageState.isDragging = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  imageState.isDragging = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  imageState.isDragging = false
  if (!e.dataTransfer?.files) return
  handleFiles(e.dataTransfer.files)
}

function toggleExpand() {
  imageState.isExpanded = !imageState.isExpanded
}
</script>

<template>
  <div>
    <!-- Upload area -->
    <div
      class="p-4 border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center gap-4 hover:bg-blue-500 transition-colors group"
      :class="imageState.isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'"
      @click="triggerUpload"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div class="text-gray-600 text-center group-hover:text-white transition-colors">
        <p v-if="!imageState.isUploading">Click or drag pictures here to upload</p>
        <div v-else class="loader w-6 h-6"></div>
      </div>
    </div>

    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onFilesSelected"
    />

    <!-- Toggle preview -->
    <button @click="toggleExpand" class="flex items-center gap-1 mt-2">
      <span>{{ imageState.isExpanded ? '▼' : '▶' }}</span>
      <span>Preview Uploaded Pictures</span>
    </button>

    <!-- Preview uploaded files -->
    <div
      v-show="imageState.isExpanded"
      class="flex flex-wrap gap-2 mt-2 p-2 transition-all duration-200 border rounded bg-gray-50 h-60 overflow-y-scroll"
    >
      <div v-if="allPictures.length === 0">
        <p class="text-gray-400 italic m-auto">No file uploaded</p>
      </div>

      <div v-else>
        <div v-for="pic in allPictures" :key="pic.key" class="flex items-center">
          <img
            v-if="!uploadingFiles.has(pic.name)"
            :src="pic.base64"
            alt="Uploaded image"
            class="w-16 h-16 object-cover rounded"
          />
          <!-- Spinner while uploading -->
          <div v-else class="loader w-16 h-16"></div>

          <span class="text-sm ml-1">{{ pic.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from '@/types/types'
import { useMultiImageUpload, type SkippedFile } from '@/composables/useMultiImageUpload'

const reasonText: Record<SkippedFile['reason'], string> = {
  'no-match': 'no dish matches this filename',
  'not-an-image': 'not an image file',
  'not-readable': 'could not be read as an image',
}

// Props
const props = defineProps<{
  menuItems: MenuItem[]
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:item', item: MenuItem): void
  (e: 'update:menuItems', items: MenuItem[]): void
}>()

// Use multi-image composable
const {
  inputRef,
  uploadingFiles,
  skippedFiles,
  lastBatchSize,
  dismissSkipped,
  imageState,
  allPictures,
  triggerUpload,
  deleteImage,
  onFilesSelected,
  onDragOver,
  onDragLeave,
  onDrop,
  toggleExpand,
} = useMultiImageUpload(props, emit)
</script>

<template>
  <div>
    <div>
      <p>Multi Image Upload</p>
    </div>

    <!-- Upload area -->
    <div
      class="p-3 border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center gap-4 hover:bg-blue-500 transition-colors group"
      :class="imageState.isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'"
      @click="triggerUpload"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div class="text-gray-600 text-center group-hover:text-white transition-colors text-sm">
        <p v-if="!imageState.isUploading">Click or drag images here to upload</p>
        <div v-else class="loader w-6 h-6"></div>
      </div>
    </div>

    <!-- Files the last drop could not place -->
    <div
      v-if="skippedFiles.length"
      class="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900"
      role="status"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="font-medium">
          {{ skippedFiles.length }} of {{ lastBatchSize }}
          {{ lastBatchSize === 1 ? 'file was' : 'files were' }} not added
        </p>
        <button
          @click.stop="dismissSkipped"
          class="cursor-pointer px-1 leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      <ul class="mt-1 list-disc pl-4">
        <li v-for="file in skippedFiles" :key="file.name">
          <span class="font-mono">{{ file.name }}</span>{{ ' — ' + reasonText[file.reason] }}
        </li>
      </ul>
      <p class="mt-1">Rename to <strong>No_Name</strong> and drop it again.</p>
    </div>

    <div>
      <p class="text-sm text-gray-600">
        Please name the image like this: <strong>No_Name</strong><br />
        Example: <strong>01_Sample 1</strong>
      </p>
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
        <div v-for="pic in allPictures" :key="pic.key" class="flex items-center gap-1">
          <img
            v-if="!uploadingFiles.has(pic.name)"
            :src="pic.base64"
            alt="Uploaded image"
            class="w-16 h-16 object-cover rounded"
          />
          <span class="text-sm ml-1">{{ pic.name }}</span>
          <button
            @click.stop="deleteImage(pic.item, pic.name)"
            class="w-3.5 h-3.5 text-xs flex items-center justify-center text-red-500 rounded-full shadow-sm hover:bg-blue-500 hover:text-white px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue'
import { useImageUpload } from '@/composables/useImageUpload.ts'

const props = defineProps<{
  modelValue?: string // logo, cover
  readonly?: boolean
  placeholder?: string
  class?: string // optional styling class
  variant?: string // e.g. 'logo', 'cover'
}>()

// compute default placeholder based on variant
const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  switch (props.variant) {
    case 'logo':
      return 'Upload Logo'
    case 'cover':
      return 'Upload Cover'
    default:
      return 'Upload Image'
  }
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const {
  pictureVisible,
  displayedPicture,
  isDragging,
  fileInputRef,
  triggerUpload,
  handleDrop,
  uploadPicture,
  handleDragOver,
  handleDragLeave,
  deletePicture,
  setPicture,
  onImageError,
} = useImageUpload(props.modelValue, props.readonly, (val) => emit('update:modelValue', val))

watch(() => props.modelValue, setPicture, { immediate: true })
</script>

<template>
  <div
    class="relative group flex items-center justify-center cursor-pointer border border-transparent"
    :class="[isDragging ? 'border-blue-500 bg-blue-50' : '', props.class]"
    @click="triggerUpload"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- Drag Overlay -->
    <div
      v-if="isDragging"
      class="absolute inset-0 flex items-center justify-center bg-blue-100/70 text-blue-500 text-sm font-medium"
    >
      Drop image here
    </div>

    <!-- Image -->
    <div
      v-if="displayedPicture && pictureVisible"
      class="w-full h-full overflow-hidden flex items-center justify-center"
    >
      <img
        v-if="props.variant === 'logo'"
        :src="displayedPicture"
        style="height: 2rem; width: auto"
        @error="onImageError"
      />
      <img
        v-else
        :src="displayedPicture"
        class="max-w-full max-h-full object-contain"
        @error="onImageError"
      />
    </div>

    <!-- Placeholder -->
    <div
      v-else
      class="flex justify-center items-center w-full opacity-30 transition hover:opacity-100"
      :class="{
        'hover:outline rounded-sm outline-gray-300 hover:bg-gray-100 hover:text-gray-600':
          !props.readonly && !displayedPicture,
        'outline-none': props.readonly,
      }"
    >
      <span data-ui-only v-if="!props.readonly">
        {{ computedPlaceholder }}
      </span>
    </div>

    <!-- Delete Button -->
    <div
      v-if="displayedPicture && !props.readonly"
      data-ui-only
      class="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition"
    >
      <button
        class="w-6 h-6 flex items-center justify-center text-red-500 rounded-full shadow hover:bg-blue-500 hover:text-white"
        @click="deletePicture"
      >
        ✕
      </button>
    </div>

    <!-- File Input -->
    <input ref="fileInputRef" type="file" class="hidden" accept="image/*" @change="uploadPicture" />
  </div>
</template>

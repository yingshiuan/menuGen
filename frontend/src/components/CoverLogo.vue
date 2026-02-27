<script setup lang="ts">
import { watch } from 'vue'
import { useImageUpload } from '@/composables/useImageUpload'

const props = defineProps<{
  modelValue?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const {
  fileInputRef,
  pictureVisible,
  displayedPicture,
  isDragging,
  triggerUpload,
  uploadPicture,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  deletePicture,
  onImageError,
  setPicture,
} = useImageUpload(props.modelValue, props.readonly, (value) => emit('update:modelValue', value))

watch(
  () => props.modelValue,
  (val) => setPicture(val),
  { immediate: true },
)
</script>

<template>
  <div
    class="relative group w-60 h-full flex items-center justify-center cursor-pointer"
    :class="isDragging ? 'border-blue-500 bg-blue-50' : 'border-transparent'"
    @click="triggerUpload"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div
      v-if="isDragging"
      class="absolute inset-0 w-auto flex items-center justify-center bg-blue-100/70 text-blue-500 text-sm font-medium"
    >
      Drop image here
    </div>

    <!-- Image -->
    <div
      v-if="displayedPicture && pictureVisible"
      class="w-full h-full overflow-hidden flex items-center justify-center"
    >
      <img
        :src="displayedPicture"
        class="max-w-full max-h-full object-contain"
        @error="onImageError"
      />
    </div>

    <!-- Upload Placeholder -->
    <div
      v-else
      class="flex justify-center items-center opacity-30 transition hover:opacity-100 w-full"
      :class="{
        'hover:outline rounded-sm outline-gray-300 hover:bg-gray-100 hover:text-gray-600':
          !props.readonly && !displayedPicture,
        'outline-none': props.readonly,
      }"
    >
      <span data-ui-only v-if="!props.readonly">Upload Logo</span>
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

    <input ref="fileInputRef" type="file" class="hidden" accept="image/*" @change="uploadPicture" />
  </div>
</template>

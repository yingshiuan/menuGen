<script lang="ts" setup>
import { computed, watch } from 'vue'
// import LogoFile from '@/asset/svg/logo.png'
import { useImageUpload } from '@/composables/useImageUpload'

const props = defineProps<{
  defaultSrc?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:logo', base64: string): void
}>()



const {
  fileInputRef,
  pictureVisible,
  pictureBase64,
  isDragging,
  triggerUpload,
  uploadPicture,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  deletePicture,
  onImageError,
  setPicture,
} = useImageUpload(props.defaultSrc, props.readonly, (value) => emit('update:logo', value))

const displayedPicture = computed(() => pictureBase64.value || props.defaultSrc)

watch(
  () => props.defaultSrc,
  (val) => {
    if (!pictureBase64.value) {
      setPicture(val)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="relative group w-auto flex justify-center items-center cursor-pointer"
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
    
    <img
      v-if="displayedPicture && pictureVisible"
      :src="displayedPicture"
      alt="Logo-Image"
      style="height: 2rem; width: auto"
      data-logo="true"
      @error="onImageError"
    />

    <div
      v-else
      class="flex justify-center items-center opacity-30 transition hover:opacity-100"
      style="height: 2rem"
      :class="{
        'hover:outline rounded-sm outline-gray-300 hover:bg-gray-100 hover:text-gray-600':
          !props.readonly && !displayedPicture,
        'outline-none': props.readonly,
      }"
    >
      <span
        data-ui-only
        v-if="!props.readonly"
        class="text-sm"
        :title="`Click to upload the Picture...`"
        >Upload Logo</span
      >
    </div>
    <div
      v-if="displayedPicture && !props.readonly"
      class="absolute -top-4 -right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
    >
      <button
        class="w-5 h-5 flex items-center justify-center text-red-500 rounded-full shadow-sm hover:bg-blue-500 hover:text-white cursor-pointer"
        @click="deletePicture"
        title="Delete logo"
      >
        ✕
      </button>
    </div>

    <input ref="fileInputRef" type="file" class="hidden" accept="image/*" @change="uploadPicture" />
  </div>
</template>

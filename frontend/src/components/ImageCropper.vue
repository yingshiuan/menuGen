<!-- CropModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImageUpload } from '@/composables/useImageUpload.ts'

/** Props */
const props = defineProps<{
  modelValue?: string 
  readonly?: boolean
  placeholder?: string
  class?: string
  variant?: 'logo' | 'cover' | 'picture'
  cropWidth?: number
  cropHeight?: number
  aspectRatio?: number
}>()

/** Placeholder text */
const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  switch (props.variant) {
    case 'logo':
      return 'Upload Logo'
    case 'cover':
      return 'Upload Cover'
    case 'picture':
      return 'Upload Picture'
    default:
      return 'Upload Image'
  }
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

/** Image upload composable */
const {
  pictureVisible,
  displayedPicture,
  isDragging,
  fileInputRef,
  triggerUpload,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  deletePicture,
  setPicture,
  onImageError,
} = useImageUpload(props.modelValue, props.readonly, (val) => emit('update:modelValue', val))

watch(() => props.modelValue, setPicture, { immediate: true })

/** Crop state */
const isModalVisible = ref(false)
const imageSrc = ref<string | null>(null)
const croppedImage = ref<string | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

const aspectRatio = ref(props.aspectRatio ?? (props.variant === 'logo' ? 300 / 32 : 1))

const cropFrame = ref<{ x: number; y: number; width: number; height: number }>({
  x: 50,
  y: 50,
  width: props.cropWidth ?? (props.variant === 'logo' ? 300 : 240),
  height: props.cropHeight ?? (props.variant === 'logo' ? 32 : 240),
})

/** Drag & resize */
const dragStart = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const isResizing = ref(false)
const resizeStart = ref<{ x: number; y: number; width: number; height: number }>({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
})
const resizeDirection = ref<'se' | 'e' | 's'>('se')

/** Helpers for safe mouse/touch coords */
const getClientXY = (event: MouseEvent | TouchEvent) => {
  if ('touches' in event && event.touches.length > 0) {
    const touch = event.touches[0]
    if (touch) return { x: touch.clientX, y: touch.clientY }
  } else if ('changedTouches' in event && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0]
    if (touch) return { x: touch.clientX, y: touch.clientY }
  } else if ('clientX' in event && 'clientY' in event) {
    return { x: event.clientX, y: event.clientY }
  }
  return { x: 0, y: 0 }
}

/** Open / Close modal */
const openCropper = () => {
  if (imageSrc.value) isModalVisible.value = true
}
const closeModal = () => {
  isModalVisible.value = false
  croppedImage.value = null
  imageSrc.value = null
}

/** Upload and read image */
const uploadPictureAndCrop = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    imageSrc.value = reader.result as string
    openCropper()
  }
  reader.readAsDataURL(file)
}

/** Drag handlers */
const startDrag = (event: MouseEvent | TouchEvent) => {
  const { x: clientX, y: clientY } = getClientXY(event)
  isDragging.value = true
  dragStart.value = { x: clientX - cropFrame.value.x, y: clientY - cropFrame.value.y }

  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('touchend', stopDrag)
}

const onDrag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  if ('touches' in event) event.preventDefault()

  const bounds = getImageDisplayBounds()
  if (!bounds) return

  const { x: clientX, y: clientY } = getClientXY(event)

  let newX = clientX - dragStart.value.x
  let newY = clientY - dragStart.value.y

  // Clamp inside visible image
  newX = Math.max(bounds.left, Math.min(newX, bounds.right - cropFrame.value.width))

  newY = Math.max(bounds.top, Math.min(newY, bounds.bottom - cropFrame.value.height))

  cropFrame.value.x = newX
  cropFrame.value.y = newY
}

const stopDrag = () => {
  isDragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', stopDrag)
}

/** Resize handlers */
const startResize = (direction: typeof resizeDirection.value, event: MouseEvent | TouchEvent) => {
  const { x: clientX, y: clientY } = getClientXY(event)
  resizeDirection.value = direction
  isResizing.value = true
  resizeStart.value = {
    x: clientX,
    y: clientY,
    width: cropFrame.value.width,
    height: cropFrame.value.height,
  }

  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
  window.addEventListener('touchmove', onResize, { passive: false })
  window.addEventListener('touchend', stopResize)
}

const onResize = (event: MouseEvent | TouchEvent) => {
  if (!isResizing.value) return
  if ('touches' in event) event.preventDefault()

  const bounds = getImageDisplayBounds()
  if (!bounds) return

  const { x: clientX, y: clientY } = getClientXY(event)

  const deltaX = clientX - resizeStart.value.x
  const deltaY = clientY - resizeStart.value.y

  const MIN_SIZE = 100

  // SE RESIZE (Logo main case)
  if (resizeDirection.value === 'se') {
    let newWidth = resizeStart.value.width + deltaX
    newWidth = Math.max(MIN_SIZE, newWidth)

    let newHeight = newWidth / aspectRatio.value

    // Bottom limit
    const maxHeight = bounds.bottom - cropFrame.value.y
    if (newHeight > maxHeight) {
      newHeight = maxHeight
      newWidth = newHeight * aspectRatio.value
    }

    // Slide left if overflow right
    const overflowRight = cropFrame.value.x + newWidth - bounds.right
    if (overflowRight > 0) {
      cropFrame.value.x -= overflowRight
    }

    cropFrame.value.width = newWidth
    cropFrame.value.height = newHeight

    return
  }

  // E resize
  if (resizeDirection.value === 'e') {
    let newWidth = Math.max(MIN_SIZE, resizeStart.value.width + deltaX)

    if (cropFrame.value.x + newWidth > bounds.right) {
      newWidth = bounds.right - cropFrame.value.x
    }

    cropFrame.value.width = newWidth
    return
  }

  // S resize
  if (resizeDirection.value === 's') {
    let newHeight = Math.max(MIN_SIZE, resizeStart.value.height + deltaY)

    if (cropFrame.value.y + newHeight > bounds.bottom) {
      newHeight = bounds.bottom - cropFrame.value.y
    }

    cropFrame.value.height = newHeight
    return
  }
}
const stopResize = () => {
  isResizing.value = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
  window.removeEventListener('touchmove', onResize)
  window.removeEventListener('touchend', stopResize)
}

/** Crop image */
const cropImage = () => {
  if (!imageSrc.value || !containerRef.value || !imageRef.value) return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = imageRef.value

  const containerWidth = containerRef.value.clientWidth
  const containerHeight = containerRef.value.clientHeight
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight

  const imageRatio = naturalWidth / naturalHeight
  const containerRatio = containerWidth / containerHeight

  let displayWidth = 0,
    displayHeight = 0
  if (imageRatio > containerRatio) {
    displayWidth = containerWidth
    displayHeight = containerWidth / imageRatio
  } else {
    displayHeight = containerHeight
    displayWidth = containerHeight * imageRatio
  }

  const offsetX = (containerWidth - displayWidth) / 2
  const offsetY = (containerHeight - displayHeight) / 2
  const scaleX = naturalWidth / displayWidth
  const scaleY = naturalHeight / displayHeight

  const cropX = (cropFrame.value.x - offsetX) * scaleX
  const cropY = (cropFrame.value.y - offsetY) * scaleY
  const cropWidth = cropFrame.value.width * scaleX
  const cropHeight = cropFrame.value.height * scaleY

  canvas.width = cropFrame.value.width
  canvas.height = cropFrame.value.height
  ctx?.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)

  croppedImage.value = canvas.toDataURL()
  emit('update:modelValue', croppedImage.value)
  setPicture(croppedImage.value)
  closeModal()
}

const getImageDisplayBounds = () => {
  if (!containerRef.value || !imageRef.value) return null

  const containerWidth = containerRef.value.clientWidth
  const containerHeight = containerRef.value.clientHeight
  const naturalWidth = imageRef.value.naturalWidth
  const naturalHeight = imageRef.value.naturalHeight

  const imageRatio = naturalWidth / naturalHeight
  const containerRatio = containerWidth / containerHeight

  let displayWidth = 0
  let displayHeight = 0

  if (imageRatio > containerRatio) {
    displayWidth = containerWidth
    displayHeight = containerWidth / imageRatio
  } else {
    displayHeight = containerHeight
    displayWidth = containerHeight * imageRatio
  }

  const offsetX = (containerWidth - displayWidth) / 2
  const offsetY = (containerHeight - displayHeight) / 2

  return {
    left: offsetX,
    top: offsetY,
    right: offsetX + displayWidth,
    bottom: offsetY + displayHeight,
  }
}
const centerCropFrame = () => {
  const bounds = getImageDisplayBounds()
  if (!bounds) return

  cropFrame.value.x = bounds.left + (bounds.right - bounds.left - cropFrame.value.width) / 2

  cropFrame.value.y = bounds.top + (bounds.bottom - bounds.top - cropFrame.value.height) / 2
}

/** Watch for external changes */
watch([() => displayedPicture, () => pictureVisible], () => {
  if (displayedPicture && pictureVisible && !imageSrc.value) {
    imageSrc.value = typeof displayedPicture === 'string' ? displayedPicture : ''
    openCropper()
  }
})
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
    <div
      v-if="isDragging"
      class="absolute inset-0 flex items-center justify-center bg-blue-100/70 text-blue-500 text-sm font-medium"
    >
      Drop image here
    </div>

    <div
      v-if="displayedPicture && pictureVisible"
      class="w-full h-full overflow-hidden flex items-center justify-center"
      @click="openCropper"
    >
      <img
        v-if="props.variant === 'logo'"
        :src="displayedPicture"
        style="height: 2rem; width: auto"
        @error="onImageError"
      />
      <img
        v-else-if="props.variant === 'cover'"
        :src="displayedPicture"
        class="w-60 h-60 object-cover rounded-full"
        @error="onImageError"
      />

      <img
        v-else-if="props.variant === 'picture'"
        :src="displayedPicture"
        class="w-20 h-20 object-cover rounded-full"
        @error="onImageError"
      />
    </div>

    <div
      v-else
      class="flex justify-center items-center w-full opacity-30 transition hover:opacity-100"
      :class="{
        'hover:outline rounded-sm outline-gray-300 hover:bg-gray-100 hover:text-gray-600':
          !props.readonly && !displayedPicture,
        'outline-none': props.readonly,
      }"
    >
      <span v-if="!props.readonly">{{ computedPlaceholder }}</span>
    </div>

    <div
      v-if="displayedPicture && !props.readonly"
      class="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition"
    >
      <button
        class="w-3.5 h-3.5 text-xs flex items-center justify-center text-red-500 rounded-full shadow hover:bg-blue-500 hover:text-white"
        @click="deletePicture"
      >
        ✕
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept="image/*"
      @change="uploadPictureAndCrop"
    />
  </div>

  <div v-if="isModalVisible" class="modal">
    <div class="modal-content">
      <div class="crop-container" ref="containerRef">
        <div class="image-wrapper">
          <img ref="imageRef" :src="imageSrc || ''" alt="Uploaded Image" @load="centerCropFrame" />
        </div>
        <div
          class="crop-frame"
          :style="{
            width: `${cropFrame.width}px`,
            height: `${cropFrame.height}px`,
            top: `${cropFrame.y}px`,
            left: `${cropFrame.x}px`,
            borderRadius: props.variant === 'logo' ? '0' : '50%',
          }"
          @mousedown="startDrag"
          @touchstart.prevent="startDrag"
        >
          <div
            class="resize-handle se"
            @mousedown.stop.prevent="startResize('se', $event)"
            @touchstart.stop.prevent="startResize('se', $event)"
          ></div>
          <div
            class="resize-handle e"
            @mousedown.stop.prevent="startResize('e', $event)"
            @touchstart.stop.prevent="startResize('e', $event)"
          ></div>
          <div
            class="resize-handle s"
            @mousedown.stop.prevent="startResize('s', $event)"
            @touchstart.stop.prevent="startResize('s', $event)"
          ></div>
        </div>
      </div>
      <div class="controls">
        <button
          class="bg-blue-500 p-1 text-white rounded-lg hover:bg-blue-700 hover:text-white border-2 border-blue-500 transition-colors duration-200 shadow-md"
          @click="cropImage"
        >
          Crop Image
        </button>
        <button
          class="border border-red-500 rounded-lg text-red-500 p-1 hover:bg-red-500 hover:text-white transition"
          @click="closeModal"
        >
          Close
        </button>
      </div>
      <!-- <div v-if="croppedImage" class="cropped-preview">
        <h3>Cropped Image Preview</h3>
        <img :src="croppedImage" alt="Cropped Image" />
      </div> -->
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
}
.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  width: 80%;
  max-width: 50rem;
}
.crop-container {
  position: relative;
  width: 100%;
  height: 25rem;
  background: #f0f0f0;
  overflow: hidden;
}
.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.crop-frame {
  position: absolute;
  border: 2px dashed #000;
  cursor: move;
  z-index: 1;
}
.controls {
  margin-top: 10px;
  display: flex;
  gap: 1rem;
}
/* .controls button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.controls button:hover {
  background: #0056b3;
} */
.cropped-preview {
  margin-top: 1rem;
}
.cropped-preview img {
  max-width: 100%;
  max-height: 200px;
  display: block;
}
.crop-frame .resize-handle {
  position: absolute;
  width: 1rem;
  height: 1rem;
  background: #000;
  border-radius: 50%;
  z-index: 2;
  border: 1px solid #fff;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.5);
}
.resize-handle.se {
  right: 0;
  bottom: 0;
  transform: translate(50%, 50%);
  cursor: se-resize;
}
.resize-handle.e {
  right: 0;
  top: 50%;
  transform: translate(50%, -50%);
  cursor: e-resize;
}
.resize-handle.s {
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 50%);
  cursor: s-resize;
}
.resize-handle:hover {
  background: #007bff;
}
</style>

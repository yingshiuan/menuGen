<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useImageUpload } from '@/composables/useImageUpload.ts'
import { useImageCropper } from '@/composables/useImageCropper'

/** Props */
const props = defineProps<{
  modelValue?: string | null
  readonly?: boolean
  placeholder?: string
  class?: string
  variant?: 'logo' | 'cover' | 'picture' | 'icon'
  cropWidth?: number
  cropHeight?: number
  aspectRatio?: number
  src?: string | null
}>()

/** Placeholder text */
const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  switch (props.variant) {
    case 'logo':
      return 'Upload Logo'
    case 'cover':
      return 'Upload Cover Logo'
    case 'picture':
      return 'Upload Picture'
    case 'icon':
      return 'Upload Icon'
    default:
      return 'Upload Image'
  }
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: string | null): void
  (e: 'update:modalOpen', val: boolean): void
}>()

/** Image upload composable */
const {
  // pictureVisible,
  displayedPicture,
  isDragging,
  fileInputRef,
  triggerUpload,
  handleDragOver,
  handleDragLeave,
  deletePicture,
  setPicture,
  onImageError,
} = useImageUpload(props.modelValue ?? null, props.readonly, (val) =>
  emit('update:modelValue', val),
)

watch(() => props.modelValue, setPicture, { immediate: true })

/** Crop state */
interface CropFrame {
  x: number
  y: number
  width: number
  height: number
}

interface CropState {
  isModalVisible: boolean
  imageSrc: string | null
  croppedImage: string | null
  aspectRatio: number
  cropFrame: CropFrame
}

interface DragState {
  dragStart: { x: number; y: number }
  isResizing: boolean
  resizeStart: CropFrame
  resizeDirection: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
  isCropDragging: boolean
}

const cropState = reactive<CropState>({
  isModalVisible: false,
  imageSrc: null,
  croppedImage: null,
  aspectRatio: props.aspectRatio ?? (props.variant === 'logo' ? 300 / 32 : 1),
  cropFrame: {
    x: 50,
    y: 50,
    width: props.cropWidth ?? (props.variant === 'logo' ? 300 : 240),
    height: props.cropHeight ?? (props.variant === 'logo' ? 32 : 240),
  },
})

/** Drag & Resize state */
const dragState = reactive<DragState>({
  dragStart: { x: 0, y: 0 },
  isResizing: false,
  resizeStart: { x: 0, y: 0, width: 0, height: 0 },
  resizeDirection: 'se',
  isCropDragging: false,
})

const containerRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

const aspectRatio = computed(() => {
  return props.aspectRatio ?? (props.variant === 'logo' ? 300 / 32 : 1)
})

const { cropImage } = useImageCropper()

const handleCrop = () => {
  if (!cropState.imageSrc || !containerRef.value || !imageRef.value) return

  const result = cropImage(
    cropState.imageSrc,
    containerRef.value,
    imageRef.value,
    cropState.cropFrame,
  )

  if (!result) return

  cropState.croppedImage = result
  emit('update:modelValue', result)
  setPicture(result)
  closeModal()
}

/** Upload and read image */
const readFileAndOpenCropper = (file: File) => {
  const reader = new FileReader()

  reader.onload = () => {
    cropState.imageSrc = reader.result as string
    cropState.isModalVisible = true
  }

  reader.readAsDataURL(file)
}

const handleDropAndCrop = (event: DragEvent) => {
  if (props.readonly) return

  // Reset drag state from composable first
  handleDragLeave()

  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  readFileAndOpenCropper(file)
}

const uploadPictureAndCrop = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  readFileAndOpenCropper(file)
  input.value = '' // clear so same file can be re-uploaded
}

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
  if (cropState.imageSrc) cropState.isModalVisible = true
}
const closeModal = () => {
  cropState.isModalVisible = false
  cropState.croppedImage = null
  cropState.imageSrc = null
}

/** Drag handlers */
const startDrag = (event: MouseEvent | TouchEvent) => {
  if (props.readonly) return
  const coords = getClientXY(event)
  dragState.dragStart = { x: coords.x - cropState.cropFrame.x, y: coords.y - cropState.cropFrame.y }
  dragState.isCropDragging = true

  window.addEventListener('mousemove', onDrag)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('touchend', stopDrag)
}

const onDrag = (event: MouseEvent | TouchEvent) => {
  if (!dragState.isCropDragging) return // uses its own flag
  if ('touches' in event) event.preventDefault()

  const bounds = getImageDisplayBounds()
  if (!bounds) return

  const { x: clientX, y: clientY } = getClientXY(event)

  let newX = clientX - dragState.dragStart.x
  let newY = clientY - dragState.dragStart.y

  newX = Math.max(bounds.left, Math.min(newX, bounds.right - cropState.cropFrame.width))
  newY = Math.max(bounds.top, Math.min(newY, bounds.bottom - cropState.cropFrame.height))

  cropState.cropFrame.x = newX
  cropState.cropFrame.y = newY
}

const stopDrag = () => {
  dragState.isCropDragging = false // uses its own flag
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', stopDrag)
}

/** Resize handlers */
const startResize = (
  direction: typeof dragState.resizeDirection,
  event: MouseEvent | TouchEvent,
) => {
  const { x: clientX, y: clientY } = getClientXY(event)
  dragState.resizeDirection = direction
  dragState.isResizing = true
  dragState.resizeStart = {
    x: clientX,
    y: clientY,
    width: cropState.cropFrame.width,
    height: cropState.cropFrame.height,
  }
  // save frame origin separately for w/n calculations
  dragState.dragStart = { x: cropState.cropFrame.x, y: cropState.cropFrame.y }

  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
  window.addEventListener('touchmove', onResize, { passive: false })
  window.addEventListener('touchend', stopResize)
}

const onResize = (event: MouseEvent | TouchEvent) => {
  if (!dragState.isResizing) return
  if ('touches' in event) event.preventDefault()

  const bounds = getImageDisplayBounds()
  if (!bounds) return

  const { x: clientX, y: clientY } = getClientXY(event)
  const deltaX = clientX - dragState.resizeStart.x
  const deltaY = clientY - dragState.resizeStart.y
  const MIN_SIZE = 100
  const dir = dragState.resizeDirection
  const isCircle = props.variant === 'picture'
  const isLogo = props.variant === 'logo'

  let x = cropState.cropFrame.x
  let y = cropState.cropFrame.y
  let width = cropState.cropFrame.width
  let height = cropState.cropFrame.height
  const startW = dragState.resizeStart.width
  const startH = dragState.resizeStart.height
  const startFrameX = dragState.dragStart.x
  const startFrameY = dragState.dragStart.y

  // ── EDGE HANDLES: single axis only, free resize ──
  if (dir === 'e') {
    let newW = Math.max(MIN_SIZE, startW + deltaX)
    if (startFrameX + newW > bounds.right) newW = bounds.right - startFrameX
    width = newW
  } else if (dir === 'w') {
    let newW = Math.max(MIN_SIZE, startW - deltaX)
    let newX = startFrameX + (startW - newW)
    if (newX < bounds.left) {
      newX = bounds.left
      newW = startFrameX + startW - bounds.left
    }
    x = newX
    width = newW
  } else if (dir === 's') {
    let newH = Math.max(MIN_SIZE, startH + deltaY)
    if (startFrameY + newH > bounds.bottom) newH = bounds.bottom - startFrameY
    height = newH
  } else if (dir === 'n') {
    let newH = Math.max(MIN_SIZE, startH - deltaY)
    let newY = startFrameY + (startH - newH)
    if (newY < bounds.top) {
      newY = bounds.top
      newH = startFrameY + startH - bounds.top
    }
    y = newY
    height = newH
  }

  // ── CORNER HANDLES: locked ratio ──
  else if (dir === 'se') {
    // Drive by whichever delta is larger
    const size = Math.max(
      MIN_SIZE,
      isCircle ? Math.max(startW + deltaX, startH + deltaY) : startW + deltaX,
    )
    width = isLogo ? size : size
    height = isCircle ? size : isLogo ? size / aspectRatio.value : size
    // clamp right/bottom
    if (startFrameX + width > bounds.right) {
      width = bounds.right - startFrameX
      height = isCircle ? width : isLogo ? width / aspectRatio.value : width
    }
    if (startFrameY + height > bounds.bottom) {
      height = bounds.bottom - startFrameY
      width = isCircle ? height : isLogo ? height * aspectRatio.value : height
    }
  } else if (dir === 'sw') {
    const size = Math.max(
      MIN_SIZE,
      isCircle ? Math.max(startW - deltaX, startH + deltaY) : startW - deltaX,
    )
    width = size
    height = isCircle ? size : isLogo ? size / aspectRatio.value : size
    let newX = startFrameX + (startW - width)
    if (newX < bounds.left) {
      newX = bounds.left
      width = startFrameX + startW - bounds.left
      height = isCircle ? width : isLogo ? width / aspectRatio.value : width
    }
    if (startFrameY + height > bounds.bottom) {
      height = bounds.bottom - startFrameY
      width = isCircle ? height : isLogo ? height * aspectRatio.value : height
      newX = startFrameX + (startW - width)
    }
    x = newX
  } else if (dir === 'ne') {
    const size = Math.max(
      MIN_SIZE,
      isCircle ? Math.max(startW + deltaX, startH - deltaY) : startW + deltaX,
    )
    width = size
    height = isCircle ? size : isLogo ? size / aspectRatio.value : size
    let newY = startFrameY + (startH - height)
    if (startFrameX + width > bounds.right) {
      width = bounds.right - startFrameX
      height = isCircle ? width : isLogo ? width / aspectRatio.value : width
      newY = startFrameY + (startH - height)
    }
    if (newY < bounds.top) {
      newY = bounds.top
      height = startFrameY + startH - bounds.top
      width = isCircle ? height : isLogo ? height * aspectRatio.value : height
    }
    y = newY
  } else if (dir === 'nw') {
    const size = Math.max(
      MIN_SIZE,
      isCircle ? Math.max(startW - deltaX, startH - deltaY) : startW - deltaX,
    )
    width = size
    height = isCircle ? size : isLogo ? size / aspectRatio.value : size
    let newX = startFrameX + (startW - width)
    let newY = startFrameY + (startH - height)
    if (newX < bounds.left) {
      newX = bounds.left
      width = startFrameX + startW - bounds.left
      height = isCircle ? width : isLogo ? width / aspectRatio.value : width
      newY = startFrameY + (startH - height)
    }
    if (newY < bounds.top) {
      newY = bounds.top
      height = startFrameY + startH - bounds.top
      width = isCircle ? height : isLogo ? height * aspectRatio.value : height
      newX = startFrameX + (startW - width)
    }
    x = newX
    y = newY
  }

  width = Math.max(MIN_SIZE, width)
  height = Math.max(MIN_SIZE, height)

  cropState.cropFrame.x = x
  cropState.cropFrame.y = y
  cropState.cropFrame.width = width
  cropState.cropFrame.height = height
}

const stopResize = () => {
  dragState.isResizing = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
  window.removeEventListener('touchmove', onResize)
  window.removeEventListener('touchend', stopResize)
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

  cropState.cropFrame.x = bounds.left + (bounds.right - bounds.left - cropState.cropFrame.width) / 2

  cropState.cropFrame.y = bounds.top + (bounds.bottom - bounds.top - cropState.cropFrame.height) / 2
}

watch(
  () => cropState.isModalVisible,
  (val) => {
    emit('update:modalOpen', val)
  },
)

watch(
  () => props.src,
  (val) => {
    if (val) cropState.imageSrc = val
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="relative group flex items-center justify-center cursor-pointer border border-transparent rounded-full"
    :class="[isDragging ? 'border-blue-500 bg-blue-50' : '', props.class]"
    @click="triggerUpload"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDropAndCrop"
  >
    <div
      v-if="isDragging"
      class="absolute inset-0 flex items-center justify-center bg-blue-100/70 text-blue-500 text-sm rounded-lg"
    >
      Drop here
    </div>

    <div
      v-if="displayedPicture"
      class="w-full h-full overflow-hidden flex items-center justify-center"
      @click.stop="props.variant === 'icon' ? triggerUpload() : openCropper()"
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
        v-else-if="props.variant === 'icon'"
        :src="displayedPicture"
        class="w-6 h-6 object-contain"
        @error="onImageError"
      />
      <!-- <img
        v-else-if="props.variant === 'picture'"
        data-ui-only
        :src="displayedPicture"
        class="object-cover rounded-full"
        @error="onImageError"
      /> -->
    </div>

    <div
      v-else
      class="flex justify-center items-center opacity-30 transition hover:opacity-100"
      :class="[
        props.variant === 'logo' ? 'w-full h-full px-1 rounded-lg' : '',
        props.variant === 'cover'
          ? 'hover:w-60 hover:h-60 hover:object-cover hover:rounded-full'
          : '',
        props.variant === 'picture' ? 'w-20 h-20 rounded-full' : '',
        props.variant === 'icon' ? 'shrink-0 text-xs rounded-lg px-1' : '',
        !props.readonly && !displayedPicture
          ? 'hover:outline hover:bg-gray-100 hover:text-gray-600'
          : '',
      ]"
    >
      <span data-ui-only v-if="!props.readonly" class="text-center">{{ computedPlaceholder }}</span>
    </div>

    <div
      v-if="displayedPicture && !props.readonly && props.variant !== 'picture'"
      class="absolute -top-1.5 -right-3 opacity-100 group-hover:opacity-100 transition"
      data-ui-only
    >
      <button
        class="w-3.5 h-3.5 text-xs flex items-center justify-center z-10 text-red-500 rounded-full shadow hover:bg-blue-500 hover:text-white"
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

  <Teleport to="body">
    <div v-if="cropState.isModalVisible" class="modal">
      <div class="modal-content">
        <div class="crop-container" ref="containerRef">
          <div class="image-wrapper">
            <img
              ref="imageRef"
              :src="cropState.imageSrc || ''"
              alt="Uploaded Image"
              @load="centerCropFrame"
            />
          </div>
          <div
            class="crop-frame"
            :style="{
              width: `${cropState.cropFrame.width}px`,
              height: `${cropState.cropFrame.height}px`,
              top: `${cropState.cropFrame.y}px`,
              left: `${cropState.cropFrame.x}px`,
              borderRadius: props.variant === 'logo' ? '0' : '50%',
            }"
            @mousedown="startDrag"
            @touchstart.prevent="startDrag"
          >
            <!-- 4 corners (always shown) -->
            <!-- Corner hit areas (always shown) -->
            <div
              class="edge-hit nw-corner"
              @mousedown.stop.prevent="startResize('nw', $event)"
              @touchstart.stop.prevent="startResize('nw', $event)"
            ></div>
            <div
              class="edge-hit ne-corner"
              @mousedown.stop.prevent="startResize('ne', $event)"
              @touchstart.stop.prevent="startResize('ne', $event)"
            ></div>
            <div
              class="edge-hit sw-corner"
              @mousedown.stop.prevent="startResize('sw', $event)"
              @touchstart.stop.prevent="startResize('sw', $event)"
            ></div>
            <div
              class="edge-hit se-corner"
              @mousedown.stop.prevent="startResize('se', $event)"
              @touchstart.stop.prevent="startResize('se', $event)"
            ></div>
            <!-- Circle handles on top -->
            <div
              class="resize-handle nw"
              @mousedown.stop.prevent="startResize('nw', $event)"
              @touchstart.stop.prevent="startResize('nw', $event)"
            ></div>
            <div
              class="resize-handle ne"
              @mousedown.stop.prevent="startResize('ne', $event)"
              @touchstart.stop.prevent="startResize('ne', $event)"
            ></div>
            <div
              class="resize-handle sw"
              @mousedown.stop.prevent="startResize('sw', $event)"
              @touchstart.stop.prevent="startResize('sw', $event)"
            ></div>
            <div
              class="resize-handle se"
              @mousedown.stop.prevent="startResize('se', $event)"
              @touchstart.stop.prevent="startResize('se', $event)"
            ></div>

            <!-- 4 edges (logo/rectangle only) -->
            <div v-if="props.variant == 'logo'">
              <!-- Edge hit areas (full-length invisible bars) -->
              <div
                class="edge-hit n"
                @mousedown.stop.prevent="startResize('n', $event)"
                @touchstart.stop.prevent="startResize('n', $event)"
              ></div>
              <div
                class="edge-hit s"
                @mousedown.stop.prevent="startResize('s', $event)"
                @touchstart.stop.prevent="startResize('s', $event)"
              ></div>
              <div
                class="edge-hit e"
                @mousedown.stop.prevent="startResize('e', $event)"
                @touchstart.stop.prevent="startResize('e', $event)"
              ></div>
              <div
                class="edge-hit w"
                @mousedown.stop.prevent="startResize('w', $event)"
                @touchstart.stop.prevent="startResize('w', $event)"
              ></div>
              <!-- Circle handles on top -->
              <div
                class="resize-handle n"
                @mousedown.stop.prevent="startResize('n', $event)"
                @touchstart.stop.prevent="startResize('n', $event)"
              ></div>
              <div
                class="resize-handle s"
                @mousedown.stop.prevent="startResize('s', $event)"
                @touchstart.stop.prevent="startResize('s', $event)"
              ></div>
              <div
                class="resize-handle e"
                @mousedown.stop.prevent="startResize('e', $event)"
                @touchstart.stop.prevent="startResize('e', $event)"
              ></div>
              <div
                class="resize-handle w"
                @mousedown.stop.prevent="startResize('w', $event)"
                @touchstart.stop.prevent="startResize('w', $event)"
              ></div>
            </div>
          </div>
        </div>
        <div class="controls flex justify-between">
          <button
            class="border border-red-500 rounded-lg text-red-500 p-1 hover:bg-red-500 hover:text-white transition"
            @click="closeModal"
          >
            Cancel
          </button>
          <button
            class="bg-blue-500 p-1 text-white rounded-lg hover:bg-blue-700 hover:text-white border-2 border-blue-500 transition-colors duration-200 shadow-md"
            @click="handleCrop"
          >
            Done
          </button>
        </div>
        <!-- <div v-if="croppedImage" class="cropped-preview">
        <h3>Cropped Image Preview</h3>
        <img :src="croppedImage" alt="Cropped Image" />
      </div> -->
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.a4-preview.modal-open {
  pointer-events: none; /* block hover & click on underlying page */
}
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  pointer-events: all;
}
.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  width: 80%;
  max-width: 50rem;
  pointer-events: all;
}
.crop-container {
  position: relative;
  width: 100%;
  height: 25rem;
  /* background-image:
    linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
    linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
    linear-gradient(-45deg, transparent 75%, #e5e5e5 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0px;
  background-color: #fff; */
  background: #e2e8f0;
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
.resize-handle.nw {
  left: 0;
  top: 0;
  transform: translate(-50%, -50%);
  cursor: nw-resize;
}
.resize-handle.ne {
  right: 0;
  top: 0;
  transform: translate(50%, -50%);
  cursor: ne-resize;
}
.resize-handle.sw {
  left: 0;
  bottom: 0;
  transform: translate(-50%, 50%);
  cursor: sw-resize;
}
.resize-handle.se {
  right: 0;
  bottom: 0;
  transform: translate(50%, 50%);
  cursor: se-resize;
}
.resize-handle.n {
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  cursor: n-resize;
}
.resize-handle.s {
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 50%);
  cursor: s-resize;
}
.resize-handle.e {
  right: 0;
  top: 50%;
  transform: translate(50%, -50%);
  cursor: e-resize;
}
.resize-handle.w {
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: w-resize;
}

.resize-handle:hover {
  background: #007bff;
}

/* Edge hit areas - invisible but wide/tall for easy grabbing */
.edge-hit {
  position: absolute;
  z-index: 2;
  background: transparent;
}

/* Horizontal edges - full width, 12px tall */
.edge-hit.n {
  top: -6px;
  left: 1rem; /* avoid overlap with corner handles */
  right: 1rem;
  height: 12px;
  cursor: n-resize;
}
.edge-hit.s {
  bottom: -6px;
  left: 1rem;
  right: 1rem;
  height: 12px;
  cursor: s-resize;
}

/* Vertical edges - full height, 12px wide */
.edge-hit.e {
  right: -6px;
  top: 1rem;
  bottom: 1rem;
  width: 12px;
  cursor: e-resize;
}
.edge-hit.w {
  left: -6px;
  top: 1rem;
  bottom: 1rem;
  width: 12px;
  cursor: w-resize;
}

/* Corner hit areas - larger square zones */
.edge-hit.nw-corner {
  top: -8px;
  left: -8px;
  width: 24px;
  height: 24px;
  cursor: nw-resize;
}
.edge-hit.ne-corner {
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  cursor: ne-resize;
}
.edge-hit.sw-corner {
  bottom: -8px;
  left: -8px;
  width: 24px;
  height: 24px;
  cursor: sw-resize;
}
.edge-hit.se-corner {
  bottom: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  cursor: se-resize;
}
</style>

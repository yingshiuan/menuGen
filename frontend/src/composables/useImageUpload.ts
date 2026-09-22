import { ref, computed } from 'vue'
import { compressImage, MAX_EDGE, JPEG_QUALITY } from '@/composables/imageCompression'

/** Whether the file is an image; if not, the user is told so. */
export function acceptImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  alert('Please upload a valid image file')
  return false
}

export function useImageUpload(
  initialValue: string | null,
  readonly: boolean | null,
  emit: (value: string) => void,
  onDragStateChange?: (dragging: boolean) => void, // optional callback to notify parent
) {
  const pictureBase64 = ref<string>(initialValue ?? '')
  const pictureVisible = ref<boolean>(!!initialValue)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isDragging = ref<boolean>(false)

  const displayedPicture = computed(() => pictureBase64.value)

  async function processFile(file: File) {
    if (!acceptImageFile(file)) return

    try {
      pictureBase64.value = await compressImage(file, MAX_EDGE, MAX_EDGE, JPEG_QUALITY)
      pictureVisible.value = true
      emit(pictureBase64.value)
    } catch {
      // A file can carry an image mime type and still not decode, e.g. a
      // renamed text file. Say so rather than leaving the picture blank.
      alert('Could not read that image file')
    }
  }

  /* Upload Trigger */
  function triggerUpload() {
    if (readonly) return
    fileInputRef.value?.click()
  }

  function uploadPicture(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return

    processFile(file)

    if (fileInputRef.value) fileInputRef.value.value = ''
  }

  /* Drag & Drop Handlers */
  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    if (readonly) return
    isDragging.value = true
    onDragStateChange?.(true) // notify parent
  }

  function handleDragLeave() {
    isDragging.value = false
    onDragStateChange?.(false) // notify parent
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    if (readonly) return

    isDragging.value = false
    onDragStateChange?.(false) // notify parent

    const file = e.dataTransfer?.files?.[0]
    if (!file) return

    processFile(file)
  }

  /* Delete */
  function deletePicture(event?: MouseEvent) {
    event?.stopPropagation()
    pictureBase64.value = ''
    pictureVisible.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
    emit('')
  }

  function onImageError() {
    pictureVisible.value = false
  }

  function setPicture(value?: string | null) {
    pictureBase64.value = value ?? ''
    pictureVisible.value = !!value
  }

  return {
    fileInputRef,
    pictureBase64,
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
  }
}

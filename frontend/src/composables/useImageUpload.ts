import { ref, computed } from 'vue'

export function useImageUpload(
  initialValue: string | undefined,
  readonly: boolean | undefined,
  emit: (value: string) => void
) {
  const pictureBase64 = ref<string>(initialValue ?? '')
  const pictureVisible = ref<boolean>(!!initialValue)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isDragging = ref<boolean>(false)

  const displayedPicture = computed(() => pictureBase64.value)

  function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      pictureBase64.value = reader.result as string
      pictureVisible.value = true
      emit(pictureBase64.value)
    }
    reader.readAsDataURL(file)
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

  /* Drop and Drag Handlers */
  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    if (readonly) return
    isDragging.value = true
  }

  function handleDragLeave() {
    isDragging.value = false
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    if (readonly) return

    isDragging.value = false

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

  function setPicture(value?: string) {
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
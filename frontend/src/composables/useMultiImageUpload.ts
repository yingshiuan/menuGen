import { ref, reactive, computed } from 'vue'
import type { MenuItem } from '@/types/types'

export interface ImageState {
  isDragging: boolean
  isExpanded: boolean
  isUploading: boolean
}

export interface SkippedFile {
  name: string
  reason: 'no-match' | 'not-an-image' | 'not-readable'
}

export interface ImageFile {
  name: string
  base64: string
  key: string
  item: MenuItem // reference to parent MenuItem
}

export function useMultiImageUpload(
  props: { menuItems: MenuItem[] },
  emit: {
    (e: 'update:item', item: MenuItem): void
    (e: 'update:menuItems', items: MenuItem[]): void
  },
) {
  const inputRef = ref<HTMLInputElement | null>(null)
  const uploadingFiles = ref<Set<string>>(new Set())
  // Files the last drop threw away, so the interface can say so
  const skippedFiles = ref<SkippedFile[]>([])
  const lastBatchSize = ref(0)
  const imageState = reactive<ImageState>({
    isDragging: false,
    isExpanded: false,
    isUploading: false,
  })

  // Compute keys only for Vue v-for rendering, include parent reference
  const allPictures = computed(() => {
    return props.menuItems.flatMap((item) => {
      // If item.images is undefined, return an empty array
      if (!item.images || item.images.length === 0) return []

      return item.images.map((img) => ({
        key: `${item.No}_${img.name}`, // unique key
        name: img.name,
        base64: img.base64,
        item,
      }))
    })
  })

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

        const base64 = canvas.toDataURL('image/jpeg', quality)
        resolve(base64)
      }

      img.onerror = () => reject(new Error(`Could not decode ${file.name}`))

      reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
      reader.readAsDataURL(file)
    })
  }

  async function handleFiles(files: FileList | File[]) {
    imageState.isUploading = true
    skippedFiles.value = []
    lastBatchSize.value = Array.from(files).length

    const promises = Array.from(files).map(async (file) => {
      if (!file.type.startsWith('image/')) {
        skippedFiles.value.push({ name: file.name, reason: 'not-an-image' })
        return
      }

      uploadingFiles.value.add(file.name)

      try {
        const base64 = await compressImage(file)
        const filename = file.name.replace(/\.[^/.]+$/, '')

        const matched = props.menuItems.find((item) => {
          const num = item.No?.toString() ?? ''
          return (
            item.Name === filename ||
            filename === `${num}_${item.Name}` ||
            filename === `${num.padStart(2, '0')}_${item.Name}`
          )
        })

        if (!matched) {
          skippedFiles.value.push({ name: file.name, reason: 'no-match' })
          return
        }

        const pictures = matched.images ?? []

        let newImages

        const existing = pictures.find((p) => p.name === filename)

        if (existing) {
          newImages = pictures.map((p) => (p.name === filename ? { ...p, base64 } : p))
        } else {
          newImages = [...pictures, { name: filename, base64 }]
        }

        const updatedItem: MenuItem = {
          ...matched,
          images: newImages,
          mainImageBase64: base64,
          lastUpdated: Date.now(),
        }

        emit('update:item', updatedItem)
      } catch {
        skippedFiles.value.push({ name: file.name, reason: 'not-readable' })
      } finally {
        uploadingFiles.value.delete(file.name)
      }
    })

    try {
      await Promise.all(promises)
    } finally {
      if (inputRef.value) inputRef.value.value = ''
      imageState.isUploading = false
    }
  }

  function deleteImage(item: MenuItem, imageName: string) {
    const remainingImages = (item.images ?? []).filter((img) => img.name !== imageName)

    const updatedItem: MenuItem = {
      ...item,
      images: remainingImages,
      mainImageBase64: remainingImages[0]?.base64 ?? null,
    }

    emit('update:item', updatedItem)

    const updatedMenuItems = props.menuItems.map((i) => (i.id === item.id ? updatedItem : i))
    emit('update:menuItems', updatedMenuItems)
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

  function dismissSkipped() {
    skippedFiles.value = []
  }

  function toggleExpand() {
    imageState.isExpanded = !imageState.isExpanded
  }

  return {
    inputRef,
    uploadingFiles,
    skippedFiles,
    lastBatchSize,
    dismissSkipped,
    imageState,
    allPictures,
    triggerUpload,
    handleFiles,
    onFilesSelected,
    onDragOver,
    onDragLeave,
    onDrop,
    toggleExpand,
    compressImage,
    deleteImage,
  }
}

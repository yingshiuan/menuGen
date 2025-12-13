<script lang="ts" setup>
import { reactive, ref, computed } from 'vue'
import LogoFile from '@/asset/svg/logo.png'

const props = defineProps<{ 
  defaultSrc?: string,
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:logo', base64: string): void
}>()

const state = reactive({
  pictureBase64: ''
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const pictureVisible = ref(true)

const displayedPicture = computed(() => state.pictureBase64 || props.defaultSrc || LogoFile)

function triggerUpload() {
  if (props.readonly) return
  fileInputRef.value?.click()
}

function onImageError() {
  pictureVisible.value = false
}

function uploadPicture(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    state.pictureBase64 = reader.result as string
    pictureVisible.value = true
    emit('update:logo', state.pictureBase64)
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div 
    class="w-auto h-8 flex justify-center items-center cursor-pointer overflow-hidden"
    :class="{
      'border border-gray-300': !props.readonly && !displayedPicture
      }"
    @click="triggerUpload"
  >
    <img 
      v-if="displayedPicture && pictureVisible" 
      :src="displayedPicture" 
      alt="Logo" 
      class="w-full h-full object-cover"
      @error="onImageError"
    />
    <div v-else class="w-full h-full flex justify-center items-center opacity-30 hover:bg-gray-100 hover:text-gray-600 hover:opacity-100"
        :class="!displayedPicture && props.readonly ? '' : 'bg-transparent'"
      >
        <span v-if="!props.readonly" class="text-sm" :title="`Click to upload the Picture...`">Upload</span>
      </div>
    <input ref="fileInputRef" type="file" class="hidden" accept="image/*" @change="uploadPicture" />
  </div>
</template>

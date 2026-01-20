<script lang="ts" setup>
import { reactive, ref, computed, watch } from 'vue'
// import LogoFile from '@/asset/svg/logo.png'

const props = defineProps<{
  defaultSrc?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:logo', base64: string): void
}>()

const state = reactive({
  pictureBase64: '',
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const pictureVisible = ref(true)

const displayedPicture = computed(() => state.pictureBase64 || props.defaultSrc) //|| LogoFile

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

function deleteLogo(event: MouseEvent) {
  event.stopPropagation()
  state.pictureBase64 = ''
  pictureVisible.value = false
  if (fileInputRef.value) fileInputRef.value.value = ''
  emit('update:logo', '')
}

watch(
  () => props.defaultSrc,
  (val) => {
    if (val) {
      state.pictureBase64 = val
      pictureVisible.value = true
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="relative group w-auto flex justify-center items-center cursor-pointer"
    @click="triggerUpload"
  >
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
        class="btn-sm text-red-500 rounded-full shadow-sm hover:bg-blue-500 hover:text-white px-1 cursor-pointer"
        @click="deleteLogo"
        title="Delete logo"
      >
        ✕
      </button>
    </div>

    <input ref="fileInputRef" type="file" class="hidden" accept="image/*" @change="uploadPicture" />
  </div>
</template>

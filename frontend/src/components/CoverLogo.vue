<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const state = reactive({
  pictureBase64: props.modelValue ?? '',
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const pictureVisible = ref(true)

const displayedPicture = computed(() => state.pictureBase64)

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
    emit('update:modelValue', state.pictureBase64)
  }
  reader.readAsDataURL(file)

  if (fileInputRef.value) fileInputRef.value.value = ''
}

function deleteLogo(event: MouseEvent) {
  event.stopPropagation()
  state.pictureBase64 = ''
  pictureVisible.value = false
  emit('update:modelValue', '')
}

watch(
  () => props.modelValue,
  (val) => {
    state.pictureBase64 = val ?? ''
    pictureVisible.value = !!val
  },
  { immediate: true },
)
</script>


<template>
  <div
    class="relative group w-60 h-full flex items-center justify-center cursor-pointer"
    @click="triggerUpload"
  >
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
      <span data-ui-only v-if="!readonly">Upload Logo</span>
    </div>

    <!-- Delete Button -->
    <div
      v-if="displayedPicture && !readonly"
      data-ui-only
      class="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition"
    >
      <button
        class="w-6 h-6 flex items-center justify-center text-red-500 rounded-full shadow hover:bg-blue-500 hover:text-white"
        @click="deleteLogo"
      >
        ✕
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept="image/*"
      @change="uploadPicture"
    />
  </div>
</template>



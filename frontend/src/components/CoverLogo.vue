<script setup lang="ts">
import { ref, watch } from 'vue'
// import ImageUploader from '@/components/ImageUploader.vue'
import ImageCropper from '@/components/ImageCropper.vue'

const props = defineProps<{
  modelValue?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const local = ref(props.modelValue || '')

watch(
  () => props.modelValue,
  (val) => {
    local.value = val || ''
  },
)

function handleUpdate(val: string) {
  local.value = val
  emit('update:modelValue', val)
}
</script>

<template>
  <!-- <ImageUploader
    :model-value="local"
    :readonly="props.readonly"
    variant="cover"
    @update:modelValue="handleUpdate"
  /> -->
  <ImageCropper
    v-model="local"
    variant="cover"          
    :aspectRatio="1" 
    :cropWidth="240"    
    :cropHeight="240"
    :readonly="props.readonly"
    @update:modelValue="handleUpdate"
  />
</template>

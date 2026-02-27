<script lang="ts" setup>
import { ref, watch } from 'vue'
import ImageUploader from '@/components/ImageUploader.vue'

const props = defineProps<{
  defaultSrc?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:logo', base64: string): void
}>()

// maintain a local value for v-model, starting from defaultSrc
const local = ref(props.defaultSrc || '')

watch(
  () => props.defaultSrc,
  (val) => {
    if (!local.value) {
      local.value = val || ''
    }
  },
)

function handleUpdate(val: string) {
  local.value = val
  emit('update:logo', val)
}
</script>

<template>
  <ImageUploader
    :model-value="local"
    :readonly="props.readonly"
    variant="logo"
    @update:modelValue="handleUpdate"
  />
</template>

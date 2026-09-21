<script lang="ts" setup>
import { clampSize } from '@/domain/sizes'
import { PHOTO_SIZE_RANGE, useMenuPhoto } from '@/composables/useMenuPhoto'

// Only "Fill page" uses the photo size; "Compact" photos are always 80px
const props = defineProps<{ disabled?: boolean }>()

const { photoSize, maxPhotoSize, followMax, showNameRing } = useMenuPhoto()

// Above the maximum the fullest page couldn't fit the photos, so the box stops there
function clamp() {
  const range = { min: PHOTO_SIZE_RANGE.min, max: maxPhotoSize.value }
  photoSize.value = clampSize(photoSize.value, range, maxPhotoSize.value)
  followMax.value = photoSize.value === maxPhotoSize.value
}
</script>

<template>
  <div class="flex flex-col gap-1 text-sm mt-1">
    <div class="flex flex-col gap-1" :class="{ 'opacity-50': props.disabled }">
      <label class="flex items-center gap-2">
        Photo size
        <input
          type="number"
          v-model.number="photoSize"
          :min="PHOTO_SIZE_RANGE.min"
          :max="maxPhotoSize"
          step="1"
          :disabled="props.disabled"
          @change="clamp"
          class="border p-1 rounded w-20"
        />
        px
      </label>
      <p class="text-xs text-gray-500">
        <template v-if="props.disabled">Used with "Fill page".</template>
        <template v-else>
          Max {{ maxPhotoSize }} px still fits the fullest page, so every page shows the same size.
        </template>
      </p>
    </div>

    <!-- Both spacings: without the curved name the photo fills most of its circle -->
    <label class="flex items-center gap-2">
      <input type="checkbox" v-model="showNameRing" class="w-4 h-4" />
      Name around photo
    </label>
  </div>
</template>

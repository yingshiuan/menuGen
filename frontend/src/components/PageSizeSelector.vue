<script lang="ts" setup>

const { width, height } = defineProps<{ width: string; height: string }>()

const emit = defineEmits<{
  (e: 'update:width', value: string): void
  (e: 'update:height', value: string): void
}>()

let startX = 0
let startValue = 0
let active: 'width' | 'height' | null = null

function parseValue(val: string) {
  return parseInt(val.replace('mm', '').trim()) || 0
}

function startDrag(e: PointerEvent, field: 'width' | 'height') {
  active = field
  startX = e.clientX
  startValue = parseValue(field === 'width' ? width : height)

  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag)
}

function onDrag(e: PointerEvent) {
  if (!active) return

  const delta = e.clientX - startX
  const next = Math.max(0, startValue + Math.round(delta / 5))

  if (active === 'width') {
    emit('update:width', next + 'mm')
    emit('update:height', height)
  } else {
    emit('update:height', next + 'mm')
    emit('update:width', width)
  }
}

function stopDrag() {
  active = null
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
}

function onWidthInput(e: Event) {
  let val = (e.target as HTMLInputElement).value
  if (!val.includes('mm')) val += 'mm'
  emit('update:width', val)
}

function onHeightInput(e: Event) {
  let val = (e.target as HTMLInputElement).value
  if (!val.includes('mm')) val += 'mm'
  emit('update:height', val)
}
</script>

<template>
  <div class="flex gap-2 items-center">
    <label class="flex items-center select-none gap-2">
      <span class="cursor-ew-resize" @pointerdown.prevent="(e) => startDrag(e, 'width')">
        W
      </span>
      <input type="text" :value="width" @input="onWidthInput" class="border p-1 rounded" />
    </label>

    <label class="flex items-center select-none gap-2">
      <span class="cursor-ew-resize" @pointerdown.prevent="(e) => startDrag(e, 'height')">
        H
      </span>
      <input type="text" :value="height" @input="onHeightInput" class="border p-1 rounded" />
    </label>
  </div>
</template>

<style scoped>
input {
  width: 5rem;
}
</style>

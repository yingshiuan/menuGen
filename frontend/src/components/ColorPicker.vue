<script lang="ts" setup>
import { reactive, watch } from 'vue'

const props = defineProps<{ 
  type: 'bg' | 'text', 
  color: string 
}>()

const emit = defineEmits<{
  (e: 'update:color', color: string): void
}>()

interface ColorState {
  localColor: string
  defaultColor: string
}

const colorState = reactive<ColorState>({
  localColor: props.color,
  defaultColor: props.type === 'bg' ? '#ffffff' : '#000000'
})

watch(
  () => props.type,
  (newType) => {
    colorState.defaultColor = newType === 'bg' ? '#ffffff' : '#000000'
  }
)

watch(() => props.color, val => colorState.localColor = val)
watch(() => colorState.localColor, val => emit('update:color', val))

function resetColor() {
  colorState.localColor = colorState.defaultColor
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label>{{ props.type === 'bg' ? 'Background' : 'Text' }} Color</label>
    <!-- Color wheel picker -->
    <input type="color" v-model="colorState.localColor" class="w-10 h-10 p-0 border-none cursor-pointer"/>
    <!-- Text input for hex, rgb(), etc. -->
    <input 
      type="text" 
      v-model="colorState.localColor" 
      placeholder="e.g. #ff0000 or rgb(255,0,0)" 
      class="border p-1 rounded w-24"
    />

    <button 
      type="button" 
      @click="resetColor"
      class="p-1 bg-gray-200 rounded hover:bg-gray-300"
    >
      Reset
    </button>
  </div>
</template>

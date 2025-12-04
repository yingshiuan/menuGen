<script lang="ts" setup>
import { ref, defineProps, defineEmits, watch } from 'vue'

const props = defineProps<{ type: 'bg' | 'text', color: string }>()
const emit = defineEmits<{
  (e: 'update:color', color: string): void
}>()

const localColor = ref(props.color)

// Store the default color to reset to
const defaultColor = props.type === 'bg' ? '#ffffff' : '#000000'

// Sync with parent
watch(() => props.color, val => localColor.value = val)
watch(localColor, val => emit('update:color', val))

// Reset function
function resetColor() {
  localColor.value = defaultColor
}
</script>

<template>
  <div class="flex items-center gap-2 mb-2">
    <label>{{ props.type === 'bg' ? 'Background' : 'Text' }} Color:</label>
    
    <!-- Color wheel picker -->
    <input type="color" v-model="localColor" class="w-10 h-10 p-0 border-none cursor-pointer"/>
    
    <!-- Text input for hex, rgb(), etc. -->
    <input 
      type="text" 
      v-model="localColor" 
      placeholder="e.g. #ff0000 or rgb(255,0,0)" 
      class="border px-2 py-1 rounded w-32"
    />

    <!-- Reset button -->
    <button 
      type="button" 
      @click="resetColor"
      class="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
    >
      Reset
    </button>
  </div>
</template>

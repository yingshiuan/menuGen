<script lang="ts" setup>
import { ref } from 'vue'

const props = defineProps({
  message: {
    type: String,
    default: 'This app uses a free backend hosting service, so the first request may take a few seconds while the server wakes up.'
  }
})
// If the first export doesn’t work the first time, don’t be afraid to try again — it’s normal!

const visible = ref(true)

const close = () => {
  visible.value = false
}
</script>


<template>
  <div v-if="visible" class="banner flex px-4 py-1 text-xs text-white bg-blue-500 item-center justify-between">
    <span>{{ props.message }}</span>
    <button class="text-white cursor-pointer font-bold hover:text-blue-700" @click="close">✕</button>
  </div>
</template>
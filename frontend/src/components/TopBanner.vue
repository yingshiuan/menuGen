<script lang="ts" setup>
import { ref } from 'vue'

const props = defineProps({
  message: {
    type: String,
    default: 'First request may take a few seconds (free tier)'
  }
})
// If the first export doesn’t work the first time, don’t be afraid to try again — it’s normal!
//This app uses a free backend hosting service, so the first request may take a few seconds while the server wakes up.

const visible = ref(true)

const close = () => {
  visible.value = false
}
</script>


<template>
  <div v-if="visible" class="fixed bottom-0 left-0 w-full flex px-4 py-1 text-xs text-white bg-blue-500 item-center justify-between">
    <span>{{ props.message }}</span>
    <button class="text-white cursor-pointer font-bold hover:text-blue-700" @click="close">✕</button>
  </div>
</template>
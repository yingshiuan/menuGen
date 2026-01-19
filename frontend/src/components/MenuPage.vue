<script lang="ts" setup>

const props = defineProps<{
  currentPage: number
  totalPages: number
}>();

const emit = defineEmits<{
  (e: 'update:page', page: number): void
}>();

function prevPage() {
  if (props.currentPage > 0) emit('update:page', props.currentPage - 1)
}

function nextPage() {
  if (props.currentPage < props.totalPages - 1) emit('update:page', props.currentPage + 1)
}

</script>

<template>
  <div class="flex">
  <div class="max-w-xl mx-auto flex justify-center">
    <button @click="prevPage" :disabled="currentPage === 0"
      class="bg-blue-500 text-white p-1 rounded-lg hover:bg-blue-700 hover:text-white border-2 border-blue-500 transition-colors duration-200 shadow-md">
      ‹ Previous
    </button>
  </div>
    <span class="p-2">Page {{ currentPage + 1 }} / {{ totalPages }}</span>
    <div class="max-w-xl mx-auto flex justify-center">
      <button @click="nextPage" :disabled="currentPage === totalPages - 1"
        class="bg-blue-500 text-white p-1 rounded-lg hover:bg-blue-700 hover:text-white border-2 border-blue-500 transition-colors duration-200 shadow-md">
        Next ›
      </button>
    </div>
  </div>
</template>

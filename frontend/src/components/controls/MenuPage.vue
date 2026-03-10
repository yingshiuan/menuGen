<script lang="ts" setup>
const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
}>()

function prevPage() {
  if (props.currentPage > 0) emit('update:page', props.currentPage - 1)
}

function nextPage() {
  if (props.currentPage < props.totalPages - 1) emit('update:page', props.currentPage + 1)
}
</script>

<template>
  <div class="flex gap-2 items-center justify-between">
    <button
      @click="prevPage"
      :disabled="currentPage === 0"
      class="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-700 border-2 border-blue-500 transition-colors duration-200 shadow-md disabled:opacity-50"
    >
      ‹ Previous
    </button>
    <span class="text-sm">Page {{ currentPage + 1 }} / {{ totalPages }}</span>
    <button
      @click="nextPage"
      :disabled="currentPage === totalPages - 1"
      class="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-700 border-2 border-blue-500 transition-colors duration-200 shadow-md disabled:opacity-50"
    >
      Next ›
    </button>
  </div>
</template>

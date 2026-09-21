<script lang="ts" setup>
// One collapsible group of the control panel. A named group (group/section) so the
// hover effects of plain `group` elements inside, like the photo drop zone, stay local.
defineProps<{ title: string; open?: boolean }>()
</script>

<template>
  <details class="group/section py-2" :open="open">
    <summary
      class="flex items-center gap-2 cursor-pointer select-none font-bold list-none [&::-webkit-details-marker]:hidden"
    >
      <span class="text-xs text-gray-500 transition-transform group-open/section:rotate-90"
        >▶</span
      >
      {{ title }}
    </summary>
    <div class="mt-2 flex flex-col gap-2 text-sm">
      <slot />
    </div>
  </details>
</template>

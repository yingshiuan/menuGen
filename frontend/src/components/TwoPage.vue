<script setup lang="ts">
import type { MenuItem } from '@/types/types'
import MenuPreview from './MenuPreview.vue'
import type { ItemSpacing } from '@/components/ItemSpacingControl.vue'

const props = defineProps<{
  items: MenuItem[]
  footerText: string
  fontFamily: string
  bgColor: string
  textColor: string
  itemSpacing: ItemSpacing
  readonly: boolean
  currentPage: number
  itemsPerPage: number
  defaultSrc?: string
  pageWidth: string
  pageHeight: string
  keepCategoryTogether?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:footerText', value: string): void
  (e: 'update:logo', base64: string): void
  (e: 'add-before', payload: { No: string }): void
  (e: 'add-after', payload: { No: string }): void
  (e: 'delete-item', payload: { No: string }): void
  (e: 'reorder', payload: { fromNo: string; toNo: string }): void
  (e: 'update:totalPages', value: number): void
}>()

function handleTotalPagesUpdate(val: number) {
  emit('update:totalPages', val)
}
</script>

<template>
  <div class="two-page-wrapper flex gap-2">
    <!-- Left Page -->
    <MenuPreview
      :items="props.items"
      :font-family="props.fontFamily"
      :bg-color="props.bgColor"
      :text-color="props.textColor"
      :item-spacing="props.itemSpacing"
      :readonly="props.readonly"
      :current-page="props.currentPage * 2"
      :items-per-page="props.itemsPerPage"
      :page-width="props.pageWidth"
      :page-height="props.pageHeight"
      :keep-category-together="props.keepCategoryTogether"
      :footer-text="props.footerText"
      :default-src="props.defaultSrc"
      @add-before="(p) => emit('add-before', p)"
      @add-after="(p) => emit('add-after', p)"
      @delete-item="(p) => emit('delete-item', p)"
      @reorder="(p) => emit('reorder', p)"
      @update:logo="(p) => emit('update:logo', p)"
      @update:totalPages="handleTotalPagesUpdate"
    />

    <!-- Right Page -->
    <MenuPreview
      :items="props.items"
      :font-family="props.fontFamily"
      :bg-color="props.bgColor"
      :text-color="props.textColor"
      :item-spacing="props.itemSpacing"
      :readonly="props.readonly"
      :current-page="props.currentPage * 2 + 1"
      :items-per-page="props.itemsPerPage"
      :page-width="props.pageWidth"
      :page-height="props.pageHeight"
      :keep-category-together="props.keepCategoryTogether"
      :footer-text="props.footerText"
      :default-src="props.defaultSrc"
      @add-before="(p) => emit('add-before', p)"
      @add-after="(p) => emit('add-after', p)"
      @delete-item="(p) => emit('delete-item', p)"
      @reorder="(p) => emit('reorder', p)"
      @update:logo="(p) => emit('update:logo', p)"
      @update:totalPages="handleTotalPagesUpdate"
    />
  </div>
</template>

<style scoped>
.two-page-wrapper {
  display: flex;
  /* justify-content: end; */
  /* translate: -10% 0; */
}
</style>

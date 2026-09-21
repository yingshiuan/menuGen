<script setup lang="ts">
import type { MenuItem } from '@/types/types'
import MenuPreview from '@/components/layouts/MenuPreview.vue'
import type { ItemSpacing } from '@/components/controls/ItemSpacingControl.vue'

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
  (e: 'add-before', payload: { id: string }): void
  (e: 'add-after', payload: { id: string }): void
  (e: 'delete-item', payload: { id: string }): void
  (e: 'reorder', payload: { fromId: string; toId: string }): void
}>()
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

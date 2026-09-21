<script lang="ts" setup>
import { computed, onMounted, onUpdated, ref, reactive, watch } from 'vue'
import type { MenuItem } from '@/types/types'
import { paginateMenu } from '@/domain/menuPages'
import { useMenuLang } from '@/composables/useMenuLang'
import { useMenuTypography } from '@/composables/useMenuTypography'
import { useMenuPhoto } from '@/composables/useMenuPhoto'
import MenuItemComponent from '@/components/layouts/MenuItem.vue'
import LogoUpload from '@/components/AddLogo.vue'
import MeunInfo from '@/components/layouts/MeunInfo.vue'
import type { ItemSpacing } from '@/components/controls/ItemSpacingControl.vue'

/* Props & Emits */
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
  // Dishes are identified by id: numbers can be empty or repeat (side dishes, desserts)
  (e: 'add-before', payload: { id: string }): void
  (e: 'add-after', payload: { id: string }): void
  (e: 'delete-item', payload: { id: string }): void
  (e: 'reorder', payload: { fromId: string; toId: string }): void
}>()

/* State */
const dragState = reactive<{ draggingIndex: number | null; dragOverIndex: number | null }>({
  draggingIndex: null,
  dragOverIndex: null,
})

const logoBase64 = ref<string | null>(props.defaultSrc ?? null)
const tappedIndex = ref<number | null>(null)

const isModalOpen = ref(false)

watch(isModalOpen, () => {
  tappedIndex.value = null
})

/* Domain / Computed */
const { primary } = useMenuLang()
const { fontSize } = useMenuTypography()

const pages = computed(() =>
  paginateMenu(props.items, props.itemsPerPage, props.keepCategoryTogether, primary.value),
)
const totalPages = computed(() => pages.value.length)
const clampedPage = computed(() => Math.min(Math.max(props.currentPage, 0), totalPages.value - 1))
const pageItems = computed(() => pages.value[clampedPage.value] ?? [])

/* Infrastructure / Helpers */
watch(
  () => props.defaultSrc,
  (val) => {
    logoBase64.value = val ?? null
  },
  { immediate: true },
)

// The on-screen page measures how much room headers and dishes get, so "Fill page" can
// work out the photo size that fits the menu's fullest page. (The PDF copy is hidden and
// has no layout, and uses the same numbers.)
const pageRef = ref<HTMLElement | null>(null)
const logoRef = ref<HTMLElement | null>(null)
const footerRef = ref<HTMLElement | null>(null)
const { pageLayout } = useMenuPhoto()

function measureLayout() {
  const page = pageRef.value
  const logo = logoRef.value
  const footer = footerRef.value
  // Only "Fill page" uses the result, and its spacing differs from "Compact"
  if (props.readonly || props.itemSpacing !== 'fill' || !page || !logo || !footer) return

  const header = page.querySelector('h2')
  const box = page.querySelector<HTMLElement>('[data-dish-box]')
  const content = box?.querySelector<HTMLElement>('[data-dish]')
  const areaHeight = footer.offsetTop - (logo.offsetTop + logo.offsetHeight)
  if (!header || !box || !content || areaHeight <= 0) return

  const measured = {
    areaHeight,
    headerHeight: header.offsetHeight + parseFloat(getComputedStyle(header).marginBottom),
    dishMargin: box.offsetHeight - content.offsetHeight,
  }
  if (Object.entries(measured).some(([k, v]) => pageLayout[k as keyof typeof measured] !== v)) {
    Object.assign(pageLayout, measured)
  }
}

onMounted(measureLayout)
onUpdated(measureLayout)

function shouldShowCategoryHeader(index: number) {
  const current = pageItems.value[index]
  const prev = pageItems.value[index - 1]
  if (!current) return false
  return index === 0 || current.category !== prev?.category
}

// Drag & Drop
function onDragStart(e: DragEvent, index: number) {
  // Only start drag if user clicked the handle
  if (!(e.target as HTMLElement).closest('.drag-handle')) {
    e.preventDefault()
    return
  }

  dragState.draggingIndex = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))

  const ghost = document.createElement('div')
  ghost.style.width = '8rem'
  ghost.style.height = '4rem'
  ghost.style.background = 'rgba(0,0,0,0.1)'
  ghost.style.border = '0.1rem solid #aaa'
  ghost.style.borderRadius = '0.2rem'
  ghost.style.position = 'absolute'
  ghost.style.top = '-9999px'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 50, 20)
  setTimeout(() => document.body.removeChild(ghost), 0)
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dragState.dragOverIndex = e.clientY < rect.top + rect.height / 2 ? index : index + 1
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const from = dragState.draggingIndex
  const to = dragState.dragOverIndex
  dragState.draggingIndex = null
  dragState.dragOverIndex = null
  if (from === null || to === null || from === to) return
  const fromItem = pageItems.value[from]?.item
  const toIndex = Math.min(to, pageItems.value.length - 1)
  const toItem = pageItems.value[toIndex]?.item

  if (!fromItem || !toItem) return

  // Optional: handle moving after last item
  if (to === pageItems.value.length) {
    // Move to end
    emit('reorder', {
      fromId: fromItem.id,
      toId: pageItems.value[toIndex - 1]?.item.id ?? fromItem.id,
    })
  } else {
    emit('reorder', { fromId: fromItem.id, toId: toItem.id })
  }
}

/* UI */
const styleObject = computed(() => ({
  fontFamily: `${props.fontFamily ?? 'sans-serif'}, 'Noto Sans TC', sans-serif`,
  backgroundColor: props.bgColor ?? '#ffffff',
  color: props.textColor ?? '#000000',
}))

// "Fill page": boxes share the page height, and flex-col passes that height down so the
// dish photo can grow to fill its box
const itemFlexClass = computed(() =>
  props.itemSpacing === 'fill' ? 'flex-1 flex flex-col' : 'flex-none',
)

const itemSpacingClass = computed(() => {
  switch (props.itemSpacing) {
    case 'compact':
      return 'mb-0'
    case 'normal':
      return 'mb-1'
    case 'spacious':
      return 'mb-1.5'
    default:
      return ''
  }
})
</script>

<template>
  <div
    ref="pageRef"
    class="a4-preview p-6 flex flex-col relative"
    :style="{
      ...styleObject,
      width: props.pageWidth ?? '210mm',
      height: props.pageHeight ?? '297mm',
    }"
  >
    <!-- Logo Section -->
    <div ref="logoRef" class="flex items-start justify-end">
      <LogoUpload
        :default-src="logoBase64 || undefined"
        :readonly="readonly"
        @update:logo="
          (base64: string) => {
            logoBase64 = base64
            emit('update:logo', base64)
          }
        "
      />
    </div>

    <!-- Menu Items Section -->
    <template
      v-for="(entry, index) in pageItems"
      :key="`${clampedPage}-${entry.category}-${entry.item.no || 'item'}-${index}`"
    >
      <!-- Its own row, so "Fill page" gives every dish the same share of the page -->
      <!-- Dropping a dish on the header puts it before the category's first dish -->
      <h2
        v-if="shouldShowCategoryHeader(index)"
        class="flex-none text-xl font-bold mb-1 border-b-1"
        :style="fontSize('category')"
        @dragover.prevent="dragState.dragOverIndex = index"
        @drop="onDrop"
      >
        {{ entry.category }}
      </h2>

      <div
        data-dish-box
        class="group relative"
        :class="[itemFlexClass, itemSpacingClass]"
        @dragover="(e) => onDragOver(e, index)"
        @drop="onDrop"
      >
        <div
          v-if="dragState.dragOverIndex === index"
          data-ui-only
          class="absolute top-0 left-0 w-full h-0.5 bg-blue-500"
        ></div>

        <div
          class="relative transition-all duration-150 rounded-md flex flex-1"
          :class="[
            'transition-all duration-200 ease-in-out',
            dragState.draggingIndex === index ? 'scale-90 opacity-60 z-10' : '',
            tappedIndex === index ? 'scale-102 shadow-sm' : '',
            isModalOpen ? '' : 'group-hover:scale-102 group-hover:shadow-sm',
          ]"
          @click="tappedIndex = tappedIndex === index ? null : index"
        >
          <MenuItemComponent
            class="flex-1"
            :item="entry.item"
            :readonly="readonly"
            :text-color="props.textColor"
            :fill-height="props.itemSpacing === 'fill'"
            @update:item="(updated) => Object.assign(entry.item, updated)"
            @modalOpen="isModalOpen = $event"
          />

          <!-- Overlay Controls -->
          <div
            v-if="!props.readonly"
            data-ui-only
            class="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
            :class="{
              'opacity-0 pointer-events-none': isModalOpen,
              'opacity-100 pointer-events-auto': tappedIndex === index,
              'group-hover:opacity-100 group-hover:pointer-events-auto': !isModalOpen,
            }"
          >
            <button
              class="w-8 h-8 flex items-center justify-center rounded-full shadow-sm hover:bg-blue-500 hover:text-white cursor-pointer"
              @click.stop.prevent="() => emit('add-before', { id: entry.item.id })"
              title="Add item before"
            >
              ＋
            </button>
          </div>
          <div
            v-if="!props.readonly"
            data-ui-only
            class="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
            :class="{
              'opacity-0 pointer-events-none': isModalOpen,
              'opacity-100 pointer-events-auto': tappedIndex === index,
              'group-hover:opacity-100 group-hover:pointer-events-auto': !isModalOpen,
            }"
          >
            <button
              class="w-8 h-8 flex items-center justify-center rounded-full shadow-sm hover:bg-blue-500 hover:text-white cursor-pointer"
              @click.stop.prevent="() => emit('add-after', { id: entry.item.id })"
              title="Add item after"
            >
              ＋
            </button>
          </div>
          <div
            v-if="!props.readonly"
            data-ui-only
            class="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
            :class="{
              'opacity-0 pointer-events-none': isModalOpen,
              'opacity-100 pointer-events-auto': tappedIndex === index,
              'group-hover:opacity-100 group-hover:pointer-events-auto': !isModalOpen,
            }"
          >
            <button
              class="w-8 h-8 flex items-center justify-center text-red-500 rounded-full shadow-sm hover:bg-blue-500 hover:text-white cursor-pointer"
              @click.stop.prevent="() => emit('delete-item', { id: entry.item.id })"
              title="Delete item"
            >
              ✕
            </button>
          </div>
          <div
            v-if="!props.readonly"
            class="drag-handle absolute bottom-0 left-0 text-2xl cursor-move text-gray-400 opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
            :class="{
              'opacity-0 pointer-events-none': isModalOpen,
              'opacity-100 pointer-events-auto': tappedIndex === index,
              'group-hover:opacity-100 group-hover:pointer-events-auto': !isModalOpen,
            }"
            title="Drag to reorder"
            data-ui-only
            @dragstart="(e) => onDragStart(e, index)"
            draggable="true"
          >
            <span
              class="w-10 h-10 flex items-center justify-center rounded-full shadow-sm hover:bg-blue-500 hover:text-white"
            >
              ⠿
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- Footer Section -->
    <div ref="footerRef" class="mt-auto bottom-0 left-0 w-full">
      <MeunInfo
        :footer-text="props.footerText"
        :readonly="readonly"
        show-all
        @update:footerText="(text) => emit('update:footerText', text)"
      />
    </div>
  </div>
</template>

<style>
.a4-preview {
  /* width: 210mm;
  min-height: 297mm; */
  /* border: 1px solid #ccc; */
  /* box-shadow: 0 0 10px rgba(0,0,0,0.2); */
}

@media screen {
  .a4-preview {
    /* transform: scale(0.8); */
    transform-origin: top center;
  }
}

@media print {
  .a4-preview {
    /* width: 210mm;
    min-height: 297mm;
    transform: none !important; */
  }
}
</style>

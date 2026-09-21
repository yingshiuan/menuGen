<script lang="ts" setup>
import { computed, reactive, ref, watch, nextTick } from 'vue'
import type { Lang, MenuItem } from '@/types/types'
import { useIcons } from '@/composables/useIcons'
import { useMenuLang } from '@/composables/useMenuLang'
import { useMenuTypography } from '@/composables/useMenuTypography'
import { useMenuPhoto } from '@/composables/useMenuPhoto'
import { LANG_LABELS, MEASURE_UNIT, cloneMenuItem, isDietaryKey, pickText } from '@/domain/menuItem'
import ImageCropper from '@/components/ImageCropper.vue'

/* Props & Emits */
const props = defineProps<{
  item: MenuItem
  readonly?: boolean // PDF/export mode
  textColor?: string
  fillHeight?: boolean // "Fill page" spacing: the photo grows to the dish box height
}>()

const emit = defineEmits<{
  (e: 'update:item', item: MenuItem): void
  (e: 'modalOpen', val: boolean): void
}>()

/* State */
const local = reactive({
  ...cloneMenuItem(props.item),
  mainImageBase64: props.item.mainImageBase64 || null,
  lastUpdated: props.item.lastUpdated ?? 0,
})

/* Language */
const { primary, extraLangs } = useMenuLang()

const displayName = computed(() => pickText(local.name, primary.value))
// Names after the main one. No fallback: "Szechuan Soup / Szechuan Soup" is worse than
// leaving out a language the dish has no name in.
const extraNameText = (lang: Lang) => local.name[lang]?.trim() ?? ''
const displayDescription = computed(() => pickText(local.description, primary.value))
const displayCategory = computed(() => pickText(local.category, primary.value))
const measureUnit = computed(() => MEASURE_UNIT[primary.value])

const { fontSize } = useMenuTypography()
const { photoSize, showNameRing } = useMenuPhoto()

// v-model for one language of a localized field
function localizedModel(field: 'name' | 'description' | 'category', lang: () => Lang) {
  return computed({
    get: () => local[field][lang()] ?? '',
    set: (value: string) => {
      local[field][lang()] = value
    },
  })
}

const nameText = localizedModel('name', () => primary.value)
const descriptionText = localizedModel('description', () => primary.value)
const categoryText = localizedModel('category', () => primary.value)

interface PictureState {
  visible: boolean
  version: number
}

const pictureState = reactive<PictureState>({
  visible: true,
  version: 0,
})

// const fileInputRef = ref<HTMLInputElement | null>(null)
const displayedPicture = ref<string | null>(null)

// Icon mapping
const { iconMap, getDisplayLabel } = useIcons()

const allOptions = computed(() => Object.keys(iconMap.value))
const otherOptions = computed(() => allOptions.value.filter((o) => o !== 'recommend'))

// Dietary keys live in `dietary`, custom icons in `tags`
function isOn(option: string): boolean {
  return isDietaryKey(option) ? local.dietary[option] : local.tags.includes(option)
}

const displayedRecommend = computed(() => !props.readonly || isOn('recommend'))

const displayedOtherOptions = computed(() =>
  otherOptions.value.filter((opt) => !props.readonly || isOn(opt)),
)

// Toggle Options
function toggleOption(option: string) {
  if (props.readonly) return

  if (isDietaryKey(option)) {
    local.dietary[option] = !local.dietary[option]
  } else {
    const i = local.tags.indexOf(option)
    if (i >= 0) local.tags.splice(i, 1)
    else local.tags.push(option)
  }
  emit('update:item', cloneMenuItem(local))
}

function toggleRecommend() {
  toggleOption('recommend')
}

/* Editing State */
type Field = 'no' | 'name' | 'measure' | 'description' | 'price' | 'category'

// Editing state
const editingState = reactive<Record<Field, boolean>>({
  no: false,
  name: false,
  measure: false,
  description: false,
  price: false,
  category: false,
})

// The extra name being edited, if any (one at a time)
const editingExtraName = ref<Lang | null>(null)

function startEditingExtraName(lang: Lang) {
  if (props.readonly) return
  editingExtraName.value = lang
  nextTick(() => document.getElementById(`name-${lang}`)?.focus())
}

function stopEditingExtraName() {
  editingExtraName.value = null
  emit('update:item', cloneMenuItem(local))
}

// Start/stop editing
function startEditing(field: Field) {
  if (props.readonly) return
  editingState[field] = true

  nextTick(() => {
    document.getElementById(field)?.focus()
  })
}

function stopEditing(field: Field) {
  editingState[field] = false
  // Emit update when stopping edit on any field
  emit('update:item', cloneMenuItem(local))
}

// const isEditingImage = ref(false)

/* Color Logic */
const lighterTextColor = computed(() => {
  const hex = props.textColor ?? '#000000'
  return lightenColor(hex, 40) // 40% lighter
})

function lightenColor(hex: string, percent: number) {
  const num = parseInt(hex.replace('#', ''), 16)
  let r = (num >> 16) & 0xff
  let g = (num >> 8) & 0xff
  let b = num & 0xff

  r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)))
  g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)))
  b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)))

  return `rgb(${r}, ${g}, ${b})`
}

/* Image Logic */

// Run initially and whenever name/no/base64/version change
watch(
  () => [local.mainImageBase64, displayName.value, local.no, props.item.lastUpdated],
  () => {
    updateDisplayedPicture()
  },
  { immediate: true },
)

watch(
  () => local.mainImageBase64,
  (val) => {
    if (val) {
      setDisplayedPicture(val)
    } else {
      updateDisplayedPicture()
    }
  },
  { immediate: true },
)

// Image upload
// function triggerUpload() {
//   if (props.readonly) return
//   // if (isEditingImage.value) return
//   // isEditingImage.value = true
//   emit('modalOpen', true)
// }

function handleModalOpen(val: boolean) {
  // isEditingImage.value = val
  emit('modalOpen', val) // forward up to MenuPreview
  // if (!val) {
  //   // Reset for next click
  //   isEditingImage.value = false;
  // }
}

function onImageError() {
  pictureState.visible = false
}

// function uploadPicture(event: Event) {
//   const file = (event.target as HTMLInputElement).files?.[0]
//   if (!file) return
//   if (!file.type.startsWith('image/')) {
//     alert('Please upload a valid image file')
//     return
//   }

//   const reader = new FileReader()
//   reader.onload = () => {
//     const base64 = reader.result as string
//     const now = Date.now()

//     local.mainImageBase64 = base64
//     local.lastUpdated = now

//     // Emit to parent
//     emit('update:item', { ...local, lastUpdated: now })

//     // Force UI to update immediately
//     setDisplayedPicture(base64)
//   }
//   reader.readAsDataURL(file)

//   if (fileInputRef.value) fileInputRef.value.value = ''
// }

function deletePicture() {
  if (props.readonly) return

  const remainingImages = (local.images ?? []).slice(1)

  const updatedItem: MenuItem = {
    ...cloneMenuItem(local),
    images: remainingImages,
    mainImageBase64: remainingImages[0]?.base64 ?? null,
    lastUpdated: Date.now(),
  }

  emit('update:item', updatedItem)
}

watch(
  () => props.item,
  (newItem) => {
    // Copy, so editing `local` never writes into the parent's item
    Object.assign(local, cloneMenuItem(newItem))
    updateDisplayedPicture()
  },
  { deep: true, immediate: true },
)

function setDisplayedPicture(src: string | null) {
  displayedPicture.value = src
  pictureState.visible = !!src
  pictureState.version++
  // do NOT touch local.mainImageBase64 here
}

// Handle v-model from ImageCropper
function handleImageChange(base64: string | null) {
  local.mainImageBase64 = base64
  local.lastUpdated = Date.now()
  emit('update:item', cloneMenuItem(local))
  setDisplayedPicture(base64)
}

// Update picture when props change
async function updateDisplayedPicture() {
  if (local.mainImageBase64) {
    setDisplayedPicture(local.mainImageBase64)
    return
  }

  // Disabled URL probing. Some files in `/public/picture` are prefixed with a
  // number like `01_Name.png`, others are plain `Name.png`, so this tried each
  // candidate and kept the first that loaded. Restoring it needs the checkImage
  // helper back -- it was deleted here because nothing called it.
  // const candidates: string[] = []
  // if (local.Name) candidates.push(`/picture/${local.Name}.png?v=${Date.now()}`)
  // if (local.No && local.Name) {
  //   const noPadded = local.No.toString().padStart(2, '0')
  //   candidates.push(`/picture/${noPadded}_${local.Name}.png?v=${Date.now()}`)
  // }

  // for (const url of candidates) {
  //   const ok = await checkImage(url)
  //   if (ok) {
  //     setDisplayedPicture(url)
  //     return
  //   }
  // }

  setDisplayedPicture(null)
  // isEditingImage.value = true
}

// for update contain in the items
// watch(
//   local,
//   () => {
//     if (!Object.values(editingState).some((state) => state)) {
//       emit('update:item', local)
//     }
//   },
//   { deep: true },
// )

// A newly added custom icon starts switched on for every dish
watch(allOptions, (newOptions, oldOptions) => {
  const added = newOptions.filter(
    (opt) => !oldOptions.includes(opt) && !isDietaryKey(opt) && !local.tags.includes(opt),
  )
  if (!added.length) return
  local.tags.push(...added)
  // Emit to update parent BEFORE it can sync back and wipe us
  emit('update:item', cloneMenuItem(local))
})
</script>

<template>
  <!-- "Fill page": no gap between dishes, so the photo can use the dish's whole height -->
  <div data-dish :class="props.fillHeight ? 'my-0' : 'my-1'">
    <!-- Dish line (number, names, price); the description sets its own size -->
    <div class="h-full flex items-start gap-2 font-bold text-base" :style="fontSize('name')">
      <!-- Recommend Icon (1em: follows the dish name size; 1lh: centred on the name's first line) -->
      <div class="shrink-0 w-[1em] h-lh flex justify-center items-center">
        <img
          v-if="displayedRecommend"
          :src="iconMap['recommend']"
          class="w-[1em] h-[1em] cursor-pointer hover:opacity-100"
          :class="{
            'opacity-100': isOn('recommend'),
            'opacity-30': !isOn('recommend'),
            'pointer-events-none': props.readonly,
          }"
          @click="toggleRecommend"
          :title="getDisplayLabel('recommend')"
          :data-selected="isOn('recommend')"
        />
      </div>

      <!-- No (em: wide enough for "413" at any dish name size) -->
      <div class="shrink-0 w-[1.75em] text-right">
        <span
          v-if="local.no && !editingState.no"
          @click="startEditing('no')"
          :title="`Click to edit the Number...`"
          class="cursor-pointer"
          >{{ local.no }}</span
        >
        <span
          v-else-if="!local.no && !props.readonly && !editingState.no"
          data-ui-only
          @click="startEditing('no')"
          title="Click to add No..."
          class="opacity-30 cursor-pointer"
        >
          No.
        </span>
        <input
          v-else
          id="no"
          type="number"
          v-model="local.no"
          @blur="stopEditing('no')"
          @keyup.enter="stopEditing('no')"
          :readonly="props.readonly"
          class="border p-1 w-20"
        />
      </div>

      <!-- Name & Extra Names -->
      <div class="flex-1 flex flex-col">
        <div>
          <span
            v-if="displayName && !editingState.name"
            @click="startEditing('name')"
            :title="`Click to edit the Name...`"
            class="cursor-pointer"
            >{{ displayName }}
            <span
              v-if="local.measure && !editingState.measure"
              class="cursor-pointer hover:bg-gray-300 rounded"
              @click.stop="startEditing('measure')"
              :title="`Click to edit the Measure...`"
            >
              ({{ local.measure }} {{ measureUnit }})</span
            >
            <span
              v-else-if="!local.measure && !props.readonly && !editingState.measure"
              data-ui-only
              @click.stop="startEditing('measure')"
              title="Click to add Measure..."
              class="opacity-30 cursor-pointer"
            >
              ({{ measureUnit }})
            </span>
          </span>
          <span
            v-else-if="!displayName && !props.readonly && !editingState.name"
            data-ui-only
            @click="startEditing('name')"
            title="Click to add Name..."
            class="opacity-30 cursor-pointer"
          >
            Click to add Name
          </span>

          <input
            v-else
            id="name"
            v-model="nameText"
            @blur="stopEditing('name')"
            @keyup.enter="stopEditing('name')"
            :readonly="props.readonly"
            :placeholder="displayName"
            class="p-1"
          />
          <!-- Measure editing (inline) -->
          <span v-if="editingState.measure" class="inline-flex items-center gap-1">
            (
            <input
              id="measure"
              v-model="local.measure"
              @blur="stopEditing('measure')"
              @keyup.enter="stopEditing('measure')"
              :readonly="props.readonly"
              class="p-1 w-12 border"
              placeholder="qty"
            />
            {{ measureUnit }})
          </span>
          <!-- Extra Names (e.g. English, Chinese) -->
          <template v-for="lang in extraLangs" :key="lang">
            <span
              v-if="extraNameText(lang) && editingExtraName !== lang"
              class="font-light menu-item whitespace-normal break-keep cursor-pointer"
              @click="startEditingExtraName(lang)"
              :title="`Click to edit the ${LANG_LABELS[lang]} Name...`"
            >
              <span class="inline"> / </span>
              {{ extraNameText(lang) }}
            </span>

            <span
              v-else-if="!extraNameText(lang) && !props.readonly && editingExtraName !== lang"
              data-ui-only
              @click="startEditingExtraName(lang)"
              :title="`Click to add ${LANG_LABELS[lang]} Name...`"
              class="opacity-30 cursor-pointer"
            >
              <span class="inline"> / </span>
              Click to add {{ LANG_LABELS[lang] }} Name
            </span>

            <input
              v-else-if="editingExtraName === lang"
              :id="`name-${lang}`"
              v-model="local.name[lang]"
              @blur="stopEditingExtraName"
              @keyup.enter="stopEditingExtraName"
              :readonly="props.readonly"
              class="p-1 whitespace-normal break-keep"
            />
          </template>
        </div>

        <!-- Description -->
        <div
          class="text-sm font-extralight mt-1"
          :style="{ color: lighterTextColor, ...fontSize('description') }"
        >
          <span
            v-if="!editingState.description && displayDescription"
            @click="startEditing('description')"
            :title="'Click to edit the Description...'"
            class="cursor-pointer"
          >
            {{ displayDescription }}
          </span>

          <span
            v-else-if="!props.readonly && !displayDescription && !editingState.description"
            data-ui-only
            @click="startEditing('description')"
            title="Click to add description..."
            class="opacity-30 cursor-pointer"
          >
            Click to add description
          </span>

          <!-- Textarea for editing -->
          <textarea
            v-if="editingState.description"
            id="description"
            v-model="descriptionText"
            @blur="stopEditing('description')"
            @keyup.enter="stopEditing('description')"
            :readonly="props.readonly"
            class="p-1 w-full"
            :placeholder="displayDescription || 'Click to add description'"
          />
        </div>

        <!-- Category (UI only, hover reveal) -->
        <div class="relative group text-xs font-extralight mt-1" data-ui-only>
          <!-- Hover label -->
          <div
            v-if="!editingState.category && displayCategory"
            class="absolute left-0 top-0 px-2 py-0.5 bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer whitespace-nowrap"
            @click="startEditing('category')"
            title="Click to edit category"
          >
            {{ displayCategory }}
          </div>

          <!-- Empty state -->
          <div
            v-else-if="!editingState.category && !displayCategory && !props.readonly"
            class="absolute left-0 top-0 px-2 py-0.5 bg-gray-200 text-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer whitespace-nowrap"
            @click="startEditing('category')"
          >
            + Category
          </div>

          <!-- Edit mode -->
          <textarea
            v-if="editingState.category"
            id="category"
            v-model="categoryText"
            @blur="stopEditing('category')"
            @keyup.enter="stopEditing('category')"
            class="p-1 w-full border border-gray-300 rounded"
            :placeholder="displayCategory || 'Edit category'"
          />
        </div>
      </div>

      <!-- Other Options (1em: follow the dish name size; 1lh: centred on the name's first line) -->
      <div class="shrink-0 h-lh flex gap-1 justify-start items-center">
        <img
          v-for="opt in displayedOtherOptions"
          :key="opt"
          :src="iconMap[opt]"
          class="w-[1em] h-[1em] cursor-pointer hover:opacity-100"
          :class="{
            'opacity-100': isOn(opt),
            'opacity-30': !isOn(opt),
            'pointer-events-none': props.readonly,
          }"
          @click="toggleOption(opt)"
          :title="getDisplayLabel(opt)"
          :data-selected="isOn(opt)"
        />
      </div>

      <!-- Price (em: wide enough for "42.5" at any dish name size) -->
      <div class="shrink-0 w-[2em] text-right">
        <span
          v-if="local.price && !editingState.price"
          @click="startEditing('price')"
          :title="`Click to edit the Price...`"
          class="cursor-pointer"
          >{{ local.price }}</span
        >
        <span
          v-else-if="!local.price && !props.readonly && !editingState.price"
          data-ui-only
          @click="startEditing('price')"
          title="Click to add Price..."
          class="opacity-30 cursor-pointer"
        >
          $
        </span>
        <input
          v-else
          id="price"
          v-model="local.price"
          @blur="stopEditing('price')"
          @keyup.enter="stopEditing('price')"
          :readonly="props.readonly"
          class="border p-1 w-24"
        />
      </div>

      <!-- Picture: 80px, or with "Fill page" the chosen photo size, shrunk to the dish box on
           a page too full for it; aspect-square keeps it round -->
      <div
        class="shrink-0 min-w-0 aspect-square relative rounded-full cursor-pointer"
        :class="props.fillHeight ? 'h-full min-h-20' : 'h-20'"
        :style="props.fillHeight ? { maxHeight: `${photoSize}px` } : undefined"
      >
        <!-- Normal img: leaves the outer ring free for the curved name, or fills the circle -->
        <div
          v-if="displayedPicture && pictureState.visible"
          class="absolute inset-0 rounded-full overflow-hidden"
          :class="showNameRing ? 'm-[12%] w-[76%] h-[76%]' : 'm-[3%] w-[94%] h-[94%]'"
        >
          <img
            :src="displayedPicture"
            class="w-full h-full object-cover rounded-full transform scale-110 overflow-hidden"
            @error="onImageError"
          />
        </div>

        <!-- Curved text overlay SVG -->
        <svg
          v-if="displayedPicture && pictureState.visible && showNameRing"
          viewBox="0 0 100 100"
          class="absolute inset-0 w-full h-full pointer-events-none"
        >
          <!--d="M 50,50 m -40,0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0"-->
          <path
            :id="`path-${props.item.id}`"
            d="M 50,50 m -42,0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0"
            fill="none"
            stroke="none"
          />
          <text class="font-extralight text-[0.6rem]" :style="{ fill: lighterTextColor }">
            <textPath :href="`#path-${props.item.id}`" startOffset="0%" text-anchor="start">
              {{ displayName }}
            </textPath>
          </text>
        </svg>

        <!-- ImageCropper always mounted — handles both upload trigger and modal events -->
        <ImageCropper
          v-model="local.mainImageBase64"
          variant="picture"
          :src="displayedPicture"
          :readonly="props.readonly"
          @update:modalOpen="handleModalOpen"
          @update:modelValue="handleImageChange"
          class="absolute inset-0 w-full h-full rounded-full font-extralight"
        />

        <!-- Delete button -->
        <div
          v-if="displayedPicture && pictureState.visible && !props.readonly"
          data-ui-only
          class="absolute bottom-0 right-0"
        >
          <button
            class="w-6 h-6 text-xs flex items-center justify-center text-red-500 rounded-full shadow-sm hover:bg-blue-500 hover:text-white px-1 cursor-pointer"
            @click.stop="deletePicture"
            title="Delete picture"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

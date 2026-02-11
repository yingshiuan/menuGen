<script lang="ts" setup>
import { computed, reactive, ref, watch, nextTick } from 'vue'
import type { MenuItem, MenuOption } from '@/types/types'

import RecommendedIcon from '@/asset/svg/recommend.svg'
import SpicyIcon from '@/asset/svg/spicy.svg'
import VeganIcon from '@/asset/svg/vegan.svg'
import VegetarianIcon from '@/asset/svg/vegetarian.svg'
import GlutenFreeIcon from '@/asset/svg/glutenfree.svg'

const props = defineProps<{
  item: MenuItem
  readonly?: boolean // PDF/export mode
  textColor?: string
}>()

const emit = defineEmits<{
  (e: 'update:item', item: MenuItem): void
}>()

const local = reactive({
  ...props.item,
  Options: props.item.Options ? [...props.item.Options] : [],
  mainImageBase64: props.item.mainImageBase64 || null,
  lastUpdated: props.item.lastUpdated ?? 0,
})

interface PictureState {
  visible: boolean
  version: number
}

const pictureState = reactive<PictureState>({
  visible: true,
  version: 0,
})

const fileInputRef = ref<HTMLInputElement | null>(null)

// Icon mapping
const iconMap: Record<MenuOption, string> = {
  Recommend: RecommendedIcon,
  Spicy: SpicyIcon,
  Vegan: VeganIcon,
  Vegetarian: VegetarianIcon,
  'Gluten Free': GlutenFreeIcon,
}

const allOptions = Object.keys(iconMap) as MenuOption[]
const otherOptions = allOptions.filter((o) => o !== 'Recommend')

type Field = 'No' | 'Name' | 'ChineseName' | 'Measure' | 'Description' | 'Price' | 'Category'

// Editing state
const editingState = reactive<Record<Field, boolean>>({
  No: false,
  Name: false,
  ChineseName: false,
  Measure: false,
  Description: false,
  Price: false,
  Category: false,
})

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
  emit('update:item', { ...local })
}

// Toggle Options
function toggleOption(option: MenuOption) {
  if (props.readonly) return

  const list = local.Options
  const i = list.indexOf(option)

  i >= 0 ? list.splice(i, 1) : list.push(option)
}

function toggleRecommend() {
  toggleOption('Recommend')
}

// Display logic
const displayedRecommend = computed(() => !props.readonly || local.Options.includes('Recommend'))

const displayedOtherOptions = computed(() =>
  otherOptions.filter((opt) => !props.readonly || local.Options.includes(opt)),
)

// Determine which picture URL actually exists. Some files in `/public/picture` are
// prefixed with a number like `01_Name.png`, others are plain `Name.png`.
// We probe candidate URLs and pick the first that loads successfully.
const displayedPicture = ref<string | null>(null)

function checkImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

async function updateDisplayedPicture() {
  if (local.mainImageBase64) {
    setDisplayedPicture(local.mainImageBase64)
    return
  }

  const candidates: string[] = []
  if (local.Name) {
    candidates.push(`/picture/${local.Name}.png?v=${Date.now()}`)
  }
  if (local.No && local.Name) {
    const noPadded = local.No.toString().padStart(2, '0')
    candidates.push(`/picture/${noPadded}_${local.Name}.png?v=${Date.now()}`)
  }

  for (const url of candidates) {
    const ok = await checkImage(url)
    if (ok) {
      setDisplayedPicture(url)
      return
    }
  }

  // No image found
  setDisplayedPicture(null)
}

// Run initially and whenever name/no/base64/version change
watch(
  () => [local.mainImageBase64, local.Name, local.No, props.item.lastUpdated],
  () => {
    updateDisplayedPicture()
  },
  { immediate: true },
)

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

// Image upload
function triggerUpload() {
  if (props.readonly) return
  fileInputRef.value?.click()
}

function onImageError() {
  pictureState.visible = false
}

// async function uploadPicture(event: Event){
//   const file = (event.target as HTMLInputElement).files?.[0]
//   if (!file) return

//    const itemNo = local.No;
//   if (!itemNo) {
//     alert('Please enter a No before uploading an image.');
//     return;
//   }

//   if (!file.type.startsWith('image/')) {
//     alert('Please upload a valid image file (PNG, JPG, JPEG, GIF, etc.).');
//     return;
//   }

//   const formData = new FormData();
//   formData.append('image', file);
//   formData.append('No', itemNo.toString());

//   try {
//     uploading.value = true;
//     const response = await fetch('http://localhost:3000/api/upload', {
//       method: 'POST',
//       body: formData,
//     });

//     if (!response.ok) {
//       throw new Error('Failed to upload image');
//     }

//     const data = await response.json();
//     const uploadedFileName = data.fileUrl; // Assuming the backend sends the image URL

//     local.No = uploadedFileName.split('.')[0]; // Update the URL or the field in your local state
//     imageVersion.value += 1; // Trigger re-rendering of the image

//   } catch (error) {
//     console.error('Error uploading image:', error);
//     pictureVisible.value = false;  // Hide image on error
//   } finally {
//     uploading.value = false;
//   }
// };

function setDisplayedPicture(src: string | null) {
  // Clear first to force Vue to re-render
  displayedPicture.value = null
  nextTick(() => {
    displayedPicture.value = src
    pictureState.visible = !!src
    pictureState.version++
  })
}

function uploadPicture(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const base64 = reader.result as string
    const now = Date.now()

    local.mainImageBase64 = base64
    local.lastUpdated = now

    // Emit to parent
    emit('update:item', { ...local, lastUpdated: now })

    // Force UI to update immediately
    setDisplayedPicture(base64)
  }
  reader.readAsDataURL(file)

  if (fileInputRef.value) fileInputRef.value.value = ''
}

function deletePicture() {
  if (props.readonly) return

  local.mainImageBase64 = null
  local.lastUpdated = Date.now()

  setDisplayedPicture(null)

  emit('update:item', { ...local, mainImageBase64: null, lastUpdated: local.lastUpdated })
}

watch(
  () => props.item,
  (newItem) => {
    Object.assign(local, newItem)
    updateDisplayedPicture()
  },
  { deep: true, immediate: true },
)

// for update contain in the items
watch(
  local,
  () => {
    if (!Object.values(editingState).some((state) => state)) {
      emit('update:item', local)
    }
  },
  { deep: true },
)
</script>

<template>
  <div class="my-1">
    <div class="flex items-start gap-2 font-bold text-sm">
      <!-- Recommend Icon -->
      <div class="shrink-0 w-4 flex justify-center items-center">
        <img
          v-if="displayedRecommend"
          :src="iconMap['Recommend']"
          class="w-4 h-4 cursor-pointer hover:opacity-100"
          :class="{
            'opacity-100': local.Options.includes('Recommend'),
            'opacity-30': !local.Options.includes('Recommend'),
            'pointer-events-none': props.readonly,
          }"
          @click="toggleRecommend"
          title="Recommend"
          :data-selected="local.Options.includes('Recommend')"
        />
      </div>

      <!-- No -->
      <div class="shrink-0 w-6 text-right">
        <span
          v-if="local.No && !editingState.No"
          @click="startEditing('No')"
          :title="`Click to edit the Number...`"
          class="cursor-pointer"
          >{{ local.No }}</span
        >
        <span
          v-else-if="!local.No && !props.readonly && !editingState.No"
          data-ui-only
          @click="startEditing('No')"
          title="Click to add No..."
          class="opacity-30 cursor-pointer"
        >
          No.
        </span>
        <input
          v-else
          id="No"
          type="number"
          v-model="local.No"
          @blur="stopEditing('No')"
          @keyup.enter="stopEditing('No')"
          :readonly="props.readonly"
          class="border p-1 w-20"
        />
      </div>

      <!-- Name & Chinese Name -->
      <div class="flex-1 flex flex-col">
        <div>
          <span
            v-if="local.Name && !editingState.Name"
            @click="startEditing('Name')"
            :title="`Click to edit the Name...`"
            class="cursor-pointer"
            >{{ local.Name }}
            <span
              v-if="local.Measure && !editingState.Measure"
              class="cursor-pointer hover:bg-gray-300 rounded"
              @click.stop="startEditing('Measure')"
              :title="`Click to edit the Measure...`"
            >
              ({{ local.Measure }} pcs)</span
            >
            <span
              v-else-if="!local.Measure && !props.readonly && !editingState.Measure"
              data-ui-only
              @click.stop="startEditing('Measure')"
              title="Click to add Measure..."
              class="opacity-30 cursor-pointer"
            >
              (pcs)
            </span>
          </span>
          <span
            v-else-if="!local.Name && !props.readonly && !editingState.Name"
            data-ui-only
            @click="startEditing('Name')"
            title="Click to add Name..."
            class="opacity-30 cursor-pointer"
          >
            Click to add Name
          </span>

          <input
            v-else
            id="Name"
            v-model="local.Name"
            @blur="stopEditing('Name')"
            @keyup.enter="stopEditing('Name')"
            :readonly="props.readonly"
            class="p-1"
          />
          <!-- Measure editing (inline) -->
          <span v-if="editingState.Measure" class="inline-flex items-center gap-1">
            (
            <input
              id="Measure"
              v-model="local.Measure"
              @blur="stopEditing('Measure')"
              @keyup.enter="stopEditing('Measure')"
              :readonly="props.readonly"
              class="p-1 w-12 border"
              placeholder="qty"
            />
            pcs)
          </span>
          <!-- Chinese Name -->
          <span
            v-if="local.ChineseName && !editingState.ChineseName"
            class="font-light menu-item whitespace-normal break-keep cursor-pointer"
            @click="startEditing('ChineseName')"
            title="Click to edit the Chinese Name..."
          >
            <span class="inline"> / </span>
            {{ local.ChineseName }}
          </span>

          <span
            v-else-if="!local.ChineseName && !props.readonly && !editingState.ChineseName"
            data-ui-only
            @click="startEditing('ChineseName')"
            title="Click to add Chinese Name..."
            class="opacity-30 cursor-pointer"
          >
            <span class="inline"> / </span>
            Click to add Chinese Name
          </span>

          <input
            v-else
            id="ChineseName"
            v-model="local.ChineseName"
            @blur="stopEditing('ChineseName')"
            @keyup.enter="stopEditing('ChineseName')"
            :readonly="props.readonly"
            class="p-1 whitespace-normal break-keep"
          />
        </div>

        <!-- Description -->
        <div class="font-extralight mt-1" :style="{ color: lighterTextColor }">
          <span
            v-if="!editingState.Description && local.Description"
            @click="startEditing('Description')"
            :title="'Click to edit the Description...'"
            class="cursor-pointer"
          >
            {{ local.Description }}
          </span>

          <span
            v-else-if="!props.readonly && !local.Description && !editingState.Description"
            data-ui-only
            @click="startEditing('Description')"
            title="Click to add description..."
            class="opacity-30 cursor-pointer"
          >
            Click to add description
          </span>

          <!-- Textarea for editing -->
          <textarea
            v-if="editingState.Description"
            id="Description"
            v-model="local.Description"
            @blur="stopEditing('Description')"
            @keyup.enter="stopEditing('Description')"
            :readonly="props.readonly"
            class="p-1 w-full"
            placeholder="Click to add description"
          />
        </div>

        <!-- Category (UI only, hover reveal) -->
        <div class="relative group text-xs font-extralight mt-1" data-ui-only>
          <!-- Hover label -->
          <div
            v-if="!editingState.Category && local.Category"
            class="absolute left-0 top-0 px-2 py-0.5 bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer whitespace-nowrap"
            @click="startEditing('Category')"
            title="Click to edit category"
          >
            {{ local.Category }}
          </div>

          <!-- Empty state -->
          <div
            v-else-if="!editingState.Category && !local.Category && !props.readonly"
            class="absolute left-0 top-0 px-2 py-0.5 bg-gray-200 text-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer whitespace-nowrap"
            @click="startEditing('Category')"
          >
            + Category
          </div>

          <!-- Edit mode -->
          <textarea
            v-if="editingState.Category"
            id="Category"
            v-model="local.Category"
            @blur="stopEditing('Category')"
            @keyup.enter="stopEditing('Category')"
            class="p-1 w-full border border-gray-300 rounded"
            placeholder="Edit category"
          />
        </div>
      </div>

      <!-- Other Options -->
      <div class="shrink-0 flex gap-1 justify-start items-center">
        <img
          v-for="opt in displayedOtherOptions"
          :key="opt"
          :src="iconMap[opt]"
          class="w-4 h-4 cursor-pointer hover:opacity-100"
          :class="{
            'opacity-100': local.Options.includes(opt as MenuOption),
            'opacity-30': !local.Options.includes(opt as MenuOption),
            'pointer-events-none': props.readonly,
          }"
          @click="toggleOption(opt as MenuOption)"
          :title="opt"
          :data-selected="local.Options.includes(opt)"
        />
      </div>

      <!-- Price -->
      <div class="w-8 text-right">
        <span
          v-if="local.Price && !editingState.Price"
          @click="startEditing('Price')"
          :title="`Click to edit the Price...`"
          class="cursor-pointer"
          >{{ local.Price }}</span
        >
        <span
          v-else-if="!local.Price && !props.readonly && !editingState.Price"
          data-ui-only
          @click="startEditing('Price')"
          title="Click to add Price..."
          class="opacity-30 cursor-pointer"
        >
          $
        </span>
        <input
          v-else
          id="Price"
          v-model="local.Price"
          @blur="stopEditing('Price')"
          @keyup.enter="stopEditing('Price')"
          :readonly="props.readonly"
          class="border p-1 w-24"
        />
      </div>

      <!-- Picture -->
      <!-- min-w and min-h need to change by the w-20 and h-20-->
      <div
        
        class="shrink-0 w-20 h-20 relative rounded-full cursor-pointer overflow-hidden"
        @click="triggerUpload"
      >
        <!-- Normal img -->
        <div
          v-if="displayedPicture && pictureState.visible"
          class="absolute inset-0 rounded-full overflow-hidden m-[12%] w-[76%] h-[76%]"
        >
          <img
            v-if="displayedPicture && pictureState.visible"
            :src="displayedPicture"
            class="w-full h-full object-cover rounded-full transform scale-110 overflow-hidden"
            @error="onImageError"
          />
        </div>

        <!-- Curved text overlay (SVG only for text path) -->
        <svg
          v-if="displayedPicture && pictureState.visible"
          viewBox="0 0 100 100"
          class="absolute inset-0 w-full h-full pointer-events-none"
        >
          <path
            :id="`path-${props.item.id}`"
            d="M 50,50 m -40,0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0"
            fill="none"
            stroke="none"
          />

          <text class="font-extralight text-[0.6rem]" :style="{ fill: lighterTextColor }">
            <textPath :href="`#path-${props.item.id}`" startOffset="0%" text-anchor="start">
              {{ local.Name }}
            </textPath>
          </text>
        </svg>

        <!-- Delete button -->
        <div
          v-if="displayedPicture && pictureState.visible && !props.readonly"
          data-ui-only
          class="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        >
          <button
            class="w-3.5 h-3.5 text-xs flex items-center justify-center text-red-500 rounded-full shadow-sm hover:bg-blue-500 hover:text-white px-1 cursor-pointer"
            @click.stop="deletePicture"
            title="Delete picture"
          >
            ✕
          </button>
        </div>

        <!-- Upload fallback -->
        <div
          v-if="!displayedPicture || !pictureState.visible"
          class="absolute inset-0 flex items-center justify-center opacity-30 hover:bg-gray-100 hover:text-gray-600 hover:opacity-100 rounded-full"
        >
          <span v-if="!props.readonly">Upload</span>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          accept="image/*"
          @change="uploadPicture"
        />
      </div>
    </div>
  </div>
</template>

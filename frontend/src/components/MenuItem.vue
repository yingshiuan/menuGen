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

type Field = 'No' | 'Name' | 'ChineseName' | 'Description' | 'Price'

// Editing state
const editingState = reactive<Record<Field, boolean>>({
  No: false,
  Name: false,
  ChineseName: false,
  Description: false,
  Price: false,
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
  // If user uploaded/selected a base64 image, use it immediately
  if (local.pictureBase64) {
    displayedPicture.value = local.pictureBase64
    pictureState.visible = true
    return
  }

  // Prepare candidate paths (try name-only first, then numbered prefixed)
  const candidates: string[] = []
  if (local.Name) {
    candidates.push(`/picture/${local.Name}.png?v=${pictureState.version}`)
  }
  if (local.No && local.Name) {
    const noPadded = local.No.toString().padStart(2, '0')
    candidates.push(`/picture/${noPadded}_${local.Name}.png?v=${pictureState.version}`)
  }

  // Try each candidate and pick the first that exists
  for (const url of candidates) {
    const ok = await checkImage(url)
    if (ok) {
      displayedPicture.value = url
      pictureState.visible = true
      return
    }
  }

  // Nothing found
  displayedPicture.value = null
  pictureState.visible = false
}

// Run initially and whenever name/no/base64/version change
watch(
  () => [local.pictureBase64, local.Name, local.No, pictureState.version],
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

async function uploadPicture(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file (PNG, JPG, JPEG, GIF, etc.)')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    local.pictureBase64 = reader.result as string
    pictureState.version += 1
  }
  reader.readAsDataURL(file)
}

// Emit changes to parent
watch(local, () => emit('update:item', local), { deep: true })
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
          v-if="!editingState.No"
          @click="startEditing('No')"
          :title="`Click to edit the Number...`"
          >{{ local.No || '-' }}</span
        >
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
      <div class="grow flex flex-col">
        <div>
          <span
            v-if="!editingState.Name"
            @click="startEditing('Name')"
            :title="`Click to edit the Name...`"
            >{{ local.Name }}
            <span v-if="local.Measure" class=""> ({{ local.Measure }} pcs)</span>
          </span>

          <input
            v-else
            id="Name"
            v-model="local.Name"
            @blur="stopEditing('Name')"
            @keyup.enter="stopEditing('Name')"
            :readonly="props.readonly"
            class="p-1 flex-1"
          />
          <!-- Chinese Name -->
          <span v-if="local.ChineseName" class="font-light">
            <span class="inline"> / </span>
            <span
              v-if="!editingState.ChineseName"
              @click="startEditing('ChineseName')"
              :title="`Click to edit the ChineseName...`"
              class="menu-item whitespace-normal break-keep"
              >{{ local.ChineseName }}</span
            >
            <input
              v-else
              id="ChineseName"
              v-model="local.ChineseName"
              @blur="stopEditing('ChineseName')"
              @keyup.enter="stopEditing('ChineseName')"
              :readonly="props.readonly"
              class="p-1 whitespace-normal break-keep"
            />
          </span>
        </div>

        <!-- Description -->
        <div class="font-extralight mt-1" :style="{ color: lighterTextColor }">
          <span
            v-if="!editingState.Description && local.Description"
            @click="startEditing('Description')"
            :title="'Click to edit the Description...'"
          >
            {{ local.Description }}
          </span>

          <span
            v-else-if="!props.readonly && !local.Description && !editingState.Description"
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
          v-if="!editingState.Price"
          @click="startEditing('Price')"
          :title="`Click to edit the Price...`"
          >{{ local.Price }}</span
        >
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
        v-if="displayedPicture || !props.readonly"
        class="shrink-0 w-20 h-20 flex justify-center items-center relative rounded-full overflow-hidden cursor-pointer"
        :class="displayedPicture && pictureState.visible ? 'border border-gray-300' : ''"
        @click="triggerUpload"
        style="min-width: 5rem; min-height: 5rem"
      >
        <!-- Image exists and loaded -->
        <img
          v-if="displayedPicture && pictureState.visible"
          :src="displayedPicture"
          alt="Item Picture"
          class="w-full h-full object-cover rounded-full transform scale-110 overflow-hidden"
          @error="onImageError"
        />

        <div
          v-else
          class="w-full h-full flex justify-center items-center opacity-30 hover:bg-gray-100 hover:text-gray-600 hover:opacity-100 rounded-full"
          :class="!displayedPicture && props.readonly ? '' : 'bg-transparent'"
        >
          <span v-if="!props.readonly" :title="`Click to upload the Picture...`">Upload</span>
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

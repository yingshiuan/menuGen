<script lang="ts" setup>
import { computed, reactive, ref, watch, nextTick } from 'vue'
import type { MenuItem, MenuOption } from '@/types/types'

import RecommendedIcon from '@/asset/svg/recommend.svg'
import SpicyIcon from '@/asset/svg/spicy.svg'
import VeganIcon from '@/asset/svg/vegan.svg'
import VegetarianIcon from '@/asset/svg/vegetarian.svg'
import GlutenFreeIcon from '@/asset/svg/glutenfree.svg'

const props = defineProps<{ 
  item: MenuItem,
  readonly?: boolean // PDF/export mode
}>()

const emit = defineEmits<{
  (e: 'update:item', item: MenuItem): void
}>()

const local = reactive({
  ...props.item,
  Options: props.item.Options ? [...props.item.Options] : [],
  pictureBase64: ''
})

interface PictureState{
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
  GlutenFree: GlutenFreeIcon
}

const allOptions = Object.keys(iconMap) as MenuOption[]
const otherOptions = allOptions.filter(o => o !== 'Recommend')

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
const displayedRecommend = computed(() =>
  !props.readonly || local.Options.includes('Recommend')
)

const displayedOtherOptions = computed(() =>
  otherOptions.filter(opt => !props.readonly || local.Options.includes(opt))
)


const displayedPicture = computed(() => {
  if (local.pictureBase64) return local.pictureBase64;
  if (local.No && local.Name) {
    const noPadded = local.No.toString().padStart(2, '0');
    return `/picture/${noPadded}_${local.Name}.png?v=${pictureState.version}`;
  }
  return null;
});

watch(displayedPicture, () => {
  pictureState.visible = true
})


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
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file (PNG, JPG, JPEG, GIF, etc.)');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    local.pictureBase64 = reader.result as string;
    pictureState.version += 1;
  };
  reader.readAsDataURL(file);
}

// Emit changes to parent
watch(local, () => emit('update:item', local), { deep: true })
</script>


<template>
<div class="my-3">
  <div class="flex items-start gap-2 font-bold text-sm">
    <!-- Recommend Icon -->
    <div class="flex-shrink-0 w-4 flex justify-center items-center">
      <img
        v-if="displayedRecommend"
        :src="iconMap['Recommend']"
        class="w-4 h-4 cursor-pointer"
        :class="{
          'opacity-100': local.Options.includes('Recommend'),
          'opacity-30': !local.Options.includes('Recommend'),
          'pointer-events-none': props.readonly
        }"
        @click="toggleRecommend"
        title="Recommend"
        :data-selected="local.Options.includes('Recommend')"
      />
    </div>

    <!-- No -->
    <div class="flex-shrink-0 w-8 text-right">
      <span v-if="!editingState.No" @click="startEditing('No')">{{ local.No || "-" }}</span>
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
    <div class="flex-grow flex flex-col">
      <div>
        <span v-if="!editingState.Name" @click="startEditing('Name')">{{ local.Name }}</span>
        <input
          v-else
          id="Name"
          v-model="local.Name"
          @blur="stopEditing('Name')"
          @keyup.enter="stopEditing('Name')"
          :readonly="props.readonly"
          class="border p-1 flex-1"
        />
        <span v-if="local.ChineseName" class="font-light">
          / 
          <span v-if="!editingState.ChineseName" @click="startEditing('ChineseName')">{{ local.ChineseName }}</span>
          <input
            v-else
            id="ChineseName"
            v-model="local.ChineseName"
            @blur="stopEditing('ChineseName')"
            @keyup.enter="stopEditing('ChineseName')"
            :readonly="props.readonly"
            class="border p-1 flex-1"
          />
        </span>
      </div>

      <!-- Description -->
      <div class="font-extralight text-gray-700 mt-1">
        <span v-if="!editingState.Description" @click="startEditing('Description')">{{ local.Description }}</span>
        <textarea
          v-else
          id="Description"
          v-model="local.Description"
          @blur="stopEditing('Description')"
          :readonly="props.readonly"
          class="border p-1 w-full"
        />
      </div>
    </div>

    <!-- Other Options -->
    <div class="flex-shrink-0 flex gap-1 flex-wrap items-center">
      <img
        v-for="opt in displayedOtherOptions"
        :key="opt"
        :src="iconMap[opt]"
        class="w-4 h-4 cursor-pointer"
        :class="{
          'opacity-100': local.Options.includes(opt as MenuOption),
          'opacity-30': !local.Options.includes(opt as MenuOption),
          'pointer-events-none': props.readonly
        }"
        @click="toggleOption(opt as MenuOption)"
        :title="opt"
        :data-selected="local.Options.includes(opt)"
      />
    </div>

    <!-- Price -->
    <div class="w-12 text-right">
      <span v-if="!editingState.Price" @click="startEditing('Price')">{{ local.Price}}</span>
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
    <div 
      v-if=" displayedPicture || !props.readonly"
      class="flex-shrink-0 w-24 h-24 flex justify-center items-center relative rounded-full overflow-hidden cursor-pointer"
      :class="displayedPicture && pictureState.visible? 'border border-gray-300' : ''"
      @click="triggerUpload"
    >
      <!-- Image exists and loaded -->
      <img
        v-if="displayedPicture && pictureState.visible"
        :src="displayedPicture"
        alt="Item Picture"
        class="w-full h-auto object-cover rounded-full transform scale-110 overflow-hidden"
        @error="onImageError"
      />

      <div v-else class="w-full h-full flex justify-center items-center hover:bg-gray-100"
        :class="!displayedPicture && props.readonly ? '' : 'bg-transparent'"
      >
        <span v-if="!props.readonly" class="text-sm">Upload</span>
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
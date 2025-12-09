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

const emit = defineEmits(['update:item'])

// Local reactive copy to avoid mutating props
const local = reactive({
  ...props.item,
  Options: props.item.Options ? [...props.item.Options] : []
})

// Refs
const pictureVisible = ref(true)
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageVersion = ref(0)

// Picture source computed
const pictureSrc = computed(() => {
  if (!local.No || !local.Name) return null
  const noPadded = local.No.toString().padStart(2, '0')
  return `/picture/${noPadded}_${local.Name}.png?v=${imageVersion.value}`
})

// Watch pictureSrc to reset visibility
watch(pictureSrc, () => {
  pictureVisible.value = true
})

// Icon mapping
const iconMap: Record<MenuOption, string> = {
  Recommend: RecommendedIcon,
  Spicy: SpicyIcon,
  Vegan: VeganIcon,
  Vegetarian: VegetarianIcon,
  GlutenFree: GlutenFreeIcon
}

// Editing state
const editingField = reactive<{ [key: string]: boolean }>({
  No: false,
  Name: false,
  ChineseName: false,
  Description: false,
  Price: false
})

// Start/stop editing
const startEditing = (field: string) => {
  if (props.readonly) return
  editingField[field] = true
  nextTick(() => {
    const input = document.getElementById(field) as HTMLInputElement | null
    input?.focus()
  })
}
const stopEditing = (field: string) => {
  editingField[field] = false
}

// Toggle Options
const toggleRecommend = () => {
  if (props.readonly) return
  if (local.Options.includes('Recommend')) local.Options = local.Options.filter(o => o !== 'Recommend')
  else local.Options.push('Recommend')
}

const otherOptions = computed(() => Object.keys(iconMap).filter(o => o !== 'Recommend') as MenuOption[])
const toggleOption = (opt: MenuOption) => {
  if (props.readonly) return
  const index = local.Options.indexOf(opt)
  if (index >= 0) local.Options.splice(index, 1)
  else local.Options.push(opt)
}

// Display logic
const displayedRecommend = computed(() => !props.readonly || local.Options.includes('Recommend'))
const displayedOtherOptions = computed(() => otherOptions.value.filter(opt => !props.readonly || local.Options.includes(opt)))

// Image upload
const triggerUpload = () => fileInputRef.value?.click()
const onImageError = () => pictureVisible.value = false
const uploadPicture = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  // handle upload via API here
  imageVersion.value += 1
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
      <span v-if="!editingField.No" @click="startEditing('No')">{{ local.No }}</span>
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
        <span v-if="!editingField.Name" @click="startEditing('Name')">{{ local.Name }}</span>
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
          <span v-if="!editingField.ChineseName" @click="startEditing('ChineseName')">{{ local.ChineseName }}</span>
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
        <span v-if="!editingField.Description" @click="startEditing('Description')">{{ local.Description }}</span>
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
      <span v-if="!editingField.Price" @click="startEditing('Price')">{{ local.Price }}</span>
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
      v-if="pictureSrc || !props.readonly" 
      class="flex-shrink-0 w-24 h-24 flex justify-center items-center relative rounded-full overflow-hidden cursor-pointer"
      :class="pictureSrc ? '' : 'border border-gray-300'"
      @click="!props.readonly ? triggerUpload : null"
    >
      <!-- Image exists and loaded -->
      <img
        v-if="pictureSrc && pictureVisible"
        :src="pictureSrc"
        alt="Item Picture"
        class="w-full h-full object-cover"
        @error="onImageError"
      />

      <div v-else class="w-full h-full flex justify-center items-center bg-gray-100"
        :class="!props.readonly ? '' : 'bg-transparent'"
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

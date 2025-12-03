<script lang="ts" setup>
import type { MenuItem, MenuOption } from '@/types/types'

// Import SVGs from src/assets/svg
import RecommendedIcon from '@/asset/svg/recommend.svg'
import SpicyIcon from '@/asset/svg/spicy.svg'
import VeganIcon from '@/asset/svg/vegan.svg'
import VegetarianIcon from '@/asset/svg/vegetarian.svg'
import GlutenFreeIcon from '@/asset/svg/glutenfree.svg'

const props = defineProps<{ item: MenuItem }>()
// const pictureSrc = ref('')

// Map item properties to icons for easier rendering
const iconMap: Record<MenuOption, string> = {
  Recommend: RecommendedIcon,
  Spicy: SpicyIcon,
  Vegan: VeganIcon,
  Vegetarian: VegetarianIcon,
  GlutenFree: GlutenFreeIcon,
}

const titleMap: Record<MenuOption, string> = {
  Recommend: 'Recommended',
  Spicy: 'Spicy',
  Vegan: 'Vegan',
  Vegetarian: 'Vegetarian',
  GlutenFree: 'GlutenFree',
}



const noPadded = props.item.No.toString().padStart(2, '0')
const pictureSrc = `/picture/${noPadded}_${props.item.Name}.png`

</script>

<template>
  <div class="my-3">
    <!-- Row: Recommend | No | Name/ChineseName | Options | Price | Picture -->
    <div class="flex items-start gap-2 font-bold text-sm">

      <!-- Recommend -->
      <div class="flex-shrink-0 w-4 flex justify-center items-center">
        <img
          v-if="props.item.Options?.includes('Recommend')"
          :src="iconMap['Recommend']"
          :alt="titleMap['Recommend']"
          :title="titleMap['Recommend']"
          class="w-4 h-4"
        />
      </div>

      <!-- No -->
      <div class="flex-shrink-0 w-8 text-left flex justify-end items-end">
        {{ props.item.No }}
      </div>

      <!-- Name / ChineseName + Description -->
      <div class="flex-grow flex flex-col">
        <div class="">
          <span>{{ props.item.Name }}</span>
          <span class="font-light" v-if="props.item.ChineseName"> / {{ props.item.ChineseName }}</span>
        </div>
        <div class="font-extralight text-gray-700 mt-1">
          {{ props.item.Description }}
        </div>
      </div>

      <!-- Options -->
      <div class="flex-shrink-0 flex gap-1 flex-wrap items-center">
        <img
          v-for="option in props.item.Options?.filter(o => o !== 'Recommend') || []"
          :key="option"
          :src="iconMap[option]"
          :alt="titleMap[option]"
          :title="titleMap[option]"
          class="w-4 h-4"
        />
      </div>

      <!-- Price -->
      <div class="flex-shrink-0 w-12 text-right">
        {{ props.item.Price }}
      </div>

      <!-- Picture -->
      <div class="flex-shrink-0 w-24 h-24 flex justify-center items-center">
      <img
        :src="pictureSrc"
        alt="Item Picture"
        class="w-24 h-24 rounded-full border border-gray-300"
        v-if="pictureSrc"
        @error="($event: Event) => ($event.target as HTMLImageElement).style.display = 'none'"
      />
    </div>
      
    </div>
  </div>
</template>





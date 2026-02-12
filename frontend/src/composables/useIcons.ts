import { ref, computed, watch, onMounted } from 'vue'
import type { MenuOption } from '@/types/types'

import RecommendedIcon from '@/asset/svg/recommend.svg'
import SpicyIcon from '@/asset/svg/spicy.svg'
import VeganIcon from '@/asset/svg/vegan.svg'
import VegetarianIcon from '@/asset/svg/vegetarian.svg'
import GlutenFreeIcon from '@/asset/svg/glutenfree.svg'

const defaultIcons: Record<MenuOption, string> = {
  Recommend: RecommendedIcon,
  Spicy: SpicyIcon,
  Vegan: VeganIcon,
  Vegetarian: VegetarianIcon,
  'Gluten Free': GlutenFreeIcon,
}

const userIcons = ref<Partial<Record<MenuOption, string>>>({})

const iconMap = computed<Record<MenuOption, string>>(() => {
  const merged = {} as Record<MenuOption, string>

  for (const key in defaultIcons) {
    const option = key as MenuOption
    merged[option] = userIcons.value[option] || defaultIcons[option]
  }

  return merged
})

function setUserIcon(option: MenuOption, base64: string) {
  userIcons.value[option] = base64
}

function resetIcon(option: MenuOption) {
  delete userIcons.value[option]
}

watch(
  userIcons,
  (val) => {
    localStorage.setItem('menu-user-icons', JSON.stringify(val))
  },
  { deep: true }
)

onMounted(() => {
  const saved = localStorage.getItem('menu-user-icons')
  if (saved) {
    userIcons.value = JSON.parse(saved)
  }
})

export function useIcons() {
  return {
    iconMap,
    setUserIcon,
    resetIcon,
  }
}

import { ref, computed, watch, onMounted } from 'vue'
import type { MenuOption } from '@/types/types'

// Import SVG files and wrap them as data URIs for PDF export compatibility
import RecommendedIconSvg from '@/asset/svg/recommend.svg?raw'
import SpicyIconSvg from '@/asset/svg/spicy.svg?raw'
import VeganIconSvg from '@/asset/svg/vegan.svg?raw'
import VegetarianIconSvg from '@/asset/svg/vegetarian.svg?raw'
import GlutenFreeIconSvg from '@/asset/svg/glutenfree.svg?raw'

// Convert raw SVG strings to data URIs for consistent rendering across browser and PDF
const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
  return `data:image/svg+xml;utf8,${encoded}`
}

const defaultIcons: Record<MenuOption, string> = {
  Recommend: svgToDataUri(RecommendedIconSvg),
  Spicy: svgToDataUri(SpicyIconSvg),
  Vegan: svgToDataUri(VeganIconSvg),
  Vegetarian: svgToDataUri(VegetarianIconSvg),
  'Gluten Free': svgToDataUri(GlutenFreeIconSvg),
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
  { deep: true },
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

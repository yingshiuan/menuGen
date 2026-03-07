import { ref, computed } from 'vue'
import type { MenuOption } from '@/types/types'

import RecommendedIconSvg from '@/asset/svg/recommend.svg?raw'
import SpicyIconSvg from '@/asset/svg/spicy.svg?raw'
import VeganIconSvg from '@/asset/svg/vegan.svg?raw'
import VegetarianIconSvg from '@/asset/svg/vegetarian.svg?raw'
import GlutenFreeIconSvg from '@/asset/svg/glutenfree.svg?raw'

const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

export const defaultIcons: Record<MenuOption, string> = {
  Recommend: svgToDataUri(RecommendedIconSvg),
  Spicy: svgToDataUri(SpicyIconSvg),
  Vegan: svgToDataUri(VeganIconSvg),
  Vegetarian: svgToDataUri(VegetarianIconSvg),
  'Gluten Free': svgToDataUri(GlutenFreeIconSvg),
}

const userIcons = ref<Partial<Record<MenuOption, string>>>({})
const userColors = ref<Partial<Record<MenuOption, string>>>({})
const coloredIcons = ref<Partial<Record<MenuOption, string>>>({})

// ── iconMap: colored version > user icon > default ──
const iconMap = computed<Record<MenuOption, string>>(() => {
  const merged = {} as Record<MenuOption, string>
  for (const key in defaultIcons) {
    const option = key as MenuOption
    merged[option] =
      coloredIcons.value[option] ??
      userIcons.value[option] ??
      defaultIcons[option]
  }
  return merged
})

// ── Color application ──
async function applyColorToImage(dataUri: string, color: string): Promise<string> {
  try {
    let svgStr = ''
    if (dataUri.startsWith('data:image/svg+xml;base64,'))
      svgStr = atob(dataUri.replace('data:image/svg+xml;base64,', ''))
    else if (dataUri.startsWith('data:image/svg+xml;utf8,'))
      svgStr = decodeURIComponent(dataUri.replace('data:image/svg+xml;utf8,', ''))
    else if (dataUri.startsWith('data:image/svg+xml,'))
      svgStr = decodeURIComponent(dataUri.replace('data:image/svg+xml,', ''))

    if (svgStr) {
      const colored = svgStr
        .replace(/fill="(?!none)[^"]*"/g, '')
        .replace(/fill:\s*(?!none)[^;"}]*/g, '')
        .replace('<svg', `<svg fill="${color}"`)
      return `data:image/svg+xml;utf8,${encodeURIComponent(colored)}`
    }

    // PNG/JPG — canvas overlay
    return await applyColorOverlayCanvas(dataUri, color)
  } catch {
    return dataUri
  }
}

function applyColorOverlayCanvas(dataUri: string, color: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width || 24
      canvas.height = img.height || 24
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUri); return }
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = color
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUri)
    img.src = dataUri
  })
}

async function applyAndStoreColor(option: MenuOption, color: string) {
  const base = userIcons.value[option] ?? defaultIcons[option]
  const result = await applyColorToImage(base, color)
  coloredIcons.value = { ...coloredIcons.value, [option]: result }
}

// ── Public functions ──
async function setUserIcon(option: MenuOption, base64: string) {
  userIcons.value = { ...userIcons.value, [option]: base64 }
  // Reapply existing color to new icon if one is set
  if (userColors.value[option]) {
    await applyAndStoreColor(option, userColors.value[option]!)
  } else {
    // Clear any old colored version so new icon shows clean
    coloredIcons.value = { ...coloredIcons.value, [option]: undefined }
  }
}

async function setUserColor(option: MenuOption, color: string) {
  userColors.value = { ...userColors.value, [option]: color }
  await applyAndStoreColor(option, color)
}

function resetIcon(option: MenuOption) {
  userIcons.value = { ...userIcons.value, [option]: undefined }
  coloredIcons.value = { ...coloredIcons.value, [option]: undefined }
}

function resetColor(option: MenuOption) {
  userColors.value = { ...userColors.value, [option]: undefined }
  coloredIcons.value = { ...coloredIcons.value, [option]: undefined }
}

export function useIcons() {
  return {
    defaultIcons,
    iconMap,
    setUserIcon,
    resetIcon,
    userIcons,
    userColors,
    setUserColor,
    resetColor,
  }
}
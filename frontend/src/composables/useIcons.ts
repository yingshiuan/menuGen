import { ref, computed } from 'vue'
import type { MenuOption } from '@/types/types'

import RecommendedIconSvg from '@/asset/svg/recommend.svg?raw'
import SpicyIconSvg from '@/asset/svg/spicy.svg?raw'
import VeganIconSvg from '@/asset/svg/vegan.svg?raw'
import VegetarianIconSvg from '@/asset/svg/vegetarian.svg?raw'
import GlutenFreeIconSvg from '@/asset/svg/glutenfree.svg?raw'
import UndefinedIconSvg from '@/asset/svg/undefine.svg?raw'

const svgToDataUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

export const defaultIcons: Record<string, string> = {
  Recommend: svgToDataUri(RecommendedIconSvg),
  Spicy: svgToDataUri(SpicyIconSvg),
  Vegan: svgToDataUri(VeganIconSvg),
  Vegetarian: svgToDataUri(VegetarianIconSvg),
  'Gluten Free': svgToDataUri(GlutenFreeIconSvg),
  Undefined: svgToDataUri(UndefinedIconSvg),
}

export const UndefinedIcon: Record<string, string> = {
  Undefined: svgToDataUri(UndefinedIconSvg),
}

const userIcons = ref<Partial<Record<string, string>>>({})
const userColors = ref<Partial<Record<string, string>>>({})
const coloredIcons = ref<Partial<Record<string, string>>>({})
const customOptions = ref<Record<string, string>>({})
const renamedLabels = ref<Record<string, string>>({}) // internalKey → displayLabel

const iconMap = computed<Record<string, string>>(() => {
  const merged: Record<string, string> = {}

  for (const key in defaultIcons) {
    if (key === 'Undefined') continue // don't show Undefined as an option
    merged[key] = coloredIcons.value[key] ?? userIcons.value[key] ?? defaultIcons[key]!
  }

  for (const key in customOptions.value) {
    merged[key] = coloredIcons.value[key] ?? userIcons.value[key] ?? customOptions.value[key]!
  }

  return merged
})

// displayLabel: get the renamed label or fall back to internal key
function getDisplayLabel(key: string): string {
  return renamedLabels.value[key] ?? key
}

function renameOption(key: string, newLabel: string) {
  if (!newLabel.trim() || newLabel === key) return
  renamedLabels.value = { ...renamedLabels.value, [key]: newLabel }
}

function resetRenameOption(key: string) {
  const updated = { ...renamedLabels.value }
  delete updated[key]
  renamedLabels.value = updated
}

function addCustomOption(label: string, iconDataUri: string) {
  customOptions.value = { ...customOptions.value, [label]: iconDataUri }
}

function removeCustomOption(label: string) {
  const updated = { ...customOptions.value }
  delete updated[label]
  customOptions.value = updated
  // also clean up rename if any
  const updatedLabels = { ...renamedLabels.value }
  delete updatedLabels[label]
  renamedLabels.value = updatedLabels
}

function renameCustomOption(oldLabel: string, newLabel: string) {
  if (!newLabel.trim() || oldLabel === newLabel) return

  const updated = { ...customOptions.value }
  const icon = updated[oldLabel]
  if (!icon) return
  delete updated[oldLabel]
  updated[newLabel] = icon
  customOptions.value = updated

  if (userIcons.value[oldLabel]) {
    userIcons.value = { ...userIcons.value, [newLabel]: userIcons.value[oldLabel], [oldLabel]: undefined }
  }
  if (userColors.value[oldLabel]) {
    userColors.value = { ...userColors.value, [newLabel]: userColors.value[oldLabel], [oldLabel]: undefined }
  }
  if (coloredIcons.value[oldLabel]) {
    coloredIcons.value = { ...coloredIcons.value, [newLabel]: coloredIcons.value[oldLabel], [oldLabel]: undefined }
  }
  // move rename label too
  if (renamedLabels.value[oldLabel]) {
    const updatedLabels = { ...renamedLabels.value }
    delete updatedLabels[oldLabel]
    renamedLabels.value = updatedLabels
  }
}

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

async function applyAndStoreColor(option: string, color: string) {
  const base = userIcons.value[option] ?? defaultIcons[option] ?? customOptions.value[option]
  if (!base) return
  const result = await applyColorToImage(base, color)
  coloredIcons.value = { ...coloredIcons.value, [option]: result }
}

async function setUserIcon(option: string, base64: string) {
  userIcons.value = { ...userIcons.value, [option]: base64 }
  if (userColors.value[option]) {
    await applyAndStoreColor(option, userColors.value[option]!)
  } else {
    coloredIcons.value = { ...coloredIcons.value, [option]: undefined }
  }
}

async function setUserColor(option: string, color: string) {
  userColors.value = { ...userColors.value, [option]: color }
  await applyAndStoreColor(option, color)
}

function resetIcon(option: string) {
  userIcons.value = { ...userIcons.value, [option]: undefined }
  coloredIcons.value = { ...coloredIcons.value, [option]: undefined }
}

function resetColor(option: string) {
  userColors.value = { ...userColors.value, [option]: undefined }
  coloredIcons.value = { ...coloredIcons.value, [option]: undefined }
}

export function useIcons() {
  return {
    defaultIcons,
    iconMap,
    customOptions,
    renamedLabels,
    getDisplayLabel,
    renameOption,
    resetRenameOption,
    addCustomOption,
    removeCustomOption,
    renameCustomOption,
    setUserIcon,
    resetIcon,
    userIcons,
    userColors,
    setUserColor,
    resetColor,
  }
}
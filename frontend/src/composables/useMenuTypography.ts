import { reactive } from 'vue'

// Text sizes on the printed menu, in pt. The PDF prints at scale 1, so these are the real sizes.
export const DEFAULT_TEXT_SIZES = { category: 15, name: 12, description: 10.5 } as const
export type TextSizeKey = keyof typeof DEFAULT_TEXT_SIZES

export const TEXT_SIZE_RANGES: Record<TextSizeKey, { min: number; max: number }> = {
  category: { min: 6, max: 30 },
  name: { min: 8, max: 14 },
  description: { min: 6, max: 14 },
}

const textSizes = reactive<Record<TextSizeKey, number>>({ ...DEFAULT_TEXT_SIZES })

// Inline style, so the size also survives into the HTML sent for the PDF
function fontSize(key: TextSizeKey) {
  return { fontSize: `${textSizes[key]}pt` }
}

function resetTextSizes() {
  Object.assign(textSizes, DEFAULT_TEXT_SIZES)
}

export function useMenuTypography() {
  return { textSizes, fontSize, resetTextSizes }
}

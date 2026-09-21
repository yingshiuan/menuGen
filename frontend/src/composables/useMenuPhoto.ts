import { reactive, ref } from 'vue'
import type { SizeRange } from '@/domain/sizes'

// Dish photo diameter in px with "Fill page" spacing. 80px is also the photo size with
// "Compact"; 160px keeps enough of the row for the dish text.
export const DEFAULT_PHOTO_SIZE = 80
export const PHOTO_SIZE_RANGE: SizeRange = { min: 80, max: 160 }

// The size in use, the same on every page
const photoSize = ref<number>(DEFAULT_PHOTO_SIZE)
// Largest size the fullest page can fit (set by MenuCreate); the box stops here
const maxPhotoSize = ref<number>(PHOTO_SIZE_RANGE.max)
// While at the maximum, follow it when the menu or page changes
const followMax = ref(true)
// The dish name written around the photo. Without it the photo fills most of its circle.
const showNameRing = ref(true)

// Measured on the on-screen menu page (MenuPreview), in px
const pageLayout = reactive({
  areaHeight: 0, // between logo and footer: what headers + dishes share
  headerHeight: 0, // one category header, margin included
  dishMargin: 0, // a dish box's height beyond its content (MenuItem's my-1)
})

export function useMenuPhoto() {
  return { photoSize, maxPhotoSize, followMax, showNameRing, pageLayout }
}

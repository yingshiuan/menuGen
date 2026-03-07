<script setup lang="ts">
import { reactive, computed } from 'vue'
import type { MenuOption } from '@/types/types'
import { useIcons } from '@/composables/useIcons.ts'
import ImageCropper from '@/components/ImageCropper.vue'

const icons = useIcons()
const { setUserIcon, resetIcon, userColors, setUserColor, resetColor, defaultIcons } =
  icons

const options = Object.keys(icons.iconMap.value) as MenuOption[]
const iconState = reactive({ isExpanded: false })
const resetCounters = reactive<Partial<Record<MenuOption, number>>>({})

// Per-option typed name state
const typedNames = reactive<Partial<Record<MenuOption, string>>>({})
const currentColors = computed(() => userColors.value)

function toggleExpand() {
  iconState.isExpanded = !iconState.isExpanded
}

function handleIconChange(opt: MenuOption, val: string | null) {
  if (val) {
    setUserIcon(opt, val)
    resetCounters[opt] = (resetCounters[opt] ?? 0) + 1
  }
}

function handleReset(opt: MenuOption) {
  resetIcon(opt)
  resetColor(opt)
  resetCounters[opt] = (resetCounters[opt] ?? 0) + 1
  typedNames[opt] = ''
}

// Convert the typed name to snake_case (material symbols uses underscores)
function toIconName(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, '_')
}

// Grab the SVG from the rendered span and save it as data URI
function confirmIcon(opt: MenuOption) {
  const name = toIconName(typedNames[opt] ?? '')
  if (!name) return

  // Use a temporary span to render and grab the SVG path via canvas
  const span = document.createElement('span')
  span.className = 'material-symbols-outlined'
  // span.style.fontSize = '24px'
  // span.style.visibility = 'hidden'
  // span.style.position = 'fixed'
  span.textContent = name
  document.body.appendChild(span)

  // Give font time to render, then fetch the actual SVG from Google
  const url = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/default/24px.svg`

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('Icon not found')
      return res.text()
    })
    .then((svg) => {
      const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
      setUserIcon(opt, dataUri)
      resetCounters[opt] = (resetCounters[opt] ?? 0) + 1
      typedNames[opt] = ''
    })
    .catch(() => {
      alert(`Icon "${name}" not found. Check the name at fonts.google.com/icons`)
    })
    .finally(() => {
      document.body.removeChild(span)
    })
}

// onMounted(() => {
//   const saved = localStorage.getItem('menu-user-icons')
//   if (saved) Object.assign(userIcons.value, JSON.parse(saved))
//   // Add this
//   const savedColors = localStorage.getItem('menu-user-colors')
//   if (savedColors) Object.assign(userColors.value, JSON.parse(savedColors))
// })
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center">
      <button
        @click="toggleExpand"
        class="flex items-center gap-1"
        title="Click to customize icons"
      >
        <span>{{ iconState.isExpanded ? '▼' : '▶' }}</span>
        <span>Customize Icons</span>
      </button>
    </div>

    <div
      v-if="iconState.isExpanded"
      class="space-y-3 p-1 transition-all duration-200 border rounded bg-gray-50 overflow-y-scroll"
    >
      <!-- Icon list -->
      <div
        v-for="opt in options"
        :key="opt"
        class="flex flex-col space-y-1 border-b border-gray-400"
      >
        <!-- Row 1: UNCHANGED from before -->
        <div class="flex items-center gap-3">
          <!-- Label -->
          <span class="text-xs w-20 shrink-0">{{ opt }}</span>
          <!-- Current icon preview -->
          <!-- <img :src="icons.iconMap.value[opt]" class="w-6 h-6 shrink-0" /> -->

          <!-- Default icon (original) -->
          <div class="shrink-0 flex flex-col items-center gap-0.5">
            <img :src="defaultIcons[opt]" class="w-5 h-5 opacity-100" :title="`Default: ${opt}`" />
          </div>

          <!-- Arrow -->
          <span class="text-xs shrink-0">→</span>

          <!-- ImageCropper for this icon -->
          <div class="h-6 flex items-center">
            <ImageCropper
              :key="`${opt}-${resetCounters[opt] ?? 0}`"
              :model-value="icons.iconMap.value[opt]"
              variant="icon"
              :aspect-ratio="1"
              :crop-width="24"
              :crop-height="24"
              @update:model-value="(val) => handleIconChange(opt, val)"
            />
          </div>

          <!-- Reset Button -->
          <button
            class="p-1 text-xs bg-gray-200 rounded hover:bg-gray-300 shrink-0 ml-auto"
            @click="handleReset(opt)"
          >
            Reset
          </button>
        </div>

        <!-- Row 2: color + icon search (new) -->
        <div class="flex items-center gap-3 space-y-1">
          <!-- Color picker -->
          <label
            class="relative flex items-center gap-1 cursor-pointer shrink-0"
            :title="`Pick color for ${opt}`"
          >
            <span class="text-[10px] text-gray-400">Color</span>
            <div
              class="w-5 h-5 rounded border border-gray-300 shrink-0"
              :style="
                currentColors[opt]
                  ? { backgroundColor: currentColors[opt] }
                  : {
                      background:
                        'linear-gradient(135deg, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                    }
              "
            />

            <input
              type="color"
              :value="currentColors[opt] ?? '#000000'"
              @input="(e) => setUserColor(opt, (e.target as HTMLInputElement).value)"
              class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>

          <button
            v-if="currentColors[opt]"
            class="text-[10px] text-gray-400 hover:text-red-400 shrink-0 -ml-1"
            @click="resetColor(opt)"
            title="Remove color"
          >
            ✕
          </button>

          <!-- Divider -->
          <div class="w-px h-4 bg-gray-200 shrink-0" />

          <!-- Icon search -->
          <span class="text-[10px] text-gray-400 shrink-0">Icon</span>

          <span
            v-if="typedNames[opt]"
            class="material-symbols-outlined text-gray-500 shrink-0"
            style="font-size: 1rem; line-height: 1"
            >{{ toIconName(typedNames[opt] ?? '') }}</span
          >

          <input
            :value="typedNames[opt] ?? ''"
            @input="typedNames[opt] = ($event.target as HTMLInputElement).value"
            @keyup.enter="confirmIcon(opt)"
            type="text"
            placeholder="e.g. udon"
            class="text-xs border rounded p-0.5 flex-1 outline-none focus:border-blue-400 min-w-0"
          />

          <button
            class="text-xs p-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-30 shrink-0"
            :disabled="!typedNames[opt]"
            @click="confirmIcon(opt)"
          >
            Add
          </button>
        </div>
      </div>

      <!-- Footer hint -->
      <p class="text-[10px] text-gray-400 pt-1">
        Find icon names at
        <a href="https://fonts.google.com/icons" target="_blank" class="text-blue-400 underline">
          fonts.google.com/icons
        </a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import type { MenuOption } from '@/types/types'
import { useIcons } from '@/composables/useIcons.ts'
import ImageCropper from '@/components/ImageCropper.vue'

const icons = useIcons()
const {
  setUserIcon,
  resetIcon,
  userColors,
  setUserColor,
  resetColor,
  defaultIcons,
  addCustomOption,
  removeCustomOption,
  renameCustomOption,
  renamedLabels,
  getDisplayLabel,
  renameOption,
  resetRenameOption,
} = icons

const emit = defineEmits<{
  (e: 'renameOption', oldLabel: string, newLabel: string): void
}>()

const renameState = reactive<{
  option: string | null
  value: string
}>({
  option: null,
  value: '',
})


const options = computed(() => Object.keys(icons.iconMap.value) as MenuOption[])
const PRESET_KEYS = new Set(['Recommend', 'Spicy', 'Vegan', 'Vegetarian', 'Gluten Free'])
const newOption = reactive({ label: '', icon: null as string | null, typedName: '' })

const iconState = reactive({ isExpanded: false })
const resetCounters = reactive<Partial<Record<string, number>>>({})
const typedNames = reactive<Partial<Record<string, string>>>({})
const currentColors = computed(() => userColors.value)

function toggleExpand() {
  iconState.isExpanded = !iconState.isExpanded
}

function handleIconChange(opt: string, val: string | null) {
  if (val) {
    setUserIcon(opt, val)
    resetCounters[opt] = (resetCounters[opt] ?? 0) + 1
  }
}

function handleReset(opt: string) {
  resetIcon(opt)
  resetColor(opt)
  resetRenameOption(opt)
  resetCounters[opt] = (resetCounters[opt] ?? 0) + 1
  typedNames[opt] = ''
}

function toIconName(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, '_')
}

function confirmIcon(opt: string) {
  const name = toIconName(typedNames[opt] ?? '')
  if (!name) return

  const span = document.createElement('span')
  span.className = 'material-symbols-outlined'
  span.textContent = name
  document.body.appendChild(span)

  const url = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/default/24px.svg`

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('Icon not found')
      return res.text()
    })
    .then((svg) => {
      const color = userColors.value[opt]
      const coloredSvg = color ? svg.replace(/<svg/, `<svg fill="${color}"`) : svg
      const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(coloredSvg)}`
      setUserIcon(opt, dataUri)
      resetCounters[opt] = (resetCounters[opt] ?? 0) + 1
      typedNames[opt] = ''
    })
    .catch(() => alert(`Icon "${name}" not found. Check the name at fonts.google.com/icons`))
    .finally(() => document.body.removeChild(span))
}

function handleColorChange(opt: string, color: string) {
  setUserColor(opt, color)
  const currentIcon = icons.iconMap.value[opt]
  if (currentIcon?.startsWith('data:image/svg+xml')) {
    const decoded = decodeURIComponent(currentIcon.replace('data:image/svg+xml;utf8,', ''))
    const coloredSvg = decoded.replace(/fill="[^"]*"/g, `fill="${color}"`)
    setUserIcon(opt, `data:image/svg+xml;utf8,${encodeURIComponent(coloredSvg)}`)
  }
}

function handleAddCustomOption() {
  const label = newOption.label.trim()
  if (!label || !newOption.icon) return
  addCustomOption(label, newOption.icon)
  setUserIcon(label, newOption.icon)
  newOption.label = ''
  newOption.icon = null
  newOption.typedName = ''
}

function confirmNewOptionIcon() {
  const name = toIconName(newOption.typedName)
  if (!name) return
  const url = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/default/24px.svg`
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('Icon not found')
      return res.text()
    })
    .then((svg) => {
      newOption.icon = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
      newOption.typedName = ''
    })
    .catch(() => alert(`Icon "${name}" not found.`))
}

function startRename(opt: string) {
  renameState.option = opt
  // start with current display label
  renameState.value = getDisplayLabel(opt)
}

function confirmRename(opt: string) {
  const newLabel = renameState.value.trim()
  if (!newLabel) {
    renameState.option = null
    return
  }

  if (PRESET_KEYS.has(opt)) {
    // Preset: just update display label, keep internal key unchanged
    renameOption(opt, newLabel)
  } else {
    // Custom option: actually rename the key
    if (newLabel !== opt) {
      renameCustomOption(opt, newLabel)
      emit('renameOption', opt, newLabel)
    }
  }
  renameState.option = null
}

function cancelRename() {
  renameState.option = null
  renameState.value = ''
}
</script>

<template>
  <div>
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
        <!-- Row 1: label + default → custom upload -->
        <div class="flex items-center gap-3">
          <!-- Label / rename -->
          <div class="text-xs w-20 shrink-0">
            <input
              v-if="renameState.option === opt"
              v-model="renameState.value"
              class="border rounded p-0.5 w-full text-xs outline-none focus:border-blue-400"
              @keyup.enter="confirmRename(opt)"
              @keyup.escape="cancelRename"
              @blur="confirmRename(opt)"
              autofocus
            />
            <span
              v-else
              class="cursor-pointer hover:text-blue-500 flex items-center gap-0.5"
              title="Click to rename"
              @click="startRename(opt)"
            >
              <!-- show renamed label if set, else internal key -->
              {{ getDisplayLabel(opt) }}
              <span class="text-gray-300 text-[0.6rem]">✎</span>
              <!-- show original key hint if renamed -->
              <span v-if="renamedLabels[opt]" class="text-gray-300 text-[0.6rem]">({{ opt }})</span>
            </span>
          </div>

          <!-- Default icon preview (presets only) -->
          <div v-if="defaultIcons[opt]" class="shrink-0 flex flex-col items-center gap-0.5">
            <img :src="defaultIcons[opt]" class="w-5 h-5 opacity-100" :title="`Default: ${opt}`" />
          </div>
          <div v-else class="w-5 shrink-0" />

          <span class="text-xs shrink-0">→</span>

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

          <!-- Reset for presets, Remove for custom -->
          <button
            v-if="PRESET_KEYS.has(opt)"
            class="p-1 text-xs bg-gray-200 rounded hover:bg-gray-300 shrink-0 ml-auto"
            @click="handleReset(opt)"
          >
            Reset
          </button>
          <button
            v-else
            class="p-1 text-xs text-red-400 hover:text-red-600 shrink-0 ml-auto"
            @click="removeCustomOption(opt)"
          >
            ✕ Remove
          </button>
        </div>

        <!-- Row 2: color + Google icon search -->
        <div class="flex items-center gap-3">
          <label class="relative flex items-center gap-1 cursor-pointer shrink-0">
            <span class="text-[0.8rem] text-gray-400">Color</span>
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
              @input="(e) => handleColorChange(opt, (e.target as HTMLInputElement).value)"
              class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>

          <button
            v-if="currentColors[opt]"
            class="text-[0.8rem] text-gray-400 hover:text-red-400 shrink-0 -ml-1"
            @click="resetColor(opt)"
          >
            ✕
          </button>

          <div class="w-px h-4 bg-gray-200 shrink-0" />
          <span class="text-[0.8rem] text-gray-400 shrink-0">Icon</span>

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

      <!-- Add new option -->
      <div class="flex flex-col gap-1">
        <span class="text-xs">Add New Option</span>
        <div class="flex items-center gap-2">
          <input
            v-model="newOption.label"
            type="text"
            placeholder="Option name e.g. Seasonal"
            class="text-xs border rounded p-1 flex-1 outline-none focus:border-blue-400"
          />
          <button
            class="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-30 self-end"
            :disabled="!newOption.label || !newOption.icon"
            @click="handleAddCustomOption"
          >
            + Add
          </button>
        </div>

        <div class="flex lg:flex-row flex-col items-center gap-2">
          <ImageCropper
            v-model="newOption.icon"
            variant="icon"
            :aspect-ratio="1"
            :crop-width="24"
            :crop-height="24"
          />
          <img v-if="newOption.icon" :src="newOption.icon" class="w-5 h-5 shrink-0" />
          <span class="flex lg:flex-row items-center gap-2">
            <span class="text-[0.8rem] text-gray-400 shrink-0">or Icon</span>
            <span
              v-if="newOption.typedName"
              class="material-symbols-outlined text-gray-500"
              style="font-size: 1rem; line-height: 1"
              >{{ toIconName(newOption.typedName) }}</span
            >
            <input
              v-model="newOption.typedName"
              type="text"
              placeholder="e.g. star"
              class="text-xs border rounded p-0.5 flex-1 outline-none focus:border-blue-400 min-w-0"
              @keyup.enter="confirmNewOptionIcon"
            />
            <button
              class="text-xs p-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-30 shrink-0"
              :disabled="!newOption.typedName"
              @click="confirmNewOptionIcon"
            >
              Search
            </button>
          </span>
        </div>
      </div>

      <div class="border-t border-gray-300 my-1" />

      <p class="text-[0.8rem] text-gray-400 pt-1">
        Find icon names at
        <a href="https://fonts.google.com/icons" target="_blank" class="text-blue-400 underline">
          fonts.google.com/icons
        </a>
      </p>
    </div>
  </div>
</template>

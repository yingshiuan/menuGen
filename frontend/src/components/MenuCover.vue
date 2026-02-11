<script setup lang="ts">
import { watch, reactive, nextTick } from 'vue'
import CoverLogo from '@/components/CoverLogo.vue'

const props = defineProps<{
  title?: string
  subtitle?: string
  coverLogo?: string | null
  bgColor: string
  textColor: string
  fontFamily: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:title', value: string): void
  (e: 'update:subtitle', value: string): void
  (e: 'update:coverLogo', value: string | null): void
}>()

const local = reactive({
  title: props.title ?? '',
  subtitle: props.subtitle ?? '',
  coverLogo: props.coverLogo ?? '',
})

const editingState = reactive({
  title: false,
  subtitle: false,
})

watch(
  () => [props.title, props.subtitle, props.coverLogo],
  ([title, subtitle, coverLogo]) => {
    local.title = title ?? ''
    local.subtitle = subtitle ?? ''
    local.coverLogo = coverLogo ?? ''
  },
  { immediate: true }
)

function startEditing(field: 'title' | 'subtitle') {
  if (props.readonly) return
  editingState[field] = true
  nextTick(() => {
    document.getElementById(field)?.focus()
  })
}

function stopEditing(field: 'title' | 'subtitle') {
  editingState[field] = false

  if (field === 'title') emit('update:title', local.title)
  else emit('update:subtitle', local.subtitle)
}

// Emit when local state changes
watch(() => local.title, (val) => emit('update:title', val))
watch(() => local.subtitle, (val) => emit('update:subtitle', val))
watch(() => local.coverLogo, (val) => emit('update:coverLogo', val))
</script>

<template>
  <div
    class="a4-preview flex flex-col items-center justify-center h-full w-full relative p-6"
    :style="{
      backgroundColor: bgColor,
      color: textColor,
      fontFamily: fontFamily,
    }"
  >
    <!-- COVER LOGO -->
    <div class="mb-8">
      <CoverLogo
        v-model="local.coverLogo"
        :readonly="readonly"
      />
    </div>

    <!-- TITLE -->
    <div class="text-center w-full not-last:text-5xl font-bold">
      <span
        v-if="local.title && !editingState.title"
        @click="startEditing('title')"
        :title="`Click to edit the title...`"
        class="cursor-pointer"
      >
        {{ local.title }}
      </span>

      <span
        v-else-if="!local.title && !props.readonly && !editingState.title"
        data-ui-only
        @click="startEditing('title')"
        title="Click to add title..."
        class="opacity-30 cursor-pointer"
      >
        Enter Title
      </span>

      <input
        v-else
        id="title"
        v-model="local.title"
        @blur="stopEditing('title')"
        @keyup.enter="stopEditing('title')"
        class="text-center bg-transparent outline-none w-full"
      />
    </div>

    <!-- SUBTITLE -->
    <div class="text-center w-full text-2xl mt-6">
      <span
        v-if="local.subtitle && !editingState.subtitle"
        @click="startEditing('subtitle')"
        :title="`Click to edit the subtitle...`"
        class="cursor-pointer opacity-80"
      >
        {{ local.subtitle}}
      </span>

      <span
        v-else-if="!local.subtitle && !props.readonly && !editingState.subtitle"
        data-ui-only
        @click="startEditing('subtitle')"
        title="Click to add subtitle..."
        class="opacity-30 cursor-pointer"
      >
        Enter Subtitle
      </span>

      <input
        v-else
        id="subtitle"
        v-model="local.subtitle"
        @blur="stopEditing('subtitle')"
        @keyup.enter="stopEditing('subtitle')"
        class="text-center bg-transparent outline-none w-full opacity-80"
      />
    </div>
  </div>
</template>

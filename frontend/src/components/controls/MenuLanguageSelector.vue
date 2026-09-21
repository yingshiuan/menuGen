<script lang="ts" setup>
import { LANGS } from '@/types/types'
import { LANG_LABELS } from '@/domain/menuItem'
import { PRIMARY_LANGS, useMenuLang } from '@/composables/useMenuLang'

const { primary, extraNames } = useMenuLang()
</script>

<template>
  <div class="flex flex-col gap-2 text-sm">
    <label class="flex items-center gap-2">
      <span class="w-24 shrink-0">Language</span>
      <select v-model="primary" class="border p-1 rounded">
        <option v-for="lang in PRIMARY_LANGS" :key="lang" :value="lang">
          {{ LANG_LABELS[lang] }}
        </option>
      </select>
    </label>
    <div class="flex items-center gap-2">
      <span class="w-24 shrink-0">Also show</span>
      <label
        v-for="lang in LANGS.filter((l) => l !== primary)"
        :key="lang"
        class="flex items-center gap-1"
      >
        <input v-model="extraNames[lang]" type="checkbox" class="w-4 h-4" />
        {{ LANG_LABELS[lang] }}
      </label>
    </div>
  </div>
</template>

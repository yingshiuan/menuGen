<script lang="ts" setup>
import { ref } from 'vue'
import Papa from 'papaparse'
import type { MenuItem, MenuOption } from '@/types/types'
import MenuPreview from '@/components/MenuPreview.vue'
import GeneratePdf from '@/components/GeneratePdf.vue'

// const csvData = ref<MenuItem[]>([])

const menuCsv = ref<MenuItem[]>([]);

const menuPreviewRef = ref<HTMLElement | null>(null)

function getOptionsFromRow(row: Record<string, string>): MenuOption[] {
  const map: Record<string, MenuOption> = {
    Recommend: 'Recommend',
    Spicy: 'Spicy',
    Vegan: 'Vegan',
    Vegetarian: 'Vegetarian',
    GlutenFree: 'GlutenFree',
  };

  return Object.entries(map)
    .filter(([key]) => row[key]?.trim())
    .map(([, value]) => value);
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement | null;
  if (!target?.files?.length) return;

  const file = target.files[0];
  if (!file) return;

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete: (result) => {
      let currentCategory = '';
      const processed: MenuItem[] = [];

      result.data.forEach((row) => {
        // Detect category row (no No./Price but has Name)
        if (!row['No.'] && !row['Price'] && row['Name']) {
          currentCategory = row['Name'].trim();
        } else {
          processed.push({
            No: row['No.'],
            Price: row['Price'],
            Name: row['Name'],
            ChineseName: row['Chinese Name'],
            Description: row['Description'],
            Options: getOptionsFromRow(row),
            Category: currentCategory || 'Uncategorized',
          } as MenuItem);
        }
      });

      menuCsv.value = processed;
    },
  });
}
</script>

<template>
  <GeneratePdf :contentRef="menuPreviewRef" />
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-bold">Menu Builder (CSV → PDF)</h1>

    <!-- Upload CSV -->
    <input
      type="file"
      accept=".csv"
      @change="handleFileChange"
      class="border rounded px-2 py-1"
    />

    <!-- <pre>{{ menuCsv }}</pre> -->

    <!-- Pass CSV data to MenuPreview -->
    <div class="menu-preview-wrapper" ref="menuPreviewRef" v-if="menuCsv.length">
      <MenuPreview :items="menuCsv" />
    </div>
  </div>
</template>

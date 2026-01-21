<script lang="ts" setup>
const props = defineProps({
  modelValue: {
    type: Number,
    required: true,
  },
  min: {
    type: Number,
    default: 0.5,
  },
  max: {
    type: Number,
    default: 1,
  },
  step: {
    type: Number,
    default: 0.1,
  },
  label: {
    type: String,
    default: 'Scale',
  },
})

const emit = defineEmits(['update:modelValue'])

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="flex items-center justify-between">
      <span>{{ props.label }}</span>
    </label>

    <input
      type="range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :value="props.modelValue"
      @input="onInput"
      class="w-full"
    />
    <span class="">{{ props.modelValue }}</span>
  </div>
</template>

<template>
  <div class="glass rounded-xl p-3 border-l-4 border-accent shadow cursor-pointer hover:shadow-lg transition">
    <div class="font-medium text-sm">{{ data.title }}</div>
    <div class="text-xs text-textSecondary">{{ data.description }}</div>
    <div class="text-[10px] text-accent mt-2">Click to drill down</div>
  </div>
</template>

<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core";

defineProps<NodeProps>();
</script>

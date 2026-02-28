<template>
  <div class="glass rounded-xl p-3 border-l-4 border-accent shadow">
    <div class="font-medium text-sm">{{ title }}</div>
    <div class="text-xs text-textSecondary">{{ description }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description: string }>();
</script>

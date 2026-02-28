<template>
  <div
    class="glass rounded-xl p-4 border-l-4 border-accent shadow-lg cursor-pointer hover:shadow-accent/20 hover:border-accent2 transition-all duration-200 min-w-[220px] max-w-[280px]"
  >
    <div class="font-medium text-sm text-white">{{ data.title }}</div>
    <div class="text-xs text-textSecondary mt-1 leading-relaxed">{{ data.description }}</div>
    <div class="text-[10px] text-accent/60 mt-2 flex items-center gap-1">
      <span>▶</span> Click to expand
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: { title: string; description: string } }>();
</script>

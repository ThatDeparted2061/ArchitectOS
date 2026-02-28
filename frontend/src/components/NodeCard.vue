<template>
  <Handle type="target" :position="Position.Top" style="visibility: hidden" />
  <div class="glass rounded-xl p-4 border-l-4 border-accent shadow-lg min-w-[220px] max-w-[280px] hover:shadow-accent/20 hover:border-accent2 transition-all duration-200">
    <div class="font-medium text-sm text-white">{{ data.title }}</div>
    <div class="text-xs text-textSecondary mt-1 leading-relaxed">{{ data.description }}</div>
    <div v-if="hasChildren" class="text-[10px] text-accent mt-2">▶ Click to expand</div>
    <div v-else class="text-[10px] text-textSecondary/40 mt-2">— leaf node —</div>
  </div>
  <Handle type="source" :position="Position.Bottom" style="visibility: hidden" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { useAppStore } from "../store/app";

const props = defineProps<{ id: string; data: { title: string; description: string } }>();
const store = useAppStore();

const hasChildren = computed(() => {
  if (!store.architecture) return false;
  const node = findInTree(store.architecture, props.id);
  return node ? node.children.length > 0 : false;
});

function findInTree(node: any, id: string): any {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return null;
}
</script>

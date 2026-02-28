<template>
  <Handle type="target" :position="Position.Top" style="visibility: hidden" />
  <div
    class="glass rounded-xl p-4 border-l-4 border-accent shadow-lg cursor-pointer hover:shadow-accent/20 hover:border-accent2 transition-all duration-200 min-w-[220px] max-w-[280px]"
    @dblclick="expand"
  >
    <div class="font-medium text-sm text-white">{{ data.title }}</div>
    <div class="text-xs text-textSecondary mt-1 leading-relaxed">{{ data.description }}</div>
    <div class="text-[10px] text-accent/60 mt-2 flex items-center gap-1">
      <span>▶</span> Double-click to expand
    </div>
  </div>
  <Handle type="source" :position="Position.Bottom" style="visibility: hidden" />
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { useAppStore } from "../store/app";

const props = defineProps<{ id: string; data: { title: string; description: string } }>();
const store = useAppStore();

const expand = () => {
  store.focusNode(props.id);
};
</script>

<template>
  <!-- Multi-Directional Handles for Tree and Cross-Subsystem Connections -->
  <Handle type="target" :position="Position.Top" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-surface !rounded-full" />
  <Handle type="target" :position="Position.Left" class="!w-2 !h-2 !opacity-0" />

  <div
    class="h-full w-full border border-dashed rounded-lg flex flex-col select-none transition-all duration-200 backdrop-blur-sm shadow-inner relative"
    :class="[
      props.data.isCollapsed
        ? 'border-accent/40 bg-surface/80 p-2.5 hover:border-accent hover:bg-surface'
        : 'border-borderMuted/80 bg-surface/20 p-3.5 hover:border-accent/60'
    ]"
  >
    <!-- Subgraph Header Bar -->
    <div class="flex items-center justify-between border-b border-borderMuted/40 pb-1.5 mb-2">
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <!-- Subgraph Folder Icon -->
        <span class="text-accent flex-shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10"/>
          </svg>
        </span>
        <div class="font-bold text-[11px] uppercase tracking-wider text-accent truncate" :title="props.data.title">
          {{ props.data.title }}
        </div>
      </div>

      <div class="flex items-center gap-1.5 flex-shrink-0">
        <!-- Child Count / Grid Column Badge -->
        <span
          v-if="props.data.childCount > 0"
          class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent/90 border border-accent/20"
          :title="`${props.data.childCount} child components inside this subsystem`"
        >
          {{ props.data.childCount }} {{ props.data.childCount === 1 ? 'item' : 'items' }}
        </span>

        <!-- Interactive Collapse / Expand Toggle Button -->
        <button
          v-if="props.data.childCount > 0"
          @click.stop="toggleCollapse"
          class="p-1 rounded bg-surfaceHover hover:bg-accent/20 text-textSecondary hover:text-accent border border-borderMuted hover:border-accent/30 transition-all duration-150 cursor-pointer flex items-center justify-center"
          :title="props.data.isCollapsed ? 'Expand subsystem (show 2D grid)' : 'Collapse subsystem (compact overview)'"
        >
          <!-- Expand icon (+) -->
          <svg v-if="props.data.isCollapsed" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <!-- Collapse icon (-) -->
          <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Description or Collapsed Hint -->
    <div v-if="!props.data.isCollapsed" class="text-[10px] text-textSecondary leading-normal font-mono mb-1 line-clamp-2">
      {{ props.data.description }}
    </div>
    <div
      v-else
      @click.stop="toggleCollapse"
      class="text-[9px] text-accent/70 hover:text-accent font-mono flex items-center gap-1 cursor-pointer"
      title="Click to expand this container"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
      <span>Click to expand {{ props.data.childCount }} components...</span>
    </div>
  </div>

  <Handle type="source" :position="Position.Bottom" class="!w-3 !h-3 !bg-blue-500 !border-2 !border-surface !rounded-full" />
  <Handle type="source" :position="Position.Right" class="!w-2 !h-2 !opacity-0" />
</template>

<script setup lang="ts">
/**
 * ContainerNode component representing architectural Subsystems and Subgraphs.
 * 
 * Logic & Capabilities:
 * 1. Multi-Directional Handles: Top/Bottom for standard hierarchical tree, Left/Right for LR tree and cross-links.
 * 2. Interactive Collapse / Expand: Allows users to fold huge modules into compact overview blocks to eliminate clutter.
 * 3. Badge Counter: Shows exactly how many files/components exist in this subsystem.
 */
import { Handle, Position } from "@vue-flow/core";
import { useAppStore } from "../store/app";

const props = defineProps<{
  id: string;
  data: {
    title: string;
    description: string;
    type?: string;
    childCount: number;
    isCollapsed?: boolean;
    cols?: number;
    subsystemId?: string;
  };
}>();

const store = useAppStore();

/**
 * Toggle between expanded multi-column 2D grid and compact overview container
 */
const toggleCollapse = () => {
  store.toggleSubsystemCollapse(props.id);
};
</script>

<template>
  <div class="h-full w-full grid-dots relative">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :node-types="nodeTypes"
      class="h-full w-full"
      :fit-view-on-init="true"
      :min-zoom="0.05"
      :max-zoom="3"
      :default_viewport="{ zoom: 0.8, x: 0, y: 0 }"
      @nodeClick="onNodeClick"
    >
      <Background :gap="24" :size="1" />
      <MiniMap
        :pannable="true"
        :zoomable="true"
        class="!bg-surface/85 !border-borderMuted !rounded-md shadow-lg"
      />
      <Controls class="!bg-surface/85 !border-borderMuted !rounded-md shadow-lg" />
    </VueFlow>

    <!-- Top Left Bar: Breadcrumbs & Layout Controls -->
    <div class="absolute top-4 left-4 flex items-center gap-2 z-40 flex-wrap">
      <!-- Breadcrumbs Navigation -->
      <div v-if="breadcrumbs.length" class="glass-card px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-1 shadow-lg backdrop-blur-md">
        <button class="text-accent hover:text-accent/80 flex items-center gap-1 transition mr-3 border-r border-borderMuted pr-3" @click="store.goBack()">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          <span>Back</span>
        </button>
        <span
          v-for="(crumb, idx) in breadcrumbs"
          :key="crumb.id"
          class="cursor-pointer hover:text-accent transition duration-150"
          @click="store.focusNode(crumb.id)"
        >
          {{ crumb.title }}<span v-if="idx < breadcrumbs.length - 1" class="text-textSecondary/40 mx-2">/</span>
        </span>
      </div>

      <!-- Tree Orientation Switcher Toggle -->
      <button 
        class="glass-card px-3 py-2 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 hover:text-accent transition shadow-lg backdrop-blur-md"
        @click="store.toggleGraphDirection()"
        :title="store.graphDirection === 'TB' ? 'Switch to Left-Right Tree' : 'Switch to Top-Down Tree'"
      >
        <svg v-if="store.graphDirection === 'TB'" class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>{{ store.graphDirection === 'TB' ? 'Tree: Top-Down' : 'Tree: Left-Right' }}</span>
      </button>

      <!-- Subsystem Collapse / Expand All Toggle -->
      <button
        v-if="hasSubsystems && store.viewMode === 'architecture' && !store.focusId"
        class="glass-card px-3 py-2 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 hover:text-accent transition shadow-lg backdrop-blur-md"
        @click="toggleAllSubsystems"
        :title="isAllCollapsed ? 'Expand all subsystems into 2D grids' : 'Collapse all subsystems to compact view'"
      >
        <svg v-if="isAllCollapsed" class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 9L4 4m0 0v4m0-4h4m11 5l-5-5m5 0h-4m4 0v4M9 15l-5 5m0 0h4m-4 0v-4m11 5v-4m0 4h-4m4 0l-5-5" />
        </svg>
        <span>{{ isAllCollapsed ? 'Expand All' : 'Collapse All' }}</span>
      </button>

      <!-- Max Grid Columns Selector (Density Control) -->
      <div
        v-if="hasSubsystems && store.viewMode === 'architecture' && !store.focusId"
        class="glass-card px-2.5 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-md"
        title="Max Grid Columns per Subsystem"
      >
        <span class="text-textSecondary text-[10px] uppercase font-bold">Grid:</span>
        <div class="flex items-center gap-1 bg-surface/50 border border-borderMuted rounded p-0.5">
          <button
            v-for="cols in [2, 3, 4]"
            :key="cols"
            class="px-1.5 py-0.5 rounded text-[10px] font-bold transition"
            :class="store.maxGridCols === cols ? 'bg-accent text-white' : 'text-textSecondary hover:text-textPrimary'"
            @click="store.setMaxGridCols(cols)"
          >
            {{ cols }}C
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * GraphCanvas component housing Vue Flow graph, background, minimap, and toolbar controls.
 * 
 * Features:
 * 1. VueFlow canvas for interactive node rendering and navigation.
 * 2. Breadcrumbs navigation for drilldown architecture traversal.
 * 3. Direction toggle: Top-to-Bottom (TB) vs Left-to-Right (LR).
 * 4. Bulk Subsystem Collapse/Expand toggle for high-level architecture overview.
 * 5. Grid Column density selector (2C / 3C / 4C).
 */
import { computed } from "vue";
import { VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { MiniMap } from "@vue-flow/minimap";
import { Controls } from "@vue-flow/controls";
import { useAppStore } from "../store/app";
import NodeCard from "./NodeCard.vue";
import ContainerNode from "./ContainerNode.vue";

const store = useAppStore();

const flowNodes = computed(() => store.nodes);
const flowEdges = computed(() => store.edges);
const breadcrumbs = computed(() => store.breadcrumbs);
const nodeTypes = { card: NodeCard, container: ContainerNode };

/**
 * Check if the current architecture has subsystems with child items
 */
const hasSubsystems = computed(() => {
  return Boolean(store.architecture && store.architecture.children && store.architecture.children.length > 0);
});

/**
 * Check if all subsystems are currently in a collapsed state
 */
const isAllCollapsed = computed(() => {
  if (!store.architecture?.children?.length) return false;
  return store.architecture.children.every((c) => store.collapsedSubsystems.has(c.id));
});

/**
 * Toggle bulk collapse/expand across all top-level subsystems
 */
const toggleAllSubsystems = () => {
  if (isAllCollapsed.value) {
    store.expandAllSubsystems();
  } else {
    store.collapseAllSubsystems();
  }
};

/**
 * Handle node clicks for deep drilldown exploration
 */
const onNodeClick = (event: any) => {
  const nodeId = event.node?.id;
  if (!nodeId || !store.architecture) return;
  const archNode = findInTree(store.architecture, nodeId);
  if (archNode && archNode.children && archNode.children.length > 0) {
    store.focusNode(nodeId);
  }
};

function findInTree(node: any, id: string): any {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return null;
}
</script>

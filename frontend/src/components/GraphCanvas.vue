<template>
  <div class="h-full w-full grid-dots relative">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :node-types="nodeTypes"
      class="h-full w-full"
      :fit-view-on-init="true"
      :min-zoom="0.1"
      :max-zoom="3"
      @nodeClick="onNodeClick"
    >
      <Background :gap="24" :size="1" />
    </VueFlow>

    <!-- Breadcrumbs -->
    <div v-if="breadcrumbs.length" class="absolute top-6 left-6 glass px-4 py-2 rounded-xl text-sm z-40 flex items-center gap-1">
      <button
        class="text-accent hover:text-white transition mr-2"
        @click="store.goBack()"
      >
        ← Back
      </button>
      <span
        v-for="(crumb, idx) in breadcrumbs"
        :key="crumb.id"
        class="cursor-pointer hover:text-accent transition"
        @click="store.focusNode(crumb.id)"
      >
        {{ crumb.title }}<span v-if="idx < breadcrumbs.length - 1" class="text-textSecondary mx-1">/</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { useAppStore } from "../store/app";
import NodeCard from "./NodeCard.vue";
import type { NodeMouseEvent } from "@vue-flow/core";

const store = useAppStore();

const flowNodes = computed(() => store.nodes);
const flowEdges = computed(() => store.edges);
const breadcrumbs = computed(() => store.breadcrumbs);
const nodeTypes = { card: NodeCard };

const onNodeClick = (event: NodeMouseEvent) => {
  store.focusNode(event.node.id);
};
</script>

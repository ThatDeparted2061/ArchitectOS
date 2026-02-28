<template>
  <div class="h-full w-full grid-dots">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      class="h-full w-full"
      :fit-view-on-init="true"
      :min-zoom="0.2"
      :max-zoom="2"
      @node-click="onNodeClick"
    >
      <Background :gap="24" :size="1" />
    </VueFlow>

    <div v-if="breadcrumbs.length" class="absolute top-6 left-6 glass px-4 py-2 rounded-xl text-sm">
      <span
        v-for="(crumb, idx) in breadcrumbs"
        :key="crumb.id"
        class="cursor-pointer hover:text-white"
        @click="store.focusNode(crumb.id)"
      >
        {{ crumb.title }}<span v-if="idx < breadcrumbs.length - 1"> / </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { useAppStore } from "../store/app";

const store = useAppStore();

const nodes = computed(() => store.nodes);
const edges = computed(() => store.edges);
const breadcrumbs = computed(() => store.breadcrumbs);

const onNodeClick = (_: unknown, node: { id: string }) => {
  store.focusNode(node.id);
};
</script>

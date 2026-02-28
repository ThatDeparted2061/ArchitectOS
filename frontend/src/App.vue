<template>
  <div class="h-screen w-screen bg-bg text-textPrimary flex">
    <Sidebar />
    <div class="flex-1 relative">
      <GraphCanvas />
      <PromptPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import Sidebar from "./components/Sidebar.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import PromptPanel from "./components/PromptPanel.vue";
import { useAppStore } from "./store/app";

const store = useAppStore();

onMounted(() => {
  store.generate("Build an API Gateway");
});
</script>

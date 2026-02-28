<template>
  <div class="h-screen w-screen bg-bg text-textPrimary flex overflow-hidden">
    <Sidebar />
    <div class="flex-1 relative">
      <!-- Welcome screen when no architecture loaded -->
      <div v-if="!store.architecture && !store.loading" class="h-full flex flex-col items-center justify-center gap-6">
        <h1 class="text-4xl font-bold text-accent">ArchitectOS</h1>
        <p class="text-textSecondary text-lg max-w-md text-center">
          Describe any system and watch it decompose into an interactive architecture graph.
        </p>
        <div class="flex gap-2 w-[420px]">
          <input
            v-model="prompt"
            @keyup.enter="submit"
            placeholder="e.g. Build an API Gateway"
            class="flex-1 bg-surface rounded-xl p-3 text-sm border border-white/5 focus:border-accent outline-none transition"
          />
          <button
            class="bg-accent text-white px-6 rounded-xl font-medium hover:opacity-90 transition"
            @click="submit"
          >
            Generate
          </button>
        </div>
        <div class="flex gap-2 mt-2">
          <button
            v-for="example in examples"
            :key="example"
            class="text-xs bg-surface px-3 py-1.5 rounded-lg text-textSecondary hover:text-white transition cursor-pointer"
            @click="prompt = example; submit()"
          >
            {{ example }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="store.loading" class="h-full flex flex-col items-center justify-center gap-4">
        <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p class="text-textSecondary">Generating architecture...</p>
      </div>

      <!-- Error -->
      <div v-if="store.error && !store.loading" class="absolute top-6 left-1/2 -translate-x-1/2 bg-red-900/80 text-white px-4 py-2 rounded-xl text-sm z-50">
        {{ store.error }}
      </div>

      <!-- Graph -->
      <GraphCanvas v-if="store.architecture && !store.loading" />

      <!-- Floating prompt (when graph is shown) -->
      <PromptPanel v-if="store.architecture && !store.loading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Sidebar from "./components/Sidebar.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import PromptPanel from "./components/PromptPanel.vue";
import { useAppStore } from "./store/app";

const store = useAppStore();
const prompt = ref("");

const examples = [
  "Build an API Gateway",
  "Design a Blockchain",
  "ATM Machine in Java OOP",
  "Chat Application",
  "E-commerce Backend",
];

const submit = () => {
  if (prompt.value.trim()) {
    store.generate(prompt.value);
  }
};
</script>

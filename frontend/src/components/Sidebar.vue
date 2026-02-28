<template>
  <aside class="w-[280px] h-full p-5 glass rounded-xl m-4 flex flex-col gap-6">
    <div>
      <h2 class="text-xl font-semibold">ArchitectOS</h2>
      <p class="text-textSecondary text-sm">Local AI Architecture Visualizer</p>
    </div>

    <div>
      <label class="text-sm text-textSecondary">Autonomy Level</label>
      <input
        type="range"
        min="1"
        max="4"
        v-model.number="store.level"
        class="w-full"
      />
      <div class="flex justify-between text-xs text-textSecondary mt-1">
        <span>Beginner</span>
        <span>Expert</span>
      </div>
    </div>

    <div>
      <label class="text-sm text-textSecondary">Mode</label>
      <select v-model="store.mode" class="w-full bg-surface rounded-xl p-2">
        <option>AI Decompose</option>
        <option>Manual Mode</option>
        <option>Hybrid</option>
      </select>
    </div>

    <div>
      <label class="text-sm text-textSecondary">Syntax</label>
      <select v-model="store.syntax" class="w-full bg-surface rounded-xl p-2">
        <option>Hide Syntax</option>
        <option>Show Pseudocode</option>
        <option>Show Real Code</option>
      </select>
    </div>

    <div class="flex items-center justify-between">
      <label class="text-sm text-textSecondary">AI Enabled</label>
      <input type="checkbox" v-model="store.aiEnabled" />
    </div>

    <button
      class="bg-accent text-white py-2 rounded-xl hover:opacity-90 transition"
      @click="store.reset()"
    >
      Reset
    </button>
  </aside>
</template>

<script setup lang="ts">
import { useAppStore } from "../store/app";

const store = useAppStore();
</script>

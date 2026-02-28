<template>
  <aside class="w-[280px] h-full p-5 glass flex flex-col gap-6 border-r border-white/5">
    <div>
      <h2 class="text-xl font-semibold text-accent">ArchitectOS</h2>
      <p class="text-textSecondary text-xs mt-1">Local AI Architecture Visualizer</p>
    </div>

    <!-- Autonomy Slider -->
    <div>
      <label class="text-sm text-textSecondary block mb-2">Autonomy Level</label>
      <input
        type="range"
        min="1"
        max="4"
        v-model.number="store.level"
        class="w-full accent-accent"
        @change="store.regenerate()"
      />
      <div class="flex justify-between text-[10px] text-textSecondary mt-1">
        <span :class="{ 'text-accent': store.level === 1 }">Beginner</span>
        <span :class="{ 'text-accent': store.level === 2 }">Intermediate</span>
        <span :class="{ 'text-accent': store.level === 3 }">Advanced</span>
        <span :class="{ 'text-accent': store.level === 4 }">Expert</span>
      </div>
    </div>

    <!-- Mode -->
    <div>
      <label class="text-sm text-textSecondary block mb-2">Mode</label>
      <select v-model="store.mode" class="w-full bg-surface rounded-xl p-2 text-sm border border-white/5 outline-none">
        <option>AI Decompose</option>
        <option>Manual Mode</option>
        <option>Hybrid</option>
      </select>
    </div>

    <!-- Syntax Toggle -->
    <div>
      <label class="text-sm text-textSecondary block mb-2">Syntax</label>
      <select v-model="store.syntax" class="w-full bg-surface rounded-xl p-2 text-sm border border-white/5 outline-none">
        <option>Hide Syntax</option>
        <option>Show Pseudocode</option>
        <option>Show Real Code</option>
      </select>
    </div>

    <!-- AI Toggle -->
    <div class="flex items-center justify-between">
      <label class="text-sm text-textSecondary">AI Enabled</label>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="store.aiEnabled" class="sr-only peer" />
        <div class="w-9 h-5 bg-surface rounded-full peer peer-checked:bg-accent transition"></div>
        <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-4"></div>
      </label>
    </div>

    <div class="flex-1"></div>

    <!-- Reset -->
    <button
      class="bg-surface text-textSecondary py-2 rounded-xl hover:text-white hover:bg-white/10 transition text-sm border border-white/5"
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

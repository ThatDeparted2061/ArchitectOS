<template>
  <div class="absolute top-6 right-6 w-[360px] glass rounded-xl p-4">
    <h3 class="text-sm font-semibold mb-2">What do you want to build?</h3>
    <div class="flex gap-2">
      <input
        v-model="prompt"
        placeholder="Describe a system (e.g., API Gateway, Blockchain)"
        class="flex-1 bg-surface rounded-xl p-2 text-sm"
      />
      <button
        class="bg-accent text-white px-4 rounded-xl"
        @click="submit"
      >
        Generate
      </button>
    </div>
    <p class="text-xs text-textSecondary mt-2">
      Mode: {{ store.mode }} · Level: {{ store.level }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAppStore } from "../store/app";

const store = useAppStore();
const prompt = ref("");

const submit = () => {
  if (!prompt.value.trim()) return;
  store.generate(prompt.value);
};
</script>

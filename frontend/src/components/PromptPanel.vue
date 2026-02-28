<template>
  <div class="absolute top-6 right-6 w-[360px] glass rounded-xl p-4">
    <div class="flex gap-2">
      <input
        v-model="prompt"
        placeholder="Build an API Gateway"
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
const prompt = ref("Build an API Gateway");

const submit = () => {
  store.generate(prompt.value);
};
</script>

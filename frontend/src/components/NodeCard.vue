<template>
  <Handle type="target" :position="Position.Top" style="visibility: hidden" />
  <div
    class="glass rounded-xl p-4 border-l-4 shadow-lg min-w-[220px] max-w-[340px] transition-all duration-200"
    :class="isEditing ? 'border-yellow-400 shadow-yellow-400/20' : 'border-accent hover:shadow-accent/20 hover:border-accent2'"
  >
    <!-- View mode -->
    <template v-if="!isEditing">
      <div class="font-medium text-sm text-white">{{ data.title }}</div>
      <div class="text-xs text-textSecondary mt-1 leading-relaxed">{{ data.description }}</div>

      <!-- Code block -->
      <div v-if="data.code" class="mt-2 bg-black/40 rounded-lg p-2 overflow-x-auto">
        <pre class="text-[10px] text-green-400 font-mono leading-tight whitespace-pre-wrap">{{ data.code }}</pre>
      </div>

      <div class="flex items-center justify-between mt-2">
        <div v-if="hasChildren" class="text-[10px] text-accent">▶ Click to expand</div>
        <div v-else class="text-[10px] text-textSecondary/40">— leaf node —</div>
        <div v-if="isHybrid" class="flex gap-1">
          <button
            class="text-[10px] text-yellow-400 hover:text-yellow-300 transition"
            @click.stop="startEdit"
          >✏️</button>
          <button
            class="text-[10px] text-red-400 hover:text-red-300 transition"
            @click.stop="deleteNode"
          >🗑️</button>
          <button
            class="text-[10px] text-green-400 hover:text-green-300 transition"
            @click.stop="addChild"
          >➕</button>
        </div>
      </div>
    </template>

    <!-- Edit mode -->
    <template v-else>
      <input
        v-model="editTitle"
        class="w-full bg-black/30 rounded px-2 py-1 text-sm text-white outline-none border border-yellow-400/30 mb-1"
        placeholder="Title"
        @keyup.enter="saveEdit"
      />
      <textarea
        v-model="editDesc"
        class="w-full bg-black/30 rounded px-2 py-1 text-xs text-textSecondary outline-none border border-yellow-400/30 resize-none"
        rows="2"
        placeholder="Description"
      ></textarea>
      <div class="flex gap-1 mt-2">
        <button
          class="text-[10px] bg-yellow-400 text-black px-2 py-0.5 rounded hover:bg-yellow-300 transition"
          @click.stop="saveEdit"
        >Save</button>
        <button
          class="text-[10px] bg-surface text-textSecondary px-2 py-0.5 rounded hover:text-white transition"
          @click.stop="cancelEdit"
        >Cancel</button>
      </div>
    </template>
  </div>
  <Handle type="source" :position="Position.Bottom" style="visibility: hidden" />
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { useAppStore } from "../store/app";

const props = defineProps<{ id: string; data: { title: string; description: string; code?: string } }>();
const store = useAppStore();

const isEditing = ref(false);
const editTitle = ref("");
const editDesc = ref("");

const isHybrid = computed(() => store.mode === "Hybrid");

const hasChildren = computed(() => {
  if (!store.architecture) return false;
  const node = findInTree(store.architecture, props.id);
  return node ? (node.children || []).length > 0 : false;
});

function startEdit() {
  editTitle.value = props.data.title;
  editDesc.value = props.data.description;
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
}

function saveEdit() {
  store.editNode(props.id, editTitle.value, editDesc.value);
  isEditing.value = false;
}

function deleteNode() {
  store.deleteNode(props.id);
}

function addChild() {
  store.addChildNode(props.id);
}

function findInTree(node: any, id: string): any {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return null;
}
</script>

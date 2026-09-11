<template>
  <!-- Multi-Directional Handles for Tree and Cross-Node Attachments -->
  <Handle type="target" :position="Position.Top" class="!w-2.5 !h-2.5 !bg-accent/80 !border !border-surface !rounded-full" />
  <Handle type="target" :position="Position.Left" class="!w-2 !h-2 !opacity-0" />

  <div
    class="border p-3 min-w-[210px] max-w-[280px] shadow-lg font-sans text-left transition-all duration-200 rounded-md backdrop-blur-md relative"
    :class="[
      categoryStyle.border,
      categoryStyle.bg,
      isEditing ? 'ring-2 ring-accent' : 'hover:border-opacity-100 hover:shadow-xl'
    ]"
  >
    <template v-if="!isEditing">
      <!-- Header: Semantic Badge & Icon -->
      <div class="flex items-center justify-between border-b pb-1.5 mb-1.5 border-white/10">
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <!-- Semantic Icon -->
          <span :class="categoryStyle.text" class="flex-shrink-0">
            <!-- Database Cylinder -->
            <svg v-if="categoryStyle.icon === 'database'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <!-- API Gateway Pill -->
            <svg v-else-if="categoryStyle.icon === 'gateway'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="2" y="6" width="20" height="12" rx="6"/>
              <circle cx="8" cy="12" r="2"/>
              <path d="M14 12h4"/>
            </svg>
            <!-- Message Queue / Event Stream Hexagon -->
            <svg v-else-if="categoryStyle.icon === 'queue'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <!-- External SaaS / Cloud -->
            <svg v-else-if="categoryStyle.icon === 'cloud'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-.1-9.999 5.002 5.002 0 1 0-9.78 2.096A4.001 4.001 0 0 0 3 15z"/>
            </svg>
            <!-- Standard Service / Microservice -->
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
          </span>

          <!-- Node Title -->
          <div 
            class="font-bold text-xs uppercase tracking-wider truncate flex-1 cursor-pointer" 
            :class="categoryStyle.text"
            @click="startEdit"
            title="Click to edit component"
          >
            {{ props.data.title }}
          </div>
        </div>

        <!-- Semantic Type Pill Badge -->
        <span 
          class="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-tight"
          :class="[categoryStyle.badgeBg, categoryStyle.text]"
        >
          {{ categoryStyle.badgeLabel }}
        </span>
      </div>
      
      <!-- Description -->
      <div 
        class="text-[11px] text-textPrimary leading-relaxed mb-2 font-mono line-clamp-3 cursor-pointer hover:text-white transition"
        @click="startEdit"
      >
        {{ props.data.description }}
      </div>

      <!-- Code Preview (if present) -->
      <div v-if="props.data.code" class="bg-bg/80 border border-borderMuted p-1.5 overflow-x-auto max-h-[85px] scrollbar-thin rounded mb-2">
        <pre class="text-[10px] text-textSecondary font-mono leading-tight whitespace-pre-wrap">{{ props.data.code }}</pre>
      </div>

      <!-- Actions Footer -->
      <div class="flex items-center justify-between pt-2 border-t border-white/10 mt-auto">
        <div v-if="hasChildren" class="text-[10px] font-bold flex items-center gap-1 cursor-pointer text-accent hover:underline" @click.stop="drillIn">
          <span>Drill In</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </div>
        <div v-else class="text-[9px] text-textSecondary/60 font-mono uppercase tracking-widest">Leaf</div>
        
        <div class="flex items-center gap-1">
          <!-- Open in VS Code Jump Button (if file path is known) -->
          <button 
            v-if="filePath" 
            class="p-1 text-accent hover:bg-accent/10 rounded transition duration-150" 
            @click.stop="openInVsCode" 
            :title="`Open ${filePath} in VS Code`"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>

          <!-- Ask AI Helper -->
          <button 
            class="p-1 text-textSecondary hover:text-accent hover:bg-white/5 rounded transition duration-150" 
            @click.stop="openAI" 
            title="Ask AI about this component"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM5 10a7 7 0 0 0 14 0M12 15v4M9 22h6M8 8h.01M16 8h.01"/></svg>
          </button>
          
          <!-- Edit -->
          <button 
            class="p-1 text-textSecondary hover:text-accent hover:bg-white/5 rounded transition duration-150" 
            @click.stop="startEdit" 
            title="Edit Node"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
          </button>

          <!-- Add Child Component -->
          <button 
            class="p-1 text-textSecondary hover:text-[#10b981] hover:bg-white/5 rounded transition duration-150" 
            @click.stop="addChild" 
            title="Add Child Component"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>

          <!-- Delete Component -->
          <button 
            class="p-1 text-textSecondary hover:text-red-500 hover:bg-white/5 rounded transition duration-150" 
            @click.stop="deleteNode" 
            title="Delete Node"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
    </template>

    <!-- Inline Editing Form -->
    <template v-else>
      <div class="flex items-center gap-1 mb-2">
        <input 
          v-model="editTitle" 
          class="w-full bg-surface rounded px-2 py-1 text-xs text-textPrimary outline-none border border-borderMuted font-mono focus:border-accent" 
          placeholder="Component Name" 
          @keyup.enter="saveEdit" 
        />
      </div>

      <!-- Quick Type Selector Dropdown -->
      <div class="mb-2">
        <select 
          v-model="editType" 
          class="w-full bg-surface rounded px-2 py-1 text-[10px] text-textSecondary outline-none border border-borderMuted font-mono"
        >
          <option value="service_layer">Microservice / Service</option>
          <option value="api_gateway">API Gateway / Router</option>
          <option value="database">Database / Data Store</option>
          <option value="queue">Queue / Event Stream</option>
          <option value="controller">Controller / Handler</option>
          <option value="external_saas">External SaaS / Cloud</option>
        </select>
      </div>

      <textarea 
        v-model="editDesc" 
        class="w-full bg-surface rounded px-2 py-1 text-[11px] text-textPrimary outline-none border border-borderMuted resize-none mb-2 font-mono focus:border-accent" 
        rows="2.5" 
        placeholder="Component description..."
      ></textarea>

      <div class="flex gap-2 justify-end">
        <button class="text-[10px] bg-[#10b981] hover:bg-[#10b981]/90 text-white px-2.5 py-1 rounded font-bold transition" @click.stop="saveEdit">Save</button>
        <button class="text-[10px] bg-surface border border-borderMuted text-textSecondary hover:text-textPrimary px-2.5 py-1 rounded transition" @click.stop="cancelEdit">Cancel</button>
      </div>
    </template>
  </div>

  <!-- Multi-Directional Source Handles -->
  <Handle type="source" :position="Position.Bottom" class="!w-2.5 !h-2.5 !bg-accent/80 !border !border-surface !rounded-full" />
  <Handle type="source" :position="Position.Right" class="!w-2 !h-2 !opacity-0" />
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { useAppStore } from "../store/app";

const props = defineProps<{ 
  id: string; 
  data: { 
    title: string; 
    description: string; 
    type?: string; 
    path?: string;
    code?: string;
  };
}>();

const store = useAppStore();

const isEditing = ref(false);
const editTitle = ref("");
const editDesc = ref("");
const editType = ref("service_layer");

const hasChildren = computed(() => {
  if (!store.architecture) return false;
  const node = findInTree(store.architecture, props.id);
  return node ? (node.children || []).length > 0 : false;
});

const filePath = computed(() => {
  if (props.data.path) return props.data.path;
  if (props.data.title && (props.data.title.includes(".") || props.data.title.includes("/"))) {
    return props.data.title;
  }
  return null;
});

function openInVsCode() {
  if (filePath.value) {
    window.parent.postMessage({ command: 'openFile', path: filePath.value }, '*');
  }
}

/**
 * Determine semantic styling, badges, and icons based on architectural category
 */
const categoryStyle = computed(() => {
  const type = (props.data.type || "").toLowerCase();
  const title = props.data.title.toLowerCase();
  
  // 1. Database / Persistence
  if (type === "database" || title.includes("db") || title.includes("database") || title.includes("sql") || title.includes("mongo") || title.includes("redis") || title.includes("store") || title.includes("repository") || title.includes("pool")) {
    return {
      border: "border-[#10b981]/60",
      bg: "bg-[#064e3b]/40",
      text: "text-[#34d399]",
      badgeBg: "bg-[#064e3b]/80",
      badgeLabel: "DATABASE",
      icon: "database"
    };
  }

  // 2. API Gateway / Router / Ingress
  if (type === "api_gateway" || title.includes("gateway") || title.includes("api") || title.includes("router") || title.includes("ingress") || title.includes("proxy") || title.includes("web") || title.includes("client")) {
    return {
      border: "border-[#38bdf8]/60",
      bg: "bg-[#0c4a6e]/40",
      text: "text-[#7dd3fc]",
      badgeBg: "bg-[#0c4a6e]/80",
      badgeLabel: "GATEWAY",
      icon: "gateway"
    };
  }

  // 3. Message Queue / Event Bus / Stream
  if (type === "queue" || title.includes("queue") || title.includes("kafka") || title.includes("rabbit") || title.includes("event") || title.includes("pubsub") || title.includes("stream") || title.includes("worker") || title.includes("ingestion")) {
    return {
      border: "border-[#f59e0b]/60",
      bg: "bg-[#451a03]/40",
      text: "text-[#fbbf24]",
      badgeBg: "bg-[#451a03]/80",
      badgeLabel: "QUEUE",
      icon: "queue"
    };
  }

  // 4. External SaaS / Cloud
  if (type === "external_saas" || title.includes("external") || title.includes("saas") || title.includes("stripe") || title.includes("aws") || title.includes("cloud")) {
    return {
      border: "border-[#818cf8]/60",
      bg: "bg-[#312e81]/40",
      text: "text-[#a5b4fc]",
      badgeBg: "bg-[#312e81]/80",
      badgeLabel: "SAAS",
      icon: "cloud"
    };
  }

  // 5. System Root
  if (type === "system" || type === "project" || title.includes("system") || title.includes("root")) {
    return {
      border: "border-[#3b82f6]/70",
      bg: "bg-[#1e3a8a]/40",
      text: "text-[#93c5fd]",
      badgeBg: "bg-[#1e3a8a]/80",
      badgeLabel: "SYSTEM",
      icon: "service"
    };
  }

  // 6. Default Microservice / Service Layer
  return {
    border: "border-[#64748b]/60",
    bg: "bg-[#1e293b]/40",
    text: "text-[#cbd5e1]",
    badgeBg: "bg-[#1e293b]/80",
    badgeLabel: "SERVICE",
    icon: "service"
  };
});

function startEdit() { 
  editTitle.value = props.data.title; 
  editDesc.value = props.data.description; 
  editType.value = props.data.type || "service_layer";
  isEditing.value = true; 
}

function cancelEdit() { 
  isEditing.value = false; 
}

function saveEdit() { 
  store.editNode(props.id, editTitle.value, editDesc.value, editType.value); 
  isEditing.value = false; 
}

function deleteNode() { store.deleteNode(props.id); }
function addChild() { store.addChildNode(props.id); }
function drillIn() { store.focusNode(props.id); }
function openAI() { store.openNodeAI(props.id); }

function findInTree(node: any, id: string): any {
  if (node.id === id) return node;
  for (const child of node.children || []) { 
    const found = findInTree(child, id); 
    if (found) return found; 
  }
  return null;
}
</script>

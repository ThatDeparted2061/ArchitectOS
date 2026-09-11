<template>
  <div class="h-screen w-screen bg-bg text-textPrimary flex overflow-hidden font-sans">
    <!-- Always mounted so welcome-screen upload can open the file picker -->
    <input ref="fileInput" type="file" accept=".zip,.tar,.gz,.js,.ts,.py,.java,.go,.rs,.c,.cpp,.h,.jsx,.tsx,.vue,.svelte,.rb,.php,.cs,.swift,.kt" multiple class="hidden" @change="handleUpload" />
    <Sidebar />
    <div class="flex-1 relative flex flex-col min-w-0">
      <!-- Toolbar: Tailored with high-contrast icon buttons for VS Code Webview -->
      <div v-if="store.architecture && !store.loading" class="flex items-center gap-2 p-2 border-b border-borderMuted bg-surface z-30 flex-wrap text-xs select-none">
        <!-- Prominent VS Code Workspace Ingestion Action -->
        <button 
          v-if="inVsCode" 
          class="toolbar-btn bg-accent/20 border-accent/40 text-accent hover:bg-accent/30 font-bold" 
          @click="decomposeActiveWorkspace"
          title="Re-analyze open workspace files and reverse-engineer architecture"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>⚡ Ingest Workspace</span>
        </button>

        <button :class="readmeBtnClass" @click="onReadmeClick" :disabled="store.readmeLoading" title="View or generate comprehensive project README">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>{{ store.readmeLoading ? 'Generating...' : readmeBtnLabel }}</span>
        </button>

        <button class="toolbar-btn" @click="store.loadFileStructure()" title="Generate full directory structure">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>Files</span>
        </button>

        <button class="toolbar-btn" @click="store.toggleViewMode()" title="Toggle between High-Level Architecture and AST Dependency Graph">
          <svg class="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          <span>{{ store.viewMode === 'architecture' ? 'Dependencies' : 'Architecture' }}</span>
        </button>

        <button class="toolbar-btn bg-accentLight border border-accent/20 text-accent hover:bg-accentLight/60" @click="store.toggleCodeViewer()" title="Inspect underlying component pseudocode/code">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span>Code</span>
        </button>

        <button class="toolbar-btn" :class="{ 'bg-accentLight/30 text-accent border-accent/25': store.promptPanelVisible }" @click="store.togglePromptPanel()" title="Toggle quick prompt bar">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Prompt Bar</span>
        </button>

        <button class="toolbar-btn" @click="downloadZip" title="Export as code ZIP bundle">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export ZIP</span>
        </button>

        <button v-if="!inVsCode" class="toolbar-btn" @click="triggerUpload" title="Upload custom ZIP or source files">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Upload</span>
        </button>

        <div class="flex-1"></div>
        <span class="text-[10px] font-mono text-textSecondary bg-bg border border-borderMuted rounded px-2 py-0.5 truncate max-w-[200px]" :title="store.lastPrompt">{{ store.lastPrompt }}</span>
      </div>

      <!-- Welcome screen -->
      <div v-if="!store.architecture && !store.loading && !store.uploadLoading" class="flex-1 flex flex-col items-center justify-center gap-5 grid-dots relative overflow-hidden p-6 select-none">
        <div class="flex flex-col items-center max-w-xl text-center z-10 space-y-2">
          <h1 class="text-3xl font-extrabold tracking-tight text-textPrimary uppercase tracking-widest border-b-2 border-accent pb-1">ArchitectOS</h1>
          <p class="text-textSecondary text-xs max-w-md leading-relaxed font-mono">
            Interactive software architecture visualizer, reverse-engineering engine & DAG canvas.
          </p>
        </div>

        <!-- Prompt input -->
        <div class="w-full max-w-[480px] bg-surface border border-borderMuted p-1 rounded flex gap-2 z-10 focus-within:border-accent shadow-sm transition duration-150">
          <input v-model="prompt" @keyup.enter="submit" placeholder="e.g., Design a high-throughput API gateway with Redis rate limiting" class="flex-1 bg-transparent px-3 py-1.5 text-xs outline-none placeholder:text-textSecondary/40 font-mono" />
          <button class="bg-accent hover:bg-accentLight text-white px-4 rounded font-bold text-xs transition duration-150" @click="submit">Decompose</button>
        </div>

        <!-- Example Prompts -->
        <div class="flex gap-1.5 max-w-lg mt-0.5 flex-wrap justify-center z-10">
          <button v-for="example in examples" :key="example" class="text-[11px] bg-surface border border-borderMuted px-2.5 py-1 rounded text-textSecondary hover:text-textPrimary hover:bg-surfaceHover transition duration-150 cursor-pointer font-medium" @click="prompt = example; submit()">{{ example }}</button>
        </div>

        <div class="text-textSecondary/50 text-[10px] font-bold uppercase tracking-widest z-10 my-0.5">OR</div>

        <!-- VS Code Primary 1-Click Reverse Engineering Action -->
        <button v-if="inVsCode" class="bg-accent/20 border border-accent/40 hover:bg-accent/30 text-accent px-5 py-2 rounded text-xs font-bold tracking-wider uppercase transition duration-150 flex items-center gap-2 shadow-sm z-10" @click="decomposeActiveWorkspace">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>⚡ Reverse Engineer Active Workspace</span>
        </button>

        <button v-if="store.savedArchitecture" class="bg-surface hover:bg-surfaceHover border border-borderMuted text-accent hover:text-accentLight px-4 py-2 rounded text-xs font-bold tracking-wider uppercase transition duration-150 flex items-center gap-2 shadow-sm z-10" @click="store.restoreSession()">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Restore Previous Session</span>
        </button>

        <button v-if="!inVsCode" class="bg-surface hover:bg-surfaceHover border border-borderMuted text-textSecondary hover:text-textPrimary px-4 py-2 rounded text-xs font-bold tracking-wider uppercase transition duration-150 flex items-center gap-2 shadow-sm z-10" @click="triggerUpload">
          <svg class="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Upload Local Codebase</span>
        </button>

        <div v-if="store.history.length" class="mt-2 w-[440px] z-10">
          <p class="text-textSecondary/55 text-[9px] font-bold uppercase tracking-wider mb-1.5 font-mono">Recent Decompositions</p>
          <div class="flex flex-col gap-1">
            <button v-for="h in store.history.slice(-3).reverse()" :key="h.timestamp" class="text-xs text-left bg-surface border border-borderMuted px-3 py-1.5 rounded text-textSecondary hover:text-textPrimary hover:bg-surfaceHover transition truncate font-mono" @click="prompt = h.prompt; submit()">{{ h.prompt }}</button>
          </div>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="store.loading || store.uploadLoading" class="flex-1 flex flex-col items-center justify-center gap-4 grid-dots">
        <div class="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin shadow-sm"></div>
        <p class="text-textSecondary text-xs font-semibold tracking-wide animate-pulse">{{ store.uploadLoading ? 'Reverse-engineering active workspace...' : 'Decomposing system architecture...' }}</p>
      </div>

      <!-- Error Toast -->
      <div v-if="store.error && !store.loading" class="absolute top-14 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500/50 text-red-200 px-3.5 py-2 rounded text-xs z-50 flex items-center gap-3 shadow-lg">
        <span>{{ store.error }}</span>
        <button @click="store.error = null" class="text-red-400 hover:text-red-200 transition font-bold">✕</button>
      </div>

      <!-- Main Graph Canvas & Quick Prompt Floating Bar -->
      <div v-if="store.architecture && !store.loading" class="flex-1 relative">
        <GraphCanvas />
        <PromptPanel v-if="store.promptPanelVisible" />
      </div>

      <!-- Modals -->
      <ReadmeModal v-if="store.readmeVisible" />
      <FileStructureModal v-if="store.fileStructureVisible" />
      <CodeViewer v-if="store.codeViewerVisible" :architecture="store.architecture" @close="store.toggleCodeViewer()" />
      <NodeAIChat
        v-if="store.activeAINodeId && activeAINode"
        :node="activeAINode"
        @close="store.closeNodeAI()"
        @update="store.updateNodeFromAI($event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Sidebar from "./components/Sidebar.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import PromptPanel from "./components/PromptPanel.vue";
import ReadmeModal from "./components/ReadmeModal.vue";
import FileStructureModal from "./components/FileStructureModal.vue";
import CodeViewer from "./components/CodeViewer.vue";
import NodeAIChat from "./components/NodeAIChat.vue";
import { useAppStore } from "./store/app";

const store = useAppStore();
const prompt = ref(store.lastPrompt || "");
const fileInput = ref<HTMLInputElement | null>(null);

if (store.architecture) store._rebuildGraph();

const inVsCode = ref(window.parent !== window);

const decomposeActiveWorkspace = () => {
  if (inVsCode.value) {
    store.uploadLoading = true;
    store.error = null;
    window.parent.postMessage({ command: "readWorkspaceFiles" }, "*");
  }
};

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.command === "workspaceFilesResult") {
    const payload = message.files.map((f: any) => ({
      path: f.path,
      content: f.content.slice(0, 8000),
    }));
    store.uploadCodebase(payload);
  }
});

const examples = [
  "Build an API Gateway",
  "Design a Blockchain",
  "Chat Application with WebSockets",
  "E-commerce Microservices",
  "Compiler AST Engine",
];

const readmeBtnLabel = computed(() => {
  if (!store.readme) return "📝 README";
  if (store.readmeStale) return "🔴 README (Stale)";
  return "📝 README";
});

const readmeBtnClass = computed(() => {
  if (store.readmeStale && store.readme) return "toolbar-btn border-amber-500/50 text-amber-300";
  return "toolbar-btn";
});

const onReadmeClick = async () => {
  if (!store.readme || store.readmeStale) {
    await store.refreshReadme();
  }
  store.toggleReadme();
};

const activeAINode = computed(() => {
  if (!store.activeAINodeId || !store.architecture) return null;
  return findInTree(store.architecture, store.activeAINodeId);
});

function findInTree(node: any, id: string): any {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return null;
}

const submit = () => {
  if (!prompt.value.trim()) return;
  store.generate(prompt.value);
};

const triggerUpload = () => {
  fileInput.value?.click();
};

const handleUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const first = files[0];
  if (first.name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(first);
    const entries: { path: string; content: string }[] = [];
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (!file.dir && !relativePath.includes("node_modules") && !relativePath.startsWith(".")) {
        try {
          const content = await file.async("string");
          entries.push({ path: relativePath, content: content.slice(0, 8000) });
        } catch {}
      }
    }
    await store.uploadCodebase(entries);
  } else {
    const entries: { path: string; content: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();
      entries.push({ path: file.name, content: content.slice(0, 8000) });
    }
    await store.uploadCodebase(entries);
  }
};

const downloadZip = async () => {
  if (!store.architecture) return;
  const zip = new JSZip();
  buildZipFolder(zip, store.architecture);
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${store.architecture.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-architecture.zip`);
};

function buildZipFolder(folder: JSZip, node: any) {
  if (node.code) {
    const filename = `${node.title.replace(/[^a-zA-Z0-9-_]/g, "")}.ts`;
    folder.file(filename, node.code);
  }
  for (const child of node.children || []) {
    const subFolder = folder.folder(child.title.replace(/[^a-zA-Z0-9-_]/g, "")) || folder;
    buildZipFolder(subFolder, child);
  }
}
</script>

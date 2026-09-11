import { defineStore } from "pinia";
import { generateArchitecture, generateReadme, getFileStructure, analyzeCodebase, getGraphData } from "../services/api";
import { buildGraph, buildDependencyGraph, type ArchNode, type ArchEdge } from "../services/graph";

/**
 * Deep clone helper to ensure immutable state mutation for Pinia reactive trees
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Recursively find node by ID in architecture tree
 */
function findInTree(node: ArchNode, id: string): ArchNode | null {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Recursively find parent node of a given child ID
 */
function findParent(node: ArchNode, id: string): ArchNode | null {
  for (const child of node.children || []) {
    if (child.id === id) return node;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

// ── LocalStorage persistence helpers ─────────────────────────────────
const STORAGE_KEY = "architectos-state";

function saveToStorage(data: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function loadFromStorage(): any {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAppStore = defineStore("app", {
  state: () => {
    const saved = loadFromStorage();
    return {
      level: saved?.level ?? 2,
      mode: (saved?.mode ?? "AI Decompose") as "AI Decompose" | "Manual Mode" | "Hybrid",
      syntax: (saved?.syntax ?? "Hide Syntax") as "Hide Syntax" | "Show Pseudocode" | "Show Real Code",
      aiEnabled: saved?.aiEnabled ?? true,
      architecture: null as ArchNode | null,
      savedArchitecture: (saved?.architecture ?? null) as ArchNode | null,
      // Cross-node semantic edges (imports, function calls, DB access, event streams)
      architectureEdges: (saved?.architectureEdges ?? []) as ArchEdge[],
      nodes: [] as any[],
      edges: [] as any[],
      breadcrumbs: [] as ArchNode[],
      focusId: (saved?.focusId ?? null) as string | null,
      // Layout direction: 'TB' = Top-to-Bottom (standard Tree), 'LR' = Left-to-Right
      graphDirection: (saved?.graphDirection ?? "TB") as "TB" | "LR",
      loading: false,
      abortController: null as AbortController | null,
      error: null as string | null,
      promptPanelVisible: saved?.promptPanelVisible ?? true,
      lastPrompt: saved?.lastPrompt ?? "",
      // README
      readme: (saved?.readme ?? "") as string,
      readmeStale: false,
      readmeLoading: false,
      readmeVisible: false,
      // File structure
      fileStructure: (saved?.fileStructure ?? []) as string[],
      fileStructureVisible: false,
      // Upload
      uploadLoading: false,
      // History
      history: (saved?.history ?? []) as { prompt: string; timestamp: number }[],
      // Code viewer
      codeViewerVisible: false,
      // Node AI
      activeAINodeId: null as string | null,
      viewMode: (saved?.viewMode ?? "architecture") as "architecture" | "dependency",
      sidebarWidth: saved?.sidebarWidth ?? 300,
      sidebarCollapsed: saved?.sidebarCollapsed ?? false,
      // Collapsed subgraph subsystem IDs for compact overview mode
      collapsedSubsystems: (saved?.collapsedSubsystems ? new Set<string>(saved.collapsedSubsystems) : new Set<string>()) as Set<string>,
      // Maximum columns allowed per subsystem 2D grid
      maxGridCols: (saved?.maxGridCols ?? 3) as number,
    };
  },
  actions: {
    restoreSession() {
      if (this.savedArchitecture) {
        this.architecture = this.savedArchitecture;
        this.focusId = null;
        this._rebuildGraph();
        this._persist();
      }
    },

    _persist() {
      saveToStorage({
        level: this.level,
        mode: this.mode,
        syntax: this.syntax,
        aiEnabled: this.aiEnabled,
        architecture: this.architecture,
        architectureEdges: this.architectureEdges,
        focusId: this.focusId,
        graphDirection: this.graphDirection,
        lastPrompt: this.lastPrompt,
        readme: this.readme,
        fileStructure: this.fileStructure,
        history: this.history.slice(-20),
        viewMode: this.viewMode,
        promptPanelVisible: this.promptPanelVisible,
        sidebarWidth: this.sidebarWidth,
        sidebarCollapsed: this.sidebarCollapsed,
        collapsedSubsystems: Array.from(this.collapsedSubsystems),
        maxGridCols: this.maxGridCols,
      });
    },

    /**
     * Rebuild the Vue Flow graph nodes and edges with 2D dynamic grid layout and cross-node connection lines
     */
    async _rebuildGraph() {
      if (!this.architecture) return;
      if (this.viewMode === "dependency") {
        try {
          const rawGraph = await getGraphData();
          const { nodes, edges } = buildDependencyGraph(rawGraph.nodes, rawGraph.edges);
          this.nodes = nodes;
          this.edges = edges;
          this.breadcrumbs = [];
        } catch (err) {
          console.error("Failed to build dependency graph:", err);
        }
      } else {
        // Build true hierarchical tree layout passing direction, cross-node edges, collapsed state, and maxGridCols
        const { nodes, edges, focusPath } = buildGraph(
          this.architecture,
          this.focusId || undefined,
          this.graphDirection,
          this.architectureEdges,
          this.collapsedSubsystems,
          this.maxGridCols
        );
        this.nodes = nodes;
        this.edges = edges;
        this.breadcrumbs = focusPath;
      }
    },

    /**
     * Toggle collapse state for a specific subsystem container
     */
    toggleSubsystemCollapse(id: string) {
      if (this.collapsedSubsystems.has(id)) {
        this.collapsedSubsystems.delete(id);
      } else {
        this.collapsedSubsystems.add(id);
      }
      this._rebuildGraph();
      this._persist();
    },

    /**
     * Collapse all top-level subsystem containers into compact overview boxes
     */
    collapseAllSubsystems() {
      if (!this.architecture || !this.architecture.children) return;
      this.architecture.children.forEach((c) => this.collapsedSubsystems.add(c.id));
      this._rebuildGraph();
      this._persist();
    },

    /**
     * Expand all subsystem containers into multi-column 2D grids
     */
    expandAllSubsystems() {
      this.collapsedSubsystems.clear();
      this._rebuildGraph();
      this._persist();
    },

    /**
     * Update maximum columns allowed per subsystem container grid
     */
    setMaxGridCols(cols: number) {
      this.maxGridCols = cols;
      this._rebuildGraph();
      this._persist();
    },

    /**
     * Toggle layout orientation between Top-Down (TB) and Left-Right (LR) tree
     */
    async toggleGraphDirection() {
      this.graphDirection = this.graphDirection === "TB" ? "LR" : "TB";
      await this._rebuildGraph();
      this._persist();
    },

    async toggleViewMode() {
      this.viewMode = this.viewMode === "architecture" ? "dependency" : "architecture";
      await this._rebuildGraph();
      this._persist();
    },

    // ── Generate Architecture ─────────────────────────────────────
    async generate(prompt: string) {
      if (!prompt.trim()) return;
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();
      this.loading = true;
      this.error = null;
      this.lastPrompt = prompt;

      try {
        const data = await generateArchitecture(prompt, this.level, this.syntax, this.abortController.signal);
        
        // Handle payload containing both root and explicit cross-node edges
        if (data.root) {
          this.architecture = data.root;
          this.architectureEdges = data.edges || [];
        } else {
          this.architecture = data;
          this.architectureEdges = data.edges || [];
        }

        this.focusId = null;
        this.readmeStale = true;
        this.readme = "";
        this.fileStructure = [];
        this._rebuildGraph();

        // Add to history
        this.history.push({ prompt, timestamp: Date.now() });
        if (this.history.length > 20) this.history.shift();

        this._persist();
      } catch (e: any) {
        if (e.name === "AbortError") {
          this.error = "Generation stopped by user.";
        } else {
          this.error = e.message || "Failed to generate";
        }
      } finally {
        this.loading = false;
        this.abortController = null;
      }
    },

    async regenerate() {
      if (this.lastPrompt) await this.generate(this.lastPrompt);
    },

    // ── Navigation & Focus ────────────────────────────────────────
    focusNode(id: string) {
      if (!this.architecture) return;
      this.focusId = id;
      this._rebuildGraph();
      this._persist();
    },

    goBack() {
      if (!this.architecture) return;
      if (this.breadcrumbs.length > 1) {
        this.focusNode(this.breadcrumbs[this.breadcrumbs.length - 2].id);
      } else {
        this.focusId = null;
        this._rebuildGraph();
        this._persist();
      }
    },

    // ── Direct Visual On-Canvas Editing ───────────────────────────
    editNode(id: string, title: string, description: string, type?: string) {
      if (!this.architecture) return;
      const arch = deepClone(this.architecture);
      const node = findInTree(arch, id);
      if (node) {
        node.title = title;
        node.description = description;
        if (type) node.type = type;
        this.architecture = arch;
        this.readmeStale = true;
        this._rebuildGraph();
        this._persist();
      }
    },

    setNodeType(id: string, type: string) {
      if (!this.architecture) return;
      const arch = deepClone(this.architecture);
      const node = findInTree(arch, id);
      if (node) {
        node.type = type;
        this.architecture = arch;
        this._rebuildGraph();
        this._persist();
      }
    },

    deleteNode(id: string) {
      if (!this.architecture) return;
      if (this.architecture.id === id) {
        this.error = "Cannot delete root node";
        return;
      }
      const arch = deepClone(this.architecture);
      const parent = findParent(arch, id);
      if (parent) {
        parent.children = (parent.children || []).filter((c) => c.id !== id);
        this.architecture = arch;
        this.readmeStale = true;
        if (this.focusId === id) this.focusId = parent.id;
        this._rebuildGraph();
        this._persist();
      }
    },

    addChildNode(parentId: string) {
      if (!this.architecture) return;
      const arch = deepClone(this.architecture);
      const parent = findInTree(arch, parentId);
      if (parent) {
        const newNode: ArchNode = {
          id: "new-" + Math.random().toString(36).slice(2, 8),
          title: "New Component",
          description: "Click to edit description...",
          depth: parent.depth + 1,
          type: "service_layer",
          children: [],
          code: "",
        };
        if (!parent.children) parent.children = [];
        parent.children.push(newNode);
        this.architecture = arch;
        this.readmeStale = true;
        this._rebuildGraph();
        this._persist();
      }
    },

    // ── README ───────────────────────────────────────────────────
    async refreshReadme() {
      if (!this.architecture) return;
      this.readmeLoading = true;
      try {
        this.readme = await generateReadme(this.architecture, this.lastPrompt);
        this.readmeStale = false;
        this._persist();
      } catch (e: any) {
        this.error = "Failed to generate README: " + e.message;
      } finally {
        this.readmeLoading = false;
      }
    },

    toggleReadme() {
      this.readmeVisible = !this.readmeVisible;
    },

    // ── File structure ───────────────────────────────────────────
    async loadFileStructure() {
      if (!this.architecture) return;
      try {
        this.fileStructure = await getFileStructure(this.architecture);
        this.fileStructureVisible = true;
        this._persist();
      } catch (e: any) {
        this.error = "Failed to generate file structure";
      }
    },

    toggleFileStructure() {
      this.fileStructureVisible = !this.fileStructureVisible;
    },

    // ── Upload ───────────────────────────────────────────────────
    async uploadCodebase(files: { path: string; content: string }[]) {
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();
      this.uploadLoading = true;
      this.error = null;
      try {
        const data = await analyzeCodebase(files, this.abortController.signal);
        
        if (data.root) {
          this.architecture = data.root;
          this.architectureEdges = data.edges || [];
        } else {
          this.architecture = data;
          this.architectureEdges = data.edges || [];
        }

        this.focusId = null;
        this.lastPrompt = "[Uploaded Codebase]";
        this.readmeStale = true;
        this.readme = "";
        this.fileStructure = [];
        this._rebuildGraph();
        this._persist();
      } catch (e: any) {
        if (e.name === "AbortError") {
          this.error = "Codebase analysis stopped by user.";
        } else {
          this.error = e.message || "Failed to analyze codebase";
        }
      } finally {
        this.uploadLoading = false;
        this.abortController = null;
      }
    },

    // ── Code viewer ───────────────────────────────────────────────
    toggleCodeViewer() {
      this.codeViewerVisible = !this.codeViewerVisible;
    },

    togglePromptPanel() {
      this.promptPanelVisible = !this.promptPanelVisible;
      this._persist();
    },

    // ── Node AI ──────────────────────────────────────────────────
    openNodeAI(nodeId: string) {
      this.activeAINodeId = nodeId;
    },

    closeNodeAI() {
      this.activeAINodeId = null;
    },

    updateNodeFromAI(updatedNode: any) {
      if (!this.architecture || !updatedNode?.id) return;
      const arch = deepClone(this.architecture);
      const node = findInTree(arch, updatedNode.id);
      if (node) {
        if (updatedNode.title) node.title = updatedNode.title;
        if (updatedNode.description) node.description = updatedNode.description;
        if (updatedNode.type) node.type = updatedNode.type;
        if (updatedNode.code !== undefined) node.code = updatedNode.code;
        this.architecture = arch;
        this.readmeStale = true;
        this._rebuildGraph();
        this._persist();
      }
    },

    stopGeneration() {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
        this.loading = false;
        this.uploadLoading = false;
      }
    },

    // ── Reset ────────────────────────────────────────────────────
    reset() {
      this.stopGeneration();
      this.level = 2;
      this.mode = "AI Decompose";
      this.syntax = "Hide Syntax";
      this.aiEnabled = true;
      this.focusId = null;
      this.error = null;
      this.architecture = null;
      this.architectureEdges = [];
      this.nodes = [];
      this.edges = [];
      this.breadcrumbs = [];
      this.lastPrompt = "";
      this.readme = "";
      this.readmeStale = false;
      this.readmeVisible = false;
      this.fileStructure = [];
      this.fileStructureVisible = false;
      this.promptPanelVisible = true;
      this.sidebarWidth = 300;
      this.sidebarCollapsed = false;
      this._persist();
    },
  },
});

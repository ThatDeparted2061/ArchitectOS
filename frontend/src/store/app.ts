import { defineStore } from "pinia";
import { generateArchitecture } from "../services/api";
import { buildGraph, type ArchNode } from "../services/graph";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function findInTree(node: ArchNode, id: string): ArchNode | null {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return null;
}

function findParent(node: ArchNode, id: string): ArchNode | null {
  for (const child of node.children || []) {
    if (child.id === id) return node;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

export const useAppStore = defineStore("app", {
  state: () => ({
    level: 2,
    mode: "AI Decompose" as "AI Decompose" | "Manual Mode" | "Hybrid",
    syntax: "Hide Syntax" as "Hide Syntax" | "Show Pseudocode" | "Show Real Code",
    aiEnabled: true,
    architecture: null as ArchNode | null,
    nodes: [] as any[],
    edges: [] as any[],
    breadcrumbs: [] as ArchNode[],
    focusId: null as string | null,
    loading: false,
    error: null as string | null,
    lastPrompt: "",
  }),
  actions: {
    async generate(prompt: string) {
      if (!prompt.trim()) return;
      this.loading = true;
      this.error = null;
      this.lastPrompt = prompt;

      try {
        const data = await generateArchitecture(prompt, this.level, this.syntax);
        this.architecture = data;
        this.focusId = null;
        this._rebuildGraph();
      } catch (e: any) {
        this.error = e.message || "Failed to generate";
        console.error(e);
      } finally {
        this.loading = false;
      }
    },

    async regenerate() {
      if (this.lastPrompt) {
        await this.generate(this.lastPrompt);
      }
    },

    focusNode(id: string) {
      if (!this.architecture) return;
      this.focusId = id;
      this._rebuildGraph();
    },

    goBack() {
      if (!this.architecture) return;
      if (this.breadcrumbs.length > 1) {
        const parent = this.breadcrumbs[this.breadcrumbs.length - 2];
        this.focusNode(parent.id);
      } else {
        this.focusId = null;
        this._rebuildGraph();
      }
    },

    // ── Hybrid mode actions ──────────────────────────────────────
    editNode(id: string, title: string, description: string) {
      if (!this.architecture) return;
      const arch = deepClone(this.architecture);
      const node = findInTree(arch, id);
      if (node) {
        node.title = title;
        node.description = description;
        this.architecture = arch;
        this._rebuildGraph();
      }
    },

    deleteNode(id: string) {
      if (!this.architecture) return;
      // Can't delete root
      if (this.architecture.id === id) {
        this.error = "Cannot delete root node";
        return;
      }
      const arch = deepClone(this.architecture);
      const parent = findParent(arch, id);
      if (parent) {
        parent.children = (parent.children || []).filter((c) => c.id !== id);
        this.architecture = arch;
        // If we're focused on the deleted node, go back
        if (this.focusId === id) {
          this.focusId = parent.id;
        }
        this._rebuildGraph();
      }
    },

    addChildNode(parentId: string) {
      if (!this.architecture) return;
      const arch = deepClone(this.architecture);
      const parent = findInTree(arch, parentId);
      if (parent) {
        const newId = "new-" + Math.random().toString(36).slice(2, 8);
        const newNode: ArchNode = {
          id: newId,
          title: "New Node",
          description: "Click edit to describe this component",
          depth: parent.depth + 1,
          children: [],
          code: "",
        };
        if (!parent.children) parent.children = [];
        parent.children.push(newNode);
        this.architecture = arch;
        this._rebuildGraph();
      }
    },

    reset() {
      this.level = 2;
      this.mode = "AI Decompose";
      this.syntax = "Hide Syntax";
      this.aiEnabled = true;
      this.focusId = null;
      this.error = null;
      this.architecture = null;
      this.nodes = [];
      this.edges = [];
      this.breadcrumbs = [];
      this.lastPrompt = "";
    },

    // ── Internal ─────────────────────────────────────────────────
    _rebuildGraph() {
      if (!this.architecture) return;
      const { nodes, edges, focusPath } = buildGraph(this.architecture, this.focusId || undefined);
      this.nodes = nodes;
      this.edges = edges;
      this.breadcrumbs = focusPath;
    },
  },
});

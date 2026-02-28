import { defineStore } from "pinia";
import { generateArchitecture } from "../services/api";
import { buildGraph, type ArchNode } from "../services/graph";

export const useAppStore = defineStore("app", {
  state: () => ({
    level: 2,
    mode: "AI Decompose",
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
        const data = await generateArchitecture(prompt, this.level);
        this.architecture = data;
        this.focusId = null;
        const { nodes, edges, focusPath } = buildGraph(data);
        this.nodes = nodes;
        this.edges = edges;
        this.breadcrumbs = focusPath;
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
      const { nodes, edges, focusPath } = buildGraph(this.architecture, id);
      this.nodes = nodes;
      this.edges = edges;
      this.breadcrumbs = focusPath;
    },
    goBack() {
      if (!this.architecture) return;
      if (this.breadcrumbs.length > 1) {
        const parent = this.breadcrumbs[this.breadcrumbs.length - 2];
        this.focusNode(parent.id);
      } else {
        this.focusId = null;
        const { nodes, edges } = buildGraph(this.architecture);
        this.nodes = nodes;
        this.edges = edges;
        this.breadcrumbs = [];
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
  },
});

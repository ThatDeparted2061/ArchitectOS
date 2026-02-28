import { defineStore } from "pinia";
import { generateArchitecture } from "../services/api";
import { buildGraph, type ArchNode } from "../services/graph";

export const useAppStore = defineStore("app", {
  state: () => ({
    level: 1,
    mode: "AI Decompose",
    syntax: "Hide Syntax",
    aiEnabled: false,
    architecture: null as ArchNode | null,
    nodes: [] as any[],
    edges: [] as any[],
    breadcrumbs: [] as ArchNode[],
    focusId: null as string | null,
  }),
  actions: {
    async generate(prompt: string) {
      const data = await generateArchitecture(prompt, this.level);
      this.architecture = data;
      this.focusId = null;
      const { nodes, edges, focusPath } = buildGraph(data);
      this.nodes = nodes;
      this.edges = edges;
      this.breadcrumbs = focusPath;
    },
    focusNode(id: string) {
      if (!this.architecture) return;
      this.focusId = id;
      const { nodes, edges, focusPath } = buildGraph(this.architecture, id);
      this.nodes = nodes;
      this.edges = edges;
      this.breadcrumbs = focusPath;
    },
    reset() {
      this.level = 1;
      this.mode = "AI Decompose";
      this.syntax = "Hide Syntax";
      this.aiEnabled = false;
      this.focusId = null;
      if (this.architecture) {
        const { nodes, edges } = buildGraph(this.architecture);
        this.nodes = nodes;
        this.edges = edges;
      }
    },
  },
});

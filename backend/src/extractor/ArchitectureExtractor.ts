import { ApiHandler } from "../api/ApiHandler";
import { KnowledgeGraph } from "../graph/KnowledgeGraph";
import { GraphClusterer, ClusteringResult } from "../graph/GraphClusterer";
import { TreeValidator } from "./TreeValidator";
import { ArchitectureNode, ArchitectureEdge, ArchitectureGraphResult } from "../types/ArchitectureTypes";
import path from "path";

export interface ExtractorStats {
  parsedFiles: number;
  skippedFiles: number;
  errors: number;
}

/**
 * ArchitectureExtractor
 * 
 * Logic & Flow:
 * 1. Clusters source files by real AST imports and package boundaries.
 * 2. Prepares a multi-cluster structural context for the LLM to synthesize high-level domain summaries.
 * 3. Enforces domain boundaries: files are strictly organized into their corresponding subsystem cluster.
 * 4. Provides a robust fallback to deterministic AST clustering if LLM is offline or times out.
 */
export class ArchitectureExtractor {
  static async extractArchitecture(
    files: { path: string; content: string }[],
    graph: KnowledgeGraph,
    stats: ExtractorStats,
    api: ApiHandler
  ): Promise<ArchitectureNode> {
    console.log(`[ArchitectureExtractor] Running AST-driven analysis on ${files.length} files...`);

    // 1. Deterministic Graph Clustering & Metrics Computation
    const clusteringResult = GraphClusterer.cluster(files, graph);
    console.log(
      `[ArchitectureExtractor] Clustered into ${clusteringResult.clusters.length} subsystems. Found ${clusteringResult.godNodes.length} God Nodes and ${clusteringResult.entryPoints.length} Entry Points.`
    );

    // 2. Build Multi-Cluster Summary for LLM
    const clusterSummaries = clusteringResult.clusters.map((c, idx) => {
      const sampleFiles = c.files.slice(0, 8).map((f) => path.basename(f.path)).join(", ");
      const symbolsText = c.symbols.slice(0, 10).map((s) => `${s.type}:${s.name}`).join(", ");
      return `Cluster ${idx + 1}: "${c.name}" (${c.files.length} files)
  - ID: ${c.id}
  - Files: ${sampleFiles}${c.files.length > 8 ? ` (+${c.files.length - 8} more)` : ""}
  - Entry Points: ${c.entryPoints.map((ep) => path.basename(ep)).join(", ") || "None"}
  - Central Hubs / God Nodes: ${c.hubNodes.map((hn) => path.basename(hn)).join(", ") || "None"}
  - Key Classes/Functions: ${symbolsText || "None"}
  - External Deps: ${c.externalDependencies.join(", ") || "None"}`;
    }).join("\n\n");

    const edgeSummaries = clusteringResult.interClusterEdges.map((e) => {
      const from = clusteringResult.clusters.find((c) => c.id === e.fromCluster)?.name || e.fromCluster;
      const to = clusteringResult.clusters.find((c) => c.id === e.toCluster)?.name || e.toCluster;
      return `${from} -> ${to} (${Array.from(e.types).join(", ")}, weight: ${e.weight})`;
    }).join("\n");

    const systemPrompt = `You are ArchitectOS, an expert Principal Systems Architect.
Analyze the deterministic codebase clusters, topological flows, and dependency metrics to synthesize a comprehensive, clean system architecture JSON.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown, no preambles.
- Schema:
{
  "id": "root-id",
  "title": "System / Project Name",
  "description": "High-level architectural overview and primary domain purpose",
  "depth": 1,
  "type": "project",
  "children": [
    {
      "id": "subsystem-id",
      "title": "Subsystem Title (e.g. Auth & Identity Domain, API Gateway, Data Pipeline)",
      "description": "2-3 sentence explanation of subsystem responsibilities and data flow",
      "depth": 2,
      "type": "domain" | "subsystem" | "api_gateway" | "database" | "service_layer",
      "children": [
        {
          "id": "component-id",
          "title": "Component/File Title",
          "description": "Purpose and technical role",
          "depth": 3,
          "type": "controller" | "service_layer" | "repository" | "file" | "module",
          "path": "path/to/file.ts",
          "code": "key code snippet (max 10 lines)",
          "children": []
        }
      ]
    }
  ]
}
- Group components logically matching the detected clusters.
- Every detected cluster should correspond to a high-level subsystem/domain.
- Descriptions should highlight how components communicate.`;

    const userPrompt = `Detected Subsystem Clusters:
${clusterSummaries}

Inter-Subsystem Communication Flows:
${edgeSummaries || "(Single-module system)"}

Total Files: ${files.length} | AST Nodes: ${graph.getNodes().length}

Synthesize the multi-level architecture tree JSON matching the detected clusters:`;

    let generatedTree: any = null;

    try {
      console.log("[ArchitectureExtractor] Querying LLM for semantic domain synthesis...");
      const content = await api.createMessage(systemPrompt, userPrompt, {
        maxTokens: 6000,
        jsonMode: true,
        temperature: 0.2,
      });

      const parsed = this.extractJsonFromResponse(content);
      if (parsed && (parsed.id || parsed.title)) {
        generatedTree = parsed;
      }
    } catch (err: any) {
      console.warn(`[ArchitectureExtractor] LLM synthesis failed or timed out: ${err.message}. Using deterministic fallback.`);
    }

    // If LLM failed, build deterministic tree from clusters directly
    if (!generatedTree) {
      generatedTree = this.buildDeterministicClusterTree(files, clusteringResult);
    }

    // 3. Ensure all files are deterministically attached to their proper parent clusters
    this.attachMissingClusterFiles(generatedTree, clusteringResult, files);

    // 4. Validate, normalize, and enforce depth
    const sanitized = TreeValidator.validateAndRepair(generatedTree, 3);
    return sanitized;
  }

  private static buildDeterministicClusterTree(
    files: { path: string; content?: string }[],
    clustering: ClusteringResult
  ): any {
    return {
      id: "root-project",
      title: "System Architecture",
      description: `Modular architecture comprising ${clustering.clusters.length} subsystems (${files.length} source components).`,
      depth: 1,
      type: "project",
      children: clustering.clusters.map((c) => ({
        id: c.id,
        title: c.name,
        description: c.description,
        depth: 2,
        type: c.type || "subsystem",
        children: c.files.map((f) => ({
          id: "file-" + path.basename(f.path).replace(/[^a-z0-9-_]/gi, "-").toLowerCase(),
          title: path.basename(f.path),
          description: `Component located at ${f.path}`,
          depth: 3,
          type: "file",
          path: f.path,
          code: f.content ? f.content.slice(0, 500) : "",
          children: [],
        })),
      })),
    };
  }

  private static attachMissingClusterFiles(
    root: any,
    clustering: ClusteringResult,
    allFiles: { path: string; content?: string }[]
  ): void {
    const existingPaths = new Set<string>();
    const traverse = (node: any) => {
      if (node.path) existingPaths.add(node.path.replace(/\\/g, "/"));
      if (Array.isArray(node.children)) node.children.forEach(traverse);
    };
    traverse(root);

    // For each cluster, ensure its files belong to their designated subsystem container
    for (const cluster of clustering.clusters) {
      let clusterSubsystem = (root.children || []).find(
        (c: any) => c.id === cluster.id || c.title.toLowerCase().includes(cluster.name.toLowerCase()) || cluster.name.toLowerCase().includes(c.title.toLowerCase())
      );

      // If cluster is missing from root, create it instead of dumping into root.children[0]
      if (!clusterSubsystem) {
        clusterSubsystem = {
          id: cluster.id,
          title: cluster.name,
          description: cluster.description,
          depth: 2,
          type: cluster.type || "subsystem",
          children: [],
        };
        if (!Array.isArray(root.children)) root.children = [];
        root.children.push(clusterSubsystem);
      }

      if (!Array.isArray(clusterSubsystem.children)) clusterSubsystem.children = [];

      for (const file of cluster.files) {
        const normPath = file.path.replace(/\\/g, "/");
        if (!existingPaths.has(normPath)) {
          clusterSubsystem.children.push({
            id: "file-" + path.basename(file.path).replace(/[^a-z0-9-_]/gi, "-").toLowerCase(),
            title: path.basename(file.path),
            description: `Source file at ${file.path}`,
            depth: (clusterSubsystem.depth || 2) + 1,
            type: "file",
            path: file.path,
            code: file.content ? file.content.slice(0, 500) : "",
            children: [],
          });
          existingPaths.add(normPath);
        }
      }
    }
  }

  private static extractJsonFromResponse(raw: string): any {
    let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0;
      let end = -1;
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end >= 0) cleaned = cleaned.slice(firstBrace, end + 1);
    }
    return JSON.parse(cleaned);
  }
}

import { KnowledgeGraph, GraphNode, GraphEdge } from "./KnowledgeGraph";
import path from "path";

export interface NodeMetrics {
  fanIn: number;
  fanOut: number;
  isHub: boolean;
  isEntryPoint: boolean;
}

export interface FileCluster {
  id: string;
  name: string;
  description: string;
  type?: string;
  files: { path: string; content?: string }[];
  symbols: GraphNode[];
  entryPoints: string[];
  hubNodes: string[];
  externalDependencies: string[];
}

export interface InterClusterEdge {
  fromCluster: string;
  toCluster: string;
  weight: number;
  types: Set<string>;
}

export interface ClusteringResult {
  clusters: FileCluster[];
  interClusterEdges: InterClusterEdge[];
  metrics: Map<string, NodeMetrics>;
  godNodes: string[];
  entryPoints: string[];
}

/**
 * Graph-Theoretic Codebase Clustering & Domain Synthesis Engine
 * 
 * Concepts & Algorithm:
 * 1. Topological Metrics: Calculates in-degree (fan-in), out-degree (fan-out), Central Hubs (God Nodes),
 *    and entrypoints from the real AST Knowledge Graph.
 * 2. Package-Aware Initial Bucket Slicing: Groups files by package boundaries (e.g. `pipeline/core`,
 *    `pipeline/underwriting`, `src/controllers`, `tests/`) rather than flattening by arbitrary root folders.
 * 3. Coupling Affinity Matrix: Evaluates real AST import and call edges across buckets to compute
 *    inter-module coupling strength.
 * 4. Micro-Bucket Merging: Merges isolated single-file buckets into their highest-affinity neighbor.
 * 5. Deterministic Subsystem Tree Synthesis: Converts clusters directly into clean architecture nodes.
 */
export class GraphClusterer {
  /**
   * Compute Fan-In, Fan-Out, God Nodes, and Entry Points from KnowledgeGraph
   */
  static computeMetrics(graph: KnowledgeGraph): {
    metrics: Map<string, NodeMetrics>;
    godNodes: string[];
    entryPoints: string[];
  } {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();
    const metrics = new Map<string, NodeMetrics>();

    // Initialize metrics
    for (const node of nodes) {
      metrics.set(node.id, {
        fanIn: 0,
        fanOut: 0,
        isHub: false,
        isEntryPoint: false,
      });
    }

    // Count in-degrees and out-degrees
    for (const edge of edges) {
      const fromMetric = metrics.get(edge.from);
      if (fromMetric) fromMetric.fanOut++;

      const toMetric = metrics.get(edge.to);
      if (toMetric) toMetric.fanIn++;
    }

    const godNodes: string[] = [];
    const entryPoints: string[] = [];

    // Identify entry point filenames & patterns
    const entryPointRegex = /(index|main|app|server|cli|router|routes|entry|verify)\.[a-z0-9]+$/i;

    for (const [id, m] of metrics.entries()) {
      const node = graph.getNode(id);
      const isFile = node?.type === "file";

      // God node criteria: High in-degree (imported or called by many components)
      if (m.fanIn >= 4 || (m.fanIn >= 2 && m.fanOut >= 4)) {
        m.isHub = true;
        godNodes.push(id);
      }

      // Entry point criteria: file matching entry pattern or 0 fan-in with positive fan-out
      if (isFile) {
        const matchesName = entryPointRegex.test(id);
        if (matchesName || (m.fanIn === 0 && m.fanOut > 0)) {
          m.isEntryPoint = true;
          entryPoints.push(id);
        }
      }
    }

    return { metrics, godNodes, entryPoints };
  }

  /**
   * Deterministically cluster codebase files into cohesive architectural subsystems
   */
  static cluster(
    files: { path: string; content?: string }[],
    graph: KnowledgeGraph
  ): ClusteringResult {
    const { metrics, godNodes, entryPoints } = this.computeMetrics(graph);
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    // Map normalized path to file
    const fileMap = new Map<string, { path: string; content?: string }>();
    for (const f of files) {
      fileMap.set(this.normalizePath(f.path), f);
    }

    // 1. Initial Package & Directory Slicing
    const directoryBuckets = new Map<string, { path: string; content?: string }[]>();

    for (const f of files) {
      const norm = this.normalizePath(f.path);
      const parts = norm.split("/");

      let bucketKey = "root";
      if (parts.length > 1) {
        // Group by functional sub-packages e.g. `pipeline/core`, `pipeline/scrub`, `src/services`, `tests`
        const top = parts[0].toLowerCase();
        const packagePrefixes = new Set(["pipeline", "src", "packages", "apps", "lib", "modules", "core"]);

        if (packagePrefixes.has(top) && parts.length > 2) {
          bucketKey = `${parts[0]}/${parts[1]}`;
        } else {
          bucketKey = parts[0];
        }
      }

      if (!directoryBuckets.has(bucketKey)) {
        directoryBuckets.set(bucketKey, []);
      }
      directoryBuckets.get(bucketKey)!.push(f);
    }

    // 2. Build Dependency Adjacency Matrix between buckets based on real AST edges
    const bucketAffinity = new Map<string, Map<string, number>>();
    const getAffinity = (b1: string, b2: string) => {
      return bucketAffinity.get(b1)?.get(b2) || 0;
    };
    const addAffinity = (b1: string, b2: string, weight: number) => {
      if (!bucketAffinity.has(b1)) bucketAffinity.set(b1, new Map());
      const current = bucketAffinity.get(b1)!.get(b2) || 0;
      bucketAffinity.get(b1)!.set(b2, current + weight);
    };

    // Find bucket for a given file path or module import
    const getBucketForPath = (filePath: string): string => {
      const cleanPath = this.normalizePath(filePath).replace(/\.[a-z0-9]+$/i, "");
      for (const [bKey, bFiles] of directoryBuckets.entries()) {
        if (bFiles.some((f) => this.normalizePath(f.path).replace(/\.[a-z0-9]+$/i, "") === cleanPath)) {
          return bKey;
        }
      }
      // Fallback matching
      const parts = cleanPath.split("/");
      const top = parts[0].toLowerCase();
      if ((top === "src" || top === "pipeline" || top === "packages") && parts.length > 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return parts.length > 1 ? parts[0] : "root";
    };

    for (const edge of edges) {
      const bFrom = getBucketForPath(edge.from);
      const bTo = getBucketForPath(edge.to);
      if (bFrom && bTo && bFrom !== bTo) {
        addAffinity(bFrom, bTo, 1);
        addAffinity(bTo, bFrom, 1);
      }
    }

    // 3. Merge tiny isolated single-file buckets into their closest neighbor if clusters > 9
    const mergedBuckets = new Map<string, { path: string; content?: string }[]>();
    for (const [bKey, bFiles] of directoryBuckets.entries()) {
      mergedBuckets.set(bKey, [...bFiles]);
    }

    while (mergedBuckets.size > 9) {
      let smallestKey: string | null = null;
      let minCount = Infinity;

      for (const [k, v] of mergedBuckets.entries()) {
        if (v.length < minCount) {
          minCount = v.length;
          smallestKey = k;
        }
      }

      if (!smallestKey || minCount >= 2) break;

      // Find neighbor with highest affinity
      let bestNeighbor: string | null = null;
      let maxAff = -1;

      for (const otherKey of mergedBuckets.keys()) {
        if (otherKey === smallestKey) continue;
        const aff = getAffinity(smallestKey, otherKey);
        if (aff > maxAff) {
          maxAff = aff;
          bestNeighbor = otherKey;
        }
      }

      if (bestNeighbor) {
        const items = mergedBuckets.get(smallestKey)!;
        mergedBuckets.get(bestNeighbor)!.push(...items);
        mergedBuckets.delete(smallestKey);
      } else {
        break;
      }
    }

    // 4. Construct FileCluster objects
    const clusters: FileCluster[] = [];
    for (const [bKey, bFiles] of mergedBuckets.entries()) {
      const clusterId = "cluster-" + bKey.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
      const clusterName = this.formatClusterName(bKey);
      
      const clusterFilePaths = new Set(bFiles.map((f) => this.normalizePath(f.path)));
      const clusterSymbols = nodes.filter((n) => {
        const fp = n.properties?.filePath ? this.normalizePath(n.properties.filePath) : null;
        return fp ? clusterFilePaths.has(fp) : clusterFilePaths.has(this.normalizePath(n.id));
      });

      const clusterEntryPoints = entryPoints.filter((ep) => clusterFilePaths.has(this.normalizePath(ep)));
      const clusterHubNodes = godNodes.filter((gn) => {
        const node = graph.getNode(gn);
        const fp = node?.properties?.filePath ? this.normalizePath(node.properties.filePath) : this.normalizePath(gn);
        return clusterFilePaths.has(fp);
      });

      // External imports / packages used in this cluster
      const externalDependencies = new Set<string>();
      for (const edge of edges) {
        if (edge.type === "imports" && clusterFilePaths.has(this.normalizePath(edge.from))) {
          if (!fileMap.has(this.normalizePath(edge.to))) {
            externalDependencies.add(edge.to);
          }
        }
      }

      clusters.push({
        id: clusterId,
        name: clusterName,
        description: this.generateClusterDescription(bKey, bFiles.length),
        type: this.inferClusterType(bKey),
        files: bFiles,
        symbols: clusterSymbols,
        entryPoints: clusterEntryPoints,
        hubNodes: clusterHubNodes,
        externalDependencies: Array.from(externalDependencies).slice(0, 10),
      });
    }

    // 5. Compute Inter-Cluster Edges from real AST connections
    const fileToClusterId = new Map<string, string>();
    for (const c of clusters) {
      for (const f of c.files) {
        fileToClusterId.set(this.normalizePath(f.path), c.id);
        // Also map without extension for module import matching
        fileToClusterId.set(this.normalizePath(f.path).replace(/\.[a-z0-9]+$/i, ""), c.id);
      }
    }

    const clusterEdgeMap = new Map<string, InterClusterEdge>();

    for (const edge of edges) {
      const cFrom = fileToClusterId.get(this.normalizePath(edge.from)) || fileToClusterId.get(this.normalizePath(edge.from).replace(/\.[a-z0-9]+$/i, ""));
      const cTo = fileToClusterId.get(this.normalizePath(edge.to)) || fileToClusterId.get(this.normalizePath(edge.to).replace(/\.[a-z0-9]+$/i, ""));

      if (cFrom && cTo && cFrom !== cTo) {
        const key = `${cFrom}->${cTo}`;
        if (!clusterEdgeMap.has(key)) {
          clusterEdgeMap.set(key, {
            fromCluster: cFrom,
            toCluster: cTo,
            weight: 0,
            types: new Set(),
          });
        }
        const record = clusterEdgeMap.get(key)!;
        record.weight += 1;
        record.types.add(edge.type);
      }
    }

    return {
      clusters,
      interClusterEdges: Array.from(clusterEdgeMap.values()),
      metrics,
      godNodes,
      entryPoints,
    };
  }

  /**
   * Deterministically construct an ArchitectureNode tree directly from AST clustering
   */
  static buildDeterministicArchitectureTree(
    files: { path: string; content?: string }[],
    graph: KnowledgeGraph,
    clustering: ClusteringResult
  ): any {
    const root: any = {
      id: "root-system",
      title: "System Architecture",
      description: `Modular architecture comprising ${clustering.clusters.length} functional subsystems (${files.length} source components).`,
      depth: 1,
      type: "system",
      children: [],
    };

    clustering.clusters.forEach((cluster) => {
      const subsystemNode: any = {
        id: cluster.id,
        title: cluster.name,
        description: cluster.description,
        depth: 2,
        type: cluster.type || "subsystem",
        children: [],
      };

      cluster.files.forEach((file) => {
        const norm = this.normalizePath(file.path);
        const fileName = path.basename(norm);
        const fileSymbols = cluster.symbols.filter((s) => {
          const fp = s.properties?.filePath ? this.normalizePath(s.properties.filePath) : null;
          return fp === norm;
        });

        const classes = fileSymbols.filter((s) => s.type === "class").map((s) => s.name);
        const functions = fileSymbols.filter((s) => s.type === "function").map((s) => s.name);

        let desc = norm;
        if (classes.length > 0) {
          desc = `Defines classes: ${classes.slice(0, 3).join(", ")}`;
        } else if (functions.length > 0) {
          desc = `Defines functions: ${functions.slice(0, 3).join(", ")}`;
        }

        subsystemNode.children.push({
          id: norm.replace(/[^a-z0-9-_]/gi, "-").toLowerCase(),
          title: fileName,
          description: desc,
          depth: 3,
          type: this.inferFileType(fileName, norm),
          path: norm,
          code: (file.content || "").slice(0, 1500),
          children: [],
        });
      });

      root.children.push(subsystemNode);
    });

    return root;
  }

  /**
   * Helper to format raw directory keys into human-friendly domain titles
   */
  private static formatClusterName(rawKey: string): string {
    if (rawKey === "root") return "Ingress & Orchestration";
    const parts = rawKey.split("/");
    const mapped = parts.map((p) => {
      const lower = p.toLowerCase();
      if (lower === "core") return "Core Calculations";
      if (lower === "underwriting") return "Underwriting Waterfall";
      if (lower === "scrub") return "Scrubbing & AutoCAMS";
      if (lower === "config") return "Configuration & Policy";
      if (lower === "exports") return "Reporting & Exporters";
      if (lower === "tests") return "Testing & Verification";
      if (lower === "legacy") return "Legacy Baseline";
      if (lower === "scripts") return "Automation Scripts";
      if (lower === "adapters") return "Data Adapters";
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    });

    return mapped.join(" ");
  }

  private static generateClusterDescription(rawKey: string, fileCount: number): string {
    const k = rawKey.toLowerCase();
    if (k.includes("core")) return `Pure mathematical engines and exposure scorecard logic (${fileCount} files).`;
    if (k.includes("underwriting")) return `Multi-step underwriting exception waterfall and audit trail logging (${fileCount} files).`;
    if (k.includes("scrub")) return `Bureau scrub deduplication and AutoCAMS reconciliation (${fileCount} files).`;
    if (k.includes("config")) return `Centralized policy rules, institution mappings, and schema contracts (${fileCount} files).`;
    if (k.includes("exports")) return `Multi-tab formatted Excel workbook generation and export pipelines (${fileCount} files).`;
    if (k.includes("tests")) return `Automated regression suite verifying numerical parity (${fileCount} files).`;
    if (k.includes("legacy")) return `Legacy monolithic baseline implementation for parity comparison (${fileCount} files).`;
    return `Functional domain containing ${fileCount} source modules.`;
  }

  private static inferClusterType(rawKey: string): string {
    const k = rawKey.toLowerCase();
    if (k.includes("core") || k.includes("underwriting")) return "domain";
    if (k.includes("scrub") || k.includes("config")) return "service_layer";
    if (k.includes("exports")) return "controller";
    if (k.includes("root") || k.includes("api")) return "api_gateway";
    return "subsystem";
  }

  private static inferFileType(fileName: string, filePath: string): string {
    const f = fileName.toLowerCase();
    const p = filePath.toLowerCase();
    if (f.includes("config") || f.includes("schema") || f.includes("mapping")) return "service_layer";
    if (f.includes("engine") || f.includes("waterfall") || f.includes("scorecard")) return "domain";
    if (f.includes("excel") || f.includes("builder") || f.includes("export")) return "controller";
    if (p.includes("test")) return "controller";
    return "service_layer";
  }

  private static normalizePath(p: string): string {
    return p.replace(/\\/g, "/").replace(/^\.\//, "");
  }
}

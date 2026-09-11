import fs from "fs";
import path from "path";
import { KnowledgeGraph } from "../src/graph/KnowledgeGraph";
import { RepositoryParser } from "../src/parser/RepositoryParser";
import { GraphClusterer } from "../src/graph/GraphClusterer";

async function runTest() {
  const dinchariyaPath = "C:\\Users\\colos\\Downloads\\dinchariya-main\\dinchariya-main";
  console.log("Reading files from:", dinchariyaPath);

  if (!fs.existsSync(dinchariyaPath)) {
    console.error("Directory not found:", dinchariyaPath);
    return;
  }

  // Collect all files recursively
  const files: { path: string; content: string }[] = [];
  function collectFiles(dir: string, baseDir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== ".git" && entry.name !== "__pycache__" && entry.name !== ".agents") {
          collectFiles(fullPath, baseDir);
        }
      } else if (entry.isFile()) {
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
        // Prefix with dinchariya-main as folder picker or zip does
        const fullRelPath = `dinchariya-main/${relPath}`;
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          files.push({ path: fullRelPath, content });
        } catch {}
      }
    }
  }

  collectFiles(dinchariyaPath, dinchariyaPath);
  console.log(`Found ${files.length} total files in dinchariya-main.`);

  // 1. Parse repository into KnowledgeGraph
  const graph = new KnowledgeGraph();
  const stats = RepositoryParser.parseRepository(files, graph);

  console.log("\n─── 1. PARSER STATS ───");
  console.log(`Parsed Files: ${stats.parsedFiles}`);
  console.log(`Skipped Files: ${stats.skippedFiles}`);
  console.log(`Parse Errors: ${stats.errors}`);
  console.log(`KnowledgeGraph Nodes: ${graph.getNodes().length}`);
  console.log(`KnowledgeGraph Edges: ${graph.getEdges().length}`);

  // 2. Run GraphClusterer on normalized files
  const clustering = GraphClusterer.cluster(stats.normalizedFiles, graph);

  console.log("\n─── 2. DETECTED CLUSTERS ───");
  clustering.clusters.forEach((c, idx) => {
    console.log(`\nCluster ${idx + 1}: [${c.name}] (${c.files.length} files) - Type: ${c.type}`);
    console.log(`  Description: ${c.description}`);
    console.log(`  Files: ${c.files.map((f) => path.basename(f.path)).join(", ")}`);
    console.log(`  Symbols: ${c.symbols.map((s) => `${s.type}:${s.name}`).slice(0, 8).join(", ")}`);
  });

  console.log("\n─── 3. INTER-CLUSTER EDGES (DATA FLOW) ───");
  clustering.interClusterEdges.forEach((e) => {
    const fromName = clustering.clusters.find((c) => c.id === e.fromCluster)?.name || e.fromCluster;
    const toName = clustering.clusters.find((c) => c.id === e.toCluster)?.name || e.toCluster;
    console.log(`  ${fromName} ──[${Array.from(e.types).join(", ")} (weight: ${e.weight})]──> ${toName}`);
  });

  // 3. Build Deterministic Architecture Tree
  const tree = GraphClusterer.buildDeterministicArchitectureTree(stats.normalizedFiles, graph, clustering);

  console.log("\n─── 4. SYNTHESIZED ARCHITECTURE TREE ───");
  console.log(`Root: ${tree.title} (${tree.children.length} subsystems)`);
  tree.children.forEach((sub: any) => {
    console.log(`  ├── Subsystem: "${sub.title}" (${sub.children.length} components)`);
  });
}

runTest().catch(console.error);

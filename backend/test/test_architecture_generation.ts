import { KnowledgeGraph } from "../src/graph/KnowledgeGraph";
import { GraphClusterer } from "../src/graph/GraphClusterer";
import { TreeValidator } from "../src/extractor/TreeValidator";
import { ArchitectureExtractor } from "../src/extractor/ArchitectureExtractor";
import { ApiHandler } from "../src/api/ApiHandler";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log("\n========================================================");
  console.log("🧪 ArchitectOS Architecture Generation & Clustering Tests");
  console.log("========================================================\n");

  // -------------------------------------------------------------------------
  // TEST 1: KnowledgeGraph & Graph Metrics Computation (Fan-in, Fan-out, Hubs)
  // -------------------------------------------------------------------------
  console.log("Test 1: Graph Metrics & God Node / Entry Point Detection");
  const graph = new KnowledgeGraph();

  // Nodes
  graph.addNode("src/server.ts", "server.ts", "file");
  graph.addNode("src/auth/authController.ts", "authController.ts", "file");
  graph.addNode("src/auth/authService.ts", "authService.ts", "file");
  graph.addNode("src/users/userService.ts", "userService.ts", "file");
  graph.addNode("src/billing/billingService.ts", "billingService.ts", "file");
  graph.addNode("src/notifications/notifyService.ts", "notifyService.ts", "file");
  graph.addNode("src/common/db.ts", "db.ts", "file");

  // Entry Point Edges: server -> authController, userService, billingService, notifyService
  graph.addEdge("src/server.ts", "src/auth/authController.ts", "imports");
  graph.addEdge("src/server.ts", "src/users/userService.ts", "imports");
  graph.addEdge("src/server.ts", "src/billing/billingService.ts", "imports");
  graph.addEdge("src/server.ts", "src/notifications/notifyService.ts", "imports");

  // Subsystem Edges: authController -> authService -> db
  graph.addEdge("src/auth/authController.ts", "src/auth/authService.ts", "imports");
  graph.addEdge("src/auth/authService.ts", "src/common/db.ts", "imports");

  // Multi-module Edges pointing to db (High Fan-in -> God Node)
  graph.addEdge("src/users/userService.ts", "src/common/db.ts", "imports");
  graph.addEdge("src/billing/billingService.ts", "src/common/db.ts", "imports");
  graph.addEdge("src/notifications/notifyService.ts", "src/common/db.ts", "imports");

  const metricsResult = GraphClusterer.computeMetrics(graph);
  const serverMetrics = metricsResult.metrics.get("src/server.ts");
  const dbMetrics = metricsResult.metrics.get("src/common/db.ts");

  assert(serverMetrics !== undefined && serverMetrics.fanOut === 4, "server.ts correctly has fanOut = 4");
  assert(serverMetrics !== undefined && serverMetrics.fanIn === 0, "server.ts has fanIn = 0");
  assert(dbMetrics !== undefined && dbMetrics.fanIn === 4, "db.ts correctly has fanIn = 4");
  assert(metricsResult.entryPoints.includes("src/server.ts"), "server.ts detected in entryPoints list");
  assert(metricsResult.godNodes.includes("src/common/db.ts"), "db.ts detected as central hub / god node");

  // -------------------------------------------------------------------------
  // TEST 2: Deterministic Codebase Clustering
  // -------------------------------------------------------------------------
  console.log("\nTest 2: Deterministic Codebase Clustering & Community Detection");
  const mockFiles = [
    { path: "src/server.ts", content: "import './auth/authController'; import './users/userService';" },
    { path: "src/auth/authController.ts", content: "import './authService';" },
    { path: "src/auth/authService.ts", content: "import '../common/db';" },
    { path: "src/users/userService.ts", content: "import '../common/db';" },
    { path: "src/billing/billingService.ts", content: "import '../common/db';" },
    { path: "src/notifications/notifyService.ts", content: "import '../common/db';" },
    { path: "src/common/db.ts", content: "export const db = {};" },
  ];

  const clusterResult = GraphClusterer.cluster(mockFiles, graph);
  assert(clusterResult.clusters.length >= 2, `Codebase clustered into ${clusterResult.clusters.length} functional clusters`);
  
  const authCluster = clusterResult.clusters.find((c) => c.files.some((f) => f.path.includes("auth")));
  assert(authCluster !== undefined, "Auth cluster identified with auth controller & service");
  assert(clusterResult.interClusterEdges.length > 0, "Inter-cluster edges identified and weighted");

  // -------------------------------------------------------------------------
  // TEST 3: TreeValidator & Depth Enforcement
  // -------------------------------------------------------------------------
  console.log("\nTest 3: TreeValidator Depth Enforcement & Auto-Repair");
  const shallowTree = {
    id: "root",
    title: "E-Commerce System",
    description: "Online marketplace platform",
    depth: 1,
    children: [
      {
        id: "order-service",
        title: "Order Service",
        description: "Manages orders",
        depth: 2,
        children: [] // Shallow! No children at level 2 when level 3 requested
      }
    ]
  };

  const validatedTree = TreeValidator.validateAndRepair(shallowTree, 3);
  
  // Assert root
  assert(validatedTree.depth === 1, "Root depth is 1");
  assert(validatedTree.children.length >= 1, "Root has valid children");
  
  // Assert Level 2 node
  const orderNode = validatedTree.children[0];
  assert(orderNode.depth === 2, "Order Service node is at depth 2");
  assert(orderNode.children.length >= 2, "Shallow Level 2 node was expanded to have at least 2 children (branching factor)");
  
  // Assert Level 3 synthesized children
  const level3Node = orderNode.children[0];
  assert(level3Node.depth === 3, "Synthesized child reaches target depth 3");
  assert(level3Node.id.startsWith("order-service-"), "Synthesized node has unique kebab-case ID derived from parent");
  assert(typeof level3Node.type === "string", `Node type properly inferred (${level3Node.type})`);

  // -------------------------------------------------------------------------
  // TEST 4: Full Multi-Pass ArchitectureExtractor with Mock LLM
  // -------------------------------------------------------------------------
  console.log("\nTest 4: Full ArchitectureExtractor Multi-Pass Synthesis");
  const mockApi: ApiHandler = {
    createMessage: async () => JSON.stringify({
      id: "root-system",
      title: "Synthesized System",
      description: "A cleanly decomposed system architecture",
      depth: 1,
      type: "project",
      children: [
        {
          id: "auth-subsystem",
          title: "Authentication Subsystem",
          description: "Handles JWT tokens and sessions",
          depth: 2,
          type: "subsystem",
          children: [
            {
              id: "auth-controller",
              title: "Auth Controller",
              description: "REST endpoints for login/register",
              depth: 3,
              type: "controller",
              children: []
            },
            {
              id: "auth-service",
              title: "Auth Service",
              description: "Business logic and token generation",
              depth: 3,
              type: "service_layer",
              children: []
            }
          ]
        },
        {
          id: "data-layer",
          title: "Database Subsystem",
          description: "Central data persistence layer",
          depth: 2,
          type: "database",
          children: [
            {
              id: "db-pool",
              title: "Connection Pool",
              description: "Database connection manager",
              depth: 3,
              type: "repository",
              children: []
            },
            {
              id: "db-migrations",
              title: "Migration Runner",
              description: "Executes schema migrations",
              depth: 3,
              type: "file",
              children: []
            }
          ]
        }
      ]
    })
  };

  const stats = { parsedFiles: mockFiles.length, skippedFiles: 0, errors: 0 };
  const extractedTree = await ArchitectureExtractor.extractArchitecture(mockFiles, graph, stats, mockApi);

  assert(extractedTree.id === "root-system", "ArchitectureExtractor assembled root tree");
  assert(extractedTree.children.length === 2, "ArchitectureExtractor extracted 2 primary subsystems");
  assert(extractedTree.children[0].title === "Authentication Subsystem", "First subsystem matches enriched title");
  assert(extractedTree.children[1].children.length === 2, "Database subsystem has 2 children at Level 3");

  console.log("\n========================================================");
  console.log("🎉 ALL 15 ASSERTIONS PASSED SUCCESSFULLY!");
  console.log("========================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

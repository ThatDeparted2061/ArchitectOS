import dotenv from "dotenv";
dotenv.config();

import { buildApiHandler } from "../src/api/ApiHandler";
import { ArchitectureExtractor } from "../src/extractor/ArchitectureExtractor";
import { KnowledgeGraph } from "../src/graph/KnowledgeGraph";

async function runBenchmark() {
  console.log("\n========================================================");
  console.log("⏱️  ArchitectOS API Performance & Latency Benchmark");
  console.log("========================================================");

  console.log(`Provider:     ${process.env.AI_PROVIDER || "ollama"}`);
  console.log(`NVIDIA Model: ${process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct"}`);
  console.log(`Base URL:     ${process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"}\n`);

  const api = buildApiHandler();

  // -------------------------------------------------------------------------
  // Benchmark 1: Raw LLM Round-Trip Latency (Minimal Payload)
  // -------------------------------------------------------------------------
  console.log("▶ Running Benchmark 1: Raw LLM Round-Trip Latency...");
  const t0 = performance.now();
  try {
    const rawRes = await api.createMessage(
      "You are a benchmark tester.",
      "Reply with the single word 'READY' and nothing else.",
      { maxTokens: 10, temperature: 0.1 }
    );
    const t1 = performance.now();
    const rawTime = (t1 - t0).toFixed(0);
    console.log(`  ✓ Raw Latency (TTFB + Response): ${rawTime} ms (Response: "${rawRes.trim()}")\n`);
  } catch (err: any) {
    console.error(`  ❌ Benchmark 1 failed: ${err.message}\n`);
  }

  // -------------------------------------------------------------------------
  // Benchmark 2: Prompt-to-Architecture (Level 1 — Overview)
  // -------------------------------------------------------------------------
  console.log("▶ Running Benchmark 2: Level 1 Architecture Generation ('Hide Syntax')...");
  const l1SystemPrompt = `You are ArchitectOS. Decompose this system into JSON:
Schema: { "id": "string", "title": "string", "description": "string", "depth": 1, "children": [{ "id": "string", "title": "string", "description": "string", "depth": 2, "children": [] }] }`;
  
  const l1Start = performance.now();
  try {
    const l1Res = await api.createMessage(
      l1SystemPrompt,
      "Design an Uber/Ride-sharing system architecture.",
      { maxTokens: 1000, jsonMode: true, temperature: 0.3 }
    );
    const l1End = performance.now();
    const l1Time = ((l1End - l1Start) / 1000).toFixed(2);
    const l1Chars = l1Res.length;
    console.log(`  ✓ Level 1 Generation: ${l1Time}s (${l1Chars} chars generated)\n`);
  } catch (err: any) {
    console.error(`  ❌ Benchmark 2 failed: ${err.message}\n`);
  }

  // -------------------------------------------------------------------------
  // Benchmark 3: Prompt-to-Architecture (Level 2 — Subsystems)
  // -------------------------------------------------------------------------
  console.log("▶ Running Benchmark 3: Level 2 Architecture Generation ('Hide Syntax')...");
  const l2SystemPrompt = `You are ArchitectOS. Decompose this system into JSON with depth 2 (Root -> Subsystems -> Leaf components):
Schema: { "id": "string", "title": "string", "description": "string", "depth": 1, "children": [{ "id": "string", "title": "string", "description": "string", "depth": 2, "children": [{ "id": "string", "title": "string", "description": "string", "depth": 3, "children": [] }] }] }`;

  const l2Start = performance.now();
  try {
    const l2Res = await api.createMessage(
      l2SystemPrompt,
      "Design a scalable E-Commerce platform with Payment, Catalog, Auth, and Order services.",
      { maxTokens: 2500, jsonMode: true, temperature: 0.3 }
    );
    const l2End = performance.now();
    const l2Time = ((l2End - l2Start) / 1000).toFixed(2);
    const l2Chars = l2Res.length;
    console.log(`  ✓ Level 2 Generation: ${l2Time}s (${l2Chars} chars generated)\n`);
  } catch (err: any) {
    console.error(`  ❌ Benchmark 3 failed: ${err.message}\n`);
  }

  // -------------------------------------------------------------------------
  // Benchmark 4: Codebase-to-Architecture Reverse Engineering
  // -------------------------------------------------------------------------
  console.log("▶ Running Benchmark 4: Codebase Ingestion (AST Clustering + LLM Synthesis)...");
  const graph = new KnowledgeGraph();
  graph.addNode("server.ts", "server.ts", "file");
  graph.addNode("auth/auth.ts", "auth.ts", "file");
  graph.addNode("routes/api.ts", "api.ts", "file");
  graph.addNode("db/pool.ts", "pool.ts", "file");
  graph.addEdge("server.ts", "routes/api.ts", "imports");
  graph.addEdge("routes/api.ts", "auth/auth.ts", "imports");
  graph.addEdge("auth/auth.ts", "db/pool.ts", "imports");

  const mockFiles = [
    { path: "server.ts", content: "import { router } from './routes/api'; startServer();" },
    { path: "routes/api.ts", content: "import { auth } from '../auth/auth'; router.post('/login', auth);" },
    { path: "auth/auth.ts", content: "import { db } from '../db/pool'; export function auth() {}" },
    { path: "db/pool.ts", content: "export const db = new Pool();" }
  ];

  const codeStart = performance.now();
  try {
    const stats = { parsedFiles: mockFiles.length, skippedFiles: 0, errors: 0 };
    const extracted = await ArchitectureExtractor.extractArchitecture(mockFiles, graph, stats, api);
    const codeEnd = performance.now();
    const codeTime = ((codeEnd - codeStart) / 1000).toFixed(2);
    console.log(`  ✓ Codebase Extraction Pipeline: ${codeTime}s (Root: "${extracted.title}", Subsystems: ${extracted.children.length})\n`);
  } catch (err: any) {
    console.error(`  ❌ Benchmark 4 failed: ${err.message}\n`);
  }

  console.log("========================================================");
  console.log("🏁 Benchmark Complete!");
  console.log("========================================================\n");
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
});

# ArchitectOS: Architecture Generation Logic — Comprehensive Analysis & Redesign Specification

## 1. Executive Summary

ArchitectOS aims to be a next-generation visual architecture tool that decomposes systems from natural language prompts and reverse-engineers codebases into interactive architectural maps. 

Currently, the architecture generation logic in both pipelines (**Prompt-to-Architecture** and **Codebase-to-Architecture**) relies on **single-shot, prompt-only LLM requests** with minimal post-processing. This produces several critical shortcomings:
1. **Shallow Depth & Low Granularity**: The LLM frequently ignores requested autonomy levels (Level 3/4) and produces shallow 1–2 level trees.
2. **Fragility & Truncation**: Deep tree generations with code snippets frequently exceed LLM token limits, resulting in cut-off JSON and runtime failures.
3. **Absence of Semantic Taxonomy**: Nodes are generic without distinct architectural semantics (e.g., Domain vs. Subsystem vs. Microservice vs. Database vs. Controller vs. Event Queue).
4. **Lack of Explicit Edge Relationships**: System diagrams rely solely on parent-child hierarchy and implicit left-to-right sequential layout rather than actual dependency/data-flow edges (HTTP, gRPC, Pub/Sub, DB queries).
5. **Shallow Codebase Reverse-Engineering**: Codebase extraction is limited to 15 files with 500-char truncated snippets and JS/TS Babel AST parsing, dumping everything else into an unorganized "Other Components" folder.

This document details the existing implementation, identifies root causes for its simplicity, and presents a production-grade multi-stage recursive generation engine.

---

## 2. Current Architecture Generation Implementation

### 2.1 Prompt-to-Architecture Flow (`backend/index.ts`)

```
User Prompt (Text) + Level (1-4) + Syntax Option
  │
  ▼
backend/index.ts: generateArchitecture(prompt, level, syntax)
  │  ├─ Single System Prompt with Level Prompt Description
  │  └─ LLM call via ApiHandler (Ollama / Nvidia / OpenAI)
  │
  ▼
extractJsonFromResponse(raw)
  │
  ▼
sanitizeNode(node)
  │  ├─ Fallback random IDs
  │  └─ Default depth/title assignment
  ▼
Return Tree to Frontend (Vue Flow)
```

#### Code Breakdown:
```typescript
// backend/index.ts
const systemPrompt = `You are ArchitectOS, an AI that decomposes software systems into architecture graphs.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown, no explanations, no text outside JSON.
- Schema: { "id": "string", "title": "string", "description": "string", "depth": number, "children": [...]${syntax !== "Hide Syntax" ? ', "code": "string"' : ""} }
- "id" must be unique kebab-case.
- "depth" starts at 1 for root and increments per level.
- Maximum depth: ${level}. You MUST use ALL ${level} levels of depth.
- Root node (depth 1) MUST have children.
- Nodes at depth ${level} have empty children [].
- Nodes at depth < ${level} MUST have 2+ children each.
- Decompose logically: each node = real architectural component.
- Descriptions: 1-2 concise sentences.${syntaxInstruction}

Autonomy: ${levelDesc}`;
```

#### Sanitization Logic:
```typescript
function sanitizeNode(node: any): any {
  return {
    id: node?.id || "node-" + Math.random().toString(36).slice(2, 8),
    title: node?.title || "Untitled",
    description: node?.description || "",
    depth: node?.depth || 1,
    code: node?.code || "",
    children: Array.isArray(node?.children) ? node.children.map(sanitizeNode) : [],
  };
}
```

---

### 2.2 Codebase Extraction Flow (`backend/src/extractor/ArchitectureExtractor.ts`)

```
Uploaded Files / VS Code Workspace
  │
  ▼
RepositoryParser (JS/TS only via Babel)
  │  └─ Builds KnowledgeGraph (classes, functions, imports)
  │
  ▼
ArchitectureExtractor.extractArchitecture()
  │  ├─ fileList (all paths)
  │  ├─ codeSnippets: first 15 files, sliced to 500 chars
  │  ├─ astSummary: top 120 AST nodes + 200 edges
  │  └─ Single LLM extraction prompt
  │
  ▼
repairMissingFiles()
  │  └─ Unassigned files appended to "Other Components" module
  ▼
Sanitized Output Graph
```

---

## 3. Key Weaknesses & Technical Limitations

| Category | Current Implementation | Core Limitation | Impact |
| :--- | :--- | :--- | :--- |
| **Generation Strategy** | Single-shot monolithic prompt | Tries to generate root, domains, subsystems, leaves, and code in 1 prompt | High rate of JSON cutoffs, token exhaustion, and hallucinated shallow trees |
| **Depth Enforcement** | Prompt instruction only (`You MUST use ALL ${level} levels`) | No deterministic validation or tree repair | Level 3/4 requests often return only Level 2 or 1 |
| **Schema & Typing** | Generic `{ id, title, description, depth, code, children }` | No architectural entity types, protocol types, or boundary metadata | Frontend displays all nodes uniformly; lack of rich visual distinctions |
| **Edge Topology** | Implicit parent-child containment | No explicit multi-node directed edges with semantics | Unable to represent event-driven architectures, pub-sub buses, or microservice mesh |
| **AST Analysis** | Babel TS parser only; hardcoded 15-file cap | Ignores Python, Go, Rust, Java; skips 80%+ of larger codebases | Inaccurate reverse-engineering for polyglot or non-JS projects |
| **Unassigned Files** | Flat dump into `Other Components` | No folder-heuristic grouping or secondary clustering pass | Messy and uninformative graph for unparsed files |
| **Graph State** | Global backend memory instance `globalGraph` | Shared across all concurrent users and requests | Race conditions and state collisions in multi-user/multi-tab usage |

---

## 4. Proposed Redesign: Advanced Architecture Generation Engine

To transform ArchitectOS into a production-grade architecture platform, the generation engine should be redesigned around **4 core pillars**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ARCHITECTOS GENERATION ENGINE V2                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────┼───────────────────────────────────┐
  ▼                                   ▼                                   ▼
[ 1. Multi-Stage Pipeline ]   [ 2. Typed Semantic Schema ]    [ 3. Deterministic Validation ]
- Stage 1: Domain Mapping     - Strict Node Types             - Schema & Depth Gatekeeper
- Stage 2: Subsystems & Flow  - Explicit Typed Edges          - Tree Expander / Sub-agent
- Stage 3: Components & I/O   - Boundary Tags (Cloud, DB, etc)- Deterministic Auto-Repair
- Stage 4: Code Contracts
```

---

### 4.1 Multi-Stage Recursive Generation Pipeline

Instead of requesting the entire tree in a single prompt, use a **hierarchical decomposition pipeline**:

#### Stage 1: System Topology & Domains (Macro Level)
- Determine system archetype (e.g., *Microservices, Event-Driven, Serverless, Monolith, Clean/Hexagonal Architecture*).
- Identify 4–6 core Architectural Domains (e.g., *Identity & Access, Data Ingestion, Orchestration Engine, Analytics & Storage, Edge Gateway*).
- Define external boundaries and actor interfaces.

#### Stage 2: Subsystem Decomposition & Flow Contracts (Meso Level)
- For each Domain, decompose into specific Subsystems / Services.
- Generate explicit directed interactions (e.g., `OrderService --[gRPC: CreateOrder]--> PaymentGateway`).

#### Stage 3: Component & Internal Structure (Micro Level)
- For Level 3/4 requests, dynamically spawn parallel sub-prompts for each subsystem.
- Generate internal components: Controllers, Handlers, Services, Repositories, Caches, Workers.

#### Stage 4: Interface & Code Contract Generation (Implementation Level)
- Generate typed code interfaces, data models, and protocol definitions (e.g., TypeScript interfaces, OpenAPI spec snippets, SQL schemas).

---

### 4.2 Universal Semantic Architecture Schema

```typescript
export type ArchitectureNodeType =
  | "system"
  | "domain"
  | "subsystem"
  | "microservice"
  | "api_gateway"
  | "controller"
  | "service_layer"
  | "repository"
  | "database"
  | "cache"
  | "queue"
  | "event_stream"
  | "external_saas"
  | "file";

export type ArchitectureEdgeType =
  | "sync_http"
  | "grpc"
  | "async_event"
  | "pub_sub"
  | "reads_writes"
  | "imports"
  | "extends"
  | "contains";

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  type: ArchitectureEdgeType;
  label?: string;
  protocol?: string;
  payloadSchema?: string;
}

export interface ArchitectureNode {
  id: string;
  title: string;
  description: string;
  depth: number;
  type: ArchitectureNodeType;
  technology?: string; // e.g. "PostgreSQL", "Redis", "FastAPI", "Kafka"
  path?: string;
  code?: string;
  metadata?: {
    tags?: string[];
    isExternal?: boolean;
    scalabilityNotes?: string;
    securityBoundary?: string;
  };
  children: ArchitectureNode[];
}

export interface ArchitectureGraphResult {
  root: ArchitectureNode;
  edges: ArchitectureEdge[];
  archetype: string;
  version: string;
}
```

---

### 4.3 Deterministic Tree Validation & Auto-Repair Engine

Implement a programmatic post-processor (`TreeValidator.ts`) that enforces structural correctness before sending data to the frontend:

1. **Depth Enforcer**:
   - Computes actual tree depth `max(depth(node))`.
   - If `actualDepth < requestedLevel`, automatically triggers a targeted **Sub-Tree Expansion** prompt for the shallowest leaf nodes.
2. **Branching Factor Validator**:
   - Ensures intermediate nodes have at least 2–4 children.
3. **ID & Link Integrity**:
   - Verifies ID uniqueness and repairs broken edge references.
4. **Resilience to JSON Cut-Offs**:
   - Implements streaming JSON parsing or multi-chunk assembly to recover partial nodes.

---

### 4.4 Advanced Codebase Ingestion Pipeline

```
Codebase Files
  │
  ├─ 1. Polyglot Ingestion (Tree-sitter / Regex Parser for Python, Go, Java, TS)
  │
  ├─ 2. Graph Clustering (Community detection on Import & Dependency graph)
  │     └─ Automatically clusters files into true functional subsystems
  │
  ├─ 3. Two-Pass Extraction:
  │     ├─ Pass A: Summarize cluster interfaces & key exports
  │     └─ Pass B: Synthesize top-level Architecture Tree from cluster summaries
  │
  └─ 4. Hierarchical Directory Fallback:
        └─ Preserves real file-tree hierarchy instead of flat "Other Components"
```

---

## 5. Implementation Roadmap & Milestones

### Phase 1: Schema Normalization & Deterministic Validation (Immediate Priority)
- [ ] Define shared `ArchitectureNode` and `ArchitectureEdge` types in a shared types module.
- [ ] Implement `TreeValidator` with depth verification, ID deduplication, and schema validation.
- [ ] Update `generateArchitecture` system prompt to output structured types and explicit cross-node edges.

### Phase 2: Multi-Stage Recursive Decomposition
- [ ] Create `ArchitectureDecomposer` service to split Level 3 and 4 generations into multi-pass LLM prompts (Domain Level -> Subsystem Level -> Component Level).
- [ ] Add sub-tree drilldown generator for expanding specific nodes on demand.

### Phase 3: Polyglot Parsing & Intelligent Codebase Clustering
- [ ] Implement fallback regex/AST parsers for Python (`import`, `class`, `def`), Go (`package`, `import`, `func`), and Java.
- [ ] Cluster codebase files by folder structure and import graph before LLM prompt assembly.
- [ ] Remove the 15-file hard limit by chunking code summaries.

### Phase 4: Frontend Visual Edge & Type Support
- [ ] Update `frontend/src/services/graph.ts` to render custom node cards tailored to `ArchitectureNodeType` (e.g. database icons, queue badges, external cloud indicators).
- [ ] Render semantic colored edges for HTTP, gRPC, and Pub/Sub communication lines.

---

## 6. Document Information
- **File**: `docs/architecture_generation_analysis.md`
- **Related Files**:
  - [`backend/index.ts`](file:///C:/Users/colos/Downloads/ArchitectOS-master/ArchitectOS-master/backend/index.ts)
  - [`backend/src/extractor/ArchitectureExtractor.ts`](file:///C:/Users/colos/Downloads/ArchitectOS-master/ArchitectOS-master/backend/src/extractor/ArchitectureExtractor.ts)
  - [`backend/src/graph/KnowledgeGraph.ts`](file:///C:/Users/colos/Downloads/ArchitectOS-master/ArchitectOS-master/backend/src/graph/KnowledgeGraph.ts)
  - [`frontend/src/services/graph.ts`](file:///C:/Users/colos/Downloads/ArchitectOS-master/ArchitectOS-master/frontend/src/services/graph.ts)

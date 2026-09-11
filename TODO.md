# ArchitectOS: Actionable TODO & Next Steps

This document outlines the implementation roadmap for ArchitectOS, tracking completed milestones and upcoming priorities.

---

## 🎯 Completed Milestones

### 1. Python AST & Static Code Parser (Milestone 2.1) ✅
- [x] **Created `backend/src/parser/languages/PythonParser.ts`**
  - [x] Parse `import ...` and `from ... import ...` statements $\rightarrow$ `imports` edges in `KnowledgeGraph`.
  - [x] Parse class definitions and inheritance (`class Foo(Bar):`) $\rightarrow$ `class` nodes and `extends` edges.
  - [x] Parse class methods (instance methods, `@classmethod`, `@staticmethod`, `async def`) $\rightarrow$ class method properties.
  - [x] Parse standalone functions and coroutines (`def`, `async def`) with parameters $\rightarrow$ `function` nodes and `defines` edges.
  - [x] Parse call expressions (`func()`, `obj.method()`) $\rightarrow$ `calls` edges.
  - [x] Automatic technology/library tag extraction (`pandas`, `openpyxl`, `sqlite3`, `pydantic`, `pytest`, etc.).
- [x] **Updated `backend/src/parser/RepositoryParser.ts`**
  - [x] Register `.py` and `.pyw` file extensions in the supported languages set.
  - [x] Route `.py`/`.pyw` files to `PythonParser.parse(...)`.
  - [x] Implemented `stripCommonRoot(files)` to strip common top-level folder wrappers (e.g. `dinchariya-main/`).
- [x] **Tested Python Ingestion**
  - [x] Verified parsing on sample Python codebases (`dinchariya-main` parsed 33 Python files, generating 112 AST nodes and 1,352 edges).

---

### 2. Graphify-Style Architecture Generation & Clustering Engine ✅
- [x] **Implemented `backend/src/graph/GraphClusterer.ts`**
  - [x] **Deterministic Dependency Clustering**: Group files and classes into cohesive functional subsystems using import/call graph density and package boundaries.
  - [x] **Graph Metrics Calculation**:
    - **Fan-in & Fan-out Degree**: Measure incoming vs. outgoing coupling per file.
    - **"God Node" & Core Hub Detection**: Identify central shared utilities, base models, or global state.
    - **Entry Point Detection**: Detect main entrypoints, routes, CLI scripts, and API controllers.
- [x] **Upgraded `backend/src/extractor/ArchitectureExtractor.ts` to Multi-Pass Synthesis**
  - [x] **Pass 1 (Deterministic)**: Extract clusters, entry points, and hub components via `GraphClusterer`.
  - [x] **Pass 2 (Semantic Enrichment)**: Prompt LLM to assign high-level domain titles, responsibilities, and external interface descriptions to detected clusters.
  - [x] **Pass 3 (Assembly)**: Construct a normalized multi-level architecture tree with explicit cross-subsystem links.

---

### 3. Dynamic 2D Multi-Column Grid Layout & Subsystem Collapse ✅
- [x] **2D Matrix Grid Layout Engine (`frontend/src/services/graph.ts`)**
  - [x] Replaced 1D vertical stacking with dynamic 2D grid matrix layout $(C \times R)$.
  - [x] Dynamically budget columns (1–4 cols) based on child card count.
  - [x] Dynamic container width and height calculation.
- [x] **Collapsible Subsystem Containers (`frontend/src/components/ContainerNode.vue`)**
  - [x] Interactive Collapse/Expand toggle button (`[−]` / `[+]`).
  - [x] Subsystem component count badges (e.g., `📁 18 items`).
  - [x] Automatic cross-node edge rerouting to container when collapsed.
- [x] **Global Canvas Controls (`frontend/src/components/GraphCanvas.vue`)**
  - [x] Bulk "Collapse All" / "Expand All" toolbar button.
  - [x] Grid Density Selector (`2C`, `3C`, `4C`).
- [x] **Multi-Column AST Dependency Graph**
  - [x] 2D matrix wrapping (max 8 rows per column) for Files, Classes, and Functions in dependency view.

---

### 4. Deterministic Tree Validation & Depth Enforcement ✅
- [x] **Created `backend/src/extractor/TreeValidator.ts`**
  - [x] Programmatically verify that generated trees reach the requested autonomy level (Levels 1–4).
  - [x] Automatically trigger targeted **Sub-Tree Expansion** for shallow leaf nodes if depth is not met.
  - [x] Deduplicate and validate unique kebab-case node IDs and parent-child depth consistency.

---

## 🚀 Active Roadmap & Upcoming Priorities

### 5. Multi-Provider LLM Engine (Milestone 1)
- [ ] Wire `OpenAiHandler.ts` into `ApiHandler.ts`.
- [ ] Implement `GeminiHandler.ts` and `AnthropicHandler.ts`.
- [ ] Add dynamic provider settings in the frontend sidebar / modal with `localStorage` persistence.

### 6. Extended Polyglot Parsing (Milestone 2.2)
- [ ] Basic parser support for `.go` (Go) files.
- [ ] Basic parser for `.java` / `.kt` (Java/Kotlin) files.
- [ ] Large codebase chunking & filtering (auto-exclude `dist`, `build`, `coverage`, `.venv`).

### 7. Frontend UX & Export Tools (Milestone 3)
- [ ] Graph Export Utility (download canvas as high-res PNG / SVG).
- [ ] Multi-Project Management (save/load project workspaces via IndexedDB or JSON).

### 8. Bidirectional Code ↔️ Graph Sync (Milestone 5)
- [ ] **Code-to-Graph Sync**: File system & AST watcher in VS Code extension (`vscode.workspace.createFileSystemWatcher`).
- [ ] **Graph-to-Code Sync**: Visual stub generation and import injection when creating nodes or connecting edges.

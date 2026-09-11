# ArchitectOS Project Working Architecture

This document explains how ArchitectOS is structured, how the app works end to end, and where the important engineering decisions currently live. It is meant as a handoff document for future work on deeper architecture graphs and production LLM handling.

## 1. Product Summary

ArchitectOS is a local-first architecture visualizer. A user can either:

1. Enter a natural-language system prompt and generate an architecture tree.
2. Upload a codebase or analyze the active VS Code workspace and reverse-engineer it into an architecture graph.

The frontend renders the result as an interactive Vue Flow graph. Users can drill into nodes, switch between logical architecture and dependency views, edit nodes in Hybrid mode, ask an AI assistant about a node, generate a README, preview generated code files, view a generated file structure, and download a ZIP project.

## 2. Repository Layout

```text
ArchitectOS-master/
  package.json                 Root npm workspace scripts
  README.md                    Public project README
  task_to_completion.md        Roadmap and production tasks
  archos                       Unix helper script
  archos.cmd                   Windows helper script
  bin/
    archos.js                  CLI trigger for VS Code extension/backend
  backend/
    index.ts                   Main Express API server
    .env.example               Runtime configuration template
    mock/
      mockArchitecture.json    Mock fallback graph when AI is disabled
    src/
      api/
        ApiHandler.ts          Provider interface and provider selection
        providers/
          OllamaHandler.ts     Ollama API implementation
          NvidiaHandler.ts     Nvidia NIM-compatible API implementation
      extractor/
        ArchitectureExtractor.ts
      graph/
        KnowledgeGraph.ts
      parser/
        RepositoryParser.ts
        languages/
          TypeScriptParser.ts
  frontend/
    vite.config.ts             Vite dev server and /api proxy
    src/
      main.ts                  Vue + Pinia bootstrap
      App.vue                  Main shell, upload handling, ZIP export
      store/
        app.ts                 Central app state and actions
      services/
        api.ts                 Frontend API wrapper
        graph.ts               Architecture/dependency graph layout
      components/
        Sidebar.vue            Controls, level selector, stats, modes
        GraphCanvas.vue        Vue Flow canvas, minimap, breadcrumbs
        NodeCard.vue           Node rendering, edit/delete/add/AI actions
        ContainerNode.vue      Subsystem container node
        PromptPanel.vue        Floating prompt input
        NodeAIChat.vue         Per-node AI chat modal
        ReadmeModal.vue        README preview/copy
        FileStructureModal.vue Generated file tree modal
        CodeViewer.vue         Generated code/file explorer view
  extension/
    src/
      extension.ts             VS Code extension entrypoint
```

## 3. Runtime Processes

The root workspace uses npm workspaces:

```text
npm run dev
```

This runs both:

```text
npm run dev -w backend    -> tsx watch index.ts
npm run dev -w frontend   -> vite
```

The frontend runs on Vite, usually `http://localhost:5173`.
The backend runs on Express, usually `http://localhost:3000`.

The frontend calls backend endpoints through `/api`. Vite proxies `/api/*` to the backend and strips the `/api` prefix:

```text
frontend /api/generate -> backend http://localhost:3000/generate
```

## 4. Environment Configuration

Backend config comes from `backend/.env`, using `dotenv` in `backend/index.ts`.

Template:

```env
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

Current provider selection is handled by `backend/src/api/ApiHandler.ts`:

```text
AI_PROVIDER=nvidia -> NvidiaHandler
anything else      -> OllamaHandler
```

The frontend has an `aiEnabled` state toggle, but the actual backend AI behavior is controlled by `AI_ENABLED` in the backend environment. In other words, the frontend toggle is currently mostly UI state; it does not dynamically switch backend AI on/off.

## 5. Backend Architecture

### 5.1 Main Server

`backend/index.ts` owns:

- Express setup
- CORS
- JSON body size limit
- AI provider construction through `buildApiHandler()`
- A process-level `globalGraph` knowledge graph
- upload middleware
- prompt-to-architecture generation
- README generation
- file-structure generation
- uploaded-codebase analysis
- AST preview
- dependency graph exposure
- node-level AI chat
- VS Code extension event stream
- health endpoint

### 5.2 Backend Routes

```text
POST /generate
  Input: { prompt, level, syntax }
  Output: architecture tree JSON
  Uses: generateArchitecture()

POST /readme
  Input: { architecture, prompt }
  Output: { readme }
  Uses: generateReadme()

POST /analyze
  Input: { files: [{ path, content }] }
  Output: architecture tree JSON
  Uses: analyzeCodebase()

POST /upload
  Input: multipart upload plus entries in req.body.entries
  Output: architecture tree JSON
  Note: frontend mainly uses /analyze after reading ZIP client-side

POST /ast-preview
  Input: { files }
  Output: raw AST graph nodes/edges plus prompt summary
  Uses: RepositoryParser + KnowledgeGraph

GET /graph
  Output: current globalGraph nodes/edges
  Used by frontend dependency view

POST /file-structure
  Input: { architecture }
  Output: { files }

POST /node-chat
  Input: { node, message, history }
  Output: { reply, updatedNode }

GET /extension-events
  Server-sent events stream used by VS Code extension

POST /trigger-open
  Sends "open" event to connected extension

GET /health
  Reports backend status, AI enabled state, provider, model, and AI availability
```

## 6. Prompt-to-Architecture Flow

This is the main flow when a user types a system idea and clicks Generate.

```text
User prompt
  -> App.vue submit()
  -> store.generate(prompt)
  -> frontend services/api.generateArchitecture()
  -> POST /api/generate
  -> Vite proxy
  -> backend POST /generate
  -> generateArchitecture(prompt, level, syntax)
  -> apiHandler.createMessage(systemPrompt, prompt, options)
  -> OllamaHandler or NvidiaHandler
  -> LLM returns JSON text
  -> extractJsonFromResponse()
  -> sanitizeNode()
  -> response JSON
  -> store.architecture
  -> store._rebuildGraph()
  -> buildGraph()
  -> Vue Flow nodes/edges
```

### 6.1 Autonomy / Depth Levels

The sidebar stores `store.level` from 1 to 4. This value is sent to `/generate`.

`backend/index.ts` maps levels to prompt rules:

```text
Level 1: Beginner, exactly 1 depth level with 3-5 child nodes under root
Level 2: Intermediate, exactly 2 depth levels
Level 3: Advanced, exactly 3 depth levels
Level 4: Expert, exactly 4 depth levels
```

The system prompt tells the LLM:

- return only JSON
- use unique kebab-case IDs
- depth starts at 1
- maximum depth equals selected level
- use all requested levels
- root must have children
- leaves at maximum depth have empty children
- nodes below maximum depth must have at least 2 children

Current issue: this is prompt-enforced only. There is no deterministic backend validation that the returned tree actually reaches the requested depth, has enough children, or follows a strict architecture taxonomy. If the LLM returns shallow/minimal JSON, `sanitizeNode()` accepts it as long as basic fields exist.

### 6.2 Syntax Modes

The frontend has three syntax options:

```text
Hide Syntax
Show Pseudocode
Show Real Code
```

The selected value is sent to `/generate`. The backend prompt changes as follows:

- `Hide Syntax`: no code requested.
- `Show Pseudocode`: every node should include 3-10 lines of pseudocode.
- `Show Real Code`: every node should include 3-15 lines of real code.

Generated `code` fields appear in node cards, code viewer, downloaded ZIP, and generated file structure.

## 7. Uploaded-Codebase Analysis Flow

This flow is used when the user uploads files, uploads a ZIP, or asks the VS Code extension to analyze the active workspace.

```text
User uploads files or ZIP
  -> App.vue handleUpload()
  -> text files are read in browser
  -> file count/content are limited
  -> store.uploadCodebase(files)
  -> frontend services/api.analyzeCodebase()
  -> POST /api/analyze
  -> backend analyzeCodebase(files)
```

If `AI_ENABLED=false`:

```text
files -> buildFileTreeArchitecture() -> simple folder/file tree
```

If `AI_ENABLED=true`:

```text
files
  -> globalGraph.clear()
  -> RepositoryParser.parseRepository(files, globalGraph)
  -> TypeScriptParser parses supported JS/TS files with Babel
  -> KnowledgeGraph receives file/class/function nodes and import/define/call/export/extends edges
  -> ArchitectureExtractor.extractArchitecture(files, graph, stats, apiHandler)
  -> LLM groups files into logical subsystems
  -> repairMissingFiles() appends unassigned files to Other Components
  -> sanitized architecture tree returned to frontend
```

### 7.1 Upload Filtering

`App.vue` supports these upload types:

```text
.zip, .tar, .gz, .js, .ts, .py, .java, .go, .rs, .c, .cpp, .h,
.jsx, .tsx, .vue, .svelte, .rb, .php, .cs, .swift, .kt
```

In practice:

- ZIP files are read client-side with JSZip.
- Text-like extensions are included.
- `node_modules` and `.git` paths are excluded.
- Individual file content is skipped if it is too large.
- Payload is limited to the first 20 files.
- Each file content is sliced to 8000 characters before analysis.

The VS Code extension path uses a similar but separate filter and sends up to 40 files.

### 7.2 Static Parser

`RepositoryParser` currently only parses:

```text
.js, .mjs, .cjs, .ts, .tsx, .jsx
```

Other uploaded languages are skipped by static parsing, even though they can still be included in the LLM file list/snippets.

`TypeScriptParser` uses Babel and extracts:

- file nodes
- import declarations
- class declarations
- class methods
- superclass relationships
- function declarations
- call expressions
- default exports
- named exports

These become graph nodes/edges in `KnowledgeGraph`.

### 7.3 Knowledge Graph Model

`KnowledgeGraph` stores:

```ts
GraphNode {
  id: string;
  name: string;
  type: "file" | "class" | "function" | "module" | "layer";
  properties: Record<string, any>;
}

GraphEdge {
  from: string;
  to: string;
  type: "imports" | "extends" | "calls" | "defines" | "exports";
  properties?: Record<string, any>;
}
```

The frontend can display this raw graph in dependency mode by calling `GET /graph`.

## 8. Architecture Tree Schema

There are two close but not identical architecture schemas in use.

Prompt generation uses:

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "depth": 1,
  "code": "optional string",
  "children": []
}
```

Uploaded-codebase extraction asks for:

```json
{
  "id": "root-id",
  "title": "Project Name",
  "description": "High level system description",
  "depth": 0,
  "type": "project",
  "path": "",
  "code": "",
  "children": [
    {
      "id": "module-id",
      "title": "Subsystem/Layer Title",
      "description": "Subsystem description",
      "depth": 1,
      "type": "module",
      "path": "",
      "code": "",
      "children": [
        {
          "id": "file-node-id",
          "title": "File/Component Title",
          "description": "File description",
          "depth": 2,
          "type": "file",
          "path": "actual/file/path.ts",
          "code": "key snippet",
          "children": []
        }
      ]
    }
  ]
}
```

The frontend `ArchNode` type only models:

```ts
{
  id: string;
  title: string;
  description: string;
  depth: number;
  children: ArchNode[];
  code?: string;
}
```

Current issue: uploaded-codebase nodes may include `type` and `path`, but `frontend/src/services/graph.ts` sanitizes them away for architecture rendering. The logical graph therefore loses file path/type metadata in some frontend paths, although the original `architecture` object in store may still contain extra fields from the backend.

## 9. Frontend Architecture

### 9.1 Bootstrap

`frontend/src/main.ts` creates the Vue app, installs Pinia, loads global CSS, and imports Vue Flow styles.

### 9.2 Main App Shell

`App.vue` owns:

- root layout
- hidden file input
- welcome screen
- main toolbar
- upload handling
- VS Code webview message handling
- README button logic
- file structure button
- logical/dependency view toggle
- code viewer button
- prompt panel toggle
- ZIP download
- modal mounting

### 9.3 Store

`frontend/src/store/app.ts` is the central state machine.

Important state:

```text
level                 selected autonomy/depth level
mode                  AI Decompose or Hybrid
syntax                Hide Syntax / Show Pseudocode / Show Real Code
architecture          current architecture tree
nodes, edges          current Vue Flow render data
breadcrumbs           drill-down path
focusId               current focused tree node
loading               prompt generation state
uploadLoading         codebase analysis state
error                 visible error message
lastPrompt            latest prompt or [Uploaded Codebase]
readme/readmeStale    generated README state
fileStructure         generated file structure paths
history               recent prompts
viewMode              architecture or dependency
sidebarWidth          persisted sidebar width
sidebarCollapsed      persisted sidebar collapsed state
activeAINodeId        current node chat target
```

State is persisted in `localStorage` under:

```text
architectos-state
```

### 9.4 Graph Rendering

`frontend/src/services/graph.ts` converts the tree into Vue Flow nodes/edges.

There are two graph modes:

1. Logical architecture graph
2. Raw dependency graph

Logical graph:

```text
buildGraph(root, focusId?)
```

If there is no focused node, `layoutProjectOverview()` is used:

- root node on the left
- top-level subsystems as container columns
- subsystem children as cards inside containers
- sequential flow edges between adjacent subsystems

If the user drills into a node, `layoutDrillDown()` is used:

- focused node becomes the local root
- child subtrees are laid out horizontally
- vertical space is allocated by leaf count

Dependency graph:

```text
buildDependencyGraph(rawNodes, rawEdges)
```

This lays out:

- files in column 1
- classes in column 2
- functions in column 3
- colored edges by relation type

### 9.5 Drill-Down

`GraphCanvas.vue` listens for node clicks. If the clicked architecture node has children:

```text
GraphCanvas.onNodeClick()
  -> store.focusNode(nodeId)
  -> store._rebuildGraph()
  -> buildGraph(architecture, focusId)
  -> breadcrumbs become visible
```

The Back button calls `store.goBack()` and moves one level up through breadcrumbs.

### 9.6 Hybrid Editing

Hybrid mode is controlled by `store.mode === "Hybrid"`.

In `NodeCard.vue`, Hybrid mode enables:

- edit title/description
- delete node
- add child node

Store actions clone and modify the architecture tree:

```text
editNode()
deleteNode()
addChildNode()
```

After edits:

- `readmeStale` becomes true
- graph is rebuilt
- state is persisted

### 9.7 Node AI Chat

Each node has an Ask AI action.

```text
NodeCard.openAI()
  -> store.openNodeAI(nodeId)
  -> NodeAIChat.vue opens
  -> POST /api/node-chat
  -> backend asks LLM about only that node
  -> response may include updatedNode
  -> store.updateNodeFromAI(updatedNode)
```

The backend prompt asks the model to return:

```json
{
  "reply": "text",
  "updatedNode": null
}
```

or an updated node object.

### 9.8 README Generation

README generation flow:

```text
Toolbar README button
  -> store.refreshReadme()
  -> frontend generateReadme()
  -> POST /api/readme
  -> backend generateReadme()
  -> LLM writes README content
  -> store.readme
  -> ReadmeModal renders simple markdown-to-HTML
```

Any graph edit marks the README as stale.

### 9.9 File Structure and Code Viewer

`POST /file-structure` recursively walks the architecture tree and returns paths like:

```text
root-node/child-node/index.ts
```

`CodeViewer.vue` independently generates a file explorer and file contents from the architecture tree. It creates:

- `tsconfig.json`
- `package.json`
- one `index.ts` per architecture node

`App.vue` uses similar logic to download a ZIP containing:

- `README.md`
- `architecture.json`
- generated `src/**/index.ts` files
- `package.json`
- `tsconfig.json`
- `.gitignore`

## 10. VS Code Extension and CLI Flow

The VS Code extension in `extension/src/extension.ts` does three major things:

1. Starts the backend automatically with:

```text
npx tsx backend/index.ts
PORT=3000
AI_ENABLED=true
```

2. Registers the command:

```text
architectos.open
```

This opens a webview panel containing an iframe pointed at:

```text
http://localhost:5173
```

3. Handles `readWorkspaceFiles` messages from the frontend. It reads workspace files matching common source extensions, excludes build/dependency folders, limits to 40 files, and sends them back to the frontend as `workspaceFilesResult`.

The root CLI helper:

```text
bin/archos.js
```

tries to call:

```text
POST http://localhost:3000/trigger-open
```

If the backend is unavailable, it runs:

```text
code .
```

Then retries the trigger after a short delay.

## 11. Current LLM Handling

The current backend has an abstraction:

```ts
interface ApiHandler {
  createMessage(systemPrompt, userPrompt, options): Promise<string>;
}
```

Current implementations:

- `OllamaHandler`: calls `POST {OLLAMA_BASE_URL}/api/generate`
- `NvidiaHandler`: calls `POST {NVIDIA_BASE_URL}/chat/completions`

Current provider selection:

```text
AI_PROVIDER=nvidia -> NvidiaHandler
default             -> OllamaHandler
```

The Nvidia handler reads the API key from:

```text
NVIDIA_API_KEY
```

This is better than hardcoding in source, but production still needs a clearer policy for API keys, billing, tenant separation, quotas, and abuse prevention.

## 12. Production LLM Options

There are three practical production models.

### Option A: User-Supplied API Keys

Users enter their own OpenAI/Gemini/Anthropic/Nvidia/Ollama settings in the UI.

Pros:

- lowest platform cost
- no billing liability for hosted app owner
- easier for open-source/self-hosted users

Cons:

- keys in browser storage are sensitive
- UX is more complex
- cannot guarantee provider availability

Best fit:

- local-first developer tool
- self-hosted app
- early-stage launch

Implementation direction:

- add provider settings UI
- store local provider config in browser only or send per request as headers
- never commit keys
- optionally encrypt local storage if packaging as desktop app

### Option B: Server-Owned API Keys

The backend owns provider keys in environment variables. Users do not see keys.

Pros:

- simple UX
- centralized provider control
- easier to tune models and prompts

Cons:

- platform owner pays for usage
- requires authentication, rate limits, quotas, logging, and abuse controls
- backend becomes a sensitive service

Best fit:

- hosted SaaS product

Implementation direction:

- add user auth
- add request quotas
- add rate limiting
- store API keys only in server env or secrets manager
- add provider router and request logging
- add cost tracking per user/project

### Option C: Hybrid

Use local Ollama by default. Hosted users can either bring their own key or use paid platform credits.

Pros:

- best flexibility
- keeps local-first identity
- supports SaaS monetization later

Cons:

- more product and engineering complexity

Recommended direction for ArchitectOS:

```text
Phase 1: Local Ollama + user-supplied keys
Phase 2: Add OpenAI/Gemini/Anthropic handlers
Phase 3: Add hosted server-owned keys only after auth/rate limits exist
```

## 13. Main Current Limitations

### 13.1 Architecture Depth Is Prompt-Only

The app asks the LLM for deeper trees, but does not enforce:

- minimum depth
- minimum branching factor
- total node range
- consistent tree-level taxonomy
- typed architecture categories

This is why generations can feel simple/minimal.

### 13.2 Uploaded Codebase Analysis Is Shallow

`ArchitectureExtractor` currently asks for:

```text
project -> module/subsystem -> file/component
```

That is only 2-3 useful levels. It does not ask for:

- package -> module -> file -> class -> method
- interface boundaries
- runtime flows
- data flows
- deployment components
- external dependencies
- storage/cache/message broker layers

### 13.3 Static Parsing Is JS/TS Only

Uploads accept many languages, but the AST parser only understands JS/TS-family files. Other languages are mostly represented through file names and snippets.

### 13.4 Global Dependency Graph Is Process-Level

`globalGraph` is shared in the backend process. In production, this is not safe for multiple users or concurrent projects. One user's analysis can overwrite another user's graph.

### 13.5 No Production Auth or Quotas

The backend currently has:

- open CORS
- no auth
- no request identity
- no quotas
- no rate limiting
- no per-user storage

This is fine for local development, but not for hosted production.

### 13.6 Upload Limits Are Basic

Frontend limits file count and size, but production backend still needs:

- server-side validation
- MIME/type checks
- total payload limits per user
- path traversal hardening
- malware/secret scanning decisions
- exclusion rules for generated/vendor files

## 14. Recommended Tree-Level Architecture Model

For deeper, more useful graphs, use explicit architecture levels instead of only "depth".

Recommended universal hierarchy:

```text
Level 0: Project/System
Level 1: Architecture Domains
         Example: Client, API, Services, Data, Infrastructure, Observability
Level 2: Subsystems
         Example: Auth Service, Billing Service, Parser Pipeline, LLM Gateway
Level 3: Components
         Example: Controllers, Repositories, Workers, Queues, Adapters
Level 4: Implementation Units
         Example: Files, classes, functions, endpoints, schemas
Level 5: Internal Behaviors
         Example: algorithms, validations, data transformations, failure paths
```

For prompt-generated systems, the LLM should produce this schema directly.

For uploaded codebases, the backend should combine:

- file paths
- import graph
- class/function AST data
- package/framework conventions
- LLM summarization

Then generate a normalized tree.

## 15. Recommended Production Refactor Plan

### 15.1 Normalize the Architecture Schema

Create one shared schema used by backend and frontend:

```ts
type ArchitectureNodeType =
  | "system"
  | "domain"
  | "subsystem"
  | "component"
  | "file"
  | "class"
  | "function"
  | "endpoint"
  | "database"
  | "queue"
  | "external"
  | "infrastructure";

interface ArchitectureNode {
  id: string;
  title: string;
  description: string;
  depth: number;
  type: ArchitectureNodeType;
  path?: string;
  language?: string;
  code?: string;
  metadata?: Record<string, unknown>;
  children: ArchitectureNode[];
}
```

### 15.2 Add Deterministic Tree Validation

After LLM output:

- validate JSON schema
- verify unique IDs
- verify parent/child depths
- verify minimum requested depth
- verify leaves and child counts
- repair or re-ask the model if invalid

### 15.3 Split LLM Use Into Jobs

For production reliability:

```text
Request
  -> create analysis job
  -> chunk files
  -> parse static graph
  -> summarize chunks
  -> merge summaries
  -> build architecture tree
  -> validate/repair
  -> persist result
  -> notify frontend
```

This avoids one huge LLM prompt and gives better control over failures.

### 15.4 Create an LLM Gateway

Replace simple provider selection with a provider registry:

```text
LlmGateway
  ProviderRegistry
    OllamaProvider
    NvidiaProvider
    OpenAIProvider
    GeminiProvider
    AnthropicProvider
  RequestPolicy
    timeout
    retries
    max tokens
    JSON mode support
    rate limits
    fallback behavior
```

### 15.5 Make Graph State Project-Scoped

Replace process-level `globalGraph` with project/session-scoped storage:

```text
projectId -> architecture tree
projectId -> dependency graph
projectId -> analysis job status
```

For local-first:

- browser IndexedDB or local JSON export can be enough.

For hosted production:

- database table/document storage is required.

## 16. Important Files to Change Later

For deeper graph generation:

```text
backend/index.ts
  generateArchitecture()
  sanitizeNode()

backend/src/extractor/ArchitectureExtractor.ts
  extraction prompt
  output schema
  repairMissingFiles()

frontend/src/services/graph.ts
  ArchNode type
  sanitize()
  layoutProjectOverview()
  layoutDrillDown()

frontend/src/store/app.ts
  architecture typing
  rebuild logic
```

For production LLM handling:

```text
backend/src/api/ApiHandler.ts
backend/src/api/providers/OllamaHandler.ts
backend/src/api/providers/NvidiaHandler.ts
backend/.env.example
frontend/src/store/app.ts
frontend/src/components/Sidebar.vue
```

For upload/codebase analysis:

```text
backend/src/parser/RepositoryParser.ts
backend/src/parser/languages/TypeScriptParser.ts
backend/src/extractor/ArchitectureExtractor.ts
frontend/src/App.vue
extension/src/extension.ts
```

## 17. Short Mental Model

ArchitectOS has two major pipelines:

```text
Idea prompt -> LLM -> architecture tree -> Vue Flow graph
Codebase files -> parser/knowledge graph -> LLM -> architecture tree -> Vue Flow graph
```

The frontend is already capable of rendering nested architecture trees and drilling into subtrees. The main quality gap is upstream: the backend needs stricter schemas, deterministic validation, richer code extraction, and better LLM orchestration.

The productionization gap is also mostly backend-side: API keys, provider routing, auth, quotas, project-scoped state, async jobs, and safer upload handling.


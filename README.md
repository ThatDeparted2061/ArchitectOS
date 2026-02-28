# ArchitectOS — Local AI Architecture Visualizer

ArchitectOS is a local-first, interactive architecture visualization tool. It converts a prompt into a layered architecture graph you can explore and drill into. It emphasizes **logic and architecture** over syntax.

## Features
- Prompt → Architecture Decomposition → Interactive Visual Explorer
- Autonomy/abstraction slider (Beginner → Expert)
- Syntax toggle (hidden by default)
- Infinite zoomable canvas (Vue Flow)
- AI on/off toggle (local mock fallback)

## Tech Stack
**Frontend:** Vue 3, TypeScript, Vite, Vue Flow, Pinia, Tailwind CSS
**Backend:** Node.js, Express, TypeScript

## Local Run
From project root:

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3000

## API
**POST** `/generate`

```json
{ "prompt": "Build an API Gateway", "level": 2 }
```

Returns **Architecture JSON**:

```json
{
  "id": "api-gateway",
  "title": "API Gateway",
  "description": "Entry point for client requests",
  "depth": 1,
  "children": []
}
```

## Architecture JSON Rules
- Strict JSON only
- No extra text/markdown
- Depth must match autonomy level
- Logical decomposition only

## Graphs & Interaction
- Click nodes to focus and drill down
- Breadcrumbs allow back navigation
- Smooth pan/zoom with subtle grid

## Notes
- If `AI_ENABLED=true`, the backend uses the AI provider (placeholder).
- If `AI_ENABLED=false`, it returns `mock/mockArchitecture.json`.

# ArchitectOS

A local-first AI architecture visualizer. Describe any system and watch it decompose into an interactive, drillable graph.

**Powered by Ollama (free, local AI). No API keys. No billing. No cloud.**

## Features

- **AI Decompose** — describe a system, AI generates the architecture graph
- **Hybrid Mode** — AI generates, then edit/add/delete nodes inline
- **Syntax Toggle** — hide code, show pseudocode, or show real code per node
- **Autonomy Levels** — Beginner (overview) → Expert (deep implementation detail)
- **Drill-down** — click any node to zoom into its children; breadcrumb navigation
- **Fully local** — runs on your machine, no data leaves your system

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.com/) with a model installed

## Setup

```bash
# Install Ollama (if not already)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Clone and install
git clone https://github.com/ThatDeparted2061/ArchitectOS.git
cd ArchitectOS
npm install

# Configure (optional — defaults work out of the box)
cp backend/.env.example backend/.env

# Run
npm run dev
```

Open http://localhost:5173

## Configuration

Edit `backend/.env`:

```
AI_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

Swap `OLLAMA_MODEL` for any model you have: `codellama`, `mistral`, `llama3.1:70b`, etc.

## Modes

| Mode | Description |
|------|-------------|
| AI Decompose | Prompt → AI generates full architecture |
| Hybrid | AI generates → you edit, add, or delete nodes |
| Manual Mode | Build from scratch (coming soon) |

## Syntax Options

| Option | What it shows |
|--------|---------------|
| Hide Syntax | Clean view — titles + descriptions only |
| Show Pseudocode | Each node includes pseudocode logic |
| Show Real Code | Each node includes real code snippets |

## Stack

- **Frontend:** Vue 3 + Vite + Vue Flow + Pinia + Tailwind CSS
- **Backend:** Express + TypeScript
- **AI:** Ollama (local LLM)

## License

MIT

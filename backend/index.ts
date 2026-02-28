import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const AI_ENABLED = process.env.AI_ENABLED === "true";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

const upload = multer({ dest: "/tmp/architect-os-uploads/" });

// ── Sanitize node tree ─────────────────────────────────────────────
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

// ── Mock fallback ──────────────────────────────────────────────────
function loadMockArchitecture() {
  const filePath = path.join(process.cwd(), "mock", "mockArchitecture.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// ── Call Ollama ────────────────────────────────────────────────────
async function callOllama(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    signal: controller.signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      format: "json",
      options: { temperature: 0.7, num_predict: maxTokens },
    }),
  });

  clearTimeout(timeout);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.message?.content;
  if (!content) throw new Error("Empty response from AI");

  return content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ── Generate architecture ──────────────────────────────────────────
async function generateArchitecture(prompt: string, level: number, syntax: string) {
  const levelNames: Record<number, string> = {
    1: "Beginner — high-level system overview. Generate exactly 1 depth level with 3-5 child nodes under root.",
    2: "Intermediate — subsystems and data flow. Generate exactly 2 depth levels. Root has 4-6 children, each child has 2-4 children.",
    3: "Advanced — internal mechanisms, auth, protocols. Generate exactly 3 depth levels. Be thorough with 10-20 total nodes.",
    4: "Expert — full implementation detail. Generate exactly 4 depth levels. Include algorithmic and data structure detail. 15-30 total nodes.",
  };

  const levelDesc = levelNames[level] || levelNames[2];

  let syntaxInstruction = "";
  if (syntax === "Show Pseudocode") {
    syntaxInstruction = `\n- Add a "code" field to EVERY node containing pseudocode (3-10 lines) showing the logic of that component. Use clear variable names and comments.`;
  } else if (syntax === "Show Real Code") {
    syntaxInstruction = `\n- Add a "code" field to EVERY node containing real, working code (3-15 lines, language relevant to the system) implementing that component's core logic.`;
  }

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

  const raw = await callOllama(systemPrompt, prompt, syntax !== "Hide Syntax" ? 6000 : 4096);

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.id || !parsed.title) throw new Error("Missing required fields");
    return sanitizeNode(parsed);
  } catch (e) {
    console.error("Failed to parse AI response:", raw.slice(0, 500));
    throw new Error("AI returned invalid JSON. Try again.");
  }
}

// ── Generate README ────────────────────────────────────────────────
async function generateReadme(architecture: any, prompt: string): Promise<string> {
  const systemPrompt = `You are a technical writer. Given an architecture JSON and the original prompt, write a comprehensive README.md for a GitHub repository.

RULES:
- Return ONLY a JSON object: { "readme": "..." }
- The readme field contains the full markdown README.
- Include: Project title, description, architecture overview, how each component works, setup instructions, file structure, and usage.
- Write in clear, friendly English.
- Use proper markdown formatting with headers, lists, code blocks.
- Make it look professional — like a real open-source project README.`;

  const userPrompt = `Original prompt: "${prompt}"

Architecture:
${JSON.stringify(architecture, null, 2)}`;

  const raw = await callOllama(systemPrompt, userPrompt, 4096);

  try {
    const parsed = JSON.parse(raw);
    return parsed.readme || parsed.content || raw;
  } catch {
    return raw;
  }
}

// ── Generate file structure from architecture ──────────────────────
function generateFileStructure(arch: any, basePath = ""): string[] {
  const files: string[] = [];
  const dirName = arch.id.replace(/[^a-z0-9-_]/gi, "-");
  const currentPath = basePath ? `${basePath}/${dirName}` : dirName;

  if (arch.code) {
    files.push(`${currentPath}/index.ts`);
  }

  if (arch.children && arch.children.length > 0) {
    for (const child of arch.children) {
      files.push(...generateFileStructure(child, currentPath));
    }
  } else {
    if (!arch.code) {
      files.push(`${currentPath}/index.ts`);
    }
  }

  return files;
}

// ── Analyze uploaded codebase ──────────────────────────────────────
async function analyzeCodebase(files: { path: string; content: string }[]) {
  const fileList = files.map((f) => `${f.path} (${f.content.length} chars)`).join("\n");
  const codeSnippets = files
    .slice(0, 15)
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 500)}`)
    .join("\n\n");

  const systemPrompt = `You are ArchitectOS. Given a codebase's file structure and code snippets, decompose it into an architecture graph.

RULES:
- Return ONLY valid JSON. No markdown.
- Schema: { "id": "string", "title": "string", "description": "string", "depth": number, "children": [...], "code": "string" }
- Create a multi-level hierarchy reflecting the actual code organization.
- Use 2-4 depth levels depending on complexity.
- Each node should map to real components/modules in the code.
- Add relevant code snippets from the actual codebase to the "code" field.
- Root node represents the entire project.`;

  const userPrompt = `File structure:\n${fileList}\n\nCode snippets:\n${codeSnippets}`;

  const raw = await callOllama(systemPrompt, userPrompt, 6000);

  try {
    const parsed = JSON.parse(raw);
    return sanitizeNode(parsed);
  } catch {
    throw new Error("Failed to analyze codebase. Try with fewer files.");
  }
}

// ── Routes ─────────────────────────────────────────────────────────

// Generate architecture
app.post("/generate", async (req, res) => {
  const { prompt, level, syntax } = req.body || {};
  if (!prompt || typeof level !== "number") {
    return res.status(400).json({ error: "Need { prompt, level }" });
  }
  try {
    let result;
    if (AI_ENABLED) {
      console.log(`[AI] Generating: "${prompt}" level=${level} syntax=${syntax || "Hide Syntax"}`);
      result = await generateArchitecture(prompt, level, syntax || "Hide Syntax");
      console.log(`[AI] Done.`);
    } else {
      result = loadMockArchitecture();
    }
    return res.json(result);
  } catch (error: any) {
    console.error("Generation error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Generate README
app.post("/readme", async (req, res) => {
  const { architecture, prompt } = req.body || {};
  if (!architecture) return res.status(400).json({ error: "Need architecture" });
  try {
    console.log(`[AI] Generating README...`);
    const readme = await generateReadme(architecture, prompt || "");
    console.log(`[AI] README done.`);
    return res.json({ readme });
  } catch (error: any) {
    console.error("README error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Upload codebase
app.post("/upload", upload.single("zipfile"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Read the uploaded file as text entries
    const filePath = req.file.path;
    const entries = req.body.entries ? JSON.parse(req.body.entries) : [];

    if (!entries.length) {
      return res.status(400).json({ error: "No file entries provided" });
    }

    console.log(`[AI] Analyzing ${entries.length} files...`);
    const result = await analyzeCodebase(entries);
    console.log(`[AI] Analysis done.`);

    // Cleanup
    fs.unlinkSync(filePath);
    return res.json(result);
  } catch (error: any) {
    console.error("Upload error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Upload as JSON (for frontend ZIP reading)
app.post("/analyze", async (req, res) => {
  const { files } = req.body || {};
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Need { files: [{path, content}] }" });
  }
  try {
    console.log(`[AI] Analyzing ${files.length} files...`);
    const result = await analyzeCodebase(files);
    console.log(`[AI] Analysis done.`);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// File structure
app.post("/file-structure", (req, res) => {
  const { architecture } = req.body || {};
  if (!architecture) return res.status(400).json({ error: "Need architecture" });
  const files = generateFileStructure(architecture);
  return res.json({ files });
});

// Node AI chat
app.post("/node-chat", async (req, res) => {
  const { node, message, history } = req.body || {};
  if (!node || !message) return res.status(400).json({ error: "Need node and message" });

  try {
    const systemPrompt = `You are an AI architecture assistant. You are focused on ONE specific node in an architecture graph.

Node: "${node.title}"
Description: "${node.description}"
${node.code ? `Code:\n${node.code}` : ""}

RULES:
- Answer questions ONLY about this specific node.
- If the user asks you to change something, return a JSON field "updatedNode" with the modified node (same schema: id, title, description, code).
- For explanations, just give clear text. Be concise.
- If the user asks to change the title, description, or code, include "updatedNode" in your response.
- Return JSON: { "reply": "your text answer", "updatedNode": null | { id, title, description, code } }`;

    const chatHistory = (history || []).map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      signal: controller.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
          { role: "user", content: message },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.7, num_predict: 2048 },
      }),
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error("Ollama error");

    const data = await response.json();
    const content = data.message?.content || "";
    const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return res.json({
        reply: parsed.reply || parsed.answer || cleaned,
        updatedNode: parsed.updatedNode || null,
      });
    } catch {
      return res.json({ reply: cleaned, updatedNode: null });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Health
app.get("/health", async (_req, res) => {
  let ollamaOk = false;
  try { const r = await fetch(`${OLLAMA_BASE_URL}/api/tags`); ollamaOk = r.ok; } catch {}
  res.json({ status: "ok", ai: AI_ENABLED, ollama: ollamaOk, model: OLLAMA_MODEL });
});

app.listen(PORT, () => {
  console.log(`Backend on http://localhost:${PORT}`);
  console.log(`AI: ${AI_ENABLED ? "ENABLED (" + OLLAMA_MODEL + ")" : "DISABLED (mock)"}`);
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const AI_ENABLED = process.env.AI_ENABLED === "true";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

// ── Mock fallback ──────────────────────────────────────────────────
function loadMockArchitecture() {
  const filePath = path.join(process.cwd(), "mock", "mockArchitecture.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// ── AI generation via Ollama ───────────────────────────────────────
async function generateWithAI(prompt: string, level: number, syntax: string) {
  const levelNames: Record<number, string> = {
    1: "Beginner (high-level system overview only, max depth 1, 3-5 nodes)",
    2: "Intermediate (subsystems + data transformations, max depth 2, 5-10 nodes)",
    3: "Advanced (internal mechanisms like auth, validation, protocols, max depth 3, 10-20 nodes)",
    4: "Expert (implementation + algorithmic depth, max depth 4, 15-30 nodes)",
  };

  const levelDesc = levelNames[level] || levelNames[2];

  let syntaxInstruction = "";
  if (syntax === "Show Pseudocode") {
    syntaxInstruction = `\n- Add a "code" field to EVERY node containing pseudocode (2-8 lines) showing the logic of that component.`;
  } else if (syntax === "Show Real Code") {
    syntaxInstruction = `\n- Add a "code" field to EVERY node containing real, working code (language relevant to the system, 3-12 lines) implementing that component's core logic.`;
  }

  const systemPrompt = `You are ArchitectOS, an AI that decomposes software systems into architecture graphs.

RULES:
- Return ONLY valid JSON. No markdown, no explanations, no text outside JSON. No backticks.
- Use this exact schema recursively:
  { "id": "string", "title": "string", "description": "string", "depth": number, "children": []${syntax !== "Hide Syntax" ? ', "code": "string"' : ""} }
- "id" must be a unique kebab-case identifier.
- "depth" starts at 1 for the root and increments for each child level.
- Maximum depth allowed: ${level}
- Do NOT exceed the maximum depth. Nodes at max depth must have empty children [].
- Decompose logically: each node should represent a real architectural component.
- Be thorough but concise. Descriptions should be 1 short sentence.
- Return a single root object, not an array.${syntaxInstruction}

Autonomy level: ${levelDesc}`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      stream: false,
      format: "json",
      options: {
        temperature: 0.7,
        num_predict: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Ollama API error:", response.status, errText);
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.message?.content;

  if (!content) {
    throw new Error("Empty response from AI");
  }

  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.id || !parsed.title) {
      throw new Error("Missing required fields");
    }
    return parsed;
  } catch (e) {
    console.error("Failed to parse AI response:", cleaned);
    throw new Error("AI returned invalid JSON. Try again.");
  }
}

// ── Routes ─────────────────────────────────────────────────────────
app.post("/generate", async (req, res) => {
  const { prompt, level, syntax } = req.body || {};

  if (!prompt || typeof level !== "number") {
    return res.status(400).json({ error: "Invalid request. Need { prompt: string, level: number }" });
  }

  try {
    let result;

    if (AI_ENABLED) {
      console.log(`[AI] Generating for: "${prompt}" at level ${level}, syntax: ${syntax || "Hide Syntax"}`);
      result = await generateWithAI(prompt, level, syntax || "Hide Syntax");
      console.log(`[AI] Done.`);
    } else {
      console.log(`[Mock] Returning mock architecture`);
      result = loadMockArchitecture();
    }

    return res.json(result);
  } catch (error: any) {
    console.error("Generation error:", error.message);
    return res.status(500).json({ error: error.message || "Failed to generate architecture" });
  }
});

// Health check
app.get("/health", async (_req, res) => {
  let ollamaOk = false;
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    ollamaOk = r.ok;
  } catch {}
  res.json({ status: "ok", ai: AI_ENABLED, ollama: ollamaOk, model: OLLAMA_MODEL });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`AI: ${AI_ENABLED ? "ENABLED (Ollama: " + OLLAMA_MODEL + ")" : "DISABLED (using mock)"}`);
});

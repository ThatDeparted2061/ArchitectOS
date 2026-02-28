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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

// ── Mock fallback ──────────────────────────────────────────────────
function loadMockArchitecture() {
  const filePath = path.join(process.cwd(), "mock", "mockArchitecture.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// ── AI generation via OpenAI ───────────────────────────────────────
async function generateWithAI(prompt: string, level: number) {
  const levelNames: Record<number, string> = {
    1: "Beginner (high-level system overview only, max depth 1)",
    2: "Intermediate (subsystems + data transformations, max depth 2)",
    3: "Advanced (internal mechanisms like auth, validation, protocols, max depth 3)",
    4: "Expert (implementation + algorithmic depth, max depth 4)",
  };

  const levelDesc = levelNames[level] || levelNames[2];

  const systemPrompt = `You are ArchitectOS, an AI that decomposes software systems into architecture graphs.

RULES:
- Return ONLY valid JSON. No markdown, no explanations, no text outside JSON.
- Use this exact schema recursively:
  { "id": "string", "title": "string", "description": "string", "depth": number, "children": [] }
- "id" must be a unique kebab-case identifier.
- "depth" starts at 1 for the root and increments for each child level.
- Maximum depth allowed: ${level}
- Do NOT exceed the maximum depth. Nodes at max depth must have empty children [].
- Decompose logically: each node should represent a real architectural component.
- Be thorough but concise. Descriptions should be 1 short sentence.

Autonomy level: ${levelDesc}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI API error:", response.status, errText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from AI");
  }

  // Strip markdown fences if the model wraps it
  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse AI response:", cleaned);
    throw new Error("AI returned invalid JSON");
  }
}

// ── Routes ─────────────────────────────────────────────────────────
app.post("/generate", async (req, res) => {
  const { prompt, level } = req.body || {};

  if (!prompt || typeof level !== "number") {
    return res.status(400).json({ error: "Invalid request. Need { prompt: string, level: number }" });
  }

  try {
    let result;

    if (AI_ENABLED && OPENAI_API_KEY) {
      console.log(`[AI] Generating for: "${prompt}" at level ${level}`);
      result = await generateWithAI(prompt, level);
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
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ai: AI_ENABLED && !!OPENAI_API_KEY });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`AI: ${AI_ENABLED && OPENAI_API_KEY ? "ENABLED (" + OPENAI_MODEL + ")" : "DISABLED (using mock)"}`);
});

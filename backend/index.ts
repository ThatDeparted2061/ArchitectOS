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

function loadMockArchitecture() {
  const filePath = path.join(process.cwd(), "mock", "mockArchitecture.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

async function generateWithAI(prompt: string, level: number) {
  // Placeholder for AI integration (LLM call)
  // Must return strict JSON architecture schema
  return loadMockArchitecture();
}

app.post("/generate", async (req, res) => {
  const { prompt, level } = req.body || {};

  if (!prompt || typeof level !== "number") {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const result = AI_ENABLED
      ? await generateWithAI(prompt, level)
      : loadMockArchitecture();

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate architecture" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

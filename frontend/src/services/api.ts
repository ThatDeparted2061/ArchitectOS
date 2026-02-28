const API_BASE = "http://localhost:3000";

export async function generateArchitecture(prompt: string, level: number, syntax: string = "Hide Syntax") {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, level, syntax }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Server error: ${res.status}`);
  }
  return res.json();
}

export async function generateReadme(architecture: any, prompt: string) {
  const res = await fetch(`${API_BASE}/readme`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ architecture, prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Server error: ${res.status}`);
  }
  const data = await res.json();
  return data.readme;
}

export async function getFileStructure(architecture: any) {
  const res = await fetch(`${API_BASE}/file-structure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ architecture }),
  });
  if (!res.ok) throw new Error("Failed to get file structure");
  const data = await res.json();
  return data.files;
}

export async function analyzeCodebase(files: { path: string; content: string }[]) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Server error: ${res.status}`);
  }
  return res.json();
}

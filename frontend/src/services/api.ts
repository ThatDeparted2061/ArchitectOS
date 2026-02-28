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

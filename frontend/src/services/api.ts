export async function generateArchitecture(prompt: string, level: number) {
  const res = await fetch("http://localhost:3000/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, level }),
  });

  if (!res.ok) {
    throw new Error("Failed to generate architecture");
  }

  return res.json();
}

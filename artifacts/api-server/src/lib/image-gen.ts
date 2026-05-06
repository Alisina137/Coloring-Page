import { Buffer } from "node:buffer";

/**
 * Generate an image using Pollinations.ai — completely free, no API key needed.
 * Returns the image as a Buffer (PNG).
 */
export async function generateImageBuffer(prompt: string, _size?: string): Promise<Buffer> {
  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&model=flux&seed=${seed}`;

  const response = await fetch(url, {
    headers: { Accept: "image/png,image/*" },
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Pollinations.ai error: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

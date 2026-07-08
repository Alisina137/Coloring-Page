---
name: HF textToImage output typing
description: "@huggingface/inference textToImage is overloaded by outputType; without an explicit outputType option TS resolves to the string/url overload even though runtime default behavior returns a Blob."
---

`hf.textToImage(args, options)` from `@huggingface/inference` v4 has overloads
keyed on `options.outputType` ("url" | "dataUrl" | "blob" | "json"). If you
call it without passing `options`, TypeScript picks the first matching
overload (`outputType: "url"` → `Promise<string>`), not the runtime default.

**Why:** Code that does `const blob = await hf.textToImage({...}); await
blob.arrayBuffer();` compiles under some tsconfig/type-version combos but
fails typecheck under stricter ones with "Property 'arrayBuffer' does not
exist on type 'string'" — the inferred return type doesn't match the actual
runtime Blob.

**How to apply:** Always pass `{ outputType: "blob" }` explicitly as the
second argument when you intend to call `.arrayBuffer()` on the result.

---
name: HF Inference token permission
description: Hugging Face API tokens need an explicit "Inference Providers" permission or textToImage/inference calls fail even with a valid, non-expired token.
---

Symptom: `@huggingface/inference` calls (e.g. `hf.textToImage(...)`) fail with
"This authentication method does not have sufficient permissions to call
Inference Providers on behalf of user ..." even though the token itself is
valid and `HF_API_TOKEN` is set correctly.

**Why:** Hugging Face access tokens are scoped. A token created without the
"Make calls to Inference Providers" checkbox enabled cannot call the
Inference Providers API used by `textToImage`, `textGeneration`, etc.

**How to apply:** When a project uses `@huggingface/inference` and generation
calls fail with a permissions error, tell the user to edit (or create) their
token at huggingface.co → Settings → Access Tokens, enable "Make calls to
Inference Providers", and provide the updated token via `requestSecrets`.

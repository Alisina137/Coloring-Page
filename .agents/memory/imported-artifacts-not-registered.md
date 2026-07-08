---
name: Imported project artifacts not registered as workflows
description: When a pnpm-workspace project is imported (e.g. from GitHub) with artifacts/*/.replit-artifact/artifact.toml already present, listArtifacts() can still return empty and WorkflowsRestart fails with "doesn't exist in config".
---

Symptom: `listArtifacts()` returns `[]` and `WorkflowsRestart({ name: "artifacts/<slug>: <service>" })` errors with "doesn't exist in config", even though `artifacts/<slug>/.replit-artifact/artifact.toml` already exists on disk with valid service definitions.

**Why:** the platform's artifact/workflow registry is separate from the files on disk — it isn't populated just because `artifact.toml` files exist in the imported repo.

**How to apply:** re-run each artifact's `artifact.toml` through `verifyAndReplaceArtifactToml` (copy the file to a sibling `.edit.toml`, pass both paths) even with unchanged content. This triggers the platform to register the artifact and generate its managed workflow(s), after which `WorkflowsRestart` works with the standard `artifacts/<slug>: <service-name>` name. Clean up the `.edit.toml` temp files afterward.

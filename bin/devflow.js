#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = join(__dirname, "..", "dist", "cli", "index.js");
const srcEntry = join(__dirname, "..", "src", "cli", "index.ts");

if (existsSync(distEntry)) {
  await import(pathToFileURL(distEntry).href);
} else {
  // Dev fallback: try tsx if available
  try {
    const { register } = await import("node:module");
    // Prefer built dist; instruct user if missing
    console.error(
      "DevFlow: run `npm run build` first (dist/ missing).\n  cd projects/devflow && npm install && npm run build"
    );
    process.exit(1);
  } catch {
    console.error("DevFlow: build required. Run: npm install && npm run build");
    process.exit(1);
  }
}

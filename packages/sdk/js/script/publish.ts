#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

// Sanitize channel name for valid npm dist-tags
// npm dist-tags can only contain URL-safe characters and cannot include # @ / or whitespace
function sanitizeChannel(channel: string): string {
  // For primary branches, default to latest
  if (channel === "main" || channel === "master" || channel === "dev" || channel === "development") {
    return "latest"
  }
  
  // Replace invalid characters with hyphens and remove leading/trailing hyphens
  return channel
    .replace(/[^a-zA-Z0-9-_./@]/g, "-")  // Replace invalid characters
    .replace(/[/@#]/g, "-")              // Replace slashes, at signs, and hashes
    .replace(/^-+|-+$/g, "")             // Remove leading/trailing hyphens
    .replace(/-+/g, "-")                 // Replace multiple consecutive hyphens with single hyphen
    || "latest"                          // Default to latest if result is empty
}

const sanitizedChannel = sanitizeChannel(Script.channel)

await import("./build")

const pkg = await import("../package.json").then((m) => m.default)
const original = JSON.parse(JSON.stringify(pkg))
for (const [key, value] of Object.entries(pkg.exports)) {
  const file = value.replace("./src/", "./dist/").replace(".ts", "")
  /// @ts-expect-error
  pkg.exports[key] = {
    import: file + ".js",
    types: file + ".d.ts",
  }
}
await Bun.write("package.json", JSON.stringify(pkg, null, 2))
await $`bun publish --tag ${sanitizedChannel} --access public`
await Bun.write("package.json", JSON.stringify(original, null, 2))

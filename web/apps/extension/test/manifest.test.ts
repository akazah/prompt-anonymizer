import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const manifestPath = path.resolve(__dirname, "../public/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

describe("extension manifest", () => {
  // Privacy surface pin: any new permission/host must be a conscious, reviewed change.

  it("should have manifest_version 3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("should have exact current permissions array", () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["contextMenus", "sidePanel", "storage"])
    );
    expect(manifest.permissions).toHaveLength(3);
  });

  it("should have exact current host_permissions", () => {
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining(["https://huggingface.co/*", "https://*.hf.co/*"])
    );
    expect(manifest.host_permissions).toHaveLength(2);
  });

  it("should have correct content_security_policy", () => {
    expect(manifest.content_security_policy).toBeDefined();
    expect(manifest.content_security_policy.extension_pages).toBe(
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
    );
  });

  it("should not have content_scripts key", () => {
    expect(manifest).not.toHaveProperty("content_scripts");
  });
});

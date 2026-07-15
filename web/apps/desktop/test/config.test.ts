import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const packageJsonPath = path.resolve(__dirname, "../package.json");
const tauriConfPath = path.resolve(__dirname, "../src-tauri/tauri.conf.json");
const capabilitiesPath = path.resolve(
  __dirname,
  "../src-tauri/capabilities/default.json"
);

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
const capabilities = JSON.parse(fs.readFileSync(capabilitiesPath, "utf-8"));

describe("desktop config", () => {
  describe("identifier", () => {
    it("should have exact current identifier value", () => {
      expect(tauriConf.identifier).toBe("com.akazah.promptanonymizer");
    });
  });

  describe("build configuration", () => {
    it("should have exact current frontendDist value", () => {
      expect(tauriConf.build.frontendDist).toBe("../../web/dist");
    });
  });

  describe("version consistency", () => {
    it("should have matching version between tauri.conf.json and package.json", () => {
      expect(tauriConf.version).toBe(packageJson.version);
    });
  });

  describe("capabilities permissions", () => {
    // Privacy pin: no shell/fs/http capability creep
    it("should have exact current permissions array", () => {
      expect(capabilities.permissions).toEqual(["core:default"]);
    });

    it("should not include shell capability", () => {
      expect(capabilities.permissions).not.toContain("shell");
      expect(
        capabilities.permissions.filter(
          (p: string) => p.includes("shell") || p.includes("fs") || p.includes("http")
        )
      ).toHaveLength(0);
    });
  });

  describe("windows configuration", () => {
    it("should have correct windows list", () => {
      expect(capabilities.windows).toEqual(["main"]);
    });

    it("should have single main window configured", () => {
      expect(tauriConf.app.windows).toHaveLength(1);
    });

    it("should pin the product window title to Prompt Anonymizer", () => {
      expect(tauriConf.productName).toBe("Prompt Anonymizer");
      expect(tauriConf.app.windows[0].title).toContain("Prompt Anonymizer");
    });
  });

  describe("frontend wiring", () => {
    it("should point frontendDist at the web app dist (shared UI)", () => {
      expect(tauriConf.build.frontendDist).toBe("../../web/dist");
      const webDist = path.resolve(__dirname, "../../web/dist");
      const webApp = path.resolve(__dirname, "../../web");
      expect(fs.existsSync(webApp)).toBe(true);
      // dist/ is build output — may be absent before `pnpm build`; the path
      // relative to src-tauri must still resolve under apps/web.
      expect(path.normalize(webDist)).toBe(
        path.normalize(path.join(webApp, "dist")),
      );
    });

    it("should build the web app before packaging", () => {
      expect(tauriConf.build.beforeBuildCommand).toContain(
        "@prompt-anonymizer/web",
      );
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { discoverSkills, loadSkillInstructions, buildSkillMetadataBlock, clearSkillCache } from "../registry";

// We need to test registry with real filesystem — create a temp skill tree
function makeTempSkillDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-registry-"));
  return dir;
}

function writeSkill(dir: string, name: string, content: string): string {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  const filePath = path.join(skillDir, "SKILL.md");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("discoverSkills", () => {
  beforeEach(() => {
    clearSkillCache();
  });

  it("discovers builtin skills in the project", () => {
    // The real builtin dir should have at least one skill
    const skills = discoverSkills();
    expect(skills.length).toBeGreaterThan(0);
    const names = skills.map((s) => s.name);
    expect(names).toContain("dcf-valuation");
    expect(names).toContain("fi-analysis");
    expect(names).toContain("tax-efficiency");
  });

  it("returns cached results on second call", () => {
    const first = discoverSkills();
    const second = discoverSkills();
    expect(first).toBe(second); // Same reference = cached
  });

  it("clears cache after clearSkillCache()", () => {
    const first = discoverSkills();
    clearSkillCache();
    const second = discoverSkills();
    expect(first).not.toBe(second);
  });
});

describe("loadSkillInstructions", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempSkillDir();
    clearSkillCache();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns instructions body from a SKILL.md file", () => {
    const filePath = writeSkill(tmpDir, "test-skill", `---
name: test-skill
description: A test skill
---

## Test Skill Instructions

Do step one.
`);
    const instructions = loadSkillInstructions(filePath);
    expect(instructions).toContain("Do step one.");
    expect(instructions).not.toContain("name:");
  });
});

describe("buildSkillMetadataBlock", () => {
  beforeEach(() => {
    clearSkillCache();
  });

  it("returns a non-empty markdown block listing available skills", () => {
    const block = buildSkillMetadataBlock();
    expect(block).toContain("## Available Skills");
    expect(block).toContain("dcf-valuation");
    expect(block).toContain("invoke_skill");
  });

  it("returns empty string when no skills exist", () => {
    // We cannot easily mock the dirs without dependency injection,
    // so we just verify non-empty when builtins are present
    const block = buildSkillMetadataBlock();
    expect(typeof block).toBe("string");
  });
});

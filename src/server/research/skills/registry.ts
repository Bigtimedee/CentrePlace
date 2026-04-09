import fs from "fs";
import path from "path";
import { parseSkillFile } from "./parser";

export interface SkillMetadata {
  name: string;
  description: string;
  filePath: string;
}

const BUILTIN_DIR = path.join(
  process.cwd(),
  "src",
  "server",
  "research",
  "skills",
  "builtin",
);
const PROJECT_DIR = path.join(process.cwd(), ".centreplace", "skills");

// In-memory cache: cleared between tests via clearSkillCache()
let cachedSkills: SkillMetadata[] | null = null;

function scanDir(dir: string): SkillMetadata[] {
  if (!fs.existsSync(dir)) return [];
  const results: SkillMetadata[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(dir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;
    try {
      const content = fs.readFileSync(skillPath, "utf-8");
      const parsed = parseSkillFile(content);
      results.push({
        name: parsed.name,
        description: parsed.description,
        filePath: skillPath,
      });
    } catch {
      // Skip malformed SKILL.md files silently
    }
  }

  return results;
}

/**
 * Discover all available skills.
 * Project-level skills (.centreplace/skills/) override builtins by name.
 * Results are cached after the first call.
 */
export function discoverSkills(): SkillMetadata[] {
  if (cachedSkills !== null) return cachedSkills;

  const builtins = scanDir(BUILTIN_DIR);
  const projectSkills = scanDir(PROJECT_DIR);

  // Project skills override builtins by name
  const byName = new Map<string, SkillMetadata>();
  for (const s of builtins) byName.set(s.name, s);
  for (const s of projectSkills) byName.set(s.name, s);

  cachedSkills = Array.from(byName.values());
  return cachedSkills;
}

/**
 * Load the full instructions body for a skill by file path.
 */
export function loadSkillInstructions(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseSkillFile(content);
  return parsed.instructions;
}

/**
 * Build a compact metadata block listing available skills for injection
 * into the system prompt.
 */
export function buildSkillMetadataBlock(): string {
  const skills = discoverSkills();
  if (skills.length === 0) return "";

  const lines = skills.map((s) => `- **${s.name}**: ${s.description}`);
  return `## Available Skills\n\nYou can invoke the following skills with the \`invoke_skill\` tool to get detailed instructions:\n\n${lines.join("\n")}`;
}

/** Clear the skill discovery cache. Used in tests. */
export function clearSkillCache(): void {
  cachedSkills = null;
}

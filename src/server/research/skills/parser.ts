export interface SkillFrontmatter {
  name: string;
  description: string;
  [key: string]: string;
}

export interface ParsedSkill {
  name: string;
  description: string;
  instructions: string;
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Only handles the flat key: value pattern used by SKILL.md files.
 * Throws if required fields (name, description) are missing.
 */
export function parseFrontmatter(content: string): SkillFrontmatter {
  const parts = content.split(/^---\s*$/m);
  if (parts.length < 3) {
    throw new Error("SKILL.md must contain YAML frontmatter delimited by ---");
  }

  const yamlBlock = parts[1];
  const frontmatter: Record<string, string> = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    // Strip surrounding quotes if present
    frontmatter[key] = value.replace(/^["']|["']$/g, "");
  }

  if (!frontmatter.name) {
    throw new Error("SKILL.md frontmatter must include 'name'");
  }
  if (!frontmatter.description) {
    throw new Error("SKILL.md frontmatter must include 'description'");
  }

  return frontmatter as SkillFrontmatter;
}

/**
 * Parse a full SKILL.md file into a ParsedSkill.
 * The instructions are everything after the closing --- delimiter.
 */
export function parseSkillFile(content: string): ParsedSkill {
  const frontmatter = parseFrontmatter(content);

  // Everything after the second --- is instructions
  const secondDelim = content.indexOf("---", content.indexOf("---") + 3);
  const instructions = content.slice(secondDelim + 3).trim();

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    instructions,
  };
}

import { describe, it, expect } from "vitest";
import { parseFrontmatter, parseSkillFile } from "../parser";

describe("parseFrontmatter", () => {
  it("parses name and description", () => {
    const content = `---
name: dcf-valuation
description: Value a company using discounted cash flow analysis
---
## Instructions`;
    const result = parseFrontmatter(content);
    expect(result.name).toBe("dcf-valuation");
    expect(result.description).toBe("Value a company using discounted cash flow analysis");
  });

  it("strips surrounding quotes from values", () => {
    const content = `---
name: "my-skill"
description: "A skill with quotes"
---`;
    const result = parseFrontmatter(content);
    expect(result.name).toBe("my-skill");
    expect(result.description).toBe("A skill with quotes");
  });

  it("throws when name is missing", () => {
    const content = `---
description: Missing name
---
body`;
    expect(() => parseFrontmatter(content)).toThrow("name");
  });

  it("throws when description is missing", () => {
    const content = `---
name: my-skill
---
body`;
    expect(() => parseFrontmatter(content)).toThrow("description");
  });

  it("throws when there is no frontmatter block", () => {
    expect(() => parseFrontmatter("Just some text without frontmatter")).toThrow();
  });

  it("parses extra arbitrary keys", () => {
    const content = `---
name: test
description: desc
version: 1.2
---`;
    const result = parseFrontmatter(content);
    expect(result.version).toBe("1.2");
  });
});

describe("parseSkillFile", () => {
  it("returns name, description, and instructions body", () => {
    const content = `---
name: fi-analysis
description: Analyze FI trajectory
---

## Financial Independence Analysis

Step 1. Compute FI number.
`;
    const result = parseSkillFile(content);
    expect(result.name).toBe("fi-analysis");
    expect(result.description).toBe("Analyze FI trajectory");
    expect(result.instructions).toContain("Step 1. Compute FI number.");
  });

  it("trims whitespace from instructions", () => {
    const content = `---
name: tax
description: Tax skill
---

   body with leading space   `;
    const result = parseSkillFile(content);
    expect(result.instructions).toBe("body with leading space");
  });

  it("returns empty string instructions when body is only whitespace", () => {
    const content = `---
name: empty
description: empty skill
---
   `;
    const result = parseSkillFile(content);
    expect(result.instructions).toBe("");
  });
});

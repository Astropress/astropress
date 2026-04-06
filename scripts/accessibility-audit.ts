import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import axe from "axe-core";

function listHtmlFiles(root: string, files: string[] = []) {
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      listHtmlFiles(fullPath, files);
      continue;
    }
    if (fullPath.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

const targetRoot = process.argv[2];
if (!targetRoot) {
  throw new Error("Usage: bun run scripts/accessibility-audit.ts <built-html-directory>");
}

const htmlFiles = listHtmlFiles(path.resolve(targetRoot));
if (htmlFiles.length === 0) {
  throw new Error(`No HTML files found under ${targetRoot}.`);
}

const violations: string[] = [];

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  const relativePath = path.relative(process.cwd(), htmlFile);
  const dom = new JSDOM(html, {
    url: `https://astropress.test/${path.relative(targetRoot, htmlFile).replace(/\\/g, "/")}`,
    runScripts: "outside-only",
  });

  dom.window.eval(axe.source);
  const result = await (dom.window as typeof dom.window & { axe: typeof axe }).axe.run(dom.window.document, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
    rules: {
      "color-contrast": { enabled: false },
    },
  });

  for (const violation of result.violations) {
    for (const node of violation.nodes) {
      violations.push(
        `${relativePath}: ${violation.id} (${violation.impact ?? "unknown"}) ${violation.help} -> ${node.target.join(", ")}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Accessibility audit failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Accessibility audit passed for ${htmlFiles.length} built HTML files.`);

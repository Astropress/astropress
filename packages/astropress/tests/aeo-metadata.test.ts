import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentsRoot = path.resolve(import.meta.dirname, "../components");
const contractsPath = path.resolve(import.meta.dirname, "../src/platform-contracts.ts");

describe("AEO metadata types in platform-contracts", () => {
  it("exports FaqItem interface with question and answer fields", () => {
    const source = readFileSync(contractsPath, "utf8");
    expect(source).toContain("export interface FaqItem");
    expect(source).toContain("question: string");
    expect(source).toContain("answer: string");
  });

  it("exports HowToStep interface with name, text, and optional imageUrl", () => {
    const source = readFileSync(contractsPath, "utf8");
    expect(source).toContain("export interface HowToStep");
    expect(source).toContain("name: string");
    expect(source).toContain("text: string");
    expect(source).toContain("imageUrl?: string");
  });

  it("exports AeoMetadata interface with faqItems, howToSteps, speakableCssSelectors", () => {
    const source = readFileSync(contractsPath, "utf8");
    expect(source).toContain("export interface AeoMetadata");
    expect(source).toContain("faqItems?: FaqItem[]");
    expect(source).toContain("howToSteps?: HowToStep[]");
    expect(source).toContain("speakableCssSelectors?: string[]");
  });

  it("ContentStoreRecord.metadata includes AeoMetadata", () => {
    const source = readFileSync(contractsPath, "utf8");
    expect(source).toContain("metadata?: Record<string, unknown> & AeoMetadata");
  });
});

describe("AstropressContentLayout component — AEO auto-wiring", () => {
  const layoutPath = path.join(componentsRoot, "AstropressContentLayout.astro");

  it("component file exists", () => {
    expect(existsSync(layoutPath)).toBe(true);
  });

  it("imports all three AEO JSON-LD components", () => {
    const source = readFileSync(layoutPath, "utf8");
    expect(source).toContain("AstropressFaqJsonLd");
    expect(source).toContain("AstropressHowToJsonLd");
    expect(source).toContain("AstropressSpeakableJsonLd");
  });

  it("conditionally renders FaqJsonLd when faqItems is present", () => {
    const source = readFileSync(layoutPath, "utf8");
    expect(source).toContain("faqItems");
    expect(source).toContain("<AstropressFaqJsonLd");
  });

  it("conditionally renders HowToJsonLd when howToSteps is present", () => {
    const source = readFileSync(layoutPath, "utf8");
    expect(source).toContain("howToSteps");
    expect(source).toContain("<AstropressHowToJsonLd");
  });

  it("conditionally renders SpeakableJsonLd when speakableCssSelectors is present", () => {
    const source = readFileSync(layoutPath, "utf8");
    expect(source).toContain("speakableSelectors");
    expect(source).toContain("<AstropressSpeakableJsonLd");
  });

  it("uses data-ap-content-layout attribute for testability", () => {
    const source = readFileSync(layoutPath, "utf8");
    expect(source).toContain("data-ap-content-layout");
  });
});

describe("AstropressBlogPostingJsonLd — schema-dts integration", () => {
  const blogPostingPath = path.join(componentsRoot, "AstropressBlogPostingJsonLd.astro");

  it("AstropressBlogPostingJsonLd.astro exists", () => {
    expect(existsSync(blogPostingPath)).toBe(true);
  });

  it("uses schema-dts BlogPosting type for compile-time validation", () => {
    const source = readFileSync(blogPostingPath, "utf8");
    expect(source).toContain("schema-dts");
    expect(source).toContain("BlogPosting");
  });

  it("emits a script[type=application/ld+json] tag", () => {
    const source = readFileSync(blogPostingPath, "utf8");
    expect(source).toContain('type="application/ld+json"');
  });

  it("AstropressContentLayout imports AstropressBlogPostingJsonLd", () => {
    const layoutPath = path.join(componentsRoot, "AstropressContentLayout.astro");
    const source = readFileSync(layoutPath, "utf8");
    expect(source).toContain("AstropressBlogPostingJsonLd");
  });

  it("AstropressContentLayout auto-wires BlogPosting for kind === post", () => {
    const layoutPath = path.join(componentsRoot, "AstropressContentLayout.astro");
    const source = readFileSync(layoutPath, "utf8");
    expect(source).toContain("isBlogPost");
    expect(source).toContain('<AstropressBlogPostingJsonLd');
  });

  it("schema-dts is in devDependencies of package.json", () => {
    const pkgPath = path.resolve(import.meta.dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { devDependencies?: Record<string, string> };
    expect(pkg.devDependencies?.["schema-dts"]).toBeDefined();
  });
});

describe("AEO JSON-LD component structural checks", () => {
  const components = [
    { name: "AstropressFaqJsonLd", checks: ["FAQPage", "mainEntity", "acceptedAnswer"] },
    { name: "AstropressHowToJsonLd", checks: ["HowTo", "HowToStep", "step"] },
    { name: "AstropressSpeakableJsonLd", checks: ["SpeakableSpecification", "WebPage", "speakable"] },
    { name: "AstropressBreadcrumbJsonLd", checks: ["BreadcrumbList"] },
    { name: "AstropressArticleJsonLd", checks: ["Article"] },
    { name: "AstropressBlogPostingJsonLd", checks: ["BlogPosting", "headline", "datePublished"] },
  ];

  for (const { name, checks } of components) {
    it(`${name}.astro exists and contains schema.org types: ${checks.join(", ")}`, () => {
      const filePath = path.join(componentsRoot, `${name}.astro`);
      expect(existsSync(filePath), `${name}.astro should exist`).toBe(true);
      const source = readFileSync(filePath, "utf8");
      for (const check of checks) {
        expect(source, `${name}.astro should reference "${check}"`).toContain(check);
      }
    });
  }
});

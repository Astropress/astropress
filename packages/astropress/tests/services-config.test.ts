import { describe, it, expect, beforeEach } from "vitest";
import {
  registerAstropressService,
  getAstropressServices,
  getAstropressService,
  unregisterAstropressService,
  clearAstropressServices,
  type AstropressServiceConfig,
} from "../src/services-config";

const cmsService: AstropressServiceConfig = {
  provider: "cms",
  label: "Payload CMS",
  description: "Open-source TypeScript CMS.",
  proxyTarget: "http://localhost:3000",
  adminPath: "/ap-admin/services/cms",
};

const shopService: AstropressServiceConfig = {
  provider: "shop",
  label: "Medusa",
  description: "Open-source headless commerce.",
  proxyTarget: "http://localhost:9000",
  adminPath: "/ap-admin/services/shop",
};

beforeEach(() => {
  clearAstropressServices();
});

describe("registerAstropressService", () => {
  it("registers a service and makes it retrievable", () => {
    registerAstropressService(cmsService);
    expect(getAstropressService("cms")).toEqual(cmsService);
  });

  it("replaces an existing service with the same provider", () => {
    registerAstropressService(cmsService);
    const updated = { ...cmsService, label: "Payload v3" };
    registerAstropressService(updated);
    expect(getAstropressService("cms")?.label).toBe("Payload v3");
    expect(getAstropressServices()).toHaveLength(1);
  });

  it("registers multiple services independently", () => {
    registerAstropressService(cmsService);
    registerAstropressService(shopService);
    expect(getAstropressServices()).toHaveLength(2);
  });
});

describe("getAstropressServices", () => {
  it("returns an empty array when no services are registered", () => {
    expect(getAstropressServices()).toEqual([]);
  });

  it("returns a copy so callers cannot mutate the registry", () => {
    registerAstropressService(cmsService);
    const list = getAstropressServices();
    list.pop();
    expect(getAstropressServices()).toHaveLength(1);
  });

  it("preserves registration order", () => {
    registerAstropressService(cmsService);
    registerAstropressService(shopService);
    const [first, second] = getAstropressServices();
    expect(first.provider).toBe("cms");
    expect(second.provider).toBe("shop");
  });
});

describe("getAstropressService", () => {
  it("returns undefined for an unregistered provider", () => {
    expect(getAstropressService("email")).toBeUndefined();
  });

  it("finds a registered service by provider key", () => {
    registerAstropressService(shopService);
    expect(getAstropressService("shop")?.label).toBe("Medusa");
  });
});

describe("unregisterAstropressService", () => {
  it("removes a specific service", () => {
    registerAstropressService(cmsService);
    registerAstropressService(shopService);
    unregisterAstropressService("cms");
    expect(getAstropressService("cms")).toBeUndefined();
    expect(getAstropressService("shop")).toBeDefined();
  });

  it("is a no-op for a provider that was never registered", () => {
    expect(() => unregisterAstropressService("community")).not.toThrow();
  });
});

describe("clearAstropressServices", () => {
  it("removes all registered services", () => {
    registerAstropressService(cmsService);
    registerAstropressService(shopService);
    clearAstropressServices();
    expect(getAstropressServices()).toEqual([]);
  });
});

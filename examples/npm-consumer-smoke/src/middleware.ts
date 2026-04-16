import { defineMiddleware } from "astro:middleware";
import { registerCms } from "@astropress-diy/astropress";

registerCms({
  templateKeys: ["content", "campaign", "landing"],
  siteUrl: "http://127.0.0.1:4326",
  seedPages: [
    {
      slug: "hello-world",
      legacyUrl: "/blog/hello-world",
      title: "Hello World",
      kind: "post",
      status: "published",
      body: "<p>Seeded demo post for the consumer smoke harness.</p>",
      summary: "Seeded demo post",
      seoTitle: "Hello World",
      metaDescription: "Seeded demo post",
      templateKey: "content",
      authorIds: [1],
      categoryIds: [10],
      tagIds: [20],
    },
    {
      slug: "draft-update",
      legacyUrl: "/blog/draft-update",
      title: "Draft Update",
      kind: "post",
      status: "draft",
      body: "<p>Draft harness content.</p>",
      summary: "Draft harness content",
      seoTitle: "Draft Update",
      metaDescription: "Draft harness content",
      templateKey: "content",
    },
  ],
  archives: [
    {
      slug: "blog",
      title: "Blog",
      kind: "posts",
      legacyUrl: "/blog",
      listingItems: [{ href: "/blog/hello-world" }, { href: "/blog/draft-update" }],
    },
  ],
  translationStatus: [
    {
      route: "/es/blog/hola",
      translationState: "draft",
      englishSourceUrl: "/blog/hello-world",
      locale: "es",
    },
  ],
});

const injectHarnessLocals = defineMiddleware(async ({ locals }, next) => {
  locals.adminUser = {
    email: "admin@example.com",
    role: "admin",
    name: "Admin Smoke",
  };
  locals.csrfToken = "smoke-csrf-token";
  return next();
});

export const onRequest = injectHarnessLocals;

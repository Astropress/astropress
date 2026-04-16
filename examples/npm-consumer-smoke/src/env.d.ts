declare namespace App {
  interface Locals {
    adminUser?: {
      email: string;
      role: "admin" | "editor";
      name: string;
    };
    csrfToken?: string;
  }
}

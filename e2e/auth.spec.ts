import { expect, test } from "@playwright/test";

const credentials = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.E2E_ADMIN_PASSWORD ?? "Password123"
  },
  company: {
    email: process.env.E2E_COMPANY_EMAIL ?? "firma@example.com",
    password: process.env.E2E_COMPANY_PASSWORD ?? "Password123",
    code: process.env.E2E_COMPANY_CODE ?? "FIRMA-XY"
  },
  vendor: {
    email: process.env.E2E_VENDOR_EMAIL ?? "baecker@example.com",
    password: process.env.E2E_VENDOR_PASSWORD ?? "Password123"
  }
};

test("login chooser is visible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Firma Login" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lieferant Login" })).toBeVisible();
});

test("company login works", async ({ page }) => {
  await page.goto("/login?mode=company");
  await page.getByLabel("E-Mail").fill(credentials.company.email);
  await page.getByLabel("Passwort").fill(credentials.company.password);
  await page.getByLabel("Firmen-Code").fill(credentials.company.code);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/company/dashboard");
  await expect(page).toHaveURL(/\/company\/dashboard/);
});

test("vendor login works", async ({ page }) => {
  await page.goto("/login?mode=vendor");
  await page.getByLabel("E-Mail").fill(credentials.vendor.email);
  await page.getByLabel("Passwort").fill(credentials.vendor.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/vendor/dashboard");
  await expect(page).toHaveURL(/\/vendor\/dashboard/);
});

test("neutral admin login works", async ({ page }) => {
  await page.goto("/login/admin");
  await page.getByLabel("E-Mail").fill(credentials.admin.email);
  await page.getByLabel("Passwort").fill(credentials.admin.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});


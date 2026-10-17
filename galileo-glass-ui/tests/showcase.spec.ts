import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
const createdIds: string[] = [];
test.afterAll(() => {
  for (const id of createdIds) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Error("Unexpected test record identifier");
    execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "galileo",
        "-d",
        "galileo",
        "-c",
        `DELETE FROM greetings WHERE id='${id}' AND seeded=false`,
      ],
      { stdio: "pipe" },
    );
  }
});
test("health confirms a real PostGIS connection", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("healthy");
  expect(body.postgis).toMatch(/^3\./);
  expect(body.greetings).toBeGreaterThanOrEqual(8);
});
test("API validates input and executes spatial filtering", async ({
  request,
}) => {
  for (const payload of [
    {},
    { name: "x", message: "hello", city: "test", latitude: 91, longitude: 0 },
    {
      name: "x".repeat(61),
      message: "hello",
      city: "test",
      latitude: 0,
      longitude: 0,
    },
  ]) {
    expect(
      (await request.post("/api/greetings", { data: payload })).status(),
    ).toBe(400);
  }
  expect(
    (
      await request.post("/api/greetings", {
        data: "{broken",
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get("/api/greetings?radius=-1")).status()).toBe(400);
  const near = await (
    await request.get(
      "/api/greetings?latitude=39.7392&longitude=-104.9903&radius=1",
    )
  ).json();
  expect(near.greetings.length).toBeGreaterThanOrEqual(1);
  expect(
    near.greetings.every(
      (g: { city: string; distance: number }) =>
        g.city === "Denver" && g.distance <= 1,
    ),
  ).toBeTruthy();
  const literal = await (
    await request.get("/api/greetings", { params: { search: "' OR 1=1 --" } })
  ).json();
  expect(literal.greetings).toHaveLength(0);
});
test("a hello is saved through the UI and survives reload", async ({
  page,
}) => {
  const uniqueName = `Explorer ${Date.now()}`;
  await page.goto("/#world");
  await page
    .getByRole("button", { name: "Add your hello", exact: true })
    .first()
    .click();
  await page.getByLabel(/^Your name/).fill(uniqueName);
  await page.getByLabel("Your city", { exact: true }).selectOption("1");
  await page
    .getByLabel("Your hello", { exact: true })
    .fill("A persistent hello from the browser test.");
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/greetings") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send hello", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  createdIds.push((await response.json()).id);
  await expect(
    page.locator(".greeting-card").filter({ hasText: uniqueName }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".greeting-card").filter({ hasText: uniqueName }),
  ).toBeVisible();
  await page.getByLabel("Search greetings").fill(uniqueName);
  await expect(page.locator(".greeting-card")).toHaveCount(1);
  await page.getByLabel("Search radius").selectOption("1000");
  await expect(page.getByText("No hellos in this orbit yet.")).toBeVisible();
});
test("all 48 component examples mount without runtime failures", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#components");
  await expect(page.locator("[data-demo]")).toHaveCount(48);
  await page.locator("[data-demo]").last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(page.locator(".demo-error")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.locator("#catalog-search").fill("GlassDataGrid");
  await expect(page.locator("[data-demo]")).toHaveCount(1);
  await page.getByRole("button", { name: "View code", exact: true }).click();
  await expect(page.locator(".demo-code")).toContainText("GlassDataGrid");
  const mission = page.getByRole("columnheader", {
    name: /^Mission/,
  });
  await mission.click();
  await expect(mission).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator("[data-demo] tbody tr").first()).toContainText(
    "Cassini",
  );
  await mission.press("Enter");
  await expect(mission).toHaveAttribute("aria-sort", "descending");
  await expect(page.locator("[data-demo] tbody tr").first()).toContainText(
    "Voyager",
  );
  const tableFits = await page
    .locator("[data-demo] table")
    .evaluate((table) => {
      const surface =
        table.parentElement!.parentElement!.getBoundingClientRect();
      return table.getBoundingClientRect().bottom <= surface.bottom;
    });
  expect(tableFits).toBeTruthy();
  await expect(page.locator(".demo-error")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("overlay dismissal and keyboard slider interaction work", async ({
  page,
}) => {
  await page.goto("/#components");
  await page.getByRole("button", { name: "Open dialog", exact: true }).click();
  await expect(
    page.getByText("Hello, explorer.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Hello, explorer.", { exact: true }),
  ).not.toBeVisible();
  await page.locator("#catalog-search").fill("Sliders & rating");
  const slider = page.getByRole("slider", { name: "Signal strength" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "65");
});
test("laboratory controls update the actual material and recipe", async ({
  page,
}) => {
  await page.goto("/#playground");
  const slider = page.getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("End");
  await expect(page.locator(".material-card")).toHaveCSS(
    "backdrop-filter",
    "blur(40px)",
  );
  await expect(page.locator(".code-panel pre")).toContainText("blur(40px)");
  await page.getByRole("button", { name: "heat", exact: true }).click();
  await expect(page.locator(".code-panel pre")).toContainText("HeatGlass");
  await page.getByRole("button", { name: "Reset material" }).click();
  await expect(page.locator(".code-panel pre")).toContainText("blur(18px)");
});
test("desktop layout and mobile navigation fit their viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hello, world. Meet glass." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, world. Meet glass." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Hello, world" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello from everywhere." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/mobile-world.png",
    fullPage: true,
  });
});

test("magnetic interactions honor operating-system reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const magneticButton = page.locator(".motion-feature button").first();
  await magneticButton.hover();
  await expect(magneticButton).toHaveCSS("transform", "none");
});

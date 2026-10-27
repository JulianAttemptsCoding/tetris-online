const { test, expect } = require("@playwright/test");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
});

test("desktop controls, settings, typing, and pause work without browser errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#gameStatus")).toHaveText("PRESS START");
  await page.locator("#start").click();
  await page.keyboard.press("x");
  expect(
    await page.evaluate(() => window.__tetrisTest.snapshot().piece.rotation),
  ).toBe(1);
  await page.locator("#name").fill("xyz");
  expect(await page.locator("#name").inputValue()).toBe("xyz");
  await page.locator("#pause").click();
  await expect(page.locator("#gameStatus")).toHaveText("PAUSED");
  await page.locator("#pause").click();
  await page.locator("#settings").click();
  await expect(page.locator("#gameStatus")).toHaveText("PAUSED");
  await page.locator('[data-action="left"]').press("a");
  await page.reload();
  await page.locator("#settings").click();
  await expect(page.locator('[data-action="left"]')).toHaveValue("a");
  expect(errors).toEqual([]);
});

test("two browsers join, see active boards, switch rooms, and leave", async ({
  browser,
}) => {
  const a = await browser.newPage(),
    b = await browser.newPage();
  const errors = [];
  for (const page of [a, b])
    page.on("pageerror", (error) => errors.push(error.message));
  await a.goto("/?room=E2E123");
  await b.goto("/?room=E2E123");
  await a.locator("#name").fill("Alice");
  await b.locator("#name").fill("Bob");
  await a.locator("#join").click();
  await b.locator("#join").click();
  await expect(a.locator(".player")).toHaveCount(2);
  await expect(b.locator(".player")).toHaveCount(2);
  await b.locator("#start").click();
  await expect(a.locator("#players")).toContainText("Bob — 0 · PLAYING");
  // A falling piece is visible before any piece has locked.
  expect(
    await a
      .locator(".player")
      .filter({ hasText: "Bob" })
      .locator("canvas")
      .evaluate((canvas) => {
        const pixels = canvas.getContext("2d").getImageData(0, 0, 80, 160).data;
        let cells = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] !== 2 || pixels[i + 1] !== 8 || pixels[i + 2] !== 23)
            cells++;
        return cells;
      }),
  ).toBeGreaterThan(0);
  await a.locator("#room").fill("OTHER");
  await a.locator("#join").click();
  await expect(b.locator(".player")).toHaveCount(1);
  await a.locator("#leave").click();
  await expect(a.locator(".player")).toHaveCount(0);
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});

test("mobile fits the viewport and pointer controls move and rotate", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator('[data-touch="rotateCW"]').tap();
  const state = await page.evaluate(() => window.__tetrisTest.snapshot());
  expect(state.piece.rotation).toBe(1);
  await page.locator('[data-touch="left"]').tap();
  expect(
    await page.evaluate(() => window.__tetrisTest.snapshot().piece.x),
  ).toBe(state.piece.x - 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.close();
});

test("peer bundle exports the pinned real Trystero API without a CDN", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(
      async () => typeof (await import("/vendor/trystero.js")).joinRoom,
    ),
  ).toBe("function");
});

test("solo loop keeps running while multiplayer script loads slowly", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/multiplayer.js*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto("/");
  await page.locator("#start").click();
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(() => page.evaluate(() => window.__tetrisTest.snapshot().piece.y))
    .toBeGreaterThan(0);
  await page.keyboard.up("ArrowDown");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});

test("browser automatically rejoins its room after network loss", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("/?room=REJOIN");
    await page.locator("#name").fill("Reconnect");
    await page.locator("#join").click();
    await expect(page.locator("#roomStatus")).toContainText("connected.");
    await context.setOffline(true);
    await expect(page.locator("#roomStatus")).toContainText("reconnecting");
    await context.setOffline(false);
    await expect(page.locator("#roomStatus")).toContainText("connected.", {
      timeout: 15000,
    });
    await expect(page.locator(".player")).toHaveCount(1);
  } finally {
    await context.close();
  }
});

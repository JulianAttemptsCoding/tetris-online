const { test, expect } = require("@playwright/test");

test("real WebRTC peers exchange boards through public signaling", async ({
  browser,
}) => {
  test.skip(
    !process.env.LIVE_PEER_TEST,
    "Opt-in: depends on public Nostr relays and network access.",
  );
  test.setTimeout(60000);
  const pages = [];
  try {
    for (const name of ["Alice", "Bob"]) {
      const page = await browser.newPage();
      pages.push(page);
      // Serve local build under a secure Pages origin to exercise the actual Pages transport.
      await page.route(
        "https://julianattemptscoding.github.io/tetris-online/**",
        async (route) => {
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url:
              "http://127.0.0.1:3100/" +
              url.pathname.replace("/tetris-online/", "") +
              url.search,
          });
          await route.fulfill({ response });
        },
      );
      await page.goto("https://julianattemptscoding.github.io/tetris-online/");
      await page.locator("#name").fill(name);
      await page.locator("#room").fill("LIVE" + String(Date.now()).slice(-4));
    }
    const room = "QA" + String(Date.now()).slice(-6);
    for (const page of pages) {
      await page.locator("#room").fill(room);
      await page.locator("#join").click();
    }
    for (const page of pages)
      await expect(page.locator(".player")).toHaveCount(2, { timeout: 45000 });
    await pages[1].locator("#start").click();
    await expect(pages[0].locator("#players")).toContainText(
      "Bob — 0 · PLAYING",
    );
    await pages[1].locator("#leave").click();
    await expect(pages[0].locator(".player")).toHaveCount(1);
  } finally {
    for (const page of pages) await page.close();
  }
});

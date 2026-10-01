import assert from "node:assert/strict";
import test from "node:test";
import { createApplication } from "../src/app.js";

test("GET /health répond avec un état observable", async (context) => {
  const server = createApplication();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

import test from "node:test";
import assert from "node:assert/strict";
import { duree } from "../src/duree.js";
test("durée estimée", () => assert.equal(duree(12, 900), "6 h"));

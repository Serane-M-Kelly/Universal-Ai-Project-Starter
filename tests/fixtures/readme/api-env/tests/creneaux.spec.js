import test from "node:test";
import assert from "node:assert/strict";
import { creneauxLibres } from "../src/creneaux.js";
test("créneaux libres", () => assert.deepEqual(creneauxLibres(["09:00", "10:00"], ["09:00"]), ["10:00"]));

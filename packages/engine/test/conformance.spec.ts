import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compileMatrix,
  createDeterministicHost,
  executeMatrixSync,
} from "../src";
import {
  approvedInput,
  creditOriginationMatrix,
  declinedInput,
} from "./fixtures/credit-origination";

/**
 * Conformance contract: with a deterministic host, a given {matrix, input}
 * must produce this exact event log — byte for byte. These golden files are
 * the language-agnostic spec the future Rust engine must reproduce.
 *
 * Regenerate intentionally with: UPDATE_GOLDEN=1 pnpm test
 */
const GOLDEN_DIR = join(__dirname, "fixtures", "golden");

function produceLog(input: Record<string, unknown>) {
  const { plan } = compileMatrix(creditOriginationMatrix);
  const log = executeMatrixSync(plan!, input, {
    host: createDeterministicHost(),
  });
  return JSON.stringify(log, null, 2) + "\n";
}

function checkGolden(name: string, actual: string) {
  const file = join(GOLDEN_DIR, name);
  if (process.env["UPDATE_GOLDEN"] === "1" || !existsSync(file)) {
    writeFileSync(file, actual);
    return;
  }
  expect(actual).toBe(readFileSync(file, "utf8"));
}

describe("conformance golden fixtures", () => {
  it("credit-origination / approved applicant", () => {
    checkGolden("credit-origination.approved.json", produceLog(approvedInput));
  });

  it("credit-origination / declined applicant", () => {
    checkGolden("credit-origination.declined.json", produceLog(declinedInput));
  });
});

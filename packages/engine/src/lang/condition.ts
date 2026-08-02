import { Value } from "./value";

/**
 * Decision-table condition shorthand, compiled once at plan time.
 *
 * Grammar of a condition cell:
 *   ''            → wildcard (always matches)
 *   'true'/'false'→ boolean match (accepts the boolean or its string form)
 *   '>= X' '<= X' '> X' '< X'  → numeric comparison (non-numeric operands never match)
 *   '!= X' '<> X' → inequality
 *   '== X' '= X'  → equality
 *   'X'           → bare literal, same as '== X'
 *
 * Equality semantics (legacy-compatible): numeric compare when both sides are
 * numeric-coercible, otherwise case-insensitive string compare with optional
 * quotes stripped from the target.
 */
export type ConditionOp =
  | "wildcard"
  | "bool_true"
  | "bool_false"
  | ">="
  | "<="
  | ">"
  | "<"
  | "!="
  | "==";

export interface CompiledCondition {
  op: ConditionOp;
  /** Raw right-hand side (trimmed, quotes stripped for equality ops) */
  target: string;
  /** Pre-parsed numeric target when coercible */
  targetNum: number | null;
  /** Original condition source string, for observability events */
  source: string;
  test(actual: Value): boolean;
}

/** Numeric coercion: numbers pass through; non-empty numeric strings coerce; all else null. */
function numericOf(v: Value | string): number | null {
  if (typeof v === "number") return Number.isNaN(v) ? null : v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"]|['"]$/g, "");
}

export function compileCondition(
  source: string | undefined | null,
): CompiledCondition {
  const raw = source == null ? "" : String(source);
  const cond = raw.trim();

  const make = (
    op: ConditionOp,
    target: string,
    test: (actual: Value) => boolean,
  ): CompiledCondition => ({
    op,
    target,
    targetNum: numericOf(target),
    source: raw,
    test,
  });

  if (cond === "") {
    return make("wildcard", "", () => true);
  }

  const lower = cond.toLowerCase();
  if (lower === "true") {
    return make(
      "bool_true",
      "true",
      (actual) => actual === true || actual === "true",
    );
  }
  if (lower === "false") {
    return make(
      "bool_false",
      "false",
      (actual) => actual === false || actual === "false",
    );
  }

  // Ordered numeric comparisons
  for (const op of [">=", "<=", ">", "<"] as const) {
    if (
      cond.startsWith(op) &&
      !(
        (op === ">" && cond[1] === "=") ||
        (op === "<" && (cond[1] === "=" || cond[1] === ">"))
      )
    ) {
      const target = cond.slice(op.length).trim();
      const targetNum = numericOf(target);
      return make(op, target, (actual) => {
        if (targetNum === null) return false;
        const actualNum = numericOf(actual);
        if (actualNum === null) return false;
        switch (op) {
          case ">=":
            return actualNum >= targetNum;
          case "<=":
            return actualNum <= targetNum;
          case ">":
            return actualNum > targetNum;
          case "<":
            return actualNum < targetNum;
        }
      });
    }
  }

  const equalityTest =
    (target: string, targetNum: number | null) =>
    (actual: Value): boolean => {
      if (targetNum !== null) {
        const actualNum = numericOf(actual);
        if (actualNum !== null) return actualNum === targetNum;
      }
      return String(actual).toLowerCase() === target.toLowerCase();
    };

  if (cond.startsWith("!=") || cond.startsWith("<>")) {
    const target = stripQuotes(cond.slice(2).trim());
    const eq = equalityTest(target, numericOf(target));
    return make("!=", target, (actual) => !eq(actual));
  }

  if (cond.startsWith("==") || cond.startsWith("=")) {
    const target = stripQuotes(cond.replace(/^==?/, "").trim());
    return make("==", target, equalityTest(target, numericOf(target)));
  }

  // Bare literal → equality
  const target = stripQuotes(cond);
  return make("==", target, equalityTest(target, numericOf(target)));
}

/**
 * Mutation literal coercion, applied once at compile time: the editor stores
 * every mutation value as a string; 'true'/'false' become booleans and numeric
 * strings become numbers (legacy-compatible).
 */
export function coerceMutationValue(v: unknown): Value {
  if (typeof v === "string") {
    if (v === "true") return true;
    if (v === "false") return false;
    if (v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    return v;
  }
  if (v === undefined) return null;
  return v as Value;
}

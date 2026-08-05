import { describe, expect, it } from "vitest";
import { evaluate, parseExpression, scopeFromObject } from "../src";

function exec(exprStr: string, vars: Record<string, any> = {}): any {
  const ast = parseExpression(exprStr);
  return evaluate(ast, scopeFromObject(vars));
}

describe("TEL Builtin Function Library", () => {
  describe("Math Functions", () => {
    it("evaluates min & max with numbers and arrays", () => {
      expect(exec("min(10, 5, 20)")).toBe(5);
      expect(exec("max(10, 5, 20)")).toBe(20);
      expect(exec("min([10, 5, 20])")).toBe(5);
      expect(exec("max([10, 5, 20])")).toBe(20);
      expect(exec("min(x, 100)", { x: 50 })).toBe(50);
    });

    it("evaluates floor, ceil, round, abs", () => {
      expect(exec("floor(5.9)")).toBe(5);
      expect(exec("ceil(5.1)")).toBe(6);
      expect(exec("ceiling(5.1)")).toBe(6);
      expect(exec("round(5.678, 2)")).toBe(5.68);
      expect(exec("round(5.678)")).toBe(6);
      expect(exec("abs(-42)")).toBe(42);
    });

    it("evaluates sqrt, pow, clamp, log, exp", () => {
      expect(exec("sqrt(16)")).toBe(4);
      expect(exec("pow(2, 3)")).toBe(8);
      expect(exec("clamp(150, 0, 100)")).toBe(100);
      expect(exec("clamp(-10, 0, 100)")).toBe(0);
      expect(exec("clamp(50, 0, 100)")).toBe(50);
      expect(exec("round(log(2.718281828459045), 2)")).toBe(1);
      expect(exec("round(exp(1), 2)")).toBe(2.72);
    });
  });

  describe("String Functions", () => {
    it("evaluates lower, upper, trim, concat, length", () => {
      expect(exec("lower('HELLO')")).toBe("hello");
      expect(exec("upper('world')")).toBe("WORLD");
      expect(exec("trim('  space  ')")).toBe("space");
      expect(exec("concat('Foo', 'Bar', 123)")).toBe("FooBar123");
      expect(exec("length('hello')")).toBe(5);
      expect(exec("length([1, 2, 3])")).toBe(3);
    });

    it("evaluates startsWith, endsWith, substring, replace", () => {
      expect(exec("startsWith('hello world', 'hello')")).toBe(true);
      expect(exec("endsWith('hello world', 'world')")).toBe(true);
      expect(exec("substring('hello world', 0, 5)")).toBe("hello");
      expect(exec("replace('foo bar foo', 'foo', 'baz')")).toBe("baz bar baz");
    });
  });

  describe("Collection & Array Functions", () => {
    it("evaluates sum, avg, count, first, last, join", () => {
      expect(exec("sum(10, 20, 30)")).toBe(60);
      expect(exec("sum([10, 20, 30])")).toBe(60);
      expect(exec("avg([10, 20, 30])")).toBe(20);
      expect(exec("count([1, 2, 3, 4])")).toBe(4);
      expect(exec("first([10, 20, 30])")).toBe(10);
      expect(exec("last([10, 20, 30])")).toBe(30);
      expect(exec("join(['a', 'b', 'c'], '-')")).toBe("a-b-c");
    });
  });

  describe("Utility & Coercion Functions", () => {
    it("evaluates coalesce and default", () => {
      expect(exec("coalesce(null, null, 'first', 'second')")).toBe("first");
      expect(exec("default(val, 'fallback')", { val: null })).toBe("fallback");
      expect(exec("default(val, 'fallback')", { val: "actual" })).toBe(
        "actual",
      );
    });

    it("evaluates toString, toNumber, toBoolean", () => {
      expect(exec("toString(123)")).toBe("123");
      expect(exec("toNumber('45.5')")).toBe(45.5);
      expect(exec("toBoolean('true')")).toBe(true);
      expect(exec("toBoolean(0)")).toBe(false);
    });

    it("evaluates nested function calls and math expressions", () => {
      expect(
        exec("min(floor(score * 1.1), max(minLimit, 800))", {
          score: 720,
          minLimit: 750,
        }),
      ).toBe(792);
    });
  });
});

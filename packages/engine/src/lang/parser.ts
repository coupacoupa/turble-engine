import { BinaryOp, Expr, UnaryOp } from "./ast";
import { TelSyntaxError } from "./errors";
import { Token, tokenize } from "./lexer";

/**
 * Pratt parser for TEL. Precedence (low → high):
 *   ?:  (right-assoc)
 *   ||
 *   &&
 *   == !=
 *   < <= > >= in contains
 *   + -
 *   * / %
 *   unary ! -
 *   postfix .prop [idx]
 *   literals, identifiers, (expr)
 */
const BINARY_PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  in: 4,
  contains: 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

const KEYWORD_LITERALS: Record<string, Expr> = {
  true: { kind: "lit", value: true },
  false: { kind: "lit", value: false },
  null: { kind: "lit", value: null },
};

class Parser {
  private tokens: Token[];
  private idx = 0;

  constructor(src: string) {
    this.tokens = tokenize(src);
  }

  private peek(): Token {
    return this.tokens[this.idx]!;
  }

  private next(): Token {
    return this.tokens[this.idx++]!;
  }

  private expectOp(text: string): void {
    const t = this.next();
    if (t.type !== "op" || t.text !== text) {
      throw new TelSyntaxError(
        `Expected '${text}' but found '${t.text || "end of input"}'`,
        t.pos,
      );
    }
  }

  parseExpression(): Expr {
    const expr = this.parseTernary();
    const t = this.peek();
    if (t.type !== "eof") {
      throw new TelSyntaxError(`Unexpected trailing input '${t.text}'`, t.pos);
    }
    return expr;
  }

  private parseTernary(): Expr {
    const test = this.parseBinary(0);
    const t = this.peek();
    if (t.type === "op" && t.text === "?") {
      this.next();
      const then = this.parseTernary();
      this.expectOp(":");
      const otherwise = this.parseTernary();
      return { kind: "cond", test, then, else: otherwise };
    }
    return test;
  }

  private binaryOpOf(t: Token): BinaryOp | undefined {
    if (t.type === "op" && t.text in BINARY_PRECEDENCE)
      return t.text as BinaryOp;
    if (t.type === "ident" && (t.text === "in" || t.text === "contains"))
      return t.text;
    return undefined;
  }

  private parseBinary(minPrec: number): Expr {
    let left = this.parseUnary();
    for (;;) {
      const op = this.binaryOpOf(this.peek());
      if (op === undefined) return left;
      const prec = BINARY_PRECEDENCE[op]!;
      if (prec < minPrec) return left;
      this.next();
      const right = this.parseBinary(prec + 1); // left-assoc
      left = { kind: "bin", op, left, right };
    }
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.type === "op" && (t.text === "!" || t.text === "-")) {
      this.next();
      return {
        kind: "unary",
        op: t.text as UnaryOp,
        operand: this.parseUnary(),
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.type === "op" && t.text === ".") {
        this.next();
        const prop = this.next();
        if (prop.type !== "ident") {
          throw new TelSyntaxError(
            `Expected property name after '.'`,
            prop.pos,
          );
        }
        expr = { kind: "member", obj: expr, prop: prop.text };
        continue;
      }
      if (t.type === "op" && t.text === "[") {
        this.next();
        const idx = this.parseTernary();
        this.expectOp("]");
        expr = { kind: "index", obj: expr, idx };
        continue;
      }
      return expr;
    }
  }

  private parsePrimary(): Expr {
    const t = this.next();
    if (t.type === "num") return { kind: "lit", value: t.num! };
    if (t.type === "str") return { kind: "lit", value: t.text };
    if (t.type === "ident") {
      if (Object.prototype.hasOwnProperty.call(KEYWORD_LITERALS, t.text)) {
        return KEYWORD_LITERALS[t.text]!;
      }
      if (t.text === "in" || t.text === "contains") {
        throw new TelSyntaxError(
          `'${t.text}' is an operator and cannot start an expression`,
          t.pos,
        );
      }
      // Function call: fn(arg1, arg2, ...)
      if (this.peek().type === "op" && this.peek().text === "(") {
        this.next(); // consume '('
        const args: Expr[] = [];
        if (this.peek().type !== "op" || this.peek().text !== ")") {
          for (;;) {
            args.push(this.parseTernary());
            if (this.peek().type === "op" && this.peek().text === ",") {
              this.next();
              continue;
            }
            break;
          }
        }
        this.expectOp(")");
        return { kind: "call", fn: t.text, args };
      }
      return { kind: "var", name: t.text };
    }
    if (t.type === "op" && t.text === "(") {
      const inner = this.parseTernary();
      this.expectOp(")");
      return inner;
    }
    if (t.type === "op" && t.text === "[") {
      const elements: Expr[] = [];
      if (this.peek().type !== "op" || this.peek().text !== "]") {
        for (;;) {
          elements.push(this.parseTernary());
          if (this.peek().type === "op" && this.peek().text === ",") {
            this.next();
            continue;
          }
          break;
        }
      }
      this.expectOp("]");
      return { kind: "array", elements };
    }
    throw new TelSyntaxError(`Unexpected '${t.text || "end of input"}'`, t.pos);
  }
}

/** Parse a TEL source string into an AST. Throws TelSyntaxError on invalid input. */
export function parseExpression(src: string): Expr {
  return new Parser(src).parseExpression();
}

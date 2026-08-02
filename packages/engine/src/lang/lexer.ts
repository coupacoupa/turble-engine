import { TelSyntaxError } from "./errors";

export type TokenType = "num" | "str" | "ident" | "op" | "eof";

export interface Token {
  type: TokenType;
  /** Raw operator/punctuation text, identifier name, or string value */
  text: string;
  /** Parsed numeric value for 'num' tokens */
  num?: number;
  pos: number;
}

const TWO_CHAR_OPS = new Set(["||", "&&", "==", "!=", "<=", ">="]);
const ONE_CHAR_OPS = new Set([
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
  "?",
  ":",
  "(",
  ")",
  "[",
  "]",
  ".",
  ",",
]);

const isDigit = (c: string) => c >= "0" && c <= "9";
const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_$]/.test(c);

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i]!;

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    // Numbers: 12, 12.5, 1e3, 1.5e-2
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? ""))) {
      const start = i;
      while (i < src.length && isDigit(src[i]!)) i++;
      if (src[i] === "." && isDigit(src[i + 1] ?? "")) {
        i++;
        while (i < src.length && isDigit(src[i]!)) i++;
      }
      if (src[i] === "e" || src[i] === "E") {
        let j = i + 1;
        if (src[j] === "+" || src[j] === "-") j++;
        if (isDigit(src[j] ?? "")) {
          i = j;
          while (i < src.length && isDigit(src[i]!)) i++;
        }
      }
      const text = src.slice(start, i);
      tokens.push({ type: "num", text, num: Number(text), pos: start });
      continue;
    }

    // Strings: single or double quoted with escapes
    if (c === "'" || c === '"') {
      const quote = c;
      const start = i;
      i++;
      let out = "";
      let closed = false;
      while (i < src.length) {
        const ch = src[i]!;
        if (ch === "\\") {
          const esc = src[i + 1];
          if (esc === undefined)
            throw new TelSyntaxError("Unterminated escape sequence", i);
          if (esc === "n") out += "\n";
          else if (esc === "t") out += "\t";
          else if (esc === "r") out += "\r";
          else out += esc; // \' \" \\ and any other char literally
          i += 2;
          continue;
        }
        if (ch === quote) {
          closed = true;
          i++;
          break;
        }
        out += ch;
        i++;
      }
      if (!closed)
        throw new TelSyntaxError("Unterminated string literal", start);
      tokens.push({ type: "str", text: out, pos: start });
      continue;
    }

    // Identifiers & keywords
    if (isIdentStart(c)) {
      const start = i;
      while (i < src.length && isIdentPart(src[i]!)) i++;
      tokens.push({ type: "ident", text: src.slice(start, i), pos: start });
      continue;
    }

    // Operators
    const two = src.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      tokens.push({ type: "op", text: two, pos: i });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(c)) {
      tokens.push({ type: "op", text: c, pos: i });
      i++;
      continue;
    }

    throw new TelSyntaxError(`Unexpected character '${c}'`, i);
  }

  tokens.push({ type: "eof", text: "", pos: src.length });
  return tokens;
}

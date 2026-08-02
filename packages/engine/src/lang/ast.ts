import { Value } from "./value";

export type BinaryOp =
  | "||"
  | "&&"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "contains"
  | "+"
  | "-"
  | "*"
  | "/"
  | "%";

export type UnaryOp = "!" | "-";

export type Expr =
  | { kind: "lit"; value: Value }
  | { kind: "var"; name: string }
  | { kind: "member"; obj: Expr; prop: string }
  | { kind: "index"; obj: Expr; idx: Expr }
  | { kind: "unary"; op: UnaryOp; operand: Expr }
  | { kind: "bin"; op: BinaryOp; left: Expr; right: Expr }
  | { kind: "cond"; test: Expr; then: Expr; else: Expr };

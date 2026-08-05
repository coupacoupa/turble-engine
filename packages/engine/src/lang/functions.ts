import { TelRuntimeError } from "./errors";
import { typeName, Value } from "./value";

export interface FunctionMetadata {
  name: string;
  category: "Math" | "String" | "Collection" | "Utility" | "Coercion";
  description: string;
  signature: string;
  snippet: string;
}

export type BuiltinFn = (args: Value[]) => Value;

function flattenNumericArgs(args: Value[]): number[] {
  const nums: number[] = [];
  for (const arg of args) {
    if (typeof arg === "number" && !Number.isNaN(arg)) {
      nums.push(arg);
    } else if (Array.isArray(arg)) {
      for (const item of arg) {
        if (typeof item === "number" && !Number.isNaN(item)) {
          nums.push(item);
        }
      }
    }
  }
  return nums;
}

export const BUILTIN_FUNCTIONS: Record<string, BuiltinFn> = {
  // --- Math Functions ---
  min: (args) => {
    const nums = flattenNumericArgs(args);
    if (nums.length === 0) return null;
    return Math.min(...nums);
  },
  max: (args) => {
    const nums = flattenNumericArgs(args);
    if (nums.length === 0) return null;
    return Math.max(...nums);
  },
  floor: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n))
      throw new TelRuntimeError(
        `floor() requires a number, got ${typeName(args[0])}`,
      );
    return Math.floor(n);
  },
  ceil: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n))
      throw new TelRuntimeError(
        `ceil() requires a number, got ${typeName(args[0])}`,
      );
    return Math.ceil(n);
  },
  ceiling: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n))
      throw new TelRuntimeError(
        `ceiling() requires a number, got ${typeName(args[0])}`,
      );
    return Math.ceil(n);
  },
  round: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n))
      throw new TelRuntimeError(
        `round() requires a number, got ${typeName(args[0])}`,
      );
    const decimals =
      args[1] !== undefined && args[1] !== null ? Number(args[1]) : 0;
    if (Number.isNaN(decimals))
      throw new TelRuntimeError(`round() decimals must be a number`);
    const factor = Math.pow(10, Math.floor(decimals));
    return Math.round(n * factor) / factor;
  },
  abs: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n))
      throw new TelRuntimeError(
        `abs() requires a number, got ${typeName(args[0])}`,
      );
    return Math.abs(n);
  },
  sqrt: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n) || n < 0)
      throw new TelRuntimeError(`sqrt() requires a non-negative number`);
    return Math.sqrt(n);
  },
  pow: (args) => {
    if (args.length < 2)
      throw new TelRuntimeError(
        `pow() requires 2 arguments: pow(base, exponent)`,
      );
    const base = Number(args[0]);
    const exp = Number(args[1]);
    if (Number.isNaN(base) || Number.isNaN(exp))
      throw new TelRuntimeError(`pow() requires numeric arguments`);
    return Math.pow(base, exp);
  },
  clamp: (args) => {
    if (args.length < 3)
      throw new TelRuntimeError(
        `clamp() requires 3 arguments: clamp(val, min, max)`,
      );
    const val = Number(args[0]);
    const min = Number(args[1]);
    const max = Number(args[2]);
    if (Number.isNaN(val) || Number.isNaN(min) || Number.isNaN(max))
      throw new TelRuntimeError(`clamp() requires numeric arguments`);
    return Math.min(Math.max(val, min), max);
  },
  log: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n) || n <= 0)
      throw new TelRuntimeError(`log() requires a positive number`);
    return Math.log(n);
  },
  exp: (args) => {
    if (args.length === 0 || args[0] === null) return null;
    const n = Number(args[0]);
    if (Number.isNaN(n)) throw new TelRuntimeError(`exp() requires a number`);
    return Math.exp(n);
  },

  // --- String Functions ---
  lower: (args) => {
    if (args.length === 0 || args[0] === null) return "";
    return String(args[0]).toLowerCase();
  },
  upper: (args) => {
    if (args.length === 0 || args[0] === null) return "";
    return String(args[0]).toUpperCase();
  },
  trim: (args) => {
    if (args.length === 0 || args[0] === null) return "";
    return String(args[0]).trim();
  },
  concat: (args) => {
    return args.map((a) => (a === null ? "" : String(a))).join("");
  },
  length: (args) => {
    if (args.length === 0 || args[0] === null) return 0;
    const target = args[0];
    if (typeof target === "string" || Array.isArray(target))
      return target.length;
    return String(target).length;
  },
  startswith: (args) => {
    if (args.length < 2)
      throw new TelRuntimeError(
        `startsWith() requires 2 arguments: startsWith(str, prefix)`,
      );
    const str = args[0] === null ? "" : String(args[0]);
    const prefix = args[1] === null ? "" : String(args[1]);
    return str.startsWith(prefix);
  },
  endswith: (args) => {
    if (args.length < 2)
      throw new TelRuntimeError(
        `endsWith() requires 2 arguments: endsWith(str, suffix)`,
      );
    const str = args[0] === null ? "" : String(args[0]);
    const suffix = args[1] === null ? "" : String(args[1]);
    return str.endsWith(suffix);
  },
  substring: (args) => {
    if (args.length < 2)
      throw new TelRuntimeError(
        `substring() requires at least 2 arguments: substring(str, start, [end])`,
      );
    const str = args[0] === null ? "" : String(args[0]);
    const start = Number(args[1]);
    if (Number.isNaN(start))
      throw new TelRuntimeError(`substring() start index must be a number`);
    if (args[2] !== undefined && args[2] !== null) {
      const end = Number(args[2]);
      if (Number.isNaN(end))
        throw new TelRuntimeError(`substring() end index must be a number`);
      return str.substring(start, end);
    }
    return str.substring(start);
  },
  replace: (args) => {
    if (args.length < 3)
      throw new TelRuntimeError(
        `replace() requires 3 arguments: replace(str, search, replacement)`,
      );
    const str = args[0] === null ? "" : String(args[0]);
    const search = args[1] === null ? "" : String(args[1]);
    const replacement = args[2] === null ? "" : String(args[2]);
    return str.replaceAll(search, replacement);
  },

  // --- Collection / Array Functions ---
  sum: (args) => {
    const nums = flattenNumericArgs(args);
    return nums.reduce((acc, curr) => acc + curr, 0);
  },
  avg: (args) => {
    const nums = flattenNumericArgs(args);
    if (nums.length === 0) return 0;
    return nums.reduce((acc, curr) => acc + curr, 0) / nums.length;
  },
  count: (args) => {
    if (args.length === 0 || args[0] === null) return 0;
    if (Array.isArray(args[0])) return args[0].length;
    return 1;
  },
  first: (args) => {
    if (args.length === 0 || args[0] === null || args[0] === undefined)
      return null;
    if (Array.isArray(args[0]))
      return args[0].length > 0 ? (args[0][0] ?? null) : null;
    return args[0];
  },
  last: (args) => {
    if (args.length === 0 || args[0] === null || args[0] === undefined)
      return null;
    if (Array.isArray(args[0]))
      return args[0].length > 0 ? (args[0][args[0].length - 1] ?? null) : null;
    return args[0];
  },
  join: (args) => {
    if (args.length === 0 || args[0] === null) return "";
    const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
    const sep =
      args[1] !== undefined && args[1] !== null ? String(args[1]) : ",";
    return arr.map((item) => (item === null ? "" : String(item))).join(sep);
  },

  // --- Utility & Coercion Functions ---
  coalesce: (args) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined) return arg;
    }
    return null;
  },
  default: (args) => {
    if (args.length < 2)
      throw new TelRuntimeError(
        `default() requires 2 arguments: default(val, fallback)`,
      );
    const val = args[0];
    return val !== null && val !== undefined ? val : args[1]!;
  },
  tostring: (args) => {
    if (args.length === 0 || args[0] === null) return "";
    return typeof args[0] === "object"
      ? JSON.stringify(args[0])
      : String(args[0]);
  },
  tonumber: (args) => {
    if (args.length === 0 || args[0] === null) return 0;
    const n = Number(args[0]);
    return Number.isNaN(n) ? 0 : n;
  },
  toboolean: (args) => {
    if (args.length === 0 || args[0] === null) return false;
    if (typeof args[0] === "boolean") return args[0];
    if (typeof args[0] === "string")
      return args[0].toLowerCase() === "true" || args[0] === "1";
    return Boolean(args[0]);
  },
  now: () => Date.now(),
};

/** Metadata for client Intellisense completion and docs */
export const FUNCTION_METADATA: FunctionMetadata[] = [
  // Math
  {
    name: "min",
    category: "Math",
    description: "Returns the minimum value from numbers or an array.",
    signature: "min(...values | array)",
    snippet: "min(${1:a}, ${2:b})",
  },
  {
    name: "max",
    category: "Math",
    description: "Returns the maximum value from numbers or an array.",
    signature: "max(...values | array)",
    snippet: "max(${1:a}, ${2:b})",
  },
  {
    name: "floor",
    category: "Math",
    description: "Rounds a number down to the nearest integer.",
    signature: "floor(number)",
    snippet: "floor(${1:val})",
  },
  {
    name: "ceil",
    category: "Math",
    description: "Rounds a number up to the nearest integer.",
    signature: "ceil(number)",
    snippet: "ceil(${1:val})",
  },
  {
    name: "ceiling",
    category: "Math",
    description: "Rounds a number up to the nearest integer.",
    signature: "ceiling(number)",
    snippet: "ceiling(${1:val})",
  },
  {
    name: "round",
    category: "Math",
    description: "Rounds a number to optional decimal places.",
    signature: "round(number, [decimals])",
    snippet: "round(${1:val}, ${2:2})",
  },
  {
    name: "abs",
    category: "Math",
    description: "Returns the absolute value of a number.",
    signature: "abs(number)",
    snippet: "abs(${1:val})",
  },
  {
    name: "sqrt",
    category: "Math",
    description: "Returns the square root of a non-negative number.",
    signature: "sqrt(number)",
    snippet: "sqrt(${1:val})",
  },
  {
    name: "pow",
    category: "Math",
    description: "Returns base raised to exponent.",
    signature: "pow(base, exponent)",
    snippet: "pow(${1:base}, ${2:exp})",
  },
  {
    name: "clamp",
    category: "Math",
    description: "Clamps a value between a minimum and maximum.",
    signature: "clamp(val, min, max)",
    snippet: "clamp(${1:val}, ${2:min}, ${3:max})",
  },
  {
    name: "log",
    category: "Math",
    description: "Returns the natural logarithm of a positive number.",
    signature: "log(number)",
    snippet: "log(${1:val})",
  },
  {
    name: "exp",
    category: "Math",
    description: "Returns e raised to the power of number.",
    signature: "exp(number)",
    snippet: "exp(${1:val})",
  },

  // String
  {
    name: "lower",
    category: "String",
    description: "Converts a string to lowercase.",
    signature: "lower(string)",
    snippet: "lower(${1:str})",
  },
  {
    name: "upper",
    category: "String",
    description: "Converts a string to uppercase.",
    signature: "upper(string)",
    snippet: "upper(${1:str})",
  },
  {
    name: "trim",
    category: "String",
    description: "Trims whitespace from start and end of string.",
    signature: "trim(string)",
    snippet: "trim(${1:str})",
  },
  {
    name: "concat",
    category: "String",
    description: "Concatenates values into a single string.",
    signature: "concat(...values)",
    snippet: "concat(${1:a}, ${2:b})",
  },
  {
    name: "length",
    category: "String",
    description: "Returns the length of a string or array.",
    signature: "length(val)",
    snippet: "length(${1:val})",
  },
  {
    name: "startsWith",
    category: "String",
    description: "Checks if string starts with prefix.",
    signature: "startsWith(str, prefix)",
    snippet: "startsWith(${1:str}, ${2:prefix})",
  },
  {
    name: "endsWith",
    category: "String",
    description: "Checks if string ends with suffix.",
    signature: "endsWith(str, suffix)",
    snippet: "endsWith(${1:str}, ${2:suffix})",
  },
  {
    name: "substring",
    category: "String",
    description: "Extracts a substring from start index to end index.",
    signature: "substring(str, start, [end])",
    snippet: "substring(${1:str}, ${2:0}, ${3:5})",
  },
  {
    name: "replace",
    category: "String",
    description: "Replaces search string occurrences with replacement.",
    signature: "replace(str, search, replacement)",
    snippet: "replace(${1:str}, ${2:search}, ${3:replacement})",
  },

  // Collection
  {
    name: "sum",
    category: "Collection",
    description: "Sums numbers or array of numbers.",
    signature: "sum(...values | array)",
    snippet: "sum(${1:arr})",
  },
  {
    name: "avg",
    category: "Collection",
    description: "Calculates the average of numbers or array.",
    signature: "avg(...values | array)",
    snippet: "avg(${1:arr})",
  },
  {
    name: "count",
    category: "Collection",
    description: "Returns item count of an array.",
    signature: "count(array)",
    snippet: "count(${1:arr})",
  },
  {
    name: "first",
    category: "Collection",
    description: "Returns first element of an array.",
    signature: "first(array)",
    snippet: "first(${1:arr})",
  },
  {
    name: "last",
    category: "Collection",
    description: "Returns last element of an array.",
    signature: "last(array)",
    snippet: "last(${1:arr})",
  },
  {
    name: "join",
    category: "Collection",
    description: "Joins array items with a separator.",
    signature: "join(array, [separator])",
    snippet: 'join(${1:arr}, ${2:", "})',
  },

  // Utility & Coercion
  {
    name: "coalesce",
    category: "Utility",
    description: "Returns the first non-null and non-undefined value.",
    signature: "coalesce(...values)",
    snippet: "coalesce(${1:val1}, ${2:val2})",
  },
  {
    name: "default",
    category: "Utility",
    description: "Returns fallback if value is null or undefined.",
    signature: "default(val, fallback)",
    snippet: "default(${1:val}, ${2:fallback})",
  },
  {
    name: "toString",
    category: "Coercion",
    description: "Converts value to string representation.",
    signature: "toString(val)",
    snippet: "toString(${1:val})",
  },
  {
    name: "toNumber",
    category: "Coercion",
    description: "Converts value to number, defaulting to 0 if invalid.",
    signature: "toNumber(val)",
    snippet: "toNumber(${1:val})",
  },
  {
    name: "toBoolean",
    category: "Coercion",
    description: "Converts value to boolean.",
    signature: "toBoolean(val)",
    snippet: "toBoolean(${1:val})",
  },
  {
    name: "now",
    category: "Utility",
    description: "Returns current timestamp in milliseconds.",
    signature: "now()",
    snippet: "now()",
  },
];

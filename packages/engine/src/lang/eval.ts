import { Expr } from './ast';
import { TelRuntimeError } from './errors';
import { deepEquals, truthy, typeName, Value } from './value';

/** Variable resolution scope. Unknown identifiers evaluate to null. */
export interface Scope {
  get(name: string): Value | undefined;
}

export function scopeFromObject(obj: Record<string, Value>): Scope {
  return {
    get: (name) => (Object.prototype.hasOwnProperty.call(obj, name) ? obj[name] : undefined),
  };
}

function compareOrdered(op: '<' | '<=' | '>' | '>=', a: Value, b: Value): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (op === '<') return a < b;
    if (op === '<=') return a <= b;
    if (op === '>') return a > b;
    return a >= b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    if (op === '<') return a < b;
    if (op === '<=') return a <= b;
    if (op === '>') return a > b;
    return a >= b;
  }
  throw new TelRuntimeError(`Cannot compare ${typeName(a)} ${op} ${typeName(b)}`);
}

function arithmetic(op: '+' | '-' | '*' | '/' | '%', a: Value, b: Value): Value {
  if (op === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TelRuntimeError(`Operator '${op}' requires numbers, got ${typeName(a)} and ${typeName(b)}`);
  }
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return a % b;
  }
}

function containsOp(haystack: Value, needle: Value): boolean {
  if (typeof haystack === 'string') {
    if (typeof needle !== 'string') {
      throw new TelRuntimeError(`'contains' on a string requires a string operand, got ${typeName(needle)}`);
    }
    return haystack.includes(needle);
  }
  if (Array.isArray(haystack)) return haystack.some((el) => deepEquals(el, needle));
  throw new TelRuntimeError(`'contains' requires a string or array, got ${typeName(haystack)}`);
}

function inOp(needle: Value, container: Value): boolean {
  if (Array.isArray(container)) return container.some((el) => deepEquals(el, needle));
  if (container !== null && typeof container === 'object') {
    if (typeof needle !== 'string') {
      throw new TelRuntimeError(`'in' on an object requires a string key, got ${typeName(needle)}`);
    }
    return Object.prototype.hasOwnProperty.call(container, needle);
  }
  if (typeof container === 'string') {
    if (typeof needle !== 'string') {
      throw new TelRuntimeError(`'in' on a string requires a string operand, got ${typeName(needle)}`);
    }
    return container.includes(needle);
  }
  throw new TelRuntimeError(`'in' requires an array, object, or string, got ${typeName(container)}`);
}

/** Evaluate a TEL AST against a scope. Throws TelRuntimeError on type errors. */
export function evaluate(expr: Expr, scope: Scope): Value {
  switch (expr.kind) {
    case 'lit':
      return expr.value;

    case 'var': {
      const v = scope.get(expr.name);
      return v === undefined ? null : v;
    }

    case 'member': {
      const obj = evaluate(expr.obj, scope);
      // Safe navigation: property access on null / non-objects yields null
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null;
      const v = obj[expr.prop];
      return v === undefined ? null : v;
    }

    case 'index': {
      const obj = evaluate(expr.obj, scope);
      const idx = evaluate(expr.idx, scope);
      if (Array.isArray(obj)) {
        if (typeof idx !== 'number' || !Number.isInteger(idx)) {
          throw new TelRuntimeError(`Array index must be an integer, got ${typeName(idx)}`);
        }
        const v = obj[idx];
        return v === undefined ? null : v;
      }
      if (obj !== null && typeof obj === 'object') {
        if (typeof idx !== 'string') {
          throw new TelRuntimeError(`Object index must be a string, got ${typeName(idx)}`);
        }
        const v = obj[idx];
        return v === undefined ? null : v;
      }
      return null; // safe navigation on null / scalars
    }

    case 'unary': {
      const v = evaluate(expr.operand, scope);
      if (expr.op === '!') return !truthy(v);
      if (typeof v !== 'number') {
        throw new TelRuntimeError(`Unary '-' requires a number, got ${typeName(v)}`);
      }
      return -v;
    }

    case 'bin': {
      const op = expr.op;
      // Short-circuit boolean ops; always produce booleans (unlike JS value-passing)
      if (op === '||') {
        return truthy(evaluate(expr.left, scope)) ? true : truthy(evaluate(expr.right, scope));
      }
      if (op === '&&') {
        return truthy(evaluate(expr.left, scope)) ? truthy(evaluate(expr.right, scope)) : false;
      }

      const a = evaluate(expr.left, scope);
      const b = evaluate(expr.right, scope);
      switch (op) {
        case '==': return deepEquals(a, b);
        case '!=': return !deepEquals(a, b);
        case '<':
        case '<=':
        case '>':
        case '>=':
          return compareOrdered(op, a, b);
        case 'in': return inOp(a, b);
        case 'contains': return containsOp(a, b);
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
          return arithmetic(op, a, b);
      }
      throw new TelRuntimeError(`Unknown operator '${op}'`);
    }

    case 'cond':
      return truthy(evaluate(expr.test, scope))
        ? evaluate(expr.then, scope)
        : evaluate(expr.else, scope);
  }
}

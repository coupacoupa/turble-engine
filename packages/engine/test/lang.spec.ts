import { describe, expect, it } from 'vitest';
import { evaluate, parseExpression, scopeFromObject, TelRuntimeError, TelSyntaxError } from '../src';
import type { Value } from '../src';

function run(src: string, vars: Record<string, Value> = {}): Value {
  return evaluate(parseExpression(src), scopeFromObject(vars));
}

describe('TEL expressions', () => {
  it('evaluates literals', () => {
    expect(run('42')).toBe(42);
    expect(run('4.5')).toBe(4.5);
    expect(run('1e3')).toBe(1000);
    expect(run("'hello'")).toBe('hello');
    expect(run('"world"')).toBe('world');
    expect(run('true')).toBe(true);
    expect(run('false')).toBe(false);
    expect(run('null')).toBe(null);
  });

  it('respects arithmetic precedence', () => {
    expect(run('2 + 3 * 4')).toBe(14);
    expect(run('(2 + 3) * 4')).toBe(20);
    expect(run('10 - 4 - 3')).toBe(3); // left associative
    expect(run('10 / 4')).toBe(2.5);
    expect(run('10 % 3')).toBe(1);
    expect(run('-5 + 2')).toBe(-3);
  });

  it('concatenates strings with +', () => {
    expect(run("'a' + 'b'")).toBe('ab');
    expect(() => run("'a' + 1")).toThrow(TelRuntimeError);
  });

  it('compares numbers and strings', () => {
    expect(run('700 >= 700')).toBe(true);
    expect(run('699 >= 700')).toBe(false);
    expect(run("'abc' < 'abd'")).toBe(true);
    expect(() => run("'a' < 1")).toThrow(TelRuntimeError);
  });

  it('equality is same-type structural', () => {
    expect(run("riskResult == 'PASS'", { riskResult: 'PASS' })).toBe(true);
    expect(run('1 == 1')).toBe(true);
    expect(run("1 == '1'")).toBe(false); // no cross-type coercion
    expect(run('null == null')).toBe(true);
    expect(run('a == b', { a: [1, 2], b: [1, 2] })).toBe(true);
    expect(run('a != b', { a: { x: 1 }, b: { x: 2 } })).toBe(true);
  });

  it('boolean ops short-circuit and return booleans', () => {
    expect(run('true && false')).toBe(false);
    expect(run('true || false')).toBe(true);
    expect(run("'' || 'x'")).toBe(true); // booleans, not JS value-passing
    expect(run('!0')).toBe(true);
    expect(run('!!5')).toBe(true);
  });

  it('evaluates ternary right-associatively', () => {
    expect(run("score >= 700 ? 'APPROVED' : 'DECLINED'", { score: 720 })).toBe('APPROVED');
    expect(run("a ? 'x' : b ? 'y' : 'z'", { a: false, b: true })).toBe('y');
  });

  it('unknown identifiers resolve to null', () => {
    expect(run('missing')).toBe(null);
    expect(run('missing == null')).toBe(true);
  });

  it('member and index access with safe navigation', () => {
    const vars: Record<string, Value> = { user: { name: 'Ada', tags: ['x', 'y'] } };
    expect(run('user.name', vars)).toBe('Ada');
    expect(run("user['name']", vars)).toBe('Ada');
    expect(run('user.tags[1]', vars)).toBe('y');
    expect(run('user.missing', vars)).toBe(null);
    expect(run('nothing.deep.chain', {})).toBe(null);
  });

  it('supports in and contains', () => {
    expect(run("'x' in tags", { tags: ['x', 'y'] })).toBe(true);
    expect(run("'name' in user", { user: { name: 'Ada' } })).toBe(true);
    expect(run("'ell' in 'hello'")).toBe(true);
    expect(run("'hello' contains 'ell'")).toBe(true);
    expect(run('tags contains 2', { tags: [1, 2, 3] })).toBe(true);
    expect(run('tags contains 9', { tags: [1, 2, 3] })).toBe(false);
  });

  it('the migrated legacy seed expression works', () => {
    const src = "riskResult == 'PASS_SCORECARD' ? 'APPROVED' : 'DECLINED'";
    expect(run(src, { riskResult: 'PASS_SCORECARD' })).toBe('APPROVED');
    expect(run(src, { riskResult: 'FAIL' })).toBe('DECLINED');
    expect(run(src, {})).toBe('DECLINED');
  });

  it('rejects invalid syntax', () => {
    expect(() => parseExpression('1 +')).toThrow(TelSyntaxError);
    expect(() => parseExpression('(1')).toThrow(TelSyntaxError);
    expect(() => parseExpression("'unterminated")).toThrow(TelSyntaxError);
    expect(() => parseExpression('a ? b')).toThrow(TelSyntaxError);
    expect(() => parseExpression('a b')).toThrow(TelSyntaxError);
    expect(() => parseExpression('')).toThrow(TelSyntaxError);
    expect(() => parseExpression('a @ b')).toThrow(TelSyntaxError);
  });

  it('IEEE-754 semantics: division by zero yields Infinity (truthy)', () => {
    expect(run('1 / 0')).toBe(Infinity);
    expect(run('1 / 0 > 100')).toBe(true);
  });
});

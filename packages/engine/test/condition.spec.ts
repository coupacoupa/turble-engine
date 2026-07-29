import { describe, expect, it } from 'vitest';
import { coerceMutationValue, compileCondition } from '../src';
import type { Value } from '../src';

function match(cond: string, actual: Value): boolean {
  return compileCondition(cond).test(actual);
}

describe('decision-table condition shorthand (legacy-compatible)', () => {
  it('empty condition is a wildcard', () => {
    expect(match('', 'anything')).toBe(true);
    expect(match('   ', null)).toBe(true);
    expect(compileCondition(undefined).test(0)).toBe(true);
  });

  it('boolean conditions accept booleans and string-booleans', () => {
    expect(match('true', true)).toBe(true);
    expect(match('true', 'true')).toBe(true);
    expect(match('true', false)).toBe(false);
    expect(match('TRUE', true)).toBe(true);
    expect(match('false', false)).toBe(true);
    expect(match('false', 'false')).toBe(true);
    expect(match('false', true)).toBe(false);
  });

  it('ordered numeric comparisons', () => {
    expect(match('>= 700', 720)).toBe(true);
    expect(match('>= 700', 700)).toBe(true);
    expect(match('>= 700', 699)).toBe(false);
    expect(match('>= 700', '750')).toBe(true); // numeric strings coerce
    expect(match('<= 0.35', 0.3)).toBe(true);
    expect(match('<= 0.35', 0.4)).toBe(false);
    expect(match('> 10', 11)).toBe(true);
    expect(match('< 10', 9)).toBe(true);
    expect(match('>= 700', 'abc')).toBe(false); // non-numeric actual never matches
    expect(match('>= abc', 5)).toBe(false); // non-numeric target never matches
  });

  it('equality: numeric when both coerce, else case-insensitive string', () => {
    expect(match('== valid', 'valid')).toBe(true);
    expect(match('== valid', 'VALID')).toBe(true); // case-insensitive
    expect(match('== valid', 'invalid')).toBe(false);
    expect(match("== 'quoted'", 'quoted')).toBe(true); // quotes stripped
    expect(match('= single', 'single')).toBe(true); // single = accepted
    expect(match('== 5', 5)).toBe(true);
    expect(match('== 5', '5')).toBe(true);
    expect(match('== 5.0', 5)).toBe(true); // numeric, not textual
  });

  it('inequality via != and <>', () => {
    expect(match('!= valid', 'invalid')).toBe(true);
    expect(match('!= valid', 'valid')).toBe(false);
    expect(match('<> 5', 6)).toBe(true);
    expect(match('<> 5', 5)).toBe(false);
  });

  it('bare literals behave as equality', () => {
    expect(match('GOLD', 'gold')).toBe(true);
    expect(match('GOLD', 'silver')).toBe(false);
    expect(match('42', 42)).toBe(true);
  });
});

describe('mutation literal coercion', () => {
  it('coerces at compile time like the legacy evaluator', () => {
    expect(coerceMutationValue('true')).toBe(true);
    expect(coerceMutationValue('false')).toBe(false);
    expect(coerceMutationValue('25000')).toBe(25000);
    expect(coerceMutationValue('0.35')).toBe(0.35);
    expect(coerceMutationValue('PASS_SCORECARD')).toBe('PASS_SCORECARD');
    expect(coerceMutationValue('')).toBe('');
    expect(coerceMutationValue(7)).toBe(7);
    expect(coerceMutationValue(undefined)).toBe(null);
  });
});

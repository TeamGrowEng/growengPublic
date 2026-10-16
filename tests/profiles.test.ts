import { test } from 'node:test';
import assert from 'node:assert/strict';
import { children, readState, saveState } from '../src/state.ts';

test('existing profile selections and activity links survive the roster extension', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } } });
  try {
    for (const childId of ['jiwoo', 'minjun', 'seoyeon', 'hajun', 'sua', 'doyun'] as const) {
      const state = { version: 1 as const, mode: 'parent' as const, childId, activities: [{ id: 'existing', childId, date: '2026-10-08T00:00:00Z', source: 'demo' as const }] };
      stored = JSON.stringify(state); assert.deepEqual(readState(), state);
    }
    for (const childId of ['yejun', 'jian', 'eunwoo', 'harin'] as const) {
      assert.equal(saveState({ version: 1, mode: 'student', childId, activities: [] }), true);
      assert.equal(readState().childId, childId);
    }
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

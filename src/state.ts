import { children, type ChildId } from '../shared/profiles.ts';
export { children, type ChildId } from '../shared/profiles.ts';
export type Mode = 'student' | 'parent' | 'teacher';
export type DemoActivity = { id: string; childId: ChildId; date: string; source: 'demo'; };
export type DemoState = { version: 1; mode: Mode; childId: ChildId; activities: DemoActivity[] };
const key = 'groweng-demo:v1';
const initial: DemoState = { version: 1, mode: 'student', childId: 'jiwoo', activities: [] };
export function readState(): DemoState {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value?.version !== 1 || !['student', 'parent', 'teacher'].includes(value.mode) ||
      !children.some(child => child.id === value.childId) || !Array.isArray(value.activities)) return initial;
    return { ...value, activities: value.activities.filter((item: DemoActivity) =>
      item && typeof item.id === 'string' && item.source === 'demo' &&
      children.some(child => child.id === item.childId) && typeof item.date === 'string' && Number.isFinite(Date.parse(item.date))).slice(0, 100) };
  } catch { return initial; }
}
export function saveState(state: DemoState): boolean {
  try { localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch { return false; }
}

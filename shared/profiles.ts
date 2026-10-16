// Stable demo keys are shared by the browser and speech server.
// Keep existing keys so saved recordings remain attached to their profiles.
export const children = [
  { id: 'jiwoo', name: '지우', color: 'green' },
  { id: 'minjun', name: '민준', color: 'blue' },
  { id: 'seoyeon', name: '서연', color: 'pink' },
  { id: 'hajun', name: '하준', color: 'green' },
  { id: 'sua', name: '수아', color: 'pink' },
  { id: 'doyun', name: '도윤', color: 'blue' },
  { id: 'yejun', name: '예준', color: 'green' },
  { id: 'jian', name: '지안', color: 'pink' },
  { id: 'eunwoo', name: '은우', color: 'blue' },
  { id: 'harin', name: '하린', color: 'pink' },
] as const;
export type ChildId = typeof children[number]['id'];

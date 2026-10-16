import { useEffect, useState } from 'react';
import { loadMaterials } from './editorial-store';
import { type Material } from '../shared/material';
import type { ChildId } from './state';
export default function MaterialPicker({ childId, material, disabled, onChange }: { childId: ChildId; material: Material; disabled: boolean; onChange: (value: Material) => void }) {
  const [materials, setMaterials] = useState<Material[]>([material]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  useEffect(() => { let cancelled = false; setLoading(true); setError(''); loadMaterials(childId).then(values => { if (!cancelled) setMaterials(values); }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : '읽기 지문을 불러오지 못했어요.'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [childId, reload]);
  const value = `${material.id}:${material.version}`;
  return <div className="material-picker"><label>읽을 이야기<select value={value} disabled={disabled || loading || !!error} onChange={event => { const selected = materials.find(item => `${item.id}:${item.version}` === event.target.value); if (selected) onChange(selected); }}>{!materials.some(item => `${item.id}:${item.version}` === value) ? <option value={value}>{material.title} · 버전 {material.version}</option> : null}{materials.map(item => <option key={`${item.id}:${item.version}`} value={`${item.id}:${item.version}`}>{item.title} · 버전 {item.version}</option>)}</select></label><button className="text-button" disabled={disabled || loading} onClick={() => setReload(count => count + 1)}>{loading ? '지문 불러오는 중…' : '지문 목록 새로고침'}</button>{error ? <p className="inline-error" role="alert">{error}</p> : null}</div>;
}

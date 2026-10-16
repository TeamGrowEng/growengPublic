import { useEffect, useState } from 'react';
import { loadTake, type StoredTake } from './recordings';
import AudioPlayer from './AudioPlayer';
import { assessmentSegments } from './assessment-segments';

export default function SavedAudio({ take, label, accountId, active, disabled }: { take: StoredTake; label: string; accountId?: string; active: boolean; disabled: boolean }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!active || disabled) return;
    setBlob(null); setError('');
    loadTake(take, accountId).then(value => { if (!cancelled) setBlob(value); })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : '녹음을 불러오지 못했어요.'); });
    return () => { cancelled = true; };
  }, [take, accountId, active, disabled, retry]);
  if (!active) return null;
  if (error) return <div className="inline-error"><p role="alert">{error}</p><button className="text-button" disabled={disabled} onClick={() => setRetry(value => value + 1)}>녹음 다시 불러오기</button></div>;
  const observations = take.observation?.features ?? take.assessment?.result.observations;
  const segments = assessmentSegments(take.assessment?.result, observations);
  return blob ? <AudioPlayer blob={blob} label={label} disabled={disabled} segments={segments} /> : <p className="audio-loading" role="status">{label} · 녹음 불러오는 중</p>;
}

import { useEffect, useRef, useState } from 'react';

export default function AudioPlayer({ blob, label, disabled = false, segments = [] }: { blob: Blob; label: string; disabled?: boolean; segments?: { startMs: number; endMs: number; label: string }[] }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const endAt = useRef<number | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function scheduleEnd() {
    clearTimeout(endTimer.current);
    const player = audio.current;
    if (player && endAt.current !== null && !player.paused && !player.seeking) endTimer.current = setTimeout(() => player.pause(), Math.max(0, (endAt.current - player.currentTime) / player.playbackRate * 1000));
  }
  useEffect(() => {
    const value = URL.createObjectURL(blob);
    setUrl(value);
    setError(false);
    return () => { clearTimeout(endTimer.current); endAt.current = null; audio.current?.pause(); URL.revokeObjectURL(value); };
  }, [blob]);
  useEffect(() => { if (disabled) audio.current?.pause(); }, [disabled]);
  return <div className="take-player"><span>{label}</span>{disabled ? <small>녹음·저장 중에는 재생을 잠시 멈춰요.</small> : <><audio ref={audio} controls preload="metadata" src={url || undefined} aria-label={label} onError={() => setError(true)} onPlaying={scheduleEnd} onRateChange={scheduleEnd} onWaiting={() => clearTimeout(endTimer.current)} onSeeking={() => clearTimeout(endTimer.current)} onSeeked={scheduleEnd} onPause={event => { if (event.currentTarget.paused) { clearTimeout(endTimer.current); endAt.current = null; } }} onTimeUpdate={event => { if (endAt.current !== null && event.currentTarget.currentTime >= endAt.current) event.currentTarget.pause(); }} onPlay={event => {
    document.querySelectorAll('audio').forEach(item => { if (item !== event.currentTarget) item.pause(); });
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    scheduleEnd();
  }} />{segments.length ? <div className="audio-segments"><small>관측 구간의 앞뒤를 함께 들어요.</small>{segments.map((segment, index) => <button type="button" className="text-button" key={index} disabled={!url} onClick={async () => {
    const player = audio.current; if (!player || !Number.isFinite(player.duration)) return;
    player.pause(); setError(false);
    endAt.current = Math.min(player.duration, (segment.endMs + 200) / 1000); player.currentTime = Math.max(0, (segment.startMs - 200) / 1000);
    try { await player.play(); scheduleEnd(); } catch { setError(true); endAt.current = null; }
  }}>{segment.label}</button>)}</div> : null}</>}{error ? <p role="alert">녹음을 재생하지 못했어요. Chrome에서 다시 확인해 주세요.</p> : null}</div>;
}

export type StopReason = 'user_stop' | 'time_limit' | 'unknown';
export type StoredObservations = { audioSha256: string; features: AudioObservations };
export function parseStoredObservations(value: unknown): StoredObservations {
  const row = value as StoredObservations;
  if (!row || typeof row.audioSha256 !== 'string' || !/^[a-f\d]{64}$/.test(row.audioSha256)) throw new Error('녹음 관측 해시를 확인해 주세요.');
  return { audioSha256: row.audioSha256, features: parseAudioObservations(row.features) };
}
export type AudioObservations = {
  version: 'pcm-energy-v1'; durationMs: number; stopReason: StopReason;
  rms: number; peak: number; clippedRatio: number;
  speechStartMs: number | null; speechEndMs: number | null;
  internalPauses: { startMs: number; endMs: number }[];
  pauseRatio: number | null; status: 'usable' | 'review' | 'retry';
  flags: string[]; method: 'energy-proxy-not-vad';
  acousticContext?: {
    version: 'acoustic-context-v1'; minimumPauseMs: 250;
    backgroundRms: number | null; backgroundWindowMs: number;
    backgroundReason: 'edge-low-energy-proxy' | 'insufficient-edge-window';
    speechRate: null; articulationRate: null; rateReason: 'actual-syllables-unmeasured';
  };
};
export function parseAudioObservations(value: unknown): AudioObservations {
  if (!value || typeof value !== 'object') throw new Error('음성 관측 형식이 맞지 않아요.');
  const row = value as AudioObservations;
  const number = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  const time = (v: unknown) => v === null || number(v, row.durationMs);
  if (row.version !== 'pcm-energy-v1' || row.method !== 'energy-proxy-not-vad' || !number(row.durationMs, 30000) || !['user_stop', 'time_limit', 'unknown'].includes(row.stopReason) || !number(row.rms, 1) || !number(row.peak, 1) || !number(row.clippedRatio, 1) || !time(row.speechStartMs) || !time(row.speechEndMs) || !(row.pauseRatio === null || number(row.pauseRatio, 1)) || !['usable', 'review', 'retry'].includes(row.status) || !Array.isArray(row.flags) || row.flags.length > 10 || row.flags.some(v => !['no_speech_energy', 'low_level', 'clipping', 'possible_truncation', 'short_speech'].includes(v)) || !Array.isArray(row.internalPauses) || row.internalPauses.length > 100) throw new Error('음성 관측값을 확인하지 못했어요.');
  let end = 0;
  for (const span of row.internalPauses) { if (!number(span.startMs, row.durationMs) || !number(span.endMs, row.durationMs) || span.startMs < end || span.endMs <= span.startMs) throw new Error('쉼 구간이 맞지 않아요.'); end = span.endMs; }
  if ((row.speechStartMs === null) !== (row.speechEndMs === null) || row.speechStartMs !== null && row.speechEndMs! <= row.speechStartMs) throw new Error('발화 구간이 맞지 않아요.');
  const context = row.acousticContext;
  if (context !== undefined && (!context || context.version !== 'acoustic-context-v1' || context.minimumPauseMs !== 250 || !number(context.backgroundWindowMs, row.durationMs) || !(context.backgroundRms === null || number(context.backgroundRms, 1)) || !['edge-low-energy-proxy', 'insufficient-edge-window'].includes(context.backgroundReason) || context.speechRate !== null || context.articulationRate !== null || context.rateReason !== 'actual-syllables-unmeasured' || (context.backgroundReason === 'edge-low-energy-proxy' ? context.backgroundRms === null || context.backgroundWindowMs < 200 || row.speechStartMs === null : context.backgroundRms !== null))) throw new Error('음향 관측의 미측정 사유가 맞지 않아요.');
  return { version: row.version, durationMs: row.durationMs, stopReason: row.stopReason, rms: row.rms, peak: row.peak, clippedRatio: row.clippedRatio, speechStartMs: row.speechStartMs, speechEndMs: row.speechEndMs, internalPauses: row.internalPauses.map(p => ({ startMs: p.startMs, endMs: p.endMs })), pauseRatio: row.pauseRatio, status: row.status, flags: [...row.flags], method: row.method, ...(context ? { acousticContext: { version: context.version, minimumPauseMs: context.minimumPauseMs, backgroundRms: context.backgroundRms, backgroundWindowMs: context.backgroundWindowMs, backgroundReason: context.backgroundReason, speechRate: null, articulationRate: null, rateReason: context.rateReason } } : {}) };
}

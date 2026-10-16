import { useEffect, useRef, useState } from 'react';
import { pauseAudio, type Take } from './recordings';

type Status = 'idle' | 'requesting' | 'recording' | 'processing';
export default function useRecorder() {
  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const recordingLimitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const permissionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopReason = useRef<'user_stop' | 'time_limit' | 'unknown'>('unknown');

  function release() {
    clearInterval(timer.current);
    clearTimeout(recordingLimitTimer.current);
    clearTimeout(permissionTimer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }
  function cancel() {
    generation.current++;
    starting.current = false;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
    release();
    setStatus('idle');
    setElapsed(0);
  }
  useEffect(() => () => {
    generation.current++;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    release();
  }, []);

  function stop() {
    if (recorder.current?.state !== 'recording') return;
    if (stopReason.current !== 'time_limit') stopReason.current = 'user_stop';
    setStatus('processing');
    clearInterval(timer.current);
    clearTimeout(recordingLimitTimer.current);
    recorder.current.stop();
  }

  async function start(onCapture: (take: Take) => void) {
    if (starting.current || recorder.current) return;
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('마이크를 사용할 수 없어요. Chrome에서 localhost 또는 HTTPS 주소로 열어 주세요.'); return;
    }
    pauseAudio();
    const token = ++generation.current;
    starting.current = true;
    setStatus('requesting');
    setElapsed(0);
    permissionTimer.current = setTimeout(() => {
      if (token !== generation.current) return;
      generation.current++;
      starting.current = false;
      setStatus('idle');
      setError('마이크 권한을 기다리는 시간이 길어졌어요. 주소창의 마이크 권한을 확인하고 다시 시도해 주세요.');
    }, 20000);
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (token !== generation.current) { input.getTracks().forEach(track => track.stop()); return; }
      clearTimeout(permissionTimer.current);
      stream.current = input;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(input, mimeType ? { mimeType } : undefined);
      recorder.current = media;
      const chunks: Blob[] = [];
      let failed = false;
      let startedAt = 0;
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => {
        failed = true;
        if (token === generation.current) {
          recorder.current = null;
          release();
          setStatus('idle');
          setError('녹음 중 문제가 생겼어요. 마이크 연결을 확인하고 다시 읽어 주세요.');
        }
      };
      media.onstop = () => {
        if (token !== generation.current) return;
        const durationMs = Math.round(performance.now() - startedAt);
        const blob = new Blob(chunks, { type: media.mimeType });
        recorder.current = null;
        release();
        setStatus('idle');
        if (failed) return;
        if (blob.size === 0 || durationMs < 700) { setError('녹음이 너무 짧아요. 문장을 읽은 뒤 녹음 끝내기를 눌러 주세요.'); return; }
        onCapture({ blob, durationMs, stopReason: stopReason.current });
      };
      media.start(250);
      stopReason.current = 'unknown';
      startedAt = performance.now();
      setStatus('recording');
      recordingLimitTimer.current = setTimeout(() => { stopReason.current = 'time_limit'; stop(); }, 5000);
      timer.current = setInterval(() => {
        const seconds = Math.min(5, Math.floor((performance.now() - startedAt) / 1000));
        setElapsed(seconds);
      }, 250);
    } catch (failure) {
      if (token !== generation.current) return;
      recorder.current = null;
      release();
      setStatus('idle');
      const name = failure instanceof DOMException ? failure.name : '';
      setError(name === 'NotAllowedError' ? '마이크 권한이 꺼져 있어요. 주소창에서 마이크를 허용한 뒤 다시 눌러 주세요.' : name === 'NotFoundError' ? '연결된 마이크가 없어요. 마이크를 연결하고 다시 시도해 주세요.' : '마이크를 시작하지 못했어요. 다른 앱이 마이크를 사용 중인지 확인해 주세요.');
    } finally { if (token === generation.current) starting.current = false; }
  }
  return { status, elapsed, error, start, stop, cancel, busy: status !== 'idle' };
}

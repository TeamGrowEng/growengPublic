import { useEffect, useRef, useState } from 'react';
import useRecorder from './useRecorder';
import AudioPlayer from './AudioPlayer';
import { pauseAudio, saveSession, type ReadingSession, type Take } from './recordings';
import type { Material } from '../shared/material';
import useUnsavedWork from './useUnsavedWork';
import type { ChildId } from './state';
import { storageLabel } from './storage-config';

export default function ReadingExercise({ material: passage, childId, sentenceIndex, active, externalBusy, onBusy, onSaved, onNext }: {
  material: Material;
  childId: ChildId; sentenceIndex: number; active: boolean; externalBusy: boolean;
  onBusy: (busy: boolean) => void; onSaved: (session: ReadingSession) => void; onNext: () => void;
}) {
  const [first, setFirst] = useState<Take | null>(null);
  const [repeat, setRepeat] = useState<Take | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const sessionId = useRef(crypto.randomUUID());
  const savingRef = useRef(false);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recorder = useRecorder();
  const mediaBusy = recorder.busy || saving || speaking;
  const busy = mediaBusy || externalBusy;
  const sentence = passage.sentences[sentenceIndex];
  const unsaved = !!first && !saved;
  useUnsavedWork(unsaved || mediaBusy);
  useEffect(() => { onBusy(mediaBusy || unsaved); return () => onBusy(false); }, [mediaBusy, unsaved, onBusy]);
  useEffect(() => {
    if (!active) { pauseAudio(); setSpeaking(false); clearTimeout(speechTimer.current); }
  }, [active]);
  useEffect(() => () => { clearTimeout(speechTimer.current); if ('speechSynthesis' in window) speechSynthesis.cancel(); }, []);

  function stopListening() { pauseAudio(); clearTimeout(speechTimer.current); setSpeaking(false); }
  function capture(take: Take) {
    const kind = first ? 'repeat' : 'first';
    if (kind === 'first') setFirst(take); else setRepeat(take);
  }

  function listen(rate: number) {
    if (busy) return;
    setSpeechError('');
    if (!('speechSynthesis' in window)) { setSpeechError('이 브라우저는 문장 듣기를 지원하지 않아요. Chrome에서 다시 열어 주세요.'); return; }
    pauseAudio();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'en-US';
    utterance.voice = speechSynthesis.getVoices().find(voice => voice.lang === 'en-US') ?? null;
    utterance.rate = rate;
    utterance.onend = () => { setSpeaking(false); clearTimeout(speechTimer.current); };
    utterance.onerror = event => { setSpeaking(false); clearTimeout(speechTimer.current); if (event.error !== 'canceled' && event.error !== 'interrupted') setSpeechError('문장 소리를 재생하지 못했어요. 다시 듣기를 눌러 주세요.'); };
    setSpeaking(true);
    speechTimer.current = setTimeout(() => {
      speechSynthesis.cancel(); setSpeaking(false); setSpeechError('문장 듣기가 지연됐어요. 다시 눌러 주세요.');
    }, 20000);
    speechSynthesis.speak(utterance);
  }
  async function save() {
    if (!first || !repeat || savingRef.current || saved) return;
    savingRef.current = true; setSaving(true); setSaveError(''); pauseAudio();
    const session: ReadingSession = { id: sessionId.current, childId, date: new Date().toISOString(), source: 'local-recording', passageId: passage.id, passageVersion: passage.version, material: passage, sentenceIndex, sentence, first, repeat, evaluationStatus: 'not-connected' };
    try { const stored = await saveSession(session); setSaved(true); onSaved(stored); }
    catch (error) { setSaveError(error instanceof Error ? error.message : '저장하지 못했어요. 다시 저장해 주세요.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  function retry() { pauseAudio(); setFirst(null); setRepeat(null); setSaved(false); setSaveError(''); sessionId.current = crypto.randomUUID(); }
  return <div className="reading-exercise">
    <div className="sentence-dots" aria-label={`전체 ${passage.sentences.length}문장 중 현재 문장`}>{passage.sentences.map((_, index) => <span key={index} className={index === sentenceIndex ? 'current' : index < sentenceIndex ? 'done' : ''} />)}</div>
    <p className="reading-sentence">{sentence}</p>
    <p className="reading-hint">{saved ? '두 번 읽은 목소리를 저장했어!' : !first ? '먼저, 너의 목소리로 문장을 읽어 봐.' : !repeat ? '문장 소리를 듣고, 한 번 더 읽어 봐.' : '두 목소리를 들어 보고 함께 저장해 봐.'}</p>
    <div className="listening-actions"><button className="secondary" disabled={busy} onClick={() => listen(1)}>♬ 문장 듣기</button><button className="secondary" disabled={busy} onClick={() => listen(.75)}>천천히 듣기</button>{speaking ? <button className="text-button" onClick={stopListening}>듣기 멈추기</button> : null}</div>
    <p className="demo-note">문장 듣기는 브라우저 음성으로 재생돼요.</p>
    <p className="demo-note">한 번에 최대 5초 녹음해요. 5초가 되면 자동으로 끝나요.</p><div className="recording-actions" aria-live="polite">
      {recorder.status === 'requesting' ? <><p>마이크 사용을 허용해 주세요.</p><button className="secondary" onClick={recorder.cancel}>취소</button></> : recorder.status === 'recording' ? <><p className="recording-status"><span />목소리를 듣고 있어 · {recorder.elapsed} / 5초</p><button className="record-stop" onClick={recorder.stop}>■ 녹음 끝내기</button><button className="text-button" onClick={recorder.cancel}>이 녹음 취소하기</button></> : recorder.status === 'processing' ? <p>녹음을 정리하고 있어요.</p> : !repeat && !saved ? <button className="primary" disabled={busy} onClick={() => recorder.start(capture)}>● {first ? '따라 읽기 녹음' : '처음 읽기 녹음'}</button> : null}
      {recorder.error ? <p className="inline-error" role="alert">{recorder.error}</p> : null}
      {speechError ? <p className="inline-error" role="alert">{speechError}</p> : null}
    </div>
    {first ? <AudioPlayer blob={first.blob} label="처음 읽은 목소리" disabled={busy} /> : null}
    {repeat ? <AudioPlayer blob={repeat.blob} label="따라 읽은 목소리" disabled={busy} /> : null}
    {first && !busy && !saved ? <button className="text-button" onClick={retry}>처음부터 다시 녹음하기</button> : null}
    {repeat && !saved ? <button className="primary save-recordings" disabled={busy} onClick={save}>{saving ? '저장하고 있어요…' : '두 목소리 저장하기'}</button> : null}
    {saveError ? <p className="inline-error" role="alert">{saveError}</p> : null}
    {saved ? <div className="saved-actions"><p role="status">✓ {storageLabel}에 저장했어요. 학부모 화면에서 비교할 수 있어요.</p><button className="primary" disabled={busy} onClick={() => { pauseAudio(); onNext(); }}>{sentenceIndex === passage.sentences.length - 1 ? '이야기 마치기' : '다음 문장 읽기'} ↗</button></div> : null}
    <p className="demo-note">성인 시연용 녹음입니다. 온라인 평가는 이 공개본에서 사용할 수 없어요.<br />저장 전 녹음은 새로고침하거나 아이를 바꾸면 사라져요. 한 녹음은 최대 5초예요.</p>
  </div>;
}

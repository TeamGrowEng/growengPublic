import { useEffect, useState } from 'react';
import type { ChildId } from './state';
import type { PublishedComment as Comment } from '../shared/editorial';
import { loadPublishedComment } from './editorial-store';
export default function PublishedComment({ childId, active, blocked }: { childId: ChildId; active: boolean; blocked: boolean }) {
  const [comment, setComment] = useState<Comment | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false; setComment(null); setError(''); setLoading(true);
    if (active && !blocked) loadPublishedComment(childId).then(value => { if (!cancelled) setComment(value); }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : '선생님 코멘트를 불러오지 못했어요.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [childId, active, blocked, reload]);
  return <section className="parent-teacher-comment"><h2>선생님이 남긴 이야기</h2>{loading ? <p role="status">코멘트를 불러오고 있어요.</p> : error ? <p className="inline-error" role="alert">{error}</p> : comment ? <><blockquote>{comment.body}</blockquote><p>{new Date(comment.publishedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}에 표시한 코멘트</p></> : <p>아직 표시한 코멘트가 없어요.</p>}<button className="text-button" disabled={blocked || !active} onClick={() => setReload(value => value + 1)}>코멘트 새로고침</button></section>;
}

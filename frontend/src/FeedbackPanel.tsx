import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ChevronUp, Cpu, LoaderCircle, MessageSquarePlus, MessagesSquare, Paperclip, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { api, ApiError, setCsrf } from './api';
import { CaptchaField, useCaptcha } from './captcha';
import { browserName, prepareScreenshot } from './feedbackAttachments';
import type { Account, EngineSnapshot, FeedbackBoard, FeedbackItem, FeedbackStatus } from './types';
import './feedback.css';

type Sort = 'top' | 'new';
type Draft = { category: string; title: string; body: string };
type VoteResult = { id: number; votes: number; voted: boolean; can_vote: boolean; csrf: string };
type Submitted = { item: FeedbackItem; detail: string; can_vote: boolean; csrf: string };

// How a submitter sees each review status.
const STATUS: Record<FeedbackStatus, string> = { new: 'Awaiting review', planned: 'Planned', done: 'Done', declined: 'Declined' };
// Used until the board loads (or if it cannot); the server's lists are authoritative.
const CATEGORIES = [{ id: 'bug', label: 'Bug report' }, { id: 'idea', label: 'Idea' }, { id: 'music', label: 'Music' }];
const LIMITS = { title_min: 4, title: 120, body: 2000, voter_check_hours: 24 };
const PLACEHOLDERS: Record<string, [string, string]> = {
  bug: ['Sentinel clips through the Ember relay', 'What happened, and what did you expect? The steps that cause it help most.'],
  idea: ['Add a night-time destination', 'What would you like, and why would it make RELAY better?'],
  music: ['More tracks like “count’s bounce”', 'Which track, and what did you think? Suggestions for RELAY RADIO are welcome too.'],
};
const DRAFT_KEY = 'relay:feedback-draft';
const LONG_BODY = 280;

// A half-written post survives closing the dialog by accident, for this tab only. Attachments do not.
function savedDraft(): Draft {
  const empty = { category: 'bug', title: '', body: '' };
  try {
    const draft = { ...empty, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') };
    return CATEGORIES.some(c => c.id === draft.category) ? draft : { ...draft, category: 'bug' };
  } catch { return empty; }
}

export function FeedbackPanel({ account, captureScreenshot, captureSnapshot }: {
  account: Account | null;
  /** The existing photograph capture of the game view, as a PNG data URL. */
  captureScreenshot: () => Promise<string>;
  /** The Engine lab's current readings. */
  captureSnapshot: () => EngineSnapshot;
}) {
  const [view, setView] = useState<'board' | 'new'>('board');
  const [sort, setSort] = useState<Sort>('top');
  const [board, setBoard] = useState<FeedbackBoard | null>(null), [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(savedDraft), [honeypot, setHoneypot] = useState('');
  // Opt-in attachments: nothing is captured or sent unless the player ticks the box.
  // The box shows the player's choice at once; the capture fills in the preview (or unticks it, with a reason).
  const [wantScreenshot, setWantScreenshot] = useState(false), [screenshot, setScreenshot] = useState('');
  const [capturing, setCapturing] = useState(false), [attachError, setAttachError] = useState('');
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [voting, setVoting] = useState<number | null>(null), [checkFor, setCheckFor] = useState<FeedbackItem | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  // Submissions always need a CAPTCHA; votes need one until this browser session has solved one.
  const captcha = useCaptcha(view === 'new' || checkFor !== null);
  const request = useRef(0), check = useRef<HTMLFormElement>(null);
  const categories = board?.categories ?? CATEGORIES, limits = board?.limits ?? LIMITS;
  const label = (id: string) => categories.find(c => c.id === id)?.label ?? id;
  const checkLasts = limits.voter_check_hours === 24 ? 'a day' : limits.voter_check_hours === 1 ? 'an hour' : limits.voter_check_hours % 24 === 0 ? `${limits.voter_check_hours / 24} days` : `${limits.voter_check_hours} hours`;
  const [titleHint, bodyHint] = PLACEHOLDERS[draft.category] ?? PLACEHOLDERS.bug;

  const load = useCallback(async (offset = 0) => {
    const current = ++request.current;
    if (offset) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ sort, ...(offset ? { offset: String(offset) } : {}) });
      const next = await api<FeedbackBoard>(`feedback/?${params}`);
      if (current !== request.current) return;
      setCsrf(next.csrf);
      setBoard(previous => offset && previous ? { ...next, items: [...previous.items, ...next.items.filter(item => !previous.items.some(p => p.id === item.id))] } : next);
    } catch (e) { if (current === request.current) setError((e as Error).message); }
    finally { if (current === request.current) { setLoading(false); setLoadingMore(false); } }
  }, [sort]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* Storage unavailable. */ } }, [draft]);
  useEffect(() => { if (checkFor) check.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [checkFor?.id]);

  function go(next: 'board' | 'new') { setView(next); setError(''); setNotice(''); setCheckFor(null); setAttachError(''); }

  async function toggleScreenshot(on: boolean) {
    setAttachError(''); setWantScreenshot(on);
    if (!on) { setScreenshot(''); return; }
    setCapturing(true);
    try { setScreenshot(await prepareScreenshot(await captureScreenshot())); }
    catch (e) { setWantScreenshot(false); setScreenshot(''); setAttachError(`No screenshot attached: ${(e as Error).message}`); }
    finally { setCapturing(false); }
  }

  function toggleSnapshot(on: boolean) {
    setAttachError('');
    if (!on) { setSnapshot(null); return; }
    try { setSnapshot(captureSnapshot()); }
    catch (e) { setSnapshot(null); setAttachError(`No Engine lab snapshot attached: ${(e as Error).message}`); }
  }

  function applyVote(result: VoteResult) {
    const update = (item: FeedbackItem) => item.id === result.id ? { ...item, votes: result.votes, voted: result.voted } : item;
    setBoard(previous => previous && { ...previous, can_vote: result.can_vote, items: previous.items.map(update), mine: previous.mine.map(update) });
  }

  async function vote(item: FeedbackItem, answer?: ReturnType<typeof captcha.fields>) {
    if (!answer && board && !board.can_vote) { setError(''); setNotice(''); setCheckFor(item); return; }
    setVoting(item.id); setError(''); setNotice('');
    try {
      const result = await api<VoteResult>(`feedback/${item.id}/vote/`, { vote: !item.voted, ...answer });
      setCsrf(result.csrf); applyVote(result); setCheckFor(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && (e.data as { captcha_required?: boolean })?.captcha_required) {
        setBoard(previous => previous && { ...previous, can_vote: false }); setCheckFor(item);  // The earlier check expired.
      } else if (e instanceof ApiError && e.status === 404) {
        setCheckFor(null); setError('That item is no longer on the board.'); void load();
      } else setError((e as Error).message);
    } finally {
      setVoting(null);
      if (answer) captcha.spend();  // Spent whatever the outcome.
    }
  }

  async function submit() {
    setBusy(true); setError(''); setNotice('');
    try {
      // Attachments go only inside this CAPTCHA-checked request, and only if ticked.
      const result = await api<Submitted>('feedback/', {
        ...draft, ...captcha.fields(),
        ...(wantScreenshot && screenshot ? { screenshot } : {}), ...(snapshot ? { diagnostics: snapshot } : {}), ...(honeypot ? { website: honeypot } : {}),
      });
      setCsrf(result.csrf);
      setDraft(previous => ({ category: previous.category, title: '', body: '' }));
      setWantScreenshot(false); setScreenshot(''); setSnapshot(null);
      setBoard(previous => previous && { ...previous, can_vote: result.can_vote, mine: [result.item, ...previous.mine] });
      go('board'); setNotice(result.detail);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); captcha.spend(); }
  }

  const messages = <>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-note" role="status">{notice}</p>}</>;
  const toggle = (id: number) => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const problems = snapshot ? snapshot.errors.length + snapshot.warnings.length + snapshot.limitations.length : 0;

  if (view === 'new') return <div className="account-panel feedback-panel">
    <span className="eyebrow">PLAYER FEEDBACK · NEW</span>
    <h2 id="modal-title">Tell us what you think.</h2>
    <p>{account ? <>Sending as <strong>{account.email}</strong>. Only the RELAY team sees who sent it. </> : 'Sending as a guest. '}
      The team reviews everything. What they accept appears on the public board for other players to upvote, without your attachments. Please leave out personal details.</p>
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label>Type<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label>Title<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} minLength={limits.title_min} maxLength={limits.title} placeholder={titleHint} autoFocus required/></label>
      <label>Details (optional)<textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} maxLength={limits.body} rows={5} placeholder={bodyHint}/></label>
      <p className="field-hint feedback-count" aria-live="polite">{draft.body.length.toLocaleString()} / {limits.body.toLocaleString()}</p>
      {/* Honeypot: hidden from people and assistive technology; form-filling bots tend to fill it in. */}
      <div className="feedback-hp" aria-hidden="true"><label>Website<input name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off"/></label></div>

      <fieldset className="feedback-attachments">
        <legend><Paperclip size={13}/> Attachments (optional)</legend>
        <label className="attach-option"><input type="checkbox" checked={wantScreenshot} disabled={capturing} onChange={e => void toggleScreenshot(e.target.checked)}/>
          <span><Camera size={14}/> Attach a screenshot of the game view {capturing && <LoaderCircle className="spin" size={13}/>}</span></label>
        {capturing && !screenshot && <p className="field-hint attach-progress" role="status">Capturing the game view…</p>}
        {wantScreenshot && screenshot && <div className="attachment-preview">
          <img src={screenshot} alt="Screenshot that will be attached"/>
          <button type="button" className="text-button" disabled={capturing} onClick={() => void toggleScreenshot(true)}><RefreshCw size={12}/> Retake</button>
        </div>}
        <label className="attach-option"><input type="checkbox" checked={!!snapshot} onChange={e => toggleSnapshot(e.target.checked)}/>
          <span><Cpu size={14}/> Attach an Engine lab snapshot</span></label>
        {snapshot && <div className="snapshot-preview" aria-label="Engine lab snapshot that will be attached">
          <dl>
            <dt>Browser</dt><dd title={snapshot.browser.user_agent}>{browserName(snapshot.browser.user_agent)} · {snapshot.browser.platform}</dd>
            <dt>Renderer</dt><dd>{snapshot.renderer.backend}{snapshot.renderer.shadow_map ? ` · shadows ${snapshot.renderer.shadow_map.toLowerCase()}` : ''}</dd>
            <dt>Frame rate</dt><dd>{snapshot.performance.fps} FPS{snapshot.performance.frame_ms != null ? ` · ${snapshot.performance.frame_ms} ms/frame` : ''} · {Math.round(snapshot.performance.resolution_scale * 100)}% scale</dd>
            <dt>Warnings</dt><dd>{problems === 0 ? 'None reported' : `${problems} reported`}</dd>
          </dl>
          {problems > 0 && <details><summary>Show warnings</summary><ul>{[...snapshot.errors, ...snapshot.warnings, ...snapshot.limitations].map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
        </div>}
        {attachError && <p className="form-error" role="alert">{attachError}</p>}
        <p className="field-hint">Nothing is attached unless you tick it. Attachments are sent only with this CAPTCHA-checked post. Only the RELAY team sees them; they never appear on the public board.</p>
      </fieldset>

      <CaptchaField captcha={captcha} busy={busy}/>
      {messages}
      <button className="button full" disabled={busy || capturing || !captcha.challenge}>{busy ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>} {busy ? 'Sending…' : 'Send for review'}</button>
    </form>
    <div className="form-links"><button type="button" className="text-button" onClick={() => go('board')}><ArrowLeft size={13}/> Back to the board</button></div>
  </div>;

  return <div className="account-panel feedback-panel">
    <span className="eyebrow">PLAYER FEEDBACK · PUBLIC BOARD</span>
    <h2 id="modal-title">Help shape RELAY.</h2>
    <p>Report a bug, suggest an idea, or tell us about the music, as a guest or signed in. The team reviews everything; what they accept appears here for everyone to upvote.</p>
    <button className="button full" onClick={() => go('new')}><MessageSquarePlus size={17}/> Send feedback</button>
    {!checkFor && messages}

    {!!board?.mine.length && <section className="feedback-yours" aria-label="Your submissions">
      <div className="section-label"><span>YOUR SUBMISSIONS</span><span>{board.mine.length}</span></div>
      <ul>{board.mine.map(item => <li key={item.id}>
        <span className={`feedback-status ${item.status}`}>{STATUS[item.status]}</span>
        <span className={`feedback-tag ${item.category}`}>{label(item.category)}</span>
        <strong>{item.title}</strong>
        {item.public && <small>{item.votes} {item.votes === 1 ? 'vote' : 'votes'}</small>}
        {(item.attachments?.screenshot || item.attachments?.engine_lab_snapshot) && <small><Paperclip size={11}/> {[item.attachments.screenshot && 'Screenshot', item.attachments.engine_lab_snapshot && 'Engine lab snapshot'].filter(Boolean).join(', ')}</small>}
        {item.staff_response && <p className="team-reply"><b>Team reply</b>{item.staff_response}</p>}
      </li>)}</ul>
    </section>}

    <div className="feedback-toolbar">
      <div className="section-label"><span>ACCEPTED FEEDBACK</span></div>
      <div className="feedback-sort" role="group" aria-label="Sort feedback">
        {(['top', 'new'] as const).map(s => <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>{s === 'top' ? 'Top' : 'New'}</button>)}
      </div>
    </div>

    {loading && !board && <p className="account-progress"><LoaderCircle className="spin" size={16}/> Loading the board…</p>}
    {!loading && !board && <button className="button secondary full" onClick={() => { setError(''); void load(); }}><RefreshCw size={16}/> Try again</button>}
    {board && !board.items.length && !loading && <div className="feedback-empty"><MessagesSquare size={30}/><strong>Nothing accepted yet.</strong><p>Bug reports, ideas and music comments appear here once the team plans or delivers them. Yours could be first.</p></div>}
    {board && board.items.length > 0 && <ul className={`feedback-list ${loading ? 'refreshing' : ''}`} aria-busy={loading}>
      {board.items.map(item => <li key={item.id}>
        <div className={`feedback-item ${item.voted ? 'voted' : ''}`}>
          <button type="button" className="vote-button" aria-pressed={item.voted} disabled={voting !== null}
            aria-label={`${item.voted ? 'Remove your upvote from' : 'Upvote'} “${item.title}”. ${item.votes} ${item.votes === 1 ? 'vote' : 'votes'}.`}
            title={item.voted ? 'Remove your upvote' : 'Upvote'} onClick={() => void vote(item)}>
            {voting === item.id ? <LoaderCircle className="spin" size={15}/> : <ChevronUp size={17}/>}<b>{item.votes}</b>
          </button>
          <div className="feedback-content">
            <div className="feedback-meta">
              <span className={`feedback-tag ${item.category}`}>{label(item.category)}</span>
              <span className={`feedback-status ${item.status}`}>{STATUS[item.status]}</span>
              {item.mine && <span className="feedback-yours-tag">Yours</span>}
            </div>
            <h3>{item.title}</h3>
            {item.body && <p className={item.body.length > LONG_BODY && !expanded.has(item.id) ? 'clamped' : ''}>{item.body}</p>}
            {item.body.length > LONG_BODY && <button type="button" className="text-button" aria-expanded={expanded.has(item.id)} onClick={() => toggle(item.id)}>{expanded.has(item.id) ? 'Show less' : 'Show more'}</button>}
            {item.staff_response && <p className="team-reply"><b>Team reply</b>{item.staff_response}</p>}
          </div>
        </div>
        {checkFor?.id === item.id && <form ref={check} className="feedback-check" onSubmit={e => { e.preventDefault(); void vote(checkFor, captcha.fields()); }}>
          <div className="feedback-check-head"><ShieldCheck size={18}/><p><strong>One quick check before you vote.</strong> This browser won’t be asked again for {checkLasts}.</p></div>
          <CaptchaField captcha={captcha} busy={voting !== null} autoFocus/>
          {messages}
          <div className="feedback-check-actions">
            <button className="button" disabled={voting !== null || !captcha.challenge}>{voting !== null ? <LoaderCircle className="spin" size={16}/> : <ChevronUp size={16}/>} {checkFor.voted ? 'Remove my vote' : 'Upvote'}</button>
            <button type="button" className="text-button" onClick={() => { setCheckFor(null); setError(''); }}>Cancel</button>
          </div>
        </form>}
      </li>)}
    </ul>}
    {board?.has_more && <button className="button secondary full" disabled={loadingMore} onClick={() => void load(board.items.length)}>{loadingMore ? <LoaderCircle className="spin" size={16}/> : null} {loadingMore ? 'Loading…' : 'Show more'}</button>}
  </div>;
}

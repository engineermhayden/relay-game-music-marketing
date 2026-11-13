import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from './api';

export type Challenge = { captcha_id: string; image: string };

/**
 * A single-use challenge from the self-hosted CAPTCHA (GET /api/account/captcha/).
 * While `active`, a new image loads whenever there is none, so call spend() after every
 * submission that sent it: the server consumes a challenge whether the answer was right or wrong.
 */
export function useCaptcha(active: boolean) {
  const [challenge, setChallenge] = useState<Challenge | null>(null), [answer, setAnswer] = useState(''), [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async (clearAnswer = false) => {
    const current = ++request.current;
    setChallenge(null); setError('');
    if (clearAnswer) setAnswer('');
    try {
      const next = await api<Challenge>('account/captcha/');
      if (current === request.current) setChallenge(next);
    } catch (e) { if (current === request.current) setError((e as Error).message); }
  }, []);
  const spend = useCallback(() => { setChallenge(null); setAnswer(''); }, []);
  useEffect(() => { if (active && !challenge && !error) void load(); }, [active, challenge, error, load]);
  /** The fields a protected request sends. */
  const fields = () => ({ captcha_id: challenge?.captcha_id ?? '', captcha_answer: answer });
  return { challenge, answer, setAnswer, error, load, spend, fields };
}

export type CaptchaState = ReturnType<typeof useCaptcha>;

export function CaptchaField({ captcha, busy, autoFocus = false }: { captcha: CaptchaState; busy: boolean; autoFocus?: boolean }) {
  return <div className="captcha">
    <div className="captcha-image">
      {captcha.challenge ? <img src={captcha.challenge.image} width={240} height={80} alt="CAPTCHA image: five distorted letters and numbers"/> : <span role={captcha.error ? 'alert' : undefined}>{captcha.error || 'Loading a new image…'}</span>}
      <button type="button" className="captcha-refresh" aria-label="Show a new image" title="Show a new image" disabled={busy} onClick={() => void captcha.load(true)}><RefreshCw size={16}/></button>
    </div>
    <label>Characters in the image<input value={captcha.answer} onChange={e => captcha.setAnswer(e.target.value)} autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={12} autoFocus={autoFocus} required/></label>
    <p className="field-hint">Not case-sensitive. Can’t read it? Show a new image.</p>
  </div>;
}

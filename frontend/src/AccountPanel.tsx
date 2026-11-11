import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BadgeCheck, ClipboardCopy, Download, KeyRound, LifeBuoy, LoaderCircle, LogIn, LogOut, Mail, MailWarning, RefreshCw, ShieldAlert, Trash2, UserPen, UserRound } from 'lucide-react';
import { api, ApiError, apiFile, setCsrf } from './api';
import type { Account } from './types';

export type AccountView = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' | 'profile' | 'change' | 'confirm-change' | 'keys' | 'regenerate' | 'new-keys' | 'recover' | 'export' | 'delete' | 'deleted';
export type AccountLink = { kind: 'verify'; token: string } | { kind: 'reset'; uid: string; token: string };
type RecoveryKey = { key: string; used: boolean };
type Captcha = { captcha_id: string; image: string };
// Forms protected by the self-hosted CAPTCHA. Every submission spends the challenge.
const CAPTCHA_VIEWS: AccountView[] = ['signin', 'signup', 'forgot'];
const CAPTCHA_PATHS = ['account/login/', 'account/signup/', 'account/password-reset/'];
type AccountResponse = {
  account?: Account | null; csrf: string; detail?: string; verification_sent?: boolean; verified_email?: string; reactivated?: boolean;
  keys?: RecoveryKey[]; recovery_set?: string; email?: string; email_changed?: boolean; activation_sent?: boolean | null;
};

/** Reads a verification/reset link from the URL fragment once, then removes it from the address bar and history. */
export function takeAccountLink(): AccountLink | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const action = params.get('account'), token = params.get('token') ?? '', uid = params.get('uid') ?? '';
  if (!action) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  if (action === 'verify-email' && token) return { kind: 'verify', token };
  if (action === 'reset-password' && token && uid) return { kind: 'reset', uid, token };
  return null;
}

const views: Record<AccountView, { eyebrow: string; title: string }> = {
  signin: { eyebrow: 'PILOT ACCOUNT · OPTIONAL', title: 'Welcome back, pilot.' },
  signup: { eyebrow: 'PILOT ACCOUNT · OPTIONAL', title: 'Keep your signal.' },
  forgot: { eyebrow: 'PILOT ACCOUNT', title: 'Reset your password.' },
  reset: { eyebrow: 'PILOT ACCOUNT', title: 'Choose a new password.' },
  verify: { eyebrow: 'PILOT ACCOUNT', title: 'Confirming your email.' },
  profile: { eyebrow: 'PILOT ACCOUNT', title: 'You’re signed in.' },
  change: { eyebrow: 'PILOT ACCOUNT', title: 'Change email or password.' },
  'confirm-change': { eyebrow: 'PILOT ACCOUNT · CONFIRM', title: 'Sign out everywhere?' },
  keys: { eyebrow: 'PILOT ACCOUNT · EMAIL CHANGE', title: 'Save your recovery keys.' },
  regenerate: { eyebrow: 'PILOT ACCOUNT', title: 'New recovery keys.' },
  'new-keys': { eyebrow: 'PILOT ACCOUNT', title: 'Save your recovery keys.' },
  recover: { eyebrow: 'PILOT ACCOUNT', title: 'Recover with a key.' },
  export: { eyebrow: 'PILOT ACCOUNT · YOUR DATA', title: 'Download your data.' },
  delete: { eyebrow: 'PILOT ACCOUNT · DELETE', title: 'Delete your account?' },
  deleted: { eyebrow: 'PILOT ACCOUNT', title: 'Account deleted.' },
};

/** Hands a file to the browser's downloads. */
function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function RecoveryKeys({ keys, email }: { keys: RecoveryKey[]; email: string }) {
  const [copied, setCopied] = useState('');
  const text = `RELAY recovery keys for ${email}\nEach key recovers your account once.\n\n${keys.map(k => `${k.key}${k.used ? '  (used)' : ''}`).join('\n')}\n`;
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied('Copied to the clipboard.'); }
    catch { setCopied('Copy is unavailable here. Use Download instead.'); }
  }
  const download = () => saveFile(new Blob([text], { type: 'text/plain' }), 'relay-recovery-keys.txt');
  return <>
    <ol className="recovery-keys" aria-label="Recovery keys">{keys.map(k => <li key={k.key} className={k.used ? 'used' : ''}><code>{k.key}</code>{k.used && <small>used</small>}</li>)}</ol>
    {keys.some(k => k.used) && <p className="field-hint">Used keys are crossed out and no longer work. Regenerate keys from your account for a full set.</p>}
    <div className="key-actions">
      <button type="button" className="button secondary" onClick={() => void copy()}><ClipboardCopy size={15}/> Copy</button>
      <button type="button" className="button secondary" onClick={download}><Download size={15}/> Download</button>
    </div>
    {copied && <p className="field-hint" role="status">{copied}</p>}
  </>;
}

export function AccountPanel({ account, link, inSquad, onChanged, onDeleted, onClose }: {
  account: Account | null;
  link: AccountLink | null;
  inSquad: boolean;
  /** Called after sign-in state changes so the app can refresh its pilot session. */
  onChanged: () => Promise<void>;
  /** Forget personal data this browser keeps, such as the saved callsign. */
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<AccountView>(() => link ? link.kind : account ? 'profile' : 'signin');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [showPassword, setShowPassword] = useState(false);
  const [newEmail, setNewEmail] = useState(''), [currentPassword, setCurrentPassword] = useState(''), [recoveryKey, setRecoveryKey] = useState('');
  const [keys, setKeys] = useState<RecoveryKey[]>([]), [keySet, setKeySet] = useState(''), [keysStored, setKeysStored] = useState(false), [understood, setUnderstood] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false), [pendingMessage, setPendingMessage] = useState(''), [resendToken, setResendToken] = useState('');
  const [captcha, setCaptcha] = useState<Captcha | null>(null), [captchaAnswer, setCaptchaAnswer] = useState(''), [captchaError, setCaptchaError] = useState('');
  const captchaRequest = useRef(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [verifyState, setVerifyState] = useState<'pending' | 'done' | 'failed'>('pending');
  // A link may open in a fresh browser before the app's session bootstrap sets the CSRF cookie.
  const ready = useRef<Promise<void>>(Promise.resolve());
  const changed = useRef(onChanged);
  changed.current = onChanged;

  /** Switch screens, discarding anything typed; the email field is kept for convenience. */
  function go(next: AccountView) {
    setView(next); setError(''); setNotice(''); setPassword(''); setShowPassword(false); setPendingActivation(false);
    setNewEmail(''); setCurrentPassword(''); setRecoveryKey(''); setKeys([]); setKeySet(''); setKeysStored(false); setUnderstood(false);
  }

  async function loadCaptcha(clearAnswer = false) {
    const request = ++captchaRequest.current;
    setCaptcha(null); setCaptchaError('');
    if (clearAnswer) setCaptchaAnswer('');
    try {
      const next = await api<Captcha>('account/captcha/');
      if (request === captchaRequest.current) setCaptcha(next);
    } catch (e) { if (request === captchaRequest.current) setCaptchaError((e as Error).message); }
  }

  async function submit(path: string, body: Record<string, unknown>, after: (result: AccountResponse) => void | Promise<void>, onError?: (e: ApiError) => boolean) {
    const protectedForm = CAPTCHA_PATHS.includes(path);
    setBusy(true); setError(''); setNotice('');
    try {
      await ready.current;
      const result = await api<AccountResponse>(path, protectedForm ? { ...body, captcha_id: captcha?.captcha_id ?? '', captcha_answer: captchaAnswer } : body);
      setCsrf(result.csrf);
      await after(result);
    } catch (e) {
      if (!(e instanceof ApiError && onError?.(e))) setError((e as Error).message);
    } finally {
      setBusy(false);
      // The server spent the challenge whatever the outcome: show a new image.
      if (protectedForm) { setCaptcha(null); setCaptchaAnswer(''); }
    }
  }

  useEffect(() => {
    // Refresh on open: the email may have been verified, or the session ended, in another browser.
    ready.current = changed.current().catch(() => undefined);
    if (link?.kind !== 'verify') return;
    void ready.current.then(() => api<AccountResponse>('account/verify-email/', { token: link.token }))
      .then(async result => {
        setCsrf(result.csrf);
        setNotice(result.reactivated ? `${result.verified_email} is confirmed and your account is active again. Sign in to continue.` : `${result.verified_email} is confirmed. Thanks!`);
        setVerifyState('done'); await changed.current();
      })
      .catch(e => { setError((e as Error).message); setVerifyState('failed'); });
  }, []); // Mount only: a link is used once.

  useEffect(() => {
    // Each protected form needs an unspent challenge; opening the dialog always starts with a new one.
    if (CAPTCHA_VIEWS.includes(view) && !captcha && !captchaError) void loadCaptcha();
  }, [view, captcha, captchaError]);

  useEffect(() => {
    // The session may finish loading after the dialog opens.
    if (account && (view === 'signin' || view === 'signup')) setView('profile');
  }, [account, view]);

  const signIn = () => { setPendingActivation(false); return submit('account/login/', { email, password }, async () => { await onChanged(); go('profile'); }, e => {
    if (!(e.data as { activation_required?: boolean })?.activation_required) return false;
    setPendingActivation(true); setNotice(''); setPendingMessage(e.message); setResendToken((e.data as { resend_token?: string }).resend_token ?? ''); return true;
  }); };
  const resendActivation = () => submit('account/verify-email/resend/', { resend_token: resendToken }, result => {
    setPendingActivation(false); setNotice(`Activation link sent to ${result.email}. Open it, then sign in.`);
  });
  const signUp = () => submit('account/signup/', { email, password }, async result => {
    await onChanged(); go('profile');
    setNotice(result.verification_sent
      ? `Welcome aboard. We sent a verification link to ${result.account?.email}.`
      : 'Your account is ready, but we could not send the verification email. Try sending it again below.');
  });
  const requestReset = () => submit('account/password-reset/', { email }, result => setNotice(result.detail ?? ''));
  const resetPassword = () => link?.kind === 'reset' && submit('account/password-reset/confirm/', { uid: link.uid, token: link.token, password }, async () => {
    await onChanged(); go('profile'); setNotice('Password updated. You’re signed in on this device; other devices were signed out.');
  });
  const resend = () => submit('account/verify-email/resend/', {}, result => setNotice(result.verification_sent ? `Verification link sent to ${result.account?.email}.` : 'Your email is already verified.'));
  const signOut = () => submit('account/logout/', {}, async () => { await onChanged(); go('signin'); setNotice('Signed out. You can keep playing as a guest.'); });
  const recover = () => submit('account/recover/', { email, key: recoveryKey, password }, async result => {
    await onChanged(); go('profile');
    const left = result.account?.recovery_keys_remaining ?? 0;
    setNotice(`Account recovered and signed out everywhere else. That key is now used; ${left} ${left === 1 ? 'key remains' : 'keys remain'}.${left < 3 ? ' Regenerate your keys soon.' : ''}`);
  });

  // Email/password change: validate, warn about signing out everywhere, then (email only) confirm stored keys.
  const emailChange = newEmail.trim() !== '', passwordChange = password !== '';
  const changeBody = () => ({ current_password: currentPassword, ...(emailChange ? { new_email: newEmail.trim() } : {}), ...(passwordChange ? { new_password: password } : {}) });
  const checkChange = () => {
    if (!emailChange && !passwordChange) { setError('Enter a new email, a new password, or both.'); return; }
    void submit('account/change/', { ...changeBody(), validate_only: true }, () => setView('confirm-change'));
  };
  const cancelChange = (message: string) => { go('profile'); setNotice(message); };
  const confirmChange = () => emailChange
    ? submit('account/recovery-keys/', { password: currentPassword }, result => { setKeys(result.keys ?? []); setKeySet(result.recovery_set ?? ''); setKeysStored(false); setView('keys'); })
    : finishChange();
  const finishChange = () => submit('account/change/', { ...changeBody(), ...(emailChange ? { recovery_set: keySet, keys_confirmed: keysStored } : {}) }, async result => {
    await onChanged(); go('signin'); setEmail(result.email ?? '');
    setNotice(!result.email_changed
      ? 'Password changed and you were signed out everywhere. Sign in with your new password.'
      : result.activation_sent
        ? `Signed out everywhere. Your account is deactivated until you open the link we sent to ${result.email}. Then sign in with that email.`
        : `Signed out everywhere. We could not send the activation email to ${result.email}. Sign in with that email to send it again.`);
  });
  const deleteAccount = () => submit('account/delete/', { password: currentPassword, confirm: understood }, async () => {
    await onChanged(); onDeleted(); go('deleted');
  });
  // The export is a file, not an account response, so it skips submit()'s CSRF and CAPTCHA handling.
  const exportData = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await ready.current;
      const file = await apiFile('account/export/', { password: currentPassword });
      saveFile(file.blob, file.filename);
      go('profile'); setNotice(`Downloaded ${file.filename}. It contains personal data, so keep it somewhere private.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const regenerate = () => submit('account/recovery-keys/', { password: currentPassword, regenerate: account?.recovery_keys_remaining != null }, async result => {
    setKeys(result.keys ?? []); setKeysStored(false); setCurrentPassword(''); setView('new-keys'); await onChanged();
  });

  const passwordInput = (label: string, value: string, set: (v: string) => void, autoComplete: 'current-password' | 'new-password', opts: { autoFocus?: boolean; required?: boolean; hint?: string } = {}) => <>
    <label>{label}<input type={showPassword ? 'text' : 'password'} value={value} onChange={e => set(e.target.value)} autoComplete={autoComplete} autoFocus={opts.autoFocus} minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={128} required={opts.required ?? true}/></label>
    {autoComplete === 'new-password' && <p className="field-hint">{opts.hint ?? 'At least 8 characters. Avoid common, all-number, or email-like passwords.'}</p>}
  </>;
  const showToggle = (label = 'Show password') => <label className="check-label"><input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)}/> {label}</label>;
  const passwordField = (label: string, autoComplete: 'current-password' | 'new-password', autoFocus = false) => <>{passwordInput(label, password, setPassword, autoComplete, { autoFocus })}{showToggle()}</>;
  const emailField = <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus maxLength={254} required/></label>;
  const captchaField = <div className="captcha">
    <div className="captcha-image">
      {captcha ? <img src={captcha.image} width={240} height={80} alt="CAPTCHA image: five distorted letters and numbers"/> : <span role={captchaError ? 'alert' : undefined}>{captchaError || 'Loading a new image…'}</span>}
      <button type="button" className="captcha-refresh" aria-label="Show a new image" title="Show a new image" disabled={busy} onClick={() => void loadCaptcha(true)}><RefreshCw size={16}/></button>
    </div>
    <label>Characters in the image<input value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)} autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={12} required/></label>
    <p className="field-hint">Not case-sensitive. Can’t read it? Show a new image.</p>
  </div>;
  const feedback = <>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-note" role="status">{notice}</p>}</>;
  const action = (label: string, busyLabel: string, Icon: typeof LogIn, disabled = false) => <button className="button full" disabled={busy || disabled}>{busy ? <LoaderCircle className="spin" size={17}/> : <Icon size={17}/>} {busy ? busyLabel : label}</button>;
  const whatChanges = emailChange && passwordChange ? 'email and password' : emailChange ? 'email' : 'password';

  return <div className="account-panel">
    <span className="eyebrow">{views[view].eyebrow}</span>
    <h2 id="modal-title">{view === 'regenerate' && account?.recovery_keys_remaining == null ? 'Create recovery keys.' : views[view].title}</h2>

    {view === 'signin' && <>
      <p>Accounts are optional. Guests can play every destination, solo or with a squad.</p>
      <form onSubmit={e => { e.preventDefault(); void signIn(); }}>
        {emailField}{passwordField('Password', 'current-password')}{captchaField}{feedback}
        {pendingActivation && <div className="account-warning" role="alert"><MailWarning size={20}/><p>{pendingMessage}</p></div>}
        {pendingActivation && <button type="button" className="button secondary full" disabled={busy} onClick={() => void resendActivation()}><Mail size={16}/> Send a new activation link</button>}
        {action('Sign in', 'Signing in…', LogIn, !captcha)}
      </form>
      <div className="form-links">
        <button type="button" className="text-button" onClick={() => go('forgot')}>Forgot password?</button>
        <button type="button" className="text-button" onClick={() => { const keep = email; go('recover'); setEmail(keep); }}>Use a recovery key</button>
        <button type="button" className="text-button" onClick={() => go('signup')}>Create an account <ArrowUpRight size={13}/></button>
      </div>
    </>}

    {view === 'signup' && <>
      <p>Optional — you can keep playing as a guest. Your account will let RELAY save expedition results and squad settings in a future update. Signing up links this browser’s pilot to your email.</p>
      <form onSubmit={e => { e.preventDefault(); void signUp(); }}>
        {emailField}{passwordField('Password', 'new-password')}{captchaField}{feedback}
        {action('Create account', 'Creating account…', UserRound, !captcha)}
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => go('signin')}>Already have an account? Sign in <ArrowUpRight size={13}/></button></div>
    </>}

    {view === 'forgot' && <>
      <p>Enter your account email and we’ll send a link to choose a new password. The link works once and expires in an hour.</p>
      <form onSubmit={e => { e.preventDefault(); void requestReset(); }}>
        {emailField}{captchaField}{feedback}
        {action('Send reset link', 'Sending…', Mail, !captcha)}
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => go('signin')}>Back to sign in <ArrowUpRight size={13}/></button></div>
    </>}

    {view === 'reset' && <>
      <p>Choose a new password for your pilot account. Other devices will be signed out.</p>
      <form onSubmit={e => { e.preventDefault(); void resetPassword(); }}>
        {passwordField('New password', 'new-password', true)}{feedback}
        {action('Save new password', 'Saving…', BadgeCheck)}
      </form>
      {error && <div className="form-links"><button type="button" className="text-button" onClick={() => go('forgot')}>Request a new link <ArrowUpRight size={13}/></button></div>}
    </>}

    {view === 'recover' && <>
      <p>Lost access to your email? Enter your account email, or the one you used before a change, with an unused recovery key. Choose a new password and you’re back in. If an email change is still unconfirmed, your previous email is restored.</p>
      <form onSubmit={e => { e.preventDefault(); void recover(); }}>
        {emailField}
        <label>Recovery key<input value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="1234-5678-9012" maxLength={40} required/></label>
        {passwordField('New password', 'new-password')}{feedback}
        {action('Recover account', 'Recovering…', LifeBuoy)}
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => go('signin')}>Back to sign in <ArrowUpRight size={13}/></button></div>
    </>}

    {view === 'verify' && <>
      {verifyState === 'pending' && <p className="account-progress"><LoaderCircle className="spin" size={16}/> Checking your verification link…</p>}
      {feedback}
      {verifyState === 'done' && <button className="button full" onClick={account ? onClose : () => go('signin')}>{account ? 'Back to the expedition' : 'Sign in'} <ArrowUpRight size={16}/></button>}
      {verifyState === 'failed' && <div className="form-links"><button type="button" className="text-button" onClick={() => go(account ? 'profile' : 'signin')}>{account ? 'Send a new link' : 'Sign in to send a new link'} <ArrowUpRight size={13}/></button></div>}
    </>}

    {view === 'profile' && account && <>
      <div className="account-card">
        <UserRound size={20}/>
        <div><strong>{account.email}</strong>{account.email_verified
          ? <span className="account-status verified"><BadgeCheck size={13}/> Email verified</span>
          : <span className="account-status"><MailWarning size={13}/> Email not verified yet</span>}
        <span className="account-status keys"><KeyRound size={13}/> {account.recovery_keys_remaining == null ? 'No recovery keys yet' : `Recovery keys: ${account.recovery_keys_remaining} of 8 unused`}</span></div>
      </div>
      <p>Pilots you fly in this browser are linked to this account. Saved expedition results and squad settings are coming in a future update.</p>
      {feedback}
      {!account.email_verified && <button className="button secondary full" disabled={busy} onClick={() => void resend()}><Mail size={16}/> Resend verification email</button>}
      <button className="button secondary full" disabled={busy} onClick={() => go('change')}><UserPen size={16}/> Change email or password</button>
      <button className="button secondary full" disabled={busy} onClick={() => go('regenerate')}><KeyRound size={16}/> {account.recovery_keys_remaining == null ? 'Create recovery keys' : 'Regenerate recovery keys'}</button>
      <button className="button secondary full" disabled={busy} onClick={() => go('export')}><Download size={16}/> Download my data</button>
      <button className="button secondary full" disabled={busy} onClick={() => void signOut()}><LogOut size={16}/> Sign out</button>
      <p className="field-hint">Signing out ends this browser’s pilot session{inSquad ? ' and leaves your current squad' : ''}. You can keep playing as a guest.</p>
      <div className="danger-zone"><button type="button" className="text-button danger" disabled={busy} onClick={() => go('delete')}><Trash2 size={13}/> Delete account</button></div>
    </>}
    {view === 'profile' && !account && <>{feedback}<button className="button full" onClick={() => go('signin')}><LogIn size={16}/> Sign in</button></>}

    {view === 'change' && account && <>
      <p>Leave a field blank to keep it. Either change signs you out on every device.</p>
      <form onSubmit={e => { e.preventDefault(); checkChange(); }}>
        <label>New email<input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={account.email} autoComplete="email" autoFocus maxLength={254}/></label>
        {passwordInput('New password', password, setPassword, 'new-password', { required: false })}
        {passwordInput('Current password', currentPassword, setCurrentPassword, 'current-password')}
        {showToggle('Show passwords')}{feedback}
        {action('Continue', 'Checking…', ArrowUpRight)}
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => go('profile')}>Cancel</button></div>
    </>}

    {view === 'confirm-change' && account && <>
      <div className="account-warning"><ShieldAlert size={20}/><p>Changing your {whatChanges} signs you out of RELAY on <strong>every device, including this one</strong>{inSquad ? ', and this browser leaves its current squad' : ''}.</p></div>
      {emailChange
        ? <p>Your account is then deactivated until you open the link we send to <strong>{newEmail.trim()}</strong>. Next, you’ll save recovery keys in case you can’t reach that address.</p>
        : <p>Then sign in again with your new password.</p>}
      {feedback}
      <button className="button full" disabled={busy} onClick={() => void confirmChange()}>{busy ? <LoaderCircle className="spin" size={17}/> : emailChange ? <KeyRound size={17}/> : <LogOut size={17}/>} {emailChange ? 'Continue to recovery keys' : 'Change password and sign out'}</button>
      <button className="button secondary full" disabled={busy} onClick={() => cancelChange('Nothing was changed.')}>Cancel</button>
    </>}

    {view === 'keys' && account && <>
      <p>Each key recovers your account once if you can’t reach your email, for example if <strong>{newEmail.trim()}</strong> has a typo. Store them somewhere safe, such as a password manager. Until you regenerate them, these same keys are shown every time you change your email.</p>
      <RecoveryKeys keys={keys} email={account.email}/>
      <form onSubmit={e => { e.preventDefault(); void finishChange(); }}>
        <label className="check-label"><input type="checkbox" checked={keysStored} onChange={e => setKeysStored(e.target.checked)}/> I have stored these recovery keys somewhere safe</label>
        {feedback}
        {action(`Change email to ${newEmail.trim()}`, 'Changing email…', Mail, !keysStored)}
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => cancelChange(`Your email was not changed. It is still ${account.email}.`)}>Cancel and keep {account.email}</button></div>
    </>}

    {view === 'regenerate' && account && <>
      <p>{account.recovery_keys_remaining == null
        ? 'Recovery keys let you back in if you lose access to your email. Each works once.'
        : 'Your current keys stop working as soon as the new ones are created.'}</p>
      <form onSubmit={e => { e.preventDefault(); void regenerate(); }}>
        {passwordInput('Current password', currentPassword, setCurrentPassword, 'current-password', { autoFocus: true })}
        {showToggle()}{feedback}
        {action(account.recovery_keys_remaining == null ? 'Create keys' : 'Replace my keys', 'Creating keys…', KeyRound)}
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => go('profile')}>Cancel</button></div>
    </>}

    {view === 'export' && account && <>
      <p>Get a copy of what RELAY stores about you, as a JSON file:</p>
      <ul className="account-list">
        <li>Your email address and account details</li>
        <li>Your pilots and their callsigns</li>
        <li>Squads you created or joined, with ORA’s replies in them</li>
        <li>The messages you wrote to ORA</li>
      </ul>
      <p>Your password and recovery keys aren’t included, and neither are other players’ callsigns or messages.</p>
      <form onSubmit={e => { e.preventDefault(); void exportData(); }}>
        {passwordInput('Current password', currentPassword, setCurrentPassword, 'current-password', { autoFocus: true })}
        {showToggle()}{feedback}
        {action('Download JSON file', 'Preparing your file…', Download)}
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => go('profile')}>Cancel</button></div>
    </>}

    {view === 'delete' && account && <>
      <div className="account-warning"><ShieldAlert size={20}/><p>This can’t be undone. You’ll be signed out on <strong>every device</strong>{inSquad ? ', and this browser leaves its current squad' : ''}.</p></div>
      <p><strong>Erased:</strong></p>
      <ul className="account-list">
        <li>Your email address and password, and your recovery keys</li>
        <li>Every callsign you flew, wherever it appears, including in squadmates’ messages</li>
        <li>Squad names you created and the messages you wrote to ORA</li>
      </ul>
      <p><strong>Kept, without anything that identifies you:</strong> scores, positions, mission events and other gameplay records, so RELAY can study how the game is played. You can create a new account with this email later; it won’t be connected to this one.</p>
      <form onSubmit={e => { e.preventDefault(); void deleteAccount(); }}>
        {passwordInput('Current password', currentPassword, setCurrentPassword, 'current-password', { autoFocus: true })}
        {showToggle()}
        <label className="check-label"><input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)}/> I understand my account can’t be restored</label>
        {feedback}
        <button className="button danger full" disabled={busy || !understood}>{busy ? <LoaderCircle className="spin" size={17}/> : <Trash2 size={17}/>} {busy ? 'Deleting…' : 'Delete my account'}</button>
      </form>
      <div className="form-links"><button type="button" className="text-button" onClick={() => cancelChange('Nothing was changed.')}>Cancel and keep my account</button></div>
    </>}

    {view === 'deleted' && <>
      <p>Your personal data was erased and you were signed out everywhere. We sent a final confirmation to your former address, which is no longer stored. You can keep exploring as a guest.</p>
      <button className="button full" onClick={onClose}>Keep exploring <ArrowUpRight size={16}/></button>
    </>}

    {view === 'new-keys' && account && <>
      <p>These keys replace any earlier ones, which no longer work. Each recovers your account once. Store them somewhere safe, such as a password manager.</p>
      <RecoveryKeys keys={keys} email={account.email}/>
      <label className="check-label standalone"><input type="checkbox" checked={keysStored} onChange={e => setKeysStored(e.target.checked)}/> I have stored these recovery keys somewhere safe</label>
      <button className="button full" disabled={!keysStored} onClick={() => go('profile')}><BadgeCheck size={17}/> Done</button>
    </>}
  </div>;
}

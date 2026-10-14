import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ErrorBanner, Page, PinPad, ScanPrompt, BigInput } from '@brainfactory/ui';
import { api, saveSession } from '../api.js';
import { useLang } from '../lang.js';

/**
 * Screen 1/3 — 登入. Scan badge = login, PIN = fallback.
 * The manual badge-code field is a trial aid until scanners arrive.
 */
export default function WorkerLogin() {
  const { t, lang, setLang } = useLang();
  const nav = useNavigate();
  const [mode, setMode] = useState<'scan' | 'pin'>('scan');
  const [badge, setBadge] = useState('');
  const [error, setError] = useState('');

  const done = (token: string, user: { sub: string; name: string; role: string; lang: string }) => {
    saveSession(token, user as never);
    if (user.lang === 'vi' || user.lang === 'zh') setLang(user.lang);
    nav(user.role === 'ADMIN' ? '/admin' : '/jobs');
  };

  const login = async (body: { badgeCode?: string; pin?: string }) => {
    setError('');
    try {
      const r = await api.login(body);
      if (!r.ok) {
        setError(t.login.error);
        return;
      }
      done(r.token, r.user);
    } catch {
      setError(t.login.error);
    }
  };

  return (
    <Page>
      <div style={{ textAlign: 'right' }}>
        <button
          onClick={() => setLang(lang === 'zh' ? 'vi' : 'zh')}
          style={{ background: 'none', border: '1px solid var(--bf-border)', color: 'var(--bf-text)', borderRadius: 8, padding: '6px 12px', fontSize: 14 }}
        >
          {lang === 'zh' ? 'Tiếng Việt' : '中文'}
        </button>
      </div>
      {mode === 'scan' ? (
        <>
          <ScanPrompt title={t.login.title} hint={t.login.scanHint} />
          <Card>
            <BigInput
              placeholder="BF-USER-…（試用手輸）"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              inputMode="text"
            />
            <div style={{ marginTop: 12 }}>
              <Button size="lg" onClick={() => login({ badgeCode: badge.trim() })} disabled={!badge.trim()}>
                {t.login.submit}
              </Button>
            </div>
          </Card>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => setMode('pin')}
              style={{ background: 'none', border: 'none', color: 'var(--bf-text-2)', fontSize: 16, textDecoration: 'underline' }}
            >
              {t.login.pinFallback}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bf-scan-title" style={{ textAlign: 'center' }}>{t.login.pinTitle}</div>
          <PinPad onDone={(pin) => login({ pin })} />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              onClick={() => setMode('scan')}
              style={{ background: 'none', border: 'none', color: 'var(--bf-text-2)', fontSize: 16, textDecoration: 'underline' }}
            >
              ←
            </button>
          </div>
        </>
      )}
      {error && <ErrorBanner text={error} />}
    </Page>
  );
}

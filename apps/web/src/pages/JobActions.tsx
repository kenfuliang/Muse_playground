import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BigInput, Button, Card, ErrorBanner, Field, Flash, Modal, Page, StatusPill, TopBar, WarnBanner,
} from '@brainfactory/ui';
import { api, clearSession, getSessionUser } from '../api.js';
import { useLang } from '../lang.js';

/** Screen 3/3 — 工單動作. Only this job's actions: 開工 / 報工 / 完工. */
export default function JobActions() {
  const { t, lang } = useLang();
  const { id } = useParams();
  const nav = useNavigate();
  const user = getSessionUser();
  const [job, setJob] = useState<any>(null);
  const [reporting, setReporting] = useState(false);
  const [shots, setShots] = useState('');
  const [good, setGood] = useState('');
  const [ng, setNg] = useState('');
  const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState('');

  const load = () => { if (id) api.job(id).then(setJob).catch(() => setError(t.common.error)); };
  useEffect(() => { load(); }, [id]);

  const showFlash = (kind: 'success' | 'error', text: string) => {
    setFlash({ kind, text });
    setTimeout(() => setFlash(null), 1200);
  };

  const doStart = async () => {
    try { setJob(await api.start(id!)); } catch { setError(t.common.error); }
  };
  const doComplete = async () => {
    if (!window.confirm(t.job.confirmComplete)) return;
    try { setJob(await api.complete(id!)); showFlash('success', t.status.COMPLETED); }
    catch { setError(t.common.error); }
  };
  const doReport = async () => {
    try {
      const r = await api.report(id!, {
        shotCount: Number(shots) || 0,
        goodQty: Number(good) || 0,
        ngQty: Number(ng) || 0,
      });
      setReporting(false);
      setShots(''); setGood(''); setNg('');
      showFlash('success', t.job.reportSuccess);
      if (r.maintenanceDue) {
        // mold hit its maintenance interval — surface it loudly
        setTimeout(() => alert('⚠️ ' + (lang === 'vi' ? 'Khuôn đến kỳ bảo dưỡng!' : '模具該保養了！')), 1300);
      }
      load();
    } catch {
      setError(t.common.error);
    }
  };

  if (!job) return <Page>{error ? <ErrorBanner text={error} /> : t.common.loading}</Page>;

  return (
    <div>
      {flash && <Flash kind={flash.kind} text={flash.text} />}
      <TopBar
        left={<span><strong>{user?.name}</strong> · {job.code}</span>}
        right={
          <span>
            <button onClick={() => nav('/jobs')} style={{ background: 'none', border: 'none', color: 'var(--bf-text-2)', fontSize: 14, marginRight: 12 }}>
              {t.job.back}
            </button>
            <button onClick={() => { clearSession(); nav('/'); }} style={{ background: 'none', border: 'none', color: 'var(--bf-text-2)', fontSize: 14 }}>
              {t.common.logout}
            </button>
          </span>
        }
      />
      <Page>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{job.productName}</h2>
          <StatusPill status={job.status} label={t.status[job.status as keyof typeof t.status]} />
        </div>
        <Card>
          <div className="bf-job-meta">
            <div><div className="k">{t.jobs.workOrderNo}</div><div>{job.code}</div></div>
            <div><div className="k">{t.jobs.plannedQty}</div><div>{job.plannedQty}</div></div>
            <div><div className="k">{t.jobs.machine}</div><div>{job.machine?.code} {job.machine?.name}</div></div>
            <div><div className="k">{t.jobs.mold}</div><div>{job.mold?.code}</div></div>
          </div>
        </Card>

        {job.status === 'SCHEDULED' && (
          <Button size="lg" kind="primary" onClick={doStart}>{t.job.start}</Button>
        )}
        {job.status === 'IN_PROGRESS' && (
          <>
            <Button size="lg" kind="primary" onClick={() => setReporting(true)}>{t.job.report}</Button>
            <Button size="lg" kind="success" onClick={doComplete}>{t.job.complete}</Button>
          </>
        )}
        {error && <ErrorBanner text={error} />}

        {reporting && (
          <Modal onClose={() => setReporting(false)}>
            <h3 style={{ marginTop: 0 }}>{t.job.report}</h3>
            <Field label={`${t.job.shots} — ${t.job.shotsHint}`}>
              <BigInput inputMode="numeric" value={shots} onChange={(e) => setShots(e.target.value)} placeholder="0" />
            </Field>
            <Field label={t.job.goodQty}>
              <BigInput inputMode="numeric" value={good} onChange={(e) => setGood(e.target.value)} placeholder="0" />
            </Field>
            <Field label={t.job.ngQty}>
              <BigInput inputMode="numeric" value={ng} onChange={(e) => setNg(e.target.value)} placeholder="0" />
            </Field>
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              <Button size="lg" kind="primary" onClick={doReport}>{t.job.submitReport}</Button>
              <Button size="lg" kind="ghost" onClick={() => setReporting(false)}>{t.common.cancel}</Button>
            </div>
          </Modal>
        )}
      </Page>
    </div>
  );
}

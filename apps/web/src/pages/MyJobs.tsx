import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, Page, StatusPill, TopBar } from '@brainfactory/ui';
import { api, clearSession, getSessionUser } from '../api.js';
import { useLang } from '../lang.js';

/** Screen 2/3 — 我的工單. Only jobs assigned to me, open states only. */
export default function MyJobs() {
  const { t } = useLang();
  const nav = useNavigate();
  const user = getSessionUser();
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    api.myJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  return (
    <div>
      <TopBar
        left={<strong>{user?.name}</strong>}
        right={
          <button
            onClick={() => { clearSession(); nav('/'); }}
            style={{ background: 'none', border: 'none', color: 'var(--bf-text-2)', fontSize: 14 }}
          >
            {t.common.logout}
          </button>
        }
      />
      <Page>
        <h2 style={{ margin: '8px 0' }}>{t.jobs.title}</h2>
        {jobs.length === 0 && <EmptyState text={t.jobs.empty} />}
        {jobs.map((j) => (
          <Card key={j.id} onClick={() => nav(`/jobs/${j.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 20 }}>{j.code}</strong>
              <StatusPill status={j.status} label={t.status[j.status as keyof typeof t.status]} />
            </div>
            <div className="bf-job-meta">
              <div><div className="k">{t.jobs.product}</div><div>{j.productName}</div></div>
              <div><div className="k">{t.jobs.plannedQty}</div><div>{j.plannedQty}</div></div>
              <div><div className="k">{t.jobs.machine}</div><div>{j.machine?.code}</div></div>
              <div><div className="k">{t.jobs.mold}</div><div>{j.mold?.code}</div></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Button size="lg" kind="ghost" onClick={() => nav(`/jobs/${j.id}`)}>{t.jobs.open}</Button>
            </div>
          </Card>
        ))}
      </Page>
    </div>
  );
}

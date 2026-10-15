import { useEffect, useState } from 'react';
import {
  BigInput, Button, Card, DataTable, EmptyState, Modal, StatusPill,
} from '@brainfactory/ui';
import { t as dict } from '@brainfactory/shared';
import { api } from '../api.js';

const t = dict('zh');
const qcT = t.qc;

/**
 * 品檢 tab（管理端，繁中）.
 * 待檢列表 → 錄結果（PASS/NG）→ NG 自動隔離 → 处置（重工/報廢/特採）.
 */
export default function QcPanel() {
  const [pending, setPending] = useState<any[]>([]);
  const [ngRecords, setNgRecords] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [newForm, setNewForm] = useState({ workOrderId: '', type: 'FIRST_ARTICLE' as string, note: '' });
  const [resultId, setResultId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ status: 'PASS' as string, note: '', ngQty: '', ngReason: '' });
  const [disposeId, setDisposeId] = useState<string | null>(null);
  const [disposeForm, setDisposeForm] = useState({ disposition: 'REWORK' as string, note: '' });

  const refresh = async () => {
    setPending(await api.qcPending().catch(() => []));
    setNgRecords(await api.qcNgRecords().catch(() => []));
  };

  useEffect(() => { refresh(); }, []);

  const openNew = async () => {
    setOrders(await api.allJobs().catch(() => []));
    setShowNew(true);
  };

  const createInspection = async () => {
    await api.qcCreate({
      workOrderId: newForm.workOrderId,
      type: newForm.type as 'FIRST_ARTICLE' | 'PATROL',
      note: newForm.note || undefined,
    });
    setShowNew(false);
    setNewForm({ workOrderId: '', type: 'FIRST_ARTICLE', note: '' });
    refresh();
  };

  const submitResult = async () => {
    if (!resultId) return;
    await api.qcResult(resultId, {
      status: resultForm.status as 'PASS' | 'NG',
      note: resultForm.note || undefined,
      ngQty: resultForm.status === 'NG' ? Number(resultForm.ngQty) : undefined,
      ngReason: resultForm.status === 'NG' ? resultForm.ngReason : undefined,
    });
    setResultId(null);
    setResultForm({ status: 'PASS', note: '', ngQty: '', ngReason: '' });
    refresh();
  };

  const submitDispose = async () => {
    if (!disposeId) return;
    await api.qcDispose(disposeId, {
      disposition: disposeForm.disposition as 'REWORK' | 'SCRAP' | 'CONCESSION',
      note: disposeForm.note || undefined,
    });
    setDisposeId(null);
    setDisposeForm({ disposition: 'REWORK', note: '' });
    refresh();
  };

  const typeLabel = (ty: string) => (ty === 'FIRST_ARTICLE' ? qcT.firstArticle : qcT.patrol);
  const statusLabel = (s: string) =>
    s === 'PENDING' ? qcT.pending : s === 'PASS' ? qcT.pass : qcT.ng;
  const dispLabel = (d: string) =>
    d === 'QUARANTINE' ? qcT.quarantine : d === 'REWORK' ? qcT.rework : d === 'SCRAP' ? qcT.scrap : qcT.concession;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button size="md" onClick={openNew}>＋ 開檢驗單</Button>
      </div>

      <h3 style={{ fontSize: 16, margin: '16px 0 8px' }}>待檢 ({pending.length})</h3>
      {pending.length > 0 ? (
        <DataTable
          columns={['檢驗單', '工單', '類型', '狀態', '']}
          rows={pending.map((p) => [
            <span key="i">{p.id.slice(-6)}</span>,
            <span key="w">{p.workOrder?.code ?? p.workOrderId.slice(-6)}</span>,
            <span key="t">{typeLabel(p.type)}</span>,
            <span key="s"><StatusPill status={p.status} label={statusLabel(p.status)} /></span>,
            <Button key="b" size="sm" onClick={() => setResultId(p.id)}>錄結果</Button>,
          ])}
        />
      ) : (
        <EmptyState text="目前沒有待檢項目" />
      )}

      <h3 style={{ fontSize: 16, margin: '24px 0 8px' }}>NG 記錄 ({ngRecords.length})</h3>
      {ngRecords.length > 0 ? (
        <DataTable
          columns={['數量', '原因', '處置', '']}
          rows={ngRecords.map((n) => [
            <span key="q">{n.qty}</span>,
            <span key="r">{n.reason}</span>,
            <span key="d">{dispLabel(n.disposition)}</span>,
            n.disposition === 'QUARANTINE'
              ? <Button key="b" size="sm" kind="ghost" onClick={() => setDisposeId(n.id)}>處置</Button>
              : <span key="b" style={{ color: 'var(--bf-text-2)', fontSize: 13 }}>已處置</span>,
          ])}
        />
      ) : (
        <EmptyState text="尚無 NG 記錄" />
      )}

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <Card>
            <h3>開檢驗單</h3>
            <label>工單
              <select
                className="bf-select"
                value={newForm.workOrderId}
                onChange={(e) => setNewForm({ ...newForm, workOrderId: e.target.value })}
              >
                <option value="">選擇…</option>
                {orders.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.code} {o.productName}</option>
                ))}
              </select>
            </label>
            <label>類型
              <select
                className="bf-select"
                value={newForm.type}
                onChange={(e) => setNewForm({ ...newForm, type: e.target.value })}
              >
                <option value="FIRST_ARTICLE">{qcT.firstArticle}</option>
                <option value="PATROL">{qcT.patrol}</option>
              </select>
            </label>
            <label>備註<BigInput value={newForm.note} onChange={(e) => setNewForm({ ...newForm, note: e.target.value })} /></label>
            <div style={{ marginTop: 12 }}>
              <Button size="lg" onClick={createInspection} disabled={!newForm.workOrderId}>建立</Button>
            </div>
          </Card>
        </Modal>
      )}

      {resultId && (
        <Modal onClose={() => setResultId(null)}>
          <Card>
            <h3>錄檢驗結果</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              {(['PASS', 'NG'] as const).map((s) => (
                <Button
                  key={s}
                  size="lg"
                  kind={resultForm.status === s ? 'primary' : 'ghost'}
                  onClick={() => setResultForm({ ...resultForm, status: s })}
                >
                  {s === 'PASS' ? qcT.pass : qcT.ng}
                </Button>
              ))}
            </div>
            {resultForm.status === 'NG' && (
              <>
                <label>NG 數量<BigInput inputMode="numeric" value={resultForm.ngQty} onChange={(e) => setResultForm({ ...resultForm, ngQty: e.target.value })} /></label>
                <label>NG 原因<BigInput value={resultForm.ngReason} onChange={(e) => setResultForm({ ...resultForm, ngReason: e.target.value })} /></label>
              </>
            )}
            <label>備註<BigInput value={resultForm.note} onChange={(e) => setResultForm({ ...resultForm, note: e.target.value })} /></label>
            <div style={{ marginTop: 12 }}>
              <Button
                size="lg"
                onClick={submitResult}
                disabled={resultForm.status === 'NG' && (!resultForm.ngQty || !resultForm.ngReason)}
              >
                確認
              </Button>
            </div>
          </Card>
        </Modal>
      )}

      {disposeId && (
        <Modal onClose={() => setDisposeId(null)}>
          <Card>
            <h3>NG 處置</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['REWORK', 'SCRAP', 'CONCESSION'] as const).map((d) => (
                <Button
                  key={d}
                  size="md"
                  kind={disposeForm.disposition === d ? 'primary' : 'ghost'}
                  onClick={() => setDisposeForm({ ...disposeForm, disposition: d })}
                >
                  {dispLabel(d)}
                </Button>
              ))}
            </div>
            <label>備註<BigInput value={disposeForm.note} onChange={(e) => setDisposeForm({ ...disposeForm, note: e.target.value })} /></label>
            <div style={{ marginTop: 12 }}>
              <Button size="lg" onClick={submitDispose}>確認處置</Button>
            </div>
          </Card>
        </Modal>
      )}
    </div>
  );
}

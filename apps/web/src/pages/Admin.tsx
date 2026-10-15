import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BigInput, Button, Card, DataTable, EmptyState, Page, StatusPill, TopBar, WarnBanner,
} from '@brainfactory/ui';
import { t as dict } from '@brainfactory/shared';
import { api, clearSession, getSessionUser } from '../api.js';
import QcPanel from './QcPanel.js';

const t = dict('zh');

/**
 * 生管後台 (v1: 繁中 only).
 * Tabs: 工單 / 模具 / 機台 / 品檢. 工單建立 = 排程：選模具＋機台＋產品＋數量＋指派人.
 */
export default function Admin() {
  const nav = useNavigate();
  const user = getSessionUser();
  const [tab, setTab] = useState<'orders' | 'molds' | 'machines' | 'qc'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [molds, setMolds] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [due, setDue] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ productName: '', plannedQty: '', moldId: '', machineId: '', assigneeBadge: '', dueDate: '' });

  useEffect(() => {
    if (user?.role !== 'ADMIN') { nav('/'); return; }
    api.allJobs().then(setOrders).catch(() => {});
    api.molds().then(setMolds).catch(() => {});
    api.machines().then(setMachines).catch(() => {});
    api.maintenanceDue().then(setDue).catch(() => {});
  }, []);

  const createOrder = async () => {
    await api.createOrder({
      productName: form.productName,
      plannedQty: Number(form.plannedQty),
      moldId: form.moldId,
      machineId: form.machineId,
      assigneeBadge: form.assigneeBadge || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
    });
    setShowNew(false);
    setForm({ productName: '', plannedQty: '', moldId: '', machineId: '', assigneeBadge: '', dueDate: '' });
    setOrders(await api.allJobs());
    alert('工單已建立');
  };

  const doMaintain = async (id: string) => {
    const note = window.prompt('保養備註（可空）') ?? '';
    await api.maintain(id, note);
    setDue(await api.maintenanceDue());
    setMolds(await api.molds());
  };

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <TopBar
        left={<strong>生管後台 · {user?.name}</strong>}
        right={
          <button onClick={() => { clearSession(); nav('/'); }} style={{ background: 'none', border: 'none', color: 'var(--bf-text-2)', fontSize: 14 }}>
            登出
          </button>
        }
      />
      <Page>
        <div className="bf-tabs">
          {(['orders', 'molds', 'machines', 'qc'] as const).map((k) => (
            <Button key={k} size="md" kind={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>
              {k === 'orders' ? '工單' : k === 'molds' ? '模具' : k === 'machines' ? '機台' : '品檢'}
            </Button>
          ))}
        </div>

        {tab === 'qc' && <QcPanel />}

        {tab === 'orders' && (
          <>
            <Button size="md" onClick={() => setShowNew(!showNew)}>＋ 開工單（排程）</Button>
            {showNew && (
              <Card>
                <div className="bf-form-grid">
                  <label>產品名稱<BigInput value={form.productName} onChange={set('productName')} /></label>
                  <label>計畫數量<BigInput inputMode="numeric" value={form.plannedQty} onChange={set('plannedQty')} /></label>
                  <label>模具<select className="bf-select" value={form.moldId} onChange={set('moldId')}>
                    <option value="">選擇…</option>
                    {molds.map((m) => <option key={m.id} value={m.id}>{m.code} {m.name}</option>)}
                  </select></label>
                  <label>機台<select className="bf-select" value={form.machineId} onChange={set('machineId')}>
                    <option value="">選擇…</option>
                    {machines.map((m) => <option key={m.id} value={m.id}>{m.code} {m.name}</option>)}
                  </select></label>
                  <label>指派給（員工證條碼，如 BF-USER-w001，可空）<BigInput value={form.assigneeBadge} onChange={set('assigneeBadge')} placeholder="留空 = 未指派" /></label>
                  <label>交期<input type="date" className="bf-select" value={form.dueDate} onChange={set('dueDate')} /></label>
                  <Button size="lg" onClick={createOrder}>建立工單</Button>
                </div>
              </Card>
            )}
            <p style={{ color: 'var(--bf-text-2)', fontSize: 14 }}>工單建立後會出現在被指派工人的「我的工單」。</p>
            {orders.length > 0 && (
              <DataTable
                columns={['工單號', '產品', '數量', '狀態', '指派給']}
                rows={orders.map((o) => [
                  <span key="c">{o.code}</span>,
                  <span key="p">{o.productName}</span>,
                  <span key="q">{o.plannedQty}</span>,
                  <span key="s"><StatusPill status={o.status} label={t.status[o.status as keyof typeof t.status]} /></span>,
                  <span key="a">{o.assignee?.name ?? '—'}</span>,
                ])}
              />
            )}
          </>
        )}

        {tab === 'molds' && (
          <>
            {due.length > 0 && (
              <WarnBanner text={`⚠️ ${due.length} 副模具該保養了`} />
            )}
            <DataTable
              columns={['模號', '名稱', '模穴', '累計模次', '保養間隔', '狀態', '']}
              rows={molds.map((m) => [
                <strong key="c">{m.code}</strong>,
                m.name,
                m.cavityCount,
                m.totalShots.toLocaleString(),
                m.maintenanceIntervalShots ? m.maintenanceIntervalShots.toLocaleString() : '未設定',
                due.some((d) => d.id === m.id) ? '⚠️ 該保養' : '正常',
                <Button key="b" size="sm" kind="ghost" onClick={() => doMaintain(m.id)}>記錄保養</Button>,
              ])}
            />
            {molds.length === 0 && <EmptyState text="尚無模具資料" />}
          </>
        )}

        {tab === 'machines' && (
          <DataTable
            columns={['編號', '名稱', '噸數', '狀態']}
            rows={machines.map((m) => [
              <strong key="c">{m.code}</strong>, m.name, m.tonnage ?? '-', m.status,
            ])}
          />
        )}
      </Page>
    </div>
  );
}

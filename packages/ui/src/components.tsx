import React, { useState } from 'react';
import type { WorkOrderStatus } from '@brainfactory/shared';

/* Whitelisted components — design spec v1.1 §4. Add nothing without updating the spec. */

type BtnSize = 'lg' | 'md' | 'sm';
type BtnKind = 'primary' | 'success' | 'danger' | 'ghost';

export function Button({
  size = 'md',
  kind = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: BtnSize; kind?: BtnKind }) {
  return <button className={`bf-btn bf-btn-${size} bf-btn-${kind}`} {...props} />;
}

export function Card({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className="bf-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {children}
    </div>
  );
}

export function StatusPill({ status, label }: { status: WorkOrderStatus; label: string }) {
  return <span className={`bf-pill bf-pill-${status}`}>{label}</span>;
}

export function BigInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="bf-input" {...props} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="bf-label">{label}</span>
      {children}
    </label>
  );
}

/** PIN pad for the no-badge fallback. Calls onDone(pin) at 4 digits. */
export function PinPad({ onDone }: { onDone: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const press = (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      onDone(next);
      setPin('');
    }
  };
  return (
    <div>
      <div className="bf-pin-display">{'•'.repeat(pin.length)}</div>
      <div className="bf-pinpad">
        {['1','2','3','4','5','6','7','8','9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)}>{d}</button>
        ))}
        <button type="button" onClick={() => setPin('')}>⌫</button>
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" onClick={() => setPin(pin.slice(0, -1))}>←</button>
      </div>
    </div>
  );
}

/** Full-screen "waiting for scanner" prompt. */
export function ScanPrompt({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="bf-scan">
      <div className="bf-scan-icon">📷</div>
      <div className="bf-scan-title">{title}</div>
      <div className="bf-scan-hint">{hint}</div>
    </div>
  );
}

/** Full-screen feedback flash: green = done, red = rejected. No tiny toasts on the floor. */
export function Flash({ kind, text }: { kind: 'success' | 'error'; text: string }) {
  return <div className={`bf-flash bf-flash-${kind}`}>{text}</div>;
}

export function TopBar({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bf-topbar">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="bf-page bf-stack">{children}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="bf-empty">{text}</div>;
}

export function ErrorBanner({ text }: { text: string }) {
  return <div className="bf-banner bf-banner-error">{text}</div>;
}

export function WarnBanner({ text }: { text: string }) {
  return <div className="bf-banner bf-banner-warn">{text}</div>;
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="bf-modal-backdrop" onClick={onClose}>
      <div className="bf-modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="bf-table">
      <thead>
        <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

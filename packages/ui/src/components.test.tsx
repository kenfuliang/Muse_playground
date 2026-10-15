import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  Button, Card, StatusPill, BigInput, Field, PinPad, ScanPrompt, Flash,
  TopBar, Page, EmptyState, ErrorBanner, WarnBanner, Modal, DataTable,
} from './components.js';

/**
 * UI primitive CI tests (Ken 2026-10-14): pin the design-system contract —
 * correct classes, structure, and status mapping. No page/flow tests here
 * (UI still evolving); these only guard the 14 whitelisted components.
 */
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('Button', () => {
  it('renders size + kind classes', () => {
    expect(html(<Button size="lg" kind="primary">開工</Button>)).toContain('bf-btn-lg');
    expect(html(<Button size="lg" kind="primary">開工</Button>)).toContain('bf-btn-primary');
    expect(html(<Button size="sm" kind="danger">刪</Button>)).toContain('bf-btn-danger');
  });
  it('forwards disabled', () => {
    expect(html(<Button disabled>按</Button>)).toContain('disabled');
  });
});

describe('StatusPill', () => {
  it('maps every work-order status to a pill class', () => {
    for (const s of ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const) {
      expect(html(<StatusPill status={s} label="x" />)).toContain(`bf-pill-${s}`);
    }
  });
});

describe('inputs', () => {
  it('BigInput uses the big touch target class', () => {
    expect(html(<BigInput />)).toContain('bf-input');
  });
  it('Field renders its label', () => {
    expect(html(<Field label="模次"><input /></Field>)).toContain('模次');
  });
  it('PinPad renders 12 keys', () => {
    const h = html(<PinPad onDone={() => {}} />);
    expect((h.match(/<button/g) ?? []).length).toBe(12);
  });
});

describe('feedback', () => {
  it('Flash success/error use full-screen classes', () => {
    expect(html(<Flash kind="success" text="ok" />)).toContain('bf-flash-success');
    expect(html(<Flash kind="error" text="bad" />)).toContain('bf-flash-error');
  });
  it('ScanPrompt shows title + hint', () => {
    const h = html(<ScanPrompt title="請掃描" hint="hint" />);
    expect(h).toContain('請掃描');
    expect(h).toContain('bf-scan');
  });
  it('banners carry their severity', () => {
    expect(html(<ErrorBanner text="e" />)).toContain('bf-banner-error');
    expect(html(<WarnBanner text="w" />)).toContain('bf-banner-warn');
  });
  it('EmptyState renders text', () => {
    expect(html(<EmptyState text="沒有工單" />)).toContain('沒有工單');
  });
});

describe('layout', () => {
  it('Card / Page / TopBar / Modal render slots', () => {
    expect(html(<Card>hi</Card>)).toContain('bf-card');
    expect(html(<Page><span>x</span></Page>)).toContain('bf-page');
    expect(html(<TopBar left="L" right="R" />)).toContain('bf-topbar');
    expect(html(<Modal onClose={() => {}}>m</Modal>)).toContain('bf-modal');
  });
  it('DataTable renders headers and rows', () => {
    const h = html(<DataTable columns={['A', 'B']} rows={[[<span>1</span>, <span>2</span>]]} />);
    expect(h).toContain('<th>A</th>');
    expect(h).toContain('bf-table');
  });
});

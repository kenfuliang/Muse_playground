# Brainfactory 整套系统 — 建造计划 (2026-10-14)

Ken 授权:按我自己的判断定范围、列计划、做 checklist。UI 一致性:先定 primitive pool → 做成 component → layout 统一。

## 范围决定

**做 (工厂闭环):**
- Phase 0: v1 打磨硬 — 权限、事务、幂等、认证加固
- Phase 1: 品檢 QC — 首件检验、量产巡检、NG 处理
- Phase 2: 出貨 — 出货单、装箱、出货记录
- Phase 3: 條碼 — 横跨品檢/出貨的扫码录入,解决"忘记更新记录"

**不做 (defer):** 客戶/財務 — 办公室用,用户和使用节奏完全不同,后面再说。

## UI 一致性体系

1. **Primitive pool**: `packages/ui/src/tokens.css` — 已冻结,不新增颜色/字体/圆角。
2. **Components**: 14 个白名单组件 (`components.tsx`) — Button/Card/StatusPill/BigInput/Field/PinPad/ScanPrompt/Flash/TopBar/Page/EmptyState/ErrorBanner/WarnBanner/Modal/DataTable。新增组件先更新 design-spec.md 并经 Ken 同意。
3. **Layout**:
   - 工人端:3 画面冻结 (登入 → 我的工单 → 工单动作),大按钮大字,扫码即动作,全屏闪反馈。
   - 管理端:Table + FilterBar + Modal 模式,高信息密度,繁中为主。
4. **i18n**: 工人端文案中越同步,字典唯一来源 `packages/shared/src/i18n.ts`,缺翻译不上线。
5. **Domain 逻辑**: 全部进 `packages/shared`(zod schema、状态机、条码格式),API 和 web 只 import,不重复定义。

---

## 测试策略 (Ken 2026-10-14)

- **Backend 重兵**: shared 所有 domain 逻辑单元测试;api service 层测试 (mock Prisma) 覆盖权限/事务/幂等/限流。
- **UI 页面轻量**: 不给页面/流程写测试,不拖慢开发。
- **UI primitives 上 CI**: 14 个白名单组件 render 测试 (vitest + react-dom/server,只断言结构/class,不测交互细节)。
- **CI**: `npm run typecheck` + `npm run test` + `npm run build` 全过。workflow 文件放 `.github/workflows/ci.yml`(需 Ken 手动加,GitHub App 无 workflows 权限)。

## Phase 0: v1 打磨硬 — Checklist

### 权限
- [ ] `MesService.transition/start/complete`: 检查 `wo.assigneeId === user.sub || user.role === 'ADMIN'`,否则 403
- [ ] `MesService.report`: 同上检查
- [ ] `MesService.getWorkOrder`: 工人只能看自己的单,admin 看全部
- [ ] `requireAdmin` 保持:开工单、模具保养、master data 写入

### 报工事务化
- [ ] `report()`: `prisma.$transaction` 包裹 workReport.create + mold.totalShots.increment + auditLog.create
- [ ] `recordMaintenance()`: 同样事务化 (maintenance.create + mold.lastMaintenanceShots.update)

### 报工幂等
- [ ] Schema: `WorkReport.idempotencyKey String? @unique` (additive migration,不丢数据)
- [ ] `reportProductionSchema`: 加 `idempotencyKey` 可选字段 (shared)
- [ ] API: `POST :id/report` 接受 header `Idempotency-Key` 或 body 字段;key 已存在直接返回已有 report,不重复计数
- [ ] Web: 报工按钮生成 UUID key,重试/双击不重复提交

### 认证加固
- [ ] PIN 哈希: `Bun.password` (bcrypt,内置,无新依赖);登录时兼容旧 sha256,验证通过则升级重哈希
- [ ] Seed: 改用 Bun.password 存 PIN
- [ ] 登录限流: 内存滑动窗口,同 badge+IP 5 次/分钟,超限 429
- [ ] JWT: `NODE_ENV=production` 时 JWT_SECRET 必填,无 dev fallback;非 production 保留 fallback 并打 warning 日志

### 验证
- [ ] `npm run typecheck` / `npm run test` / `npm run build` 全过
- [ ] shared 新增幂等/权限相关单元测试
- [ ] 真机:Postgres + API 跑通,登录/报工/幂等 key 重放实测

## Phase 1: 品檢 QC — Checklist

### Domain (shared)
- [ ] `QcInspection` 状态机: PENDING → PASS / NG (首件、巡检两种类型)
- [ ] `NgDisposition`: 隔离 → 重工 / 报废 / 特采
- [ ] zod schemas: createInspection, recordResult, disposeNg
- [ ] 中越文案: 检验、合格、不合格、隔离、重工、报废

### DB
- [ ] `QcInspection`: id, workOrderId, type (FIRST_ARTICLE/PATROL), status, inspectorId, note, timestamps
- [ ] `NgRecord`: id, inspectionId, qty, reason, disposition, timestamps
- [ ] Migration (additive)

### API
- [ ] `POST /qc/inspections` (admin/品檢员) — 为工单建检验单
- [ ] `POST /qc/inspections/:id/result` — 录结果;NG 自动建 NgRecord
- [ ] `POST /qc/ng-records/:id/dispose` — 处置
- [ ] `GET /qc/pending` — 待检列表
- [ ] 权限: 品檢员角色? v1 只有 ADMIN/WORKER — 先用 ADMIN,角色体系 phase 2 再细化 (记录 decision)

### Web (管理端)
- [ ] 待检列表页 (DataTable + StatusPill)
- [ ] 检验单详情/录结果 (Modal + 大按钮 PASS/NG)
- [ ] NG 处置页

## Phase 2: 出貨 — Checklist

### Domain (shared)
- [ ] `Shipment` 状态机: PACKING → SHIPPED
- [ ] zod schemas: createShipment, addItem, ship

### DB
- [ ] `Shipment`: id, code, customerName?, status, shippedAt?, timestamps
- [ ] `ShipmentItem`: id, shipmentId, workOrderId, qty

### API
- [ ] `POST /shipments` — 建出货单 (从已完工工单选)
- [ ] `POST /shipments/:id/items` — 加明细 (扫工单条码)
- [ ] `POST /shipments/:id/ship` — 出货确认
- [ ] `GET /shipments` — 出货记录

### Web (管理端)
- [ ] 出货单列表 + 新建 (Modal)
- [ ] 出货单详情:扫码加明细,出货确认

## Phase 3: 條碼 — Checklist

- [ ] 统一扫码输入处理:扫码枪即键盘,全局监听,按 `classifyBarcode` 分流 (已有 barcode.ts)
- [ ] 工单 label 条码打印格式 (人类可读编号 + 条码,见 design-spec §5)
- [ ] 品檢扫码:扫工单条码 → 自动定位检验单
- [ ] 出貨扫码:扫工单条码 → 加入出货明细;扫错件红屏
- [ ] 10 分钟内重扫同一码 → 「已扫过」不重复写入 (design-spec §5)
- [ ] 扫不到时手动输入 + 标记「手动」

## 每个 Phase 的 Definition of Done

- [ ] typecheck / test / build 全过
- [ ] 真机实测 (Postgres + API + 关键路径 curl)
- [ ] UI 改动有截图或逐项文字描述
- [ ] 中越文案同步 (工人端相关)
- [ ] Push 到 main,commit 信息说明改了什么

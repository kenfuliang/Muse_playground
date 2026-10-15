# Brainfactory — MES v1（塑膠射出廠試用版）

最小可用 MES：生管排程開工單 → 工人（平板，越南文/繁中）掃證登入 → 我的工單 → 開工/報工/完工 → 模具模次累計＋保養提醒。

## 架構

TypeScript monorepo（npm workspaces），modular monolith：

```
apps/api      NestJS — auth + mes modules
apps/web      React (Vite) — 工人端三畫面＋生管後台
packages/shared  zod schemas、工單狀態機、條碼格式、保養邏輯、中越 i18n（唯一來源）
packages/db      Prisma schema（Postgres）＋ seed
packages/ui      design spec 的白名單元件＋tokens
```

詳見 `docs/architecture-blueprint.md`；UI 規範見 `docs/design-spec.md`。

## 本地開發

```bash
npm install
npm run db:generate
# 啟動 Postgres（需要 DATABASE_URL），然後：
npm run db:migrate -w packages/db
npm run db:seed -w packages/db
npm run build
# 開兩個終端：
npm run start -w apps/api      # :3001
npm run dev -w apps/web        # :5173
```

試用帳號（seed 建立）：工人 `BF-USER-w001` / PIN `1234`（越南文）；生管 `BF-USER-admin` / PIN `0000`。

## 試用流程

1. 生管登入 → 後台開工單（選模具＋機台＋數量＋指派 `BF-USER-w001`）
2. 工人登入（輸入 `BF-USER-w001` 或 PIN `1234`）→ 我的工單 → 開工
3. 報工：輸入模次/良品/不良 → 模具模次累計；達到保養間隔會跳提醒
4. 完工

## 注意事項（v1 trial）

- 機台無連網：模次/數量靠人工輸入。
- 越南文為初版翻譯，試用前請母語者校對。
- PIN 存 sha256、JWT 12h：試用等級，正式上線前要強化（rate limit、secret 輪換）。
- 品檢/出貨/原料追溯是 phase 2，不在 v1。

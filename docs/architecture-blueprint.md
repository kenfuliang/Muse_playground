# Brainfactory 架構藍圖 v1.0

日期：2026-10-14
狀態：草稿，待 Ken 拍板第 14 節後凍結。
目標：從 MES 出發，逐步長到品檢 → 出貨 → 客戶 → 財務（實質是一套小 ERP），**過程中不重寫**，且一個人 + AI agents 能長期維護。

---

## 0. 決策總覽（一句話版）

| 題目 | 決策 |
|---|---|
| 架構 | Modular monolith（不是 microservices） |
| 語言 | TypeScript everywhere（前後端同一語言） |
| Repo | Monorepo（Turborepo / npm workspaces） |
| 後端框架 | NestJS（結構紀律優先）或 Hono（輕快）→ 待選 |
| ORM | Prisma + Postgres |
| API | OpenAPI-first，client SDK 生成，前端不手寫 fetch |
| 前端 | 工人端手刻（design spec v1.0）；管理端 schema-driven 生成 |
| CI | GitHub Actions 一條 workflow（lint+typecheck+test+build → 自動部署） |
| 部署 | Render + `render.yaml`（IaC），沿用現有 prod 環境 |
| 協作方式 | Spec-before-code：先寫 1 頁 module spec，agent 照 spec 實作 |

---

## 1. 為什麼是 Modular Monolith，不是 Microservices

團隊 = Ken + AI agents。Microservices 的代價是每個服務各自的 CI、部署、版本、認證、除錯——這些 ops 工作會吃掉所有開發時間，而且 agents 在分散式除錯上特別弱。

Modular monolith：**單一部署單元，但模組間有硬邊界**。規則只有一條：模組之間不准直接 import，只能透過 shared kernel（§4）或 domain events 溝通。將來某個模組真需要獨立擴展，再拆不遲——邊界清楚的話，拆是機械工作。

K8s、service mesh 這類東西，在這個團隊規模下是負資產，不碰。

---

## 2. 模組切分與上線順序

每個 Phase = 新增一個 module，**additive，只加不改**，舊模組不受影響。

| Phase | Module | 內容 |
|---|---|---|
| 0（先做） | shared kernel | 帳號/權限、audit log、barcode/label 服務、檔案儲存、通知、domain events |
| 1 | mes | 工單生命週期、站點報工、掃碼流程（design spec 的三畫面） |
| 2 | qc | 品檢單、NG 流程、量測記錄 |
| 3 | shipment | 裝箱、出貨單、司機簽收 |
| 4 | customer | 客戶檔、訂單 |
| 5 | finance | 應收/應付、對帳 |

跨模組溝通只走 **domain events**，例如：
- `qc.passed` → shipment 才允許出貨
- `shipment.confirmed` → finance 產生應收

模組內部隨便怎麼寫都行，模組之間只認 events。這是「長大不重寫」的關鍵機制。

---

## 3. Monorepo 結構

```
brainfactory/
├── apps/
│   ├── web/                 # React SPA (Vite)：工人端 + 管理端
│   └── api/                 # Node API (NestJS/Hono)
│       └── src/modules/     # mes/ qc/ shipment/ customer/ finance
├── packages/
│   ├── shared/              # zod schemas、型別、常數
│   │                        # → barcode 格式、狀態機：全系統唯一來源
│   ├── ui/                  # design spec v1.0 的 10 個元件
│   └── db/                  # Prisma schema、migrations、seed data
├── docs/                    # design spec、ADRs、module specs
├── .github/workflows/ci.yml
├── render.yaml              # 基礎設施即程式碼
├── AGENTS.md                # agent 施工規範（commit #1 就在）
└── OPENAPI.yaml             # API 唯一來源
```

---

## 4. 語言：TypeScript Everywhere

- 前後端同一語言，agents 不用切換心智模型，同一 session 前後端一起改。
- `packages/shared` 的 zod schema 前後端共用：**一份定義，兩邊驗證**，型別從 DB 直通 UI。
- Python 留到「真的有 ML 需求」那天再說，現在引入第二語言只是把 agent 的混亂加倍。

---

## 5. 後端框架（二選一，待 Ken 拍板）

| | NestJS | Hono |
|---|---|---|
| 優點 | Module 結構強制分層，正好對應 modular monolith；AI 生成的程式碼有紀律 | 輕、快、簡單 |
| 缺點 | 重、boilerplate 多 | 太自由，agent 容易寫出義大利麵 |

**建議 NestJS**：對 AI 生成的程式碼來說，「框架強迫你寫對結構」比「框架輕快」值錢得多。Boilerplate 讓 agent 寫，反正不花你的時間。

---

## 6. 資料庫：Postgres + Prisma

- Postgres：Render 上已經在跑（10/14 驗證過），不用換。
- Prisma：schema-first、migration 內建、型別自動生成，對 agents 極友好。
- **核心表預留 `tenant_id`**：現在只有隆廷，但加一個欄位是零成本的保險，將來多廠不用重寫 schema。這是便宜的選擇權，不是過度設計。

---

## 7. API：OpenAPI-first

1. 先寫 `OPENAPI.yaml`（人審這個，不審程式碼）。
2. 從 spec 生成 client SDK，前端**不准手寫 fetch**。
3. 後端用 `packages/shared` 的 zod schemas 驗證，與 OpenAPI 同源。

效果：前後端契約在寫 code 之前就凍結，agent 沒機會各說各話。

---

## 8. 前端策略：兩種 UI，兩種做法

- **工人端**（現場）：照 design spec v1.0 手刻，用 `packages/ui` 的 10 個元件。三個畫面，不會再長大。
- **管理端**（辦公室）：**schema-driven 生成**——從 Prisma/zod 定義直接長出 CRUD 表格、篩選、表單。企業軟體 ~40% 的工是這種表格，生成掉，不手刻。
- 報表：先匯出 CSV/Excel，不自建報表引擎。

---

## 9. CI：GitHub Actions（沿用現有，修好它）

一條 workflow，跑在每個 PR 上：

```
lint → typecheck → test → build →（main 合併）自動部署 Render
```

- 目標：10 分鐘內跑完。超過就拆 test。
- Render PR preview environments：每個 PR 一個可點的預覽站，Ken 點一點就能驗收，不用看 code。
- 順手修掉那個誤報的 health monitor（重指向 `linkforai.com/api/health` 或關掉，Issue #4617）。

---

## 10. 部署：Render + render.yaml

- 沿用現有：SPA static site + API service + Postgres（prod 已驗證健康）。
- `render.yaml` 把 infra 寫成程式碼：以後重建環境是一鍵的事，agent 也能看懂。
- 環境：`prod` + PR previews。Staging 等真的需要再說，現在是多餘的。
- Background worker（報表、通知）以後加，位置先留好。

---

## 11. 省力的元策略（這份藍圖最重要的章節）

前面都是技術選型，真正的省力來自工作方式：

1. **Spec-before-code**：每個 module 開工前，先寫 1 頁 module spec（資料模型 + API + UI）。Agent 照 spec 實作，**Ken 只審 spec**。審一份 spec 比審 2000 行 code 便宜一個數量級，而且 spec 寫錯了改 spec 就好。
2. **Single source of truth**：barcode 格式、工單狀態機、權限規則，只在 `packages/shared` 定義一次，其他地方不准重複定義。
3. **Seed data + demo mode**：每個功能不依賴工廠硬體就能測。沒有種子資料的 PR 不准合併。
4. **AGENTS.md 從 commit #1 就在**：小 diff、不重寫整檔、UI 改完截圖、動工前讀 design spec。把之前吃過的虧寫成規則。
5. **Audit log 預設開**：誰、何時、做了什麼，每個寫入都記。工廠合規以後一定會要，現在埋，以後不用補。
6. **離線容忍**：掃碼流程預設支援 offline queue（barcode brief §3 已定義），現場 Wi-Fi 斷了系統不能跟著斷。

---

## 12. 刻意不做的事

| 不做 | 理由 |
|---|---|
| Microservices / K8s | 團隊規模不需要，是負資產 |
| 完整多租戶 | 只留 `tenant_id` 欄位，不做租戶管理 UI |
| 自建 auth / SSO | 先簡單 JWT，以後接 Clerk；登入不是核心競爭力 |
| GraphQL | REST + OpenAPI 就夠，agents 對 REST 更熟 |
| 自建報表引擎 | 匯出 CSV/Excel 先頂著 |
| 自建 design system 以外的 UI 框架 | design spec v1.0 就是系統 |

---

## 13. 風險（誠實版）

1. **最大風險不是技術，是需求**。Spec-before-code 擋得住 agent 發散，擋不住「現場根本不是這樣做」。Phase 1 開工前，林頡那邊的工單流程必須先訪談確認，否則 spec 寫得再漂亮也是錯的。
2. **如果走 rewrite 路線**，prod 上跑的舊 Brainfactory 有隱性知識（bug 修過的地方、現場 workaround），重寫會全部丟掉。要有一次知識盤點。
3. **Scope creep**：MES → ERP 的誘惑是每個 phase 都想「順便」做下一個。規則：一個 phase 上線、現場在用，才開下一個。

---

## 14. 待 Ken 決定

- [ ] **這 repo 的定位**：`Muse_playground` = Brainfactory rewrite 的新家？還是純 playground？舊 prod（linkforai.com）怎麼辦——並行、遷移、還是退役？
- [ ] **後端框架**：NestJS（建議，結構紀律）vs Hono（輕快）
- [ ] **ORM**：Prisma（建議）vs Drizzle（更輕）
- [ ] **Phase 0/1 的 module spec**：要不要我現在就寫 shared kernel + mes 的 1 頁 spec？
- [ ] **需求訪談**：Phase 1 開工前，要不要我幫你整理一份問林頡的問題清單？

---

## 變更紀錄
- v1.0（2026-10-14）：初版。配合 design spec v1.0 與 barcode 評估 brief。

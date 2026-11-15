# AI-Novel 故事 API

初版供本機單人開發使用，API 綁定 `127.0.0.1`。需要 Node.js 24 與可連線的 PostgreSQL。前端目前仍使用瀏覽器儲存。

## 用 Docker Desktop 準備 PostgreSQL

在 Windows 開啟 Docker Desktop，接著從專案根目錄的 PowerShell 執行：

```powershell
cd backend
Copy-Item .env.example .env
```

已有 `.env` 時，保留原檔，參考 `.env.example` 更新需要的欄位。把 `.env` 裡兩處 `REPLACE_WITH_YOUR_LOCAL_PASSWORD` 換成自己的同一組密碼。若密碼在連線網址中含有特殊字元，例如 `@`，只在 `DATABASE_URL` 內編碼成 `%40`。

```powershell
docker compose up -d
docker compose ps
```

等 PostgreSQL 顯示 `healthy`，用 DBeaver 新增 PostgreSQL 連線。

| 欄位 | 填寫 |
|---|---|
| Host | `127.0.0.1` |
| Port | `5434` |
| Database | `ai_novel` |
| Username | `ai_novel` |
| Password | `.env` 的 `POSTGRES_PASSWORD` |

按「測試連線」，成功後按 Finish。預設使用 5434，避開課程範例的 5432 和 5433。若修改 `DB_PORT`，也要同步更新 `DATABASE_URL` 和 DBeaver。Docker 會在首次初始化時建立資料庫。平常可用 `docker compose stop` 暫停，資料會保留在 volume。

## 啟動 API

在 `backend` 執行：

```powershell
npm ci
npm start
```

API 第一次啟動會在 `ai_novel` 裡建立 `stories` 表。若已有 PostgreSQL，也可直接讓 `DATABASE_URL` 指向既有伺服器上的空資料庫。執行 `npm run check` 可檢查 TypeScript 型別。

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/stories` | 依最後修改時間列出故事 |
| POST | `/api/stories` | 建立故事，JSON 至少提供 `title` |
| GET | `/api/stories/{id}` | 開啟故事 |
| PUT | `/api/stories/{id}` | 儲存故事設定 |

儲存時送出讀到的 `version` 和完整的 `title`、`genre`、`status`、`summary`、`originalMode`、`storyLanguage`。若同一故事已經有更新，API 回傳 HTTP 409，重新讀取後即可取得最新版本。

`originalMode` 接受 `none`、`active`、`reference`。它目前用來保存設定。故事語言接受 `zh-TW`、`en`，新故事預設繁體中文。

PowerShell 中可用以下命令試跑。

```powershell
$api = 'http://127.0.0.1:3001/api/stories'
$story = Invoke-RestMethod -Method Post -Uri $api -ContentType 'application/json' -Body '{"title":"First story"}'
$story.summary = 'Updated summary'
$story = Invoke-RestMethod -Method Put -Uri "$api/$($story.id)" -ContentType 'application/json' -Body ($story | ConvertTo-Json)
Invoke-RestMethod -Uri "$api/$($story.id)"
```

## 介面本機驗收

在專案根目錄執行 `npm run dev`，由 Vite 將 `/api` 轉送到本機後端。

- 以「＋」建立資料庫故事。在故事設定填寫時間、地點、章節、階段等資料，儲存，再重新整理確認狀態面板讀回內容。
- 在原作資料庫新增一個原作或原創世界與一筆條目，重新整理後確認能讀回。現有瀏覽器資料會在伺服器資料庫尚未寫入時帶入，首次成功修改時寫入 PostgreSQL。
- `GET /api/library` 讀取資料庫內容和版本。`PUT /api/library` 接收 `{ entries, version }`，版本衝突時回傳 409。
- 手動 JSON 匯出目前涵蓋瀏覽器故事及原作資料庫。PostgreSQL 的故事和聊天室紀錄需另行透過資料庫備份。

## 正式上線前要提供的設定

- 正式網站網域、後端主機與 PostgreSQL 連線資訊，密碼及 `DATABASE_URL` 由部署平台的祕密設定提供。
- 正式模型供應商、模型名稱及 API 金鑰。現在的角色回覆使用本機測試邏輯。
- 若開放多位使用者，先接登入與逐故事授權，再對外開放 API。現在的後端是本機單人模式，正式網域的路由也尚未接通。

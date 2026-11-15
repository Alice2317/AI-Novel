# AI-Novel 故事 API

初版供本機單人開發使用，API 綁定 `127.0.0.1`。需要 Node.js 24 與可連線的 PostgreSQL。前端目前仍使用瀏覽器儲存。

1. 在 PostgreSQL 建立空資料庫，例如 `ai_novel`。
2. 在本目錄建立 `.env`，填入自己的連線設定。

   ```dotenv
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ai_novel
   PORT=3001
   ```

3. 在本目錄執行 `npm ci`、`npm start`。程式啟動時會建立故事資料表。
4. 執行 `npm run check` 檢查 TypeScript 型別。

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

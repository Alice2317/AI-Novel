# AI-Novel｜Storyloom

AI 互動小說網頁版前端原型。

## 開發環境
- React 18
- Vite 6
- RWD：桌面優先，支援平板與手機

## 本機啟動
```bash
npm install
npm run dev
```

## 前端功能
- 故事工作台、故事列表、新增與切換故事
- 故事設定編輯：名稱、類型、簡介、原作模式（C-1/C-2/C-3）
- 故事設定與玩家輸入紀錄使用 localStorage 保存
- 故事正文、玩家輸入區、故事資訊側欄
- 原作資料庫、備份與結算入口（尚未實作）
- 桌面、平板、手機 RWD

## 目前限制
目前沒有連接 AI API、雲端資料庫、登入、正式原作資料庫或備份服務。localStorage 資料只保存在目前瀏覽器與裝置；清除網站資料會使其消失。玩家送出訊息後目前只會顯示前端示範回覆，不會呼叫 AI。


## GitHub Pages 部署
- Vite 已設定專案站台路徑：`/AI-Novel/`。
- GitHub Actions 工作流程位於 `.github/workflows/deploy.yml`。
- 推送到 `main` 或手動執行工作流程時，會自動建置並部署 `dist`。
- 第一次部署前，請到 GitHub 專案 **Settings → Pages → Build and deployment → Source**，選擇 **GitHub Actions**。
- 部署成功後，網站網址為：`https://alice2317.github.io/AI-Novel/`。

注意：GitHub Pages 只提供靜態前端託管；目前 AI API、登入與雲端資料庫仍未接通。

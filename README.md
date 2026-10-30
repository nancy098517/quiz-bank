# 題庫練習室

適用 GitHub Pages 的靜態選擇題網站，可匯入 Excel、CSV 或 JSON 題庫。

題庫檔不會上傳到伺服器。使用者選取檔案後，資料只在目前瀏覽器內讀取並保存於 localStorage。

## Excel 欄位

第一列使用以下欄名：

`科目, 項次, 題目, 選項1, 選項2, 選項3, 選項4, 選項5, 答案, 答案說明`

- `選項5` 可留白，網站會自動顯示四個選項。
- `答案說明` 可留白。
- `答案` 可填 `1`～`5`、`A`～`E`，或完整選項文字。
- 每個科目可有不同題數，科目選單會由資料自動產生。

## 本機預覽

以靜態伺服器開啟 `dist` 目錄，例如：

```bash
python -m http.server 4173 --directory dist
```

瀏覽 `http://localhost:4173`。

## GitHub Pages

推送至 `main` 分支後，GitHub Actions 會自動將 `dist` 發布至 GitHub Pages。網站不需要後端；匯入的題庫會保存在目前瀏覽器的 localStorage。

在 GitHub 儲存庫的 `Settings → Pages` 中，將來源設為 `GitHub Actions`。

Excel 匯入功能透過 SheetJS CDN 載入。若使用環境無網路，可改用 CSV 或 JSON。

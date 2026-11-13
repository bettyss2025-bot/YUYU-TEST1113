# 旅伴 roam 手機 App（PWA）

目前交付的是可安裝網頁 App，不是 APK／IPA 或商店上架版本。保留既有行程、收支、分帳及本機儲存，加入手機 App 介面、固定底部導覽、安全區、主畫面圖示、standalone 獨立視窗與離線開啟。

## 預覽與安裝

本機執行 `node server.mjs`，開啟 `http://localhost:5173`。右上角下載圖示可查看安裝方式與離線狀態。桌面使用手機寬度呈現，手機填滿螢幕。

在真實手機完整安裝與離線使用需要可由手機連到的 **HTTPS 網址**。電腦的 localhost 不能直接給手機使用；同 Wi-Fi 的 HTTP 區域網路 IP 只能瀏覽，無法啟用完整 Service Worker 功能。本次沒有部署、開立帳號或啟用付費服務。

- iPhone：用 Safari 開啟 HTTPS 網址 → 分享 → 加入主畫面 → 新增。
- Android：用 Chrome 開啟 HTTPS 網址 → 右上角下載圖示 → 若支援，按「安裝到此裝置」；亦可由瀏覽器選單安裝。
- 安裝提示依瀏覽器支援與條件而定，不以看見安裝說明代表已安裝成功。

安裝與安全來源說明：[web.dev Installation](https://web.dev/learn/pwa/installation)、[MDN Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)。

## 離線與資料

首次連線需等到安裝說明顯示「App 離線檔案已備妥」。會快取程式、樣式、圖示、台南本機封面；遠端情境照片、外部導航與官方網站需要網路。所有帳本與行程仍以 localStorage 保存，不是真實多人同步。清除瀏覽器／網站資料會造成遺失，請定期匯出 CSV。

手機與桌面、不同瀏覽器及不同網址的資料各自獨立。從 localhost 換成 HTTPS 網址不會搬移帳目，CSV 目前是匯出功能，尚未提供還原匯入。iOS 的安裝與瀏覽器儲存行為需在實機確認，不保證自動移轉。

## 發布與更新

將執行所需靜態檔部署至 HTTPS 主機：HTML、JS、CSS、manifest、sw.js 及 assets。不要將本機伺服器／測試當作前端必要檔案。

每次發布修改後需提升 `sw.js` 的 CACHE 版本，確保程式與模組是一致的完整版本。現有頁面不會被強制中途重新載入；新版本待命時，右上安裝說明會提供更新按鈕。先完成表單儲存再更新。更新只清理旅伴自己的快取，不清除帳目 localStorage。

下一步可確認 HTTPS 部署目標後啟用手機實機測試。若要商店版，還需選擇 iOS／Android 平台、加入原生容器與平台工程、原生測試，以及簽署／開發者帳號；目前沒有產出原生安裝包，也沒有在真實 iPhone／Android 上驗證安裝。

## 驗證

執行 `node --test tests/finance.test.mjs tests/itinerary.test.mjs tests/pwa.test.mjs`。PWA 測試檢查所有離線資產存在、離線讀取程式、更新隔離、manifest 與 PNG 尺寸。這些測試不能取代實機安裝驗收。

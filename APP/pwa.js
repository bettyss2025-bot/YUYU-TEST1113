let installPrompt=null,registration=null,reloading=false;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let offlineReady=false;
const sheet=document.createElement('dialog');sheet.id='install-sheet';document.body.append(sheet);
const status=document.createElement('div');status.id='app-connection';status.setAttribute('role','status');document.body.append(status);
function updateStatus(){const offline=!navigator.onLine;status.textContent=offline?(offlineReady?'離線使用中 · 資料只儲存在此裝置':'目前離線 · 尚未完成離線準備'):'';status.hidden=!offline;document.body.classList.toggle('is-offline',offline);document.documentElement.classList.toggle('installed-app',standalone());}
window.addEventListener('online',updateStatus);window.addEventListener('offline',updateStatus);updateStatus();
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;sheet.close();updateStatus();});
function showInstall(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const secure=window.isSecureContext;
 sheet.innerHTML=`<div class="install-top"><img src="./assets/app-icon.svg" alt="旅伴 App 圖示"><div><h2>把旅伴帶著走</h2><p>你的旅行、行程與帳本，隨手打開。</p></div><button data-app-close aria-label="關閉 App 安裝說明">×</button></div><div class="install-body"><span class="install-badge">${standalone()?'已在 App 模式開啟':'可安裝的手機網頁 App（PWA）'}</span><div class="install-features"><span>⌂ 主畫面啟動</span><span>◌ 可離線開啟</span><span>▤ 本機旅遊手帳</span></div>${!secure?'<div class="notice warn">此網址是未加密的區域網路網址，無法啟用完整安裝與離線功能。需先提供 HTTPS 網址；目前可瀏覽與記帳。</div>':standalone()?'<p class="subtle">已使用獨立 App 視窗。資料保存在此裝置，不代表已啟用多人同步。</p>':installPrompt?'<button class="btn install-primary" data-app-install>安裝到此裝置</button>':ios?'<div class="install-steps"><p><b>1</b> 用 Safari 開啟此網址</p><p><b>2</b> 點「分享」按鈕</p><p><b>3</b> 選「加入主畫面」，再點「新增」</p></div>':'<div class="install-steps"><p><b>1</b> 用手機 Chrome 開啟 HTTPS 網址</p><p><b>2</b> 開啟瀏覽器選單</p><p><b>3</b> 選「安裝應用程式」或「加入主畫面」</p></div><p class="subtle">若選單尚未提供安裝，請稍後重新開啟；此瀏覽器可能不支援安裝提示。</p>'}<div class="notice">${offlineReady?'✓ App 離線檔案已備妥。':'離線檔案'+(secure?'準備中；請保持連線完成首次載入。':'尚未啟用。')}<br>離線可管理行程與記帳，首次未載入的遠端照片與外部地圖需要網路。</div><p class="subtle">目前未登入、未同步，不提供付款或推播。手機與電腦的資料不會自動共用，換網址或瀏覽器也不會搬移既有帳目。請使用 Safari 或 Chrome 開啟此 HTTPS 網址。</p>${registration?.waiting?'<button class="btn outline" data-app-update>更新 App（會重新載入，請先儲存表單）</button>':''}<p class="install-build">旅伴 roam · PWA 1.0 · 本機示範</p></div>`;
 sheet.showModal();
}
document.addEventListener('click',async event=>{
 const target=event.target.closest('button');if(!target)return;
 if(target.hasAttribute('data-app-open'))showInstall();
 if(target.hasAttribute('data-app-close'))sheet.close();
 if(target.hasAttribute('data-app-install')&&installPrompt){const prompt=installPrompt;installPrompt=null;target.disabled=true;try{await prompt.prompt();await prompt.userChoice;sheet.close();}catch{target.disabled=false;target.textContent='請改用瀏覽器選單安裝';}}
 if(target.hasAttribute('data-app-update')){if(document.querySelector('dialog[open]:not(#install-sheet)'))return;reloading=true;registration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});}
});
if('serviceWorker' in navigator&&window.isSecureContext){
 try{
  registration=await navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{updateViaCache:'none'});
  const ready=await navigator.serviceWorker.ready;offlineReady=!!ready.active;updateStatus();
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
 }catch(error){offlineReady=false;console.warn('離線功能尚未就緒',error);}
}

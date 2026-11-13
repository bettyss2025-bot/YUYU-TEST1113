export const CHECKED_AT='2026-11-13';
const cc=(file,author,work,version='4.0',caption='景點實景；歷史照片，非即時影像')=>({file,author,source:'https://commons.wikimedia.org/wiki/File:'+work,license:'CC BY-SA '+version,licenseUrl:'https://creativecommons.org/licenses/by-sa/'+version+'/',caption});
export const photoCredits={
 shennong:cc('./assets/tainan-shennong.jpg','Andrzej Otrębski','Tainan_Shennong_St_1.jpg'),
 sunset:cc('./assets/explore/sunset-platform.jpg','ScoutT7','Sunset_Platform.jpg'),
 dadaocheng:cc('./assets/explore/dadaocheng.jpg','迷惘的人生','Dadaocheng_Wharf_container_market_2022.jpg','2.0','大稻埕碼頭貨櫃市集實景；2022 年照片'),
 calligraphy:cc('./assets/explore/calligraphy.jpg','Dquai','Calligraphy_Greenway_with_Park_Lane_by_CMP.jpg','4.0','草悟道與勤美誠品綠園道周邊實景；非即時影像'),
 pier2:cc('./assets/explore/pier2.jpg','NR','Dusk_at_Pier_2_001.jpg','4.0','駁二港邊實景；歷史照片，非即時影像'),
 qixingtan:cc('./assets/explore/qixingtan.jpg','Mamtapawar512','QIXINGTAN_beach_taiwan.jpg','4.0','七星潭海灘實景；2019 年照片')
};
const classic=(id,name,city,district,desc,key,source,sourceName,x,y,extra={})=>({id,name,city,district,type:'景點',desc,photo:photoCredits[key].file,photoCredit:photoCredits[key],source,sourceName,checkedAt:CHECKED_AT,collection:'classic',basis:'官方觀光推薦・非即時人氣排名',x,y,...extra});
const event=(id,name,city,district,start,end,desc,source,sourceName,x,y,extra={})=>({id,name,city,district,type:'活動',start,end,desc,source,sourceName,checkedAt:CHECKED_AT,collection:'recent',photo:'',basis:'官方活動公告・非即時人氣排名',x,y,...extra});
export const curatedPlaces=[
 classic('p1','神農街','台南','中西區','從老屋、巷弄到燈籠街景，慢慢感受府城街區。造訪時尊重居民生活，店家營業依個別公告。','shennong','https://www.twtainan.net/zh-tw/attractions/detail/1351','台南旅遊網',46,67),
 {id:'p2',name:'巷口牛肉湯（虛構示範）',city:'台南',district:'中西區',type:'美食',desc:'保留原型帳目關聯用的虛構店家，沒有真實地址、照片或營業資訊。請勿導航至此店。',photo:'',collection:'demo',demo:true,x:55,y:58},
 classic('p3','觀夕平台・安平夕照','台南','安平區','安平港旁的海岸與觀景空間，適合散步看海。照片為此地白天實景，不保證夕陽或當天天候；請依現場海岸管制活動。','sunset','https://www.twtainan.net/zh-tw/attractions/detail/810','台南旅遊網',29,73),
 classic('p4','大稻埕碼頭','台北','大同區','沿淡水河岸散步，看看碼頭與貨櫃市集，安排一段城市河岸時光。攤位與活動依現場公告。','dadaocheng','https://travel.taipei/ja/attraction/details/720','臺北旅遊網',72,15),
 classic('p5','草悟道・勤美綠園道','台中','西區','沿都市綠帶走進藝文街區，串連周邊空間與小店。照片對應草悟道旁的勤美誠品綠園道，店家與展覽資訊另查官方。','calligraphy','https://travel.taichung.gov.tw/zh-tw/Attractions/Intro/786/','臺中觀光旅遊網',47,40),
 classic('p6','駁二藝術特區','高雄','鹽埕區','從港邊倉庫群、公共藝術到展覽空間，感受高雄的海港日常。照片拍攝於駁二港邊，並非目前展覽或即時港景。','pier2','https://khh.travel/zh-tw/attractions/detail/6/','高雄旅遊網',47,89),
 classic('p7','七星潭','花蓮','新城鄉','看弧形海灣、礫石海岸與山海景色。照片為七星潭歷史實景；出發前確認交通、天候與現場開放區域。','qixingtan','https://www.taiwan.net.tw/m1.aspx?id=9488&sno=0001124','交通部觀光署',84,43,{alert:'近期提醒：11/9 起賞星廣場及停車場施工封閉，海岸仍開放；動線請依最新公告。',alertSource:'https://www.cna.com.tw/news/aloc/202611040158.aspx'}),
 event('event-guan','2026 關子嶺溫泉美食節','台南','白河區','2026-10-24','2026-11-22','以山城溫泉、美食與夜間光環境為主題。主題週的 11/7–8 演出已結束，請勿當作本週活動；其他體驗與店家優惠依官方說明。','https://2026gzlevent.twtainan.net/','關子嶺活動官方網站',57,51),
 event('event-flower','2026 臺中國際花毯節','台中','新社區','2026-10-31','2026-11-22','在新社種苗改良繁殖場第二苗圃，欣賞季節花海與主題花毯。出發前確認接駁、停車與天候資訊。','https://www.xinshe.taichung.gov.tw/4070865/post','新社區公所',60,36,{heat:'市府 11/5 公告：累計參觀突破百萬人次，非即時人流。',heatSource:'https://www.taichung.gov.tw/3407802/post'}),
 event('event-beitou','2026 臺北溫泉季','台北','北投區','2026-11-20','2026-11-22','新北投捷運站周邊、北投公園及七星街一帶的溫泉季活動。場次與交通安排以主辦單位最新公告為準。','https://100spotlights.taiwan.net.tw/light_info.php','觀光署台灣觀光100亮點',70,10),
 event('event-xmas','2026 新北歡樂耶誕城','新北','板橋區','2026-11-13','2026-12-27','在板橋市民廣場、萬坪公園與站前廣場，安排一段秋冬光影散步。演出場次、交通與人潮管制請查官網。','https://www.taiwan.net.tw/m1.aspx?lid=081713&sNo=0001019','交通部觀光署',65,18),
 event('event-lake','2026 花蓮鯉魚潭水岸光影節','花蓮','壽豐鄉','2026-11-28','2027-01-31','在壽豐鄉鯉魚潭，規劃一段秋冬水岸光影旅行。目前為活動預告，尚未開幕；場次與交通請確認官方公告。','https://www.taiwan.net.tw/m1.aspx?lid=081934&sNo=0001019','交通部觀光署',81,50)
];
export function taipeiDate(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());}
export function eventState(place,today=taipeiDate()){if(!place.start)return '';return today<place.start?'即將登場':today>place.end?'活動已結束':'活動期間';}
export function isCurrent(place,today=taipeiDate()){return place.collection!=='recent'||place.end>=today;}
export function photoLabel(place){return place.photoCredit?'正確地點實景・非即時':place.demo?'虛構示範・無實景照片':place.photo?'使用者提供照片':'尚無可核實照片';}


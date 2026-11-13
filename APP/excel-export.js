// A small, dependency-free OOXML writer. Text uses inline strings, never formulas.
const encoder=new TextEncoder();
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;};
function zip(files){
 const chunks=[],central=[];let offset=0;
 const header=(length,entries)=>{const a=new Uint8Array(length),v=new DataView(a.buffer);for(const [at,value,size]of entries)size===2?v.setUint16(at,value,true):v.setUint32(at,value,true);return a;};
 for(const [path,text]of files){const name=encoder.encode(path),body=encoder.encode(text),crc=crc32(body);
  const local=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,0x21,2],[14,crc,4],[18,body.length,4],[22,body.length,4],[26,name.length,2]]);
  chunks.push(local,name,body);
  central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,0x21,2],[16,crc,4],[20,body.length,4],[24,body.length,4],[28,name.length,2],[42,offset,4]]),name);
  offset+=local.length+name.length+body.length;
 }
 const size=central.reduce((n,a)=>n+a.length,0),end=header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,size,4],[16,offset,4]]);
 const result=new Uint8Array(offset+size+22);let p=0;for(const a of [...chunks,...central,end]){result.set(a,p);p+=a.length;}return result;
}
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function worksheet(rows,widths){return declaration+`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((row,r)=>`<row r="${r+1}" ht="24" customHeight="1">${row.map((value,c)=>{const ref=col(c)+(r+1);if(value instanceof Date)return `<c r="${ref}" s="3"><v>${value.getTime()/86400000+25569}</v></c>`;if(typeof value==='number'){if(!Number.isFinite(value))throw Error('匯出金額無效');return `<c r="${ref}" s="2"><v>${value}</v></c>`;}return `<c r="${ref}" t="inlineStr" s="${r===0?1:0}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/></worksheet>`;}
export function buildLedgerXlsx(trip,places=[]){
 const who=id=>trip.members.find(m=>m.id===id)?.name||'未知成員';
 const date=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'';const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())?d:s;};
 const expense=trip.records.filter(r=>r.type==='expense').reduce((n,r)=>n+r.amount,0),refund=trip.records.filter(r=>r.type==='refund').reduce((n,r)=>n+r.amount,0),income=trip.records.filter(r=>r.type==='income').reduce((n,r)=>n+r.amount,0);
 const sheets=[
  {name:'收支明細',widths:[14,14,30,12,18,16,16,42,18,30,42,28],rows:[['日期','類型','名稱','類別','金額 TWD','付款人','建立者','分攤 TWD','原支出 ID','地點','備註','最後更新'],...trip.records.map(r=>[date(r.date),({expense:'支出',income:'共同收入',refund:'退款'})[r.type]||r.type,r.title,r.category,r.amount/100,r.type==='income'?'共同帳本':who(r.payer),who(r.creator),Object.entries(r.shares||{}).map(([id,n])=>`${who(id)} ${(n/100).toFixed(2)}`).join('；'),r.originalId||'',places.find(p=>p.id===r.place)?.name||'',r.note||'',r.updated||''])]},
  {name:'還款紀錄',widths:[14,18,18,18],rows:[['還款日期','還款人','收款人','金額 TWD'],...trip.repayments.map(r=>[date(r.date),who(r.from),who(r.to),r.amount/100])]},
  {name:'旅程總覽',widths:[28,65],rows:[['項目','內容'],['旅程名稱',trip.name],['出發日期',date(trip.start)],['結束日期',date(trip.end)],['預算 TWD',trip.budget/100],['支出 TWD',expense/100],['退款 TWD',refund/100],['共同收入 TWD',income/100],['淨支出 TWD',(expense-refund-income)/100],['剩餘預算 TWD',(trip.budget-expense+refund+income)/100],['匯出範圍','目前旅程的全部收支與還款，不受畫面篩選影響。'],['還款規則','還款不列入旅遊收入或支出。'],['資料來源','此裝置瀏覽器保存的旅程資料；不同裝置不會自動同步。']]}
 ];
 const files=[
  ['[Content_Types].xml',declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
  ['_rels/.rels',declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',declaration+`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${s.name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels',declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml',declaration+`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF234C3C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf xfId="0" numFmtId="4" applyNumberFormat="1"/><xf xfId="0" numFmtId="14" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
  ...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,worksheet(s.rows,s.widths)])
 ];
 return zip(files);
}
export function downloadLedgerXlsx(trip,places){
 const blob=new Blob([buildLedgerXlsx(trip,places)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(trip.name||'旅程').replace(/[\\/:*?"<>|]/g,'-')+'-帳目.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}

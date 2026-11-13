export function cents(value){if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw Error('請輸入有效金額，最多兩位小數');const [a,b='']=String(value).split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0)throw Error('金額必須大於零且在安全範圍內');return n;}
export function split(total,ids){if(!ids.length)throw Error('至少選擇一位分攤成員');return Object.fromEntries(ids.map((id,i)=>[id,Math.floor(total/ids.length)+(i<total%ids.length?1:0)]));}
export function validateShares(total,shares){if(Object.values(shares).some(n=>!Number.isSafeInteger(n)||n<0)||Object.values(shares).reduce((a,b)=>a+b,0)!==total)throw Error('自訂分攤合計必須等於金額');}
export function refundShares(expense,amount){const entries=Object.entries(expense.shares);const total=BigInt(expense.amount);const rows=entries.map(([id,n],i)=>{const product=BigInt(n)*BigInt(amount);return {id,i,n:Number(product/total),r:product%total};});const remaining=amount-rows.reduce((s,r)=>s+r.n,0);[...rows].sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1).slice(0,remaining).forEach(r=>r.n++);return Object.fromEntries(rows.map(r=>[r.id,r.n]));}
export function calculate(trip){
 const balances=Object.fromEntries(trip.members.map(m=>[m.id,{paid:0,owed:0,balance:0}]));
 let expense=0,income=0,refund=0;const categories={},refundTotals={};
 for(const r of trip.records){
  if(r.type==='income'){income+=r.amount;continue;}
  if(r.type==='refund'){refundTotals[r.originalId]=(refundTotals[r.originalId]||0)+r.amount;continue;}
  expense+=r.amount;balances[r.payer].paid+=r.amount;
  for(const[id,n]of Object.entries(r.shares))balances[id].owed+=n;
  categories[r.category]=(categories[r.category]||0)+r.amount;
 }
 // Allocate cumulative refunds once per original expense so multiple tiny refunds
 // cannot repeatedly assign the same rounding cent to a single member.
 for(const[id,amount]of Object.entries(refundTotals)){
  const original=trip.records.find(e=>e.id===id&&e.type==='expense');
  if(!original||amount>original.amount)throw Error('退款必須連結原支出且不可超過原金額');
  refund+=amount;balances[original.payer].paid-=amount;
  for(const[id,n]of Object.entries(refundShares(original,amount)))balances[id].owed-=n;
  categories[original.category]-=amount;
 }
 for(const b of Object.values(balances))b.balance=b.paid-b.owed;
 for(const r of trip.repayments){balances[r.from].balance+=r.amount;balances[r.to].balance-=r.amount;}
 const debt=Object.entries(balances).filter(([,b])=>b.balance<0).map(([id,b])=>({id,n:-b.balance}));
 const credit=Object.entries(balances).filter(([,b])=>b.balance>0).map(([id,b])=>({id,n:b.balance}));
 const suggestions=[];for(const d of debt)for(const c of credit){const n=Math.min(d.n,c.n);if(n){suggestions.push({from:d.id,to:c.id,amount:n});d.n-=n;c.n-=n;}}
 return{expense,income,refund,net:expense-refund-income,remaining:trip.budget-expense+refund+income,balances,categories,suggestions};
}

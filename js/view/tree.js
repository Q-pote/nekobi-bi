import { Utils } from '../core/utils.js';
import { Store } from '../core/store.js';
import { CONFIG } from '../core/config.js';

let currentMode = 'budget';
const ns = "http://www.w3.org/2000/svg";

const createEl = (tag, attrs) => { const el = document.createElementNS(ns, tag); for(let k in attrs) el.setAttribute(k, attrs[k]); return el; };
const drawNode = (svg,cx,cy,w,h,t,st,bg,ir=false)=>{const x=cx-w/2,y=cy-h/2,g=createEl('g',{transform:`translate(${x},${y})`});g.appendChild(createEl('rect',{width:w,height:h,rx:4,fill:bg,stroke:ir?'var(--neon-purple)':'var(--border-color)','stroke-width':1}));const t1=createEl('text',{x:w/2,y:h/2-5,'text-anchor':'middle','font-size':'11px',fill:'#eee','font-weight':'bold'});t1.textContent=t;g.appendChild(t1);const t2=createEl('text',{x:w/2,y:h/2+12,'text-anchor':'middle','font-size':'10px',fill:'var(--accent-yellow)'});t2.textContent=st;g.appendChild(t2);svg.appendChild(g);};
const drawPath = (svg,x1,y1,x2,y2,ib)=>{let d=ib?`M ${x1} ${y1} L ${x1} ${y1+(y2-y1)/2} L ${x2} ${y1+(y2-y1)/2} L ${x2} ${y2}`:`M ${x1} ${y1} L ${x2} ${y2}`;svg.prepend(createEl('path',{d,fill:'none',stroke:'var(--accent-blue)','stroke-width':1,opacity:0.6}));};
const processData = (year) => {
    const data = Store.get(year); if(!data)return null; 
    const groups=[{id:'direct',name:'直営事業'},{id:'support',name:'支援事業'},{id:'loan_out',name:'貸付'},{id:'asset_buy',name:'資産購入'},{id:'loan_repay',name:'返済'},{id:'dividend_out',name:'配当'}]; 
    let allSubs=[]; if(data.distributions)data.distributions.forEach(d=>{if(d.sub_projects)d.sub_projects.forEach(s=>allSubs.push({...s,parentId:d.id}))}); 
    let targetSubs = currentMode==='budget'?allSubs.sort((a,b)=>b.amount-a.amount).slice(0,5):allSubs.sort((a,b)=>{const hA=Utils.calcHealth(a.financials,a.recovery_target),hB=Utils.calcHealth(b.financials,b.recovery_target);return hA.rate-hB.rate}).slice(0,5); 
    let total=data.distributions?data.distributions.reduce((s,d)=>s+(d.amount||0),0):0; 
    return {groups,subs:targetSubs,totalAmount:total}; 
};
const drawTree = (svgId, year) => {
    const svg=document.getElementById(svgId); if(!svg)return; svg.innerHTML=''; 
    const td=processData(year); if(!td)return; 
    const w=svg.clientWidth||900,nw=120,nh=50,gx=20,gy=80,sy=40,rx=w/2,ry=sy,t1w=td.groups.length*nw+(td.groups.length-1)*gx,t1sx=(w-t1w)/2+nw/2,gc={}; 
    td.groups.forEach((g,i)=>{const x=t1sx+i*(nw+gx),y=ry+gy+nh; gc[g.id]={x,y}; drawNode(svg,x,y,nw,nh,g.name,'',i%2===0?'#333':'#222'); drawPath(svg,rx,ry+nh/2,x,y-nh/2,true);}); 
    drawNode(svg,rx,ry,nw*1.5,nh+10,`${year} 一般会計`,Utils.fmtMoney(td.totalAmount),'#000',true); 
    const sc={}; 
    td.subs.forEach(s=>{const p=gc[s.parentId]; if(!p)return; const c=(sc[s.parentId]||0); sc[s.parentId]=c+1; const x=p.x,y=p.y+nh+40+(c*(nh+10)); let cl='#1a1a1a',lb=Utils.fmtMoney(s.amount); if(currentMode==='kpi'){const h=Utils.calcHealth(s.financials,s.recovery_target);cl=CONFIG.colors[h.status]+'40';lb=`達成率:${h.rate.toFixed(0)}%`;} drawNode(svg,x,y,nw,nh,s.name,lb,cl); const px=p.x,py=p.y+nh/2; svg.prepend(createEl('path',{d:`M ${px} ${py} L ${x} ${y-nh/2}`,fill:'none',stroke:'var(--accent-blue)','stroke-width':1,opacity:0.6}));}); 
};
export const ViewTree = {
    draw: () => { drawTree('tree-svg-2024', "2024"); drawTree('tree-svg-2025', "2025"); },
    toggleMode: () => { currentMode = currentMode==='budget'?'kpi':'budget'; ViewTree.draw(); const l={'budget':'💰 予算規模 Top5','kpi':'🚨 KPI ワースト5'}; ['tree-mode-btn','tree-mode-btn-back'].forEach(id=>{const b=document.getElementById(id);if(b)b.innerHTML=l[currentMode]}); },
    renderCard: () => {
        const btnHtml = `<button id="tree-mode-btn" onclick="window.ViewTreeInstance.toggleMode(); event.stopPropagation();" style="position:absolute; top:10px; right:60px; z-index:100; background:rgba(0,0,0,0.5); border:1px solid var(--neon-purple); color:#fff; padding:5px 10px; cursor:pointer; border-radius:4px;">💰 予算規模 Top5</button>`;
        return `<div class="card-inner">
            <div class="card-front"><div class="card-header"><span class="flip-btn" onclick="window.toggleFlip(this)">🔄</span>【白虎】系統樹 (2024年度)</div><div class="card-body" style="position:relative; height:100%;">${btnHtml}<svg id="tree-svg-2024" width="100%" height="100%"></svg></div></div>
            <div class="card-back"><div class="card-header"><span class="flip-btn" onclick="window.toggleFlip(this)">🔄</span>【白虎】系統樹 (2025年度)</div><div class="card-body" style="position:relative; height:100%;">${btnHtml.replace('tree-mode-btn','tree-mode-btn-back')}<svg id="tree-svg-2025" width="100%" height="100%"></svg></div></div>
        </div>`;
    }
};
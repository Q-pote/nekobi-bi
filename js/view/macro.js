import { Utils } from '../core/utils.js';
import { AccountingEngine } from '../core/engine.js';
import { CONFIG } from '../core/config.js';
import { Store } from '../core/store.js';

let currentBsYear = 2024;
let currentBsMode = 'BS';
let currentBsFrontMode = 'BS';
let currentJournalYear = 2024;

const ACCOUNT_SCHEMA = {
    assets: [{ key: 'carried_forward', label: '繰越金' }, { key: 'subsidy', label: '給付金・政府給付金' }, { key: 'tax_revenue', label: '収入・税収・寄付' }, { key: 'loan_in', label: '借入' }, { key: 'dividend_in', label: '配当受取' }, { key: 'asset_sold', label: '資産売却' }],
    liabilities: [{ key: 'direct_biz', label: '直営事業費' }, { key: 'support_biz', label: '支援事業費' }, { key: 'loan_repay', label: '返済' }, { key: 'loan_out', label: '貸付' }, { key: 'dividend_out', label: '配当支払' }, { key: 'asset_buy', label: '資産購入' }]
};

const renderRawTable = (data) => {
    if (!data || !data.generalAccount) return '<div class="no-data">データなし</div>';
    const v = data.generalAccount.values || {};
    const row = (label, val) => `<div class="account-row"><span class="label">${label}</span><span class="value">${Utils.fmtMoney(val)}</span></div>`;
    const totalIn = ACCOUNT_SCHEMA.assets.reduce((sum, item) => sum + (v[item.key]||0), 0);
    const totalOut = ACCOUNT_SCHEMA.liabilities.reduce((sum, item) => sum + (v[item.key]||0), 0);
    return `<div class="bs-container"><div class="bs-column"><div class="account-category" style="color:var(--accent-blue);">収入・調達 (In)</div>${ACCOUNT_SCHEMA.assets.map(item => row(item.label, v[item.key])).join('')}<div class="account-row bs-total"><span class="label">収入合計</span><span class="value">${Utils.fmtMoney(totalIn)}</span></div></div><div class="bs-column"><div class="account-category" style="color:var(--accent-red);">支出・運用 (Out)</div>${ACCOUNT_SCHEMA.liabilities.map(item => row(item.label, v[item.key])).join('')}<div class="account-row bs-total"><span class="label">支出合計</span><span class="value">${Utils.fmtMoney(totalOut)}</span></div></div></div>`;
};

const createSvgBarDetail = (data, total, width, height, isRight=false) => {
    if (total === 0) return '';
    let y = 0;
    const barW = width * 0.5;
    const x = isRight ? (width * 0.1) : (width * 0.4);
    let svgContent = `<rect x="${x}" y="0" width="${barW}" height="${height}" fill="none" stroke="#333" stroke-width="1" stroke-dasharray="4 4" />`;
    const rects = data.map(item => {
        if (item.value <= 0) return '';
        const h = (item.value / total) * height;
        const color = getColor(item.type);
        const rect = `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" stroke="#000" stroke-width="1" opacity="0.9"><title>${item.label}: ${Utils.fmtMoney(item.value)}</title></rect>`;
        const labelX = isRight ? (x + barW + 10) : (x - 10);
        const labelAnchor = isRight ? "start" : "end";
        const midY = y + h/2;
        const percent = ((item.value / total) * 100).toFixed(1) + "%";
        const labelText = `<text x="${labelX}" y="${midY - 5}" font-size="11" fill="${color}" font-weight="bold" text-anchor="${labelAnchor}">${item.label}</text><text x="${labelX}" y="${midY + 8}" font-size="10" fill="#ccc" text-anchor="${labelAnchor}">${Utils.fmtMoney(item.value)}</text><text x="${labelX}" y="${midY + 20}" font-size="9" fill="#666" text-anchor="${labelAnchor}">(${percent})</text>`;
        const lineX1 = isRight ? (x + barW) : x;
        const line = `<line x1="${lineX1}" y1="${midY}" x2="${labelX}" y2="${midY}" stroke="${color}" stroke-width="1" opacity="0.5" />`;
        y += h;
        return rect + line + labelText;
    }).join('');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible;">${svgContent}${rects}</svg>`;
};

const createSvgWaterfall = (plData, width, height) => {
    if (!plData) return '';
    const maxVal = Math.max(plData.totals.revenue, plData.totals.expense) || 1;
    const barW = width * 0.15; const gap = width * 0.05;
    let currentX = 50; let currentY = height - 30;
    const scale = (val) => (val / maxVal) * (height - 50);
    let svgContent = '';
    let revY = currentY;
    plData.revenues.forEach(item => { if(item.value <= 0) return; const h = scale(item.value); revY -= h; svgContent += `<rect x="${currentX}" y="${revY}" width="${barW}" height="${h}" fill="${CONFIG.colors.healthy}" opacity="0.9"><title>${item.label}: ${Utils.fmtMoney(item.value)}</title></rect>`; });
    svgContent += `<text x="${currentX + barW/2}" y="${revY - 5}" font-size="10" fill="#fff" text-anchor="middle">収入</text><text x="${currentX + barW/2}" y="${currentY + 15}" font-size="10" fill="#aaa" text-anchor="middle">${Utils.fmtMoney(plData.totals.revenue)}</text>`;
    currentX += barW + gap;
    let startY = revY; 
    plData.expenses.forEach(item => { if(item.value <= 0) return; const h = scale(item.value); svgContent += `<line x1="${currentX - gap}" y1="${startY}" x2="${currentX}" y2="${startY}" stroke="#666" stroke-dasharray="2 2" /><rect x="${currentX}" y="${startY}" width="${barW}" height="${h}" fill="${CONFIG.colors.danger}" opacity="0.8"><title>${item.label}: ${Utils.fmtMoney(item.value)}</title></rect>`; startY += h; currentX += barW + gap; });
    const balVal = plData.totals.balance; const balH = scale(Math.abs(balVal)); const balColor = balVal >= 0 ? CONFIG.colors.accentBlue : CONFIG.colors.warning;
    const endX = currentX;
    if (balVal >= 0) { const balY = currentY - balH; svgContent += `<rect x="${endX}" y="${balY}" width="${barW}" height="${balH}" fill="${balColor}"><title>残高: ${Utils.fmtMoney(balVal)}</title></rect><text x="${endX + barW/2}" y="${balY - 5}" font-size="10" fill="${balColor}" text-anchor="middle" font-weight="bold">黒字</text><text x="${endX + barW/2}" y="${currentY + 15}" font-size="10" fill="#aaa" text-anchor="middle">${Utils.fmtMoney(balVal)}</text>`; } 
    else { const balY = currentY - scale(Math.abs(balVal)); svgContent += `<text x="${endX + barW/2}" y="${currentY - 20}" font-size="12" fill="${balColor}" text-anchor="middle" font-weight="bold">赤字</text><text x="${endX + barW/2}" y="${currentY + 15}" font-size="10" fill="${balColor}" text-anchor="middle">${Utils.fmtMoney(balVal)}</text>`; }
    svgContent += `<line x1="40" y1="${currentY}" x2="${width - 20}" y2="${currentY}" stroke="#444" stroke-width="1" />`;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgContent}</svg>`;
};

const createSvgHBar = (data, width, height, colorFunc) => {
    if (!data || data.length === 0) return '<div style="text-align:center; color:#666; padding:20px;">データなし</div>';
    const maxVal = Math.max(...data.map(d => d.value)) || 1;
    const barH = 25; const gap = 15; const svgH = data.length * (barH + gap);
    let y = 0;
    const bars = data.map((item, i) => {
        const w = (item.value / maxVal) * (width - 100);
        const color = colorFunc(item.label);
        const rect = `<rect x="0" y="${y}" width="${w}" height="${barH}" fill="${color}" opacity="0.8" rx="2"></rect>`;
        const valText = `<text x="${w + 5}" y="${y + 17}" font-size="11" fill="#fff">${Utils.fmtMoney(item.value)}</text>`;
        const labelText = `<text x="0" y="${y - 5}" font-size="11" fill="#aaa" font-weight="bold">${item.label}</text>`;
        const group = `<g transform="translate(0, 15)">${labelText}${rect}${valText}</g>`;
        y += (barH + gap); return group;
    }).join('');
    return `<svg width="${width}" height="${svgH + 20}" style="overflow:visible;">${bars}</svg>`;
};

const getJournalColor = (label) => {
    if (label.includes('現金')) return CONFIG.colors.healthy;
    if (label.includes('税収') || label.includes('売上')) return CONFIG.colors.accentBlue;
    if (label.includes('費用') || label.includes('事業費')) return CONFIG.colors.danger;
    if (label.includes('資産') || label.includes('建物')) return CONFIG.colors.warning;
    if (label.includes('借入')) return CONFIG.colors.danger;
    return '#888';
};

const getColor = (type) => {
    switch(type) {
        case 'cash': return CONFIG.colors.healthy;
        case 'fixed': return CONFIG.colors.accentBlue;
        case 'invest': return CONFIG.colors.warning;
        case 'debt': return CONFIG.colors.danger;
        case 'equity': return CONFIG.colors.healthy;
        default: return '#888';
    }
};

const renderBsGraphSingle = (year) => {
    const data = Store.get(year.toString()); if (!data) return '<div class="no-data">Data Not Found</div>';
    const bsData = AccountingEngine.generateBS(data);
    const w = 350; const h = 400;
    const assets = [...bsData.assets].sort((a,b) => { const order={'cash':1,'invest':2,'fixed':3}; return order[a.type]-order[b.type]; });
    const liabs = [...bsData.liabilities, ...bsData.equity];
    const maxVal = Math.max(bsData.totals.assets, bsData.totals.liab_equity) || 1;
    const leftSvg = createSvgBarDetail(assets, maxVal, w, h, false);
    const rightSvg = createSvgBarDetail(liabs, maxVal, w, h, true);
    return `<div style="display:flex; height:100%; align-items:center; justify-content:center; gap:0;"><div style="width:${w}px; height:${h}px; position:relative;"><div style="position:absolute; top:-25px; width:100%; text-align:center; color:var(--accent-blue); font-weight:bold;">資産の部 (運用)</div>${leftSvg}<div style="position:absolute; bottom:-25px; width:100%; text-align:center; font-weight:bold;">${Utils.fmtMoney(bsData.totals.assets)}</div></div><div style="width:1px; background:#444; height:${h}px; margin:0 20px;"></div><div style="width:${w}px; height:${h}px; position:relative;"><div style="position:absolute; top:-25px; width:100%; text-align:center; color:var(--accent-red); font-weight:bold;">負債・純資産の部 (調達)</div>${rightSvg}<div style="position:absolute; bottom:-25px; width:100%; text-align:center; font-weight:bold;">${Utils.fmtMoney(bsData.totals.liab_equity)}</div></div></div>`;
};

const renderPlGraphSingle = (year) => {
    const data = Store.get(year.toString()); if (!data) return '<div class="no-data">Data Not Found</div>';
    const plData = AccountingEngine.generatePL(data);
    const w = 750; const h = 400;
    return `<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center;"><div style="font-size:14px; color:#aaa; margin-bottom:10px;">${year}年度 損益ウォーターフォール (P/L)</div>${createSvgWaterfall(plData, w, h)}</div>`;
};

const renderJournalGraphSingle = (year) => {
    const data = Store.get(year.toString()); if (!data) return '<div class="no-data">Data Not Found</div>';
    const journal = AccountingEngine.generateJournal(data);
    const debitMap = {}; const creditMap = {};
    journal.forEach(j => {
        if (!debitMap[j.debit.label]) debitMap[j.debit.label] = 0; debitMap[j.debit.label] += j.debit.value;
        if (!creditMap[j.credit.label]) creditMap[j.credit.label] = 0; creditMap[j.credit.label] += j.credit.value;
    });
    const toList = (map) => Object.entries(map).map(([label, value]) => ({label, value})).filter(i => i.value > 0).sort((a,b) => b.value - a.value);
    const debits = toList(debitMap); const credits = toList(creditMap);
    const w = 350;
    const leftSvg = createSvgHBar(debits, w, 300, getJournalColor);
    const rightSvg = createSvgHBar(credits, w, 300, getJournalColor);
    return `<div style="display:flex; height:100%; justify-content:center; gap:20px; padding-top:10px; overflow-y:auto;"><div style="width:${w}px;"><div style="border-bottom:1px solid #444; margin-bottom:10px; color:var(--accent-yellow); font-weight:bold;">借方 (Debit) : 資金の使途・資産増</div>${leftSvg}</div><div style="width:1px; background:#444; min-height:300px;"></div><div style="width:${w}px;"><div style="border-bottom:1px solid #444; margin-bottom:10px; color:var(--accent-blue); font-weight:bold;">貸方 (Credit) : 調達源泉・収益</div>${rightSvg}</div></div>`;
};

// Global Toggles
window.toggleBsYear = (year) => {
    currentBsYear = year;
    const container = document.getElementById('bs-graph-container');
    if(container) {
        if (currentBsMode === 'BS') container.innerHTML = renderBsGraphSingle(year);
        else container.innerHTML = renderPlGraphSingle(year);
    }
    document.querySelectorAll('.bs-year-btn').forEach(btn => {
        btn.style.background = (parseInt(btn.dataset.year) === year) ? 'var(--neon-purple)' : 'transparent';
        btn.style.color = (parseInt(btn.dataset.year) === year) ? '#fff' : 'var(--neon-purple)';
    });
};
window.toggleBsMode = (mode) => { currentBsMode = mode; window.toggleBsYear(currentBsYear); };
window.toggleBsFrontMode = (mode) => {
    currentBsFrontMode = mode;
    const d24 = Store.get("2024"); const d25 = Store.get("2025");
    const container = document.getElementById('bs-front-container');
    if (container) container.innerHTML = renderBsFrontContent(d24, d25);
    document.querySelectorAll('.bs-front-btn').forEach(btn => {
        const isActive = btn.dataset.mode === mode;
        btn.style.background = isActive ? 'var(--neon-purple)' : 'transparent';
        btn.style.color = isActive ? '#fff' : 'var(--neon-purple)';
    });
};
window.toggleJournalYear = (year) => {
    currentJournalYear = year;
    const container = document.getElementById('journal-graph-container');
    if(container) container.innerHTML = renderJournalGraphSingle(year);
    document.querySelectorAll('.journal-year-btn').forEach(btn => {
        btn.style.background = (parseInt(btn.dataset.year) === year) ? 'var(--neon-purple)' : 'transparent';
        btn.style.color = (parseInt(btn.dataset.year) === year) ? '#fff' : 'var(--neon-purple)';
    });
};

const renderBsFrontContent = (d24, d25) => {
    const renderTrueBsTable = (bsData) => {
        if (!bsData) return '<div class="no-data">データなし</div>';
        const row = (label, val, indent=false) => `<div class="account-row" style="${indent?'padding-left:15px; color:#aaa;':''}"><span class="label">${label}</span><span class="value">${Utils.fmtMoney(val)}</span></div>`;
        return `<div class="bs-container"><div class="bs-column"><div class="account-category" style="color:var(--accent-blue);">資産の部 (Assets)</div>${bsData.assets.map(a => row(a.label, a.value)).join('')}<div class="account-row bs-total"><span class="label">資産合計</span><span class="value">${Utils.fmtMoney(bsData.totals.assets)}</span></div></div><div class="bs-column"><div class="account-category" style="color:var(--accent-red);">負債の部 (Liabilities)</div>${bsData.liabilities.map(l => row(l.label, l.value)).join('')}<div class="account-category" style="color:var(--accent-green); margin-top:20px;">純資産の部 (Equity)</div>${bsData.equity.map(e => row(e.label, e.value)).join('')}<div class="account-row bs-total" style="margin-top:auto;"><span class="label">負債・純資産合計</span><span class="value">${Utils.fmtMoney(bsData.totals.liab_equity)}</span></div></div></div>`;
    };
    if (currentBsFrontMode === 'BS') {
        const bs24 = AccountingEngine.generateBS(d24); const bs25 = AccountingEngine.generateBS(d25);
        return `<div class="year-title-sub">2024年度 (建設フェーズ)</div><div style="flex:1;">${renderTrueBsTable(bs24)}</div><hr style="border-color:#333; margin:10px 0;"><div class="year-title-sub">2025年度 (運営フェーズ)</div><div style="flex:1;">${renderTrueBsTable(bs25)}</div>`;
    } else {
        return `<div class="year-title-sub">2024年度 (Raw Data)</div><div style="flex:1;">${renderRawTable(d24)}</div><hr style="border-color:#333; margin:10px 0;"><div class="year-title-sub">2025年度 (Raw Data)</div><div style="flex:1;">${renderRawTable(d25)}</div>`;
    }
};

export const ViewMacro = {
    renderJournalCard: (d24, d25) => {
        const j24 = { journal: AccountingEngine.generateJournal(d24) };
        const j25 = { journal: AccountingEngine.generateJournal(d25) };
        const renderJournal = (data) => {
            if(!data || !data.journal) return '-';
            return `<table class="journal-table"><thead><tr><th style="width:30%">摘要</th><th style="width:35%">借方</th><th style="width:35%">貸方</th></tr></thead><tbody>${data.journal.map(j => `<tr><td>${j.desc}</td><td><div style="font-weight:bold;">${j.debit.label}</div><div style="color:var(--accent-yellow); font-size:10px;">${Utils.fmtMoney(j.debit.value)}</div></td><td><div style="font-weight:bold;">${j.credit.label}</div><div style="color:var(--accent-yellow); font-size:10px;">${Utils.fmtMoney(j.credit.value)}</div></td></tr>`).join('')}</tbody></table>`;
        };
        const front = `<div class="yearly-distribution-container"><div class="year-column"><div class="year-title-sub">2024年度</div>${renderJournal(j24)}</div><div class="year-column"><div class="year-title-sub">2025年度</div>${renderJournal(j25)}</div></div>`;
        const btnStyle = "border:1px solid var(--neon-purple); padding:5px 15px; cursor:pointer; border-radius:4px; margin:0 5px; font-family:'Orbitron'; transition:0.3s;";
        const back = `<div style="display:flex; flex-direction:column; height:100%;"><div style="display:flex; justify-content:center; margin-bottom:20px;"><button class="journal-year-btn" data-year="2024" onclick="window.toggleJournalYear(2024)" style="${btnStyle} background:var(--neon-purple); color:#fff;">2024</button><button class="journal-year-btn" data-year="2025" onclick="window.toggleJournalYear(2025)" style="${btnStyle} background:transparent; color:var(--neon-purple);">2025</button></div><div id="journal-graph-container" style="flex:1; padding:20px 0;">${renderJournalGraphSingle(2024)}</div></div>`;
        return `<div class="card-inner"><div class="card-front"><div class="card-header"><span class="flip-btn" onclick="window.toggleFlip(this)">🔄</span>🦄 【麒麟】複式簿記 (仕訳帳)</div><div class="card-body">${front}</div></div><div class="card-back"><div class="card-header"><span class="flip-btn" onclick="window.toggleFlip(this)">🔄</span>🦄 【麒麟】複式簿記 (Graph)</div><div class="card-body">${back}</div></div></div>`;
    },
    renderBsCard: (d24, d25) => {
        const btnStyle = "border:1px solid var(--neon-purple); padding:2px 8px; cursor:pointer; border-radius:4px; margin-left:10px; font-size:10px; transition:0.3s;";
        const toggles = `<div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button class="bs-front-btn" data-mode="BS" onclick="window.toggleBsFrontMode('BS')" style="${btnStyle} background:var(--neon-purple); color:#fff;">貸借対照表 (B/S)</button><button class="bs-front-btn" data-mode="RAW" onclick="window.toggleBsFrontMode('RAW')" style="${btnStyle} background:transparent; color:var(--neon-purple);">生データ (Raw)</button></div>`;
        const frontContent = renderBsFrontContent(d24, d25);
        const front = `<div style="display:flex; flex-direction:column; height:100%;">${toggles}<div id="bs-front-container" style="flex:1; display:flex; flex-direction:column;">${frontContent}</div></div>`;
        const backBtnStyle = "border:1px solid var(--neon-purple); padding:5px 15px; cursor:pointer; border-radius:4px; margin:0 5px; font-family:'Orbitron'; transition:0.3s;";
        const modeBtnStyle = "border:1px solid var(--accent-blue); padding:5px 10px; cursor:pointer; border-radius:4px; margin:0 5px; font-size:11px; transition:0.3s;";
        const back = `<div style="display:flex; flex-direction:column; height:100%;"><div style="display:flex; justify-content:space-between; align-items:center; padding:0 20px; margin-bottom:10px;"><div style="display:flex;"><button class="bs-year-btn" data-year="2024" onclick="window.toggleBsYear(2024)" style="${backBtnStyle} background:var(--neon-purple); color:#fff;">2024</button><button class="bs-year-btn" data-year="2025" onclick="window.toggleBsYear(2025)" style="${backBtnStyle} background:transparent; color:var(--neon-purple);">2025</button></div><div style="display:flex;"><button class="bs-mode-btn" data-mode="BS" onclick="window.toggleBsMode('BS')" style="${modeBtnStyle} background:var(--accent-blue); color:#fff;">🐢 ストック</button><button class="bs-mode-btn" data-mode="PL" onclick="window.toggleBsMode('PL')" style="${modeBtnStyle} background:transparent; color:var(--accent-blue);">📈 フロー</button></div></div><div id="bs-graph-container" style="flex:1; padding:10px 0;">${renderBsGraphSingle(2024)}</div></div>`;
        return `<div class="card-inner"><div class="card-front"><div class="card-header"><span class="flip-btn" onclick="window.toggleFlip(this)">🔄</span>🐢 【玄武】行政ステータス</div><div class="card-body">${front}</div></div><div class="card-back"><div class="card-header"><span class="flip-btn" onclick="window.toggleFlip(this)">🔄</span>🐢 【玄武】行政ステータス (Graph)</div><div class="card-body">${back}</div></div></div>`;
    }
};
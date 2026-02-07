import { Utils } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

const FIXED_SLOTS = [
    { id: 'direct', name: '直営事業', type: '事業' }, { id: 'support', name: '支援事業', type: '事業' },
    { id: 'loan_out', name: '貸付', type: '貸付' }, { id: 'asset_buy', name: '資産購入', type: '投資' },
    { id: 'loan_repay', name: '返済', type: '返還' }, { id: 'dividend_out', name: '配当', type: '配当' }
];

const renderAmountBlock = (item) => {
    if (!item.financials) return `<div class="amount-display">${Utils.fmtMoney(item.amount)}</div>`;
    const exp = item.financials.expenditure || 0;
    const rev = item.financials.revenue || 0;
    const rowStyle = "display:flex; justify-content:space-between; align-items:center; line-height:1.2;";
    const labelStyle = "font-size:10px; color:#888;";
    const valExpStyle = "font-size:13px; font-weight:bold; color:var(--accent-red);";
    const valRevStyle = "font-size:13px; font-weight:bold; color:var(--accent-blue);";
    return `<div style="margin: 10px 0;">
            <div style="${rowStyle}"><span style="${labelStyle}">投資(Exp)</span><span style="${valExpStyle}">${Utils.fmtMoney(exp)}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">回収(Rev)</span><span style="${valRevStyle}">${Utils.fmtMoney(rev)}</span></div>
        </div>`;
};

const renderMiniGraph = (bs) => {
    if (!bs) return '<div style="flex:1; display:flex; align-items:center; justify-content:center; color:#444; font-size:10px;">No B/S</div>';
    const assets = bs.assets_column ? bs.assets_column.reduce((s, i) => s + (i.value||0), 0) : 0;
    const liabs = bs.liabilities_column ? bs.liabilities_column.reduce((s, i) => s + (i.value||0), 0) : 0;
    const max = Math.max(assets, liabs) || 1;
    const hA = (assets / max) * 100;
    const hL = (liabs / max) * 100;
    return `<div class="mini-bs-graph"><div class="mini-bar" style="height:${hA}%" title="資産"></div><div class="mini-bar liability" style="height:${hL}%" title="支出"></div></div>`;
};

const renderHealthGauge = (item) => {
    if (!item.financials || item.recovery_target === undefined) return '<div style="flex:1; display:flex; align-items:center; justify-content:center; color:#444; font-size:10px;">No Data</div>';
    const h = Utils.calcHealth(item.financials, item.recovery_target);
    const color = CONFIG.colors[h.status];
    return `<div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; padding-bottom:5px;">
        <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;"><span style="color:#888;">目標 ${h.isPublic ? '0%' : (h.targetRate.toFixed(0) + '%')}</span><span style="color:${color}; font-weight:bold;">${h.text}</span></div>
        <div style="width:100%; height:8px; background:${CONFIG.colors.barBg}; border-radius:4px; overflow:hidden;"><div style="width:${h.rate}%; height:100%; background:${color}; transition: width 1s;"></div></div>
        <div style="font-size:9px; text-align:right; color:#666; margin-top:2px;">KPI: ${item.pnl_kpi ? item.pnl_kpi.kpi_actual : '-'}</div></div>`;
};

const renderNode = (type, item, idx, year) => {
    let bodyHtml = '';
    const amountHtml = renderAmountBlock(item);
    if (type === 'dist') bodyHtml = item.balanceSheet ? renderMiniGraph(item.balanceSheet) : '<div style="flex:1;"></div>';
    else if (type === 'eval') bodyHtml = renderHealthGauge(item);
    return `<div class="${type === 'dist' ? 'destination-node' : 'evaluation-node'} clickable" data-type="${type}" data-year="${year}" data-id="${item.id}">
        <div class="dest-header"><span class="dest-name">${item.name}</span><span class="tag-${item.type}" style="float:right;">${item.type}</span></div>
        ${amountHtml}
        ${bodyHtml}
    </div>`;
};

const renderCardGrid = (d24, d25, type) => {
    const fillSlots = (yearData) => {
        const distMap = {};
        if (yearData && yearData.distributions) yearData.distributions.forEach(d => distMap[d.id] = d);
        return FIXED_SLOTS.map((slot, i) => {
            const item = distMap[slot.id] || { ...slot, amount: 0, balanceSheet: null };
            const yearStr = yearData ? yearData.year : '20XX';
            return renderNode(type, item, i, yearStr);
        }).join('');
    };
    return `<div class="yearly-distribution-container"><div class="year-column"><div class="year-title-sub">2024年度</div><div class="card-grid">${fillSlots(d24)}</div></div><div class="year-column"><div class="year-title-sub">2025年度</div><div class="card-grid">${fillSlots(d25)}</div></div></div>`;
};

const wrapCard = (title, icon, content) => `
    <div class="card-inner">
        <div class="card-front"><div class="card-header">${icon} ${title}</div><div class="card-body">${content}</div></div>
        <div class="card-back"><div class="card-header">🔄 ${title} (Graph)</div><div class="card-body" style="display:flex; align-items:center; justify-content:center; color:#666;">(Graph Mode Not Available)</div></div>
    </div>`;

export const ViewCards = {
    renderDistCard: (d24, d25) => wrapCard('【青龍】事業グループB/S (子)', '🐉', renderCardGrid(d24, d25, 'dist')),
    renderEvalCard: (d24, d25) => wrapCard('【朱雀】事業健全性 (達成度)', '🐦', renderCardGrid(d24, d25, 'eval')),
    renderBsLegacy: (bsData) => {
         if (!bsData) return '';
         const renderRows = (list) => list.map(item => `<div class="account-row"><span class="label">${item.label}</span><span class="value">${Utils.fmtMoney(item.value)}</span></div>`).join('');
         return `<div class="bs-container" style="font-size:10px;"><div class="bs-column">${renderRows(bsData.assets_column)}</div><div class="bs-column">${renderRows(bsData.liabilities_column)}</div></div>`;
    }
};
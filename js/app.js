import { loadData } from './core/store.js';
await loadData();

import { CONFIG } from './core/config.js';
import { Store } from './core/store.js';
import { ViewMacro } from './view/macro.js';
import { ViewCards } from './view/cards.js';
import { ViewTree } from './view/tree.js';
import { Utils } from './core/utils.js';

window.toggleFlip = (btn) => {
    const card = btn.closest('.holo-card');
    if (card) card.classList.toggle('is-flipped');
    if(window.event) window.event.stopPropagation();
};
window.ViewTreeInstance = ViewTree;

class Carousel {
    constructor(el, cardsDef) { 
        this.el = el; this.cardsDef = cardsDef; 
        this.angle = 0; this.targetAngle = 0; this.theta = 360 / cardsDef.length; this.isDragging = false; 
    }
    init() {
        const d24 = Store.get("2024");
        const d25 = Store.get("2025");
        this.cardsDef.forEach(def => {
            const card = document.createElement('div');
            card.className = 'holo-card'; card.dataset.id = def.id;
            let html = '';
            if (def.id === 'kirin') html = ViewMacro.renderJournalCard(d24, d25);
            else if (def.id === 'macro') html = ViewMacro.renderBsCard(d24, d25);
            else if (def.id === 'genealogy') html = ViewTree.renderCard();
            else if (def.id === 'dist') html = ViewCards.renderDistCard(d24, d25);
            else if (def.id === 'eval') html = ViewCards.renderEvalCard(d24, d25);
            card.innerHTML = html;
            this.el.appendChild(card);
        });
        this.update(); this.bindEvents();
    }
    update() {
        this.el.style.transform = `translateZ(${-CONFIG.radius}px) rotateY(${this.angle}deg)`;
        Array.from(this.el.children).forEach((card, i) => {
            const cardAngle = i * this.theta;
            card.style.transform = `rotateY(${cardAngle}deg) translateZ(${CONFIG.radius}px)`;
            let diff = (cardAngle - (-this.angle % 360) + 540) % 360 - 180;
            Math.abs(diff) < (this.theta / 2) ? card.classList.add('active-item') : card.classList.remove('active-item');
        });
    }
    snap() {
        const step = () => { if (Math.abs(this.targetAngle - this.angle) < 0.1) { this.angle = this.targetAngle; this.update(); } else { this.angle += (this.targetAngle - this.angle) * 0.15; this.update(); requestAnimationFrame(step); } }; 
        requestAnimationFrame(step);
    }
    bindEvents() {
        let startX = 0, startAngle = 0;
        const onStart = (x) => { if(window.Modal && window.Modal.isOpen)return; this.isDragging = true; startX = x; startAngle = this.angle; this.el.style.transition = 'none'; };
        const onMove = (x) => { if (!this.isDragging) return; this.angle = startAngle + (x - startX) * 0.2; this.update(); };
        const onEnd = () => { if (!this.isDragging) return; this.isDragging = false; this.el.style.transition = 'transform 0.5s'; this.targetAngle = Math.round(this.angle/this.theta)*this.theta; this.snap(); };
        window.addEventListener('mousedown', e => onStart(e.clientX)); window.addEventListener('mousemove', e => onMove(e.clientX)); window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchstart', e => onStart(e.touches[0].clientX), {passive: true}); window.addEventListener('touchmove', e => onMove(e.touches[0].clientX), {passive: true}); window.addEventListener('touchend', onEnd);
        window.addEventListener('keydown', e => { if (window.Modal && window.Modal.isOpen) return; if (e.key === 'ArrowLeft') { this.targetAngle += this.theta; this.snap(); } if (e.key === 'ArrowRight') { this.targetAngle -= this.theta; this.snap(); } });
        this.el.addEventListener('click', (e) => {
            if (this.isDragging) return;
            if (e.target.closest('.flip-btn')) return;
            const target = e.target.closest('.clickable');
            if (target && window.Modal) {
                const { type, year, id } = target.dataset;
                if (type === 'dist') window.Modal.openDist(year, id);
                if (type === 'eval') window.Modal.openEval(year, id);
            }
        });
    }
}

window.Modal = {
    overlay: document.getElementById('editorOverlay'), title: document.getElementById('modal-title-container'), body: document.getElementById('modal-body-container'), closeBtn: document.getElementById('modalCloseBtn'), isOpen: false,
    init() { this.closeBtn.addEventListener('click', () => this.close()); window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen) this.close(); }); },
    open(titleHtml, contentHtml) { this.title.innerHTML = titleHtml; this.body.innerHTML = contentHtml; this.overlay.setAttribute('aria-hidden', 'false'); this.isOpen = true; },
    close() { this.overlay.setAttribute('aria-hidden', 'true'); this.isOpen = false; },
    openDist(year, id) { 
        const data = Store.get(year); const d = data ? data.distributions.find(item => item.id === id) : null; if (!d) return;
        const content = d.sub_projects?.length 
            ? `<div style="display:flex; gap:20px; overflow-x:auto; padding-bottom:10px;">${d.sub_projects.map(sub => `<div style="flex:0 0 300px; background:#1a1a1a; padding:15px; border-radius:4px; border:1px solid #333;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;"><div style="font-size:15px; font-weight:bold; color:var(--neon-purple); width:70%; line-height:1.2;">${sub.name}</div><div style="font-size:14px; font-weight:bold; color:var(--accent-yellow); text-align:right;">${Utils.fmtMoney(sub.amount)}</div></div><div style="font-size:11px; color:#888; margin-bottom:10px; text-align:right;">KPI: <span style="color:#fff;">${sub.pnl_kpi ? sub.pnl_kpi.kpi_actual : '-'}</span></div>${ViewCards.renderBsLegacy(sub.balanceSheet)}</div>`).join('')}</div>` 
            : ViewCards.renderBsLegacy(d.balanceSheet);
        this.open(`📂 ${year}年度: ${d.name} (詳細内訳)`, content);
    },
    openEval(year, id) {
        const data = Store.get(year); const d = data ? data.distributions.find(item => item.id === id) : null; if (!d) return;
        const rows = d.sub_projects?.map(sub => {
            const h = Utils.calcHealth(sub.financials, sub.recovery_target);
            return `<tr><td>${sub.name}</td><td>${Utils.fmtMoney(sub.amount)}</td><td>${h.isPublic?'予算内':h.rawRate.toFixed(0)+'%'}</td><td style="color:${CONFIG.colors[h.status]}; font-weight:bold;">${h.text}</td><td>${sub.pnl_kpi.kpi_actual}</td></tr>`;
        }).join('');
        this.open(`📊 ${year}年度: ${d.name} (健全性詳細)`, `<table class="sub-project-table"><thead><tr><th>事業名</th><th>投入額</th><th>回収率</th><th>判定</th><th>KPI</th></tr></thead><tbody>${rows}</tbody></table>`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const app = new Carousel(document.getElementById('carousel-middle'), [
        { id: 'kirin', title: '【麒麟】複式簿記 (仕訳帳)', icon: '🦄' },
        { id: 'macro', title: '【玄武】行政ステータス (マクロ)', icon: '🐢' },
        { id: 'dist', title: '【青龍】事業グループB/S (子)', icon: '🐉' },
        { id: 'eval', title: '【朱雀】事業健全性 (達成度)', icon: '🐦' },
        { id: 'genealogy', title: '【白虎】系統樹 (血流)', icon: '🐅' }
    ]);
    app.init();
    window.Modal.init();
    if(ViewTree) requestAnimationFrame(() => setTimeout(ViewTree.draw, 500));
});

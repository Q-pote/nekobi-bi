import { CONFIG } from './config.js';
export const Utils = {
    fmtMoney: (val) => {
        if (val === null || val === undefined || val === 0) return 'ー';
        return new Intl.NumberFormat('ja-JP').format(val) + '円';
    },
    calcHealth: (fin, target) => {
        if (!fin) return { rate: 0, status: 'unknown', text: 'データなし' };
        if (target === 0) {
            const limit = fin.budget || (fin.expenditure * 1.1);
            const isOver = fin.expenditure > limit;
            return { rate: 100, status: isOver ? 'danger' : 'healthy', text: isOver ? '予算超過' : '予算内運営', isPublic: true };
        }
        const actualRate = fin.expenditure > 0 ? (fin.revenue / fin.expenditure) : 0;
        const achievement = (actualRate / target) * 100;
        let status = 'healthy';
        if (achievement < 80) status = 'warning';
        if (achievement < 50) status = 'danger';
        if (achievement > 150) status = 'healthy';
        return { rate: Math.min(100, achievement), rawRate: actualRate * 100, targetRate: target * 100, status: status, text: `${achievement.toFixed(0)}% 達成`, isPublic: false };
    }
};
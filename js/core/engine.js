export const AccountingEngine = {
    JOURNAL_MAP: {
        'tax_revenue': { debit: '現金・預金', credit: '税収', type: 'PL_Rev', desc: '税収等の受入' },
        'subsidy': { debit: '現金・預金', credit: '国庫支出金', type: 'PL_Rev', desc: '給付金・補助金の受入' },
        'loan_in': { debit: '現金・預金', credit: '借入金', type: 'BS_Liab', desc: '資金調達 (借入)' },
        'dividend_in': { debit: '現金・預金', credit: '受取配当金', type: 'PL_Rev', desc: '配当金の受領' },
        'asset_sold': { debit: '現金・預金', credit: '固定資産', type: 'BS_Asset', desc: '資産の売却' },
        'carried_forward': { debit: '現金・預金', credit: '繰越利益剰余金', type: 'BS_Equity', desc: '前期繰越金' },
        'asset_buy': { debit: '建物・構築物', credit: '現金・預金', type: 'BS_Asset', desc: '設備投資・資産購入' },
        'loan_out': { debit: '貸付金', credit: '現金・預金', type: 'BS_Asset', desc: '支援貸付の実行' },
        'loan_repay': { debit: '借入金', credit: '現金・預金', type: 'BS_Liab', desc: '借入金の返済' },
        'dividend_out': { debit: '繰越利益剰余金', credit: '現金・預金', type: 'BS_Equity', desc: '配当金の支払い' },
        'direct_biz': { debit: '事業費 (直営)', credit: '現金・預金', type: 'PL_Exp', desc: '直営事業の実施' },
        'support_biz': { debit: '事業費 (助成)', credit: '現金・預金', type: 'PL_Exp', desc: '支援事業の実施' }
    },
    generateJournal(rawYearData) {
        if (!rawYearData) return [];
        const v = rawYearData.generalAccount?.values || {};
        const journal = [];
        for (const [key, rule] of Object.entries(this.JOURNAL_MAP)) {
            const amount = v[key];
            if (amount && amount > 0) {
                journal.push({ desc: rule.desc, debit: { label: rule.debit, value: amount }, credit: { label: rule.credit, value: amount }, amount: amount });
            }
        }
        return journal.sort((a, b) => b.amount - a.amount);
    },
    generateBS(rawYearData) {
        if (!rawYearData) return null;
        const v = rawYearData.generalAccount?.values || {};
        const fixedAssets = v.asset_buy || 0;
        const investments = v.loan_out || 0;
        const totalIn = (v.tax_revenue||0) + (v.subsidy||0) + (v.loan_in||0) + (v.dividend_in||0) + (v.asset_sold||0) + (v.carried_forward||0);
        const totalOut = (v.direct_biz||0) + (v.support_biz||0) + (v.loan_repay||0) + (v.dividend_out||0) + (v.asset_buy||0) + (v.loan_out||0);
        const cash = Math.max(0, totalIn - totalOut); 
        const debt = Math.max(0, (v.loan_in||0) - (v.loan_repay||0));
        const totalAssets = cash + fixedAssets + investments;
        const netAssets = totalAssets - debt;
        return {
            assets: [{ label: '現金・預金', value: cash, type: 'cash' }, { label: '固定資産 (建物等)', value: fixedAssets, type: 'fixed' }, { label: '貸付金・投資', value: investments, type: 'invest' }],
            liabilities: [{ label: '借入金', value: debt, type: 'debt' }],
            equity: [{ label: '正味財産', value: netAssets, type: 'equity' }],
            totals: { assets: totalAssets, liab_equity: debt + netAssets }
        };
    },
    generatePL(rawYearData) {
        if (!rawYearData) return null;
        const v = rawYearData.generalAccount?.values || {};
        const tax = (v.tax_revenue || 0) + (v.subsidy || 0);
        const biz_rev = (v.dividend_in || 0) + (v.asset_sold || 0); 
        const pure_rev = tax + biz_rev;
        const biz_cost = (v.direct_biz || 0) + (v.support_biz || 0);
        const fin_cost = (v.loan_repay || 0) + (v.dividend_out || 0);
        const invest_cost = (v.asset_buy || 0) + (v.loan_out || 0);
        const total_exp = biz_cost + fin_cost + invest_cost;
        const balance = pure_rev - total_exp;
        return {
            revenues: [{ label: '税収・給付', value: tax, type: 'rev_tax' }, { label: '事業収益他', value: biz_rev, type: 'rev_biz' }],
            expenses: [{ label: '事業運営費', value: biz_cost, type: 'exp_biz' }, { label: '財務支出', value: fin_cost, type: 'exp_fin' }, { label: '投資・貸付', value: invest_cost, type: 'exp_invest' }],
            totals: { revenue: pure_rev, expense: total_exp, balance: balance }
        };
    }
};
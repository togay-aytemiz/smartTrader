const fmt = (val, type = 'number') => {
    if (val === null || val === undefined) return '—';
    if (type === 'pct') return `${(val * 100).toFixed(1)}%`;
    if (type === 'money') return `$${val.toLocaleString()}`;
    return typeof val === 'number' ? val.toFixed(2) : val;
};

const quality = (key, val) => {
    if (val === null || val === undefined) return '';
    const c = {
        pe_ratio: v => v < 15 ? 'positive' : v > 40 ? 'negative' : 'neutral',
        forward_pe: v => v < 15 ? 'positive' : v > 40 ? 'negative' : 'neutral',
        peg_ratio: v => v < 1 ? 'positive' : v > 2 ? 'negative' : 'neutral',
        pb_ratio: v => v < 3 ? 'positive' : v > 5 ? 'negative' : 'neutral',
        roe: v => v > 0.15 ? 'positive' : v < 0 ? 'negative' : 'neutral',
        roa: v => v > 0.05 ? 'positive' : v < 0 ? 'negative' : 'neutral',
        net_margin: v => v > 0.10 ? 'positive' : v < 0 ? 'negative' : 'neutral',
        debt_to_equity: v => v < 50 ? 'positive' : v > 100 ? 'negative' : 'neutral',
        revenue_growth: v => v > 0.10 ? 'positive' : v < 0 ? 'negative' : 'neutral',
        current_ratio: v => v > 1.5 ? 'positive' : v < 1 ? 'negative' : 'neutral',
    };
    return c[key] ? c[key](val) : '';
};

const METRICS = [
    { key: 'pe_ratio', label: 'P/E (TTM)', type: 'number', sub: 'Price valuation ratio' },
    { key: 'forward_pe', label: 'Forward P/E', type: 'number', sub: 'Expected earnings multiplier' },
    { key: 'peg_ratio', label: 'PEG', type: 'number', sub: 'P/E relative to growth' },
    { key: 'pb_ratio', label: 'P/B', type: 'number', sub: 'Price to Book ratio' },
    { key: 'ev_ebitda', label: 'EV/EBITDA', type: 'number', sub: 'Enterprise multiple' },
    { key: 'roe', label: 'ROE', type: 'pct', sub: 'Return on equity' },
    { key: 'net_margin', label: 'Net Margin', type: 'pct', sub: 'Net income % of revenue' },
    { key: 'eps_ttm', label: 'EPS', type: 'number', sub: 'Earnings per share' }
];

export default function FundamentalsCard({ fundamentals }) {
    if (!fundamentals) return null;

    return (
        <div className="card">
            <div className="card-hd"><span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>Financial Health</span></div>
            <div className="fin-grid">
                {METRICS.map(({ key, label, type, sub }) => {
                    const val = fundamentals[key] !== undefined ? fundamentals[key] : fundamentals[key.replace('_ttm', '')];
                    const q = quality(key, val);
                    return (
                        <div className={`fin-box ${q}`} key={key}>
                            <div className="fin-box-hd">
                                <span>{label}</span>
                                <span style={{ fontSize: 12, opacity: 0.4 }}>ⓘ</span>
                            </div>
                            <div className="fin-val">{fmt(val, type)}</div>
                            <div className="fin-sub">{sub}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

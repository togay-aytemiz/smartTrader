/* ── Signal Card: Factor Breakdown ────────────────────────────── */

const FACTORS = [
    { key: 'dcf', label: 'DCF', w: '25%' },
    { key: 'pe', label: 'P/E', w: '20%' },
    { key: 'peg', label: 'PEG', w: '15%' },
    { key: 'ev_ebitda', label: 'EV/EBITDA', w: '15%' },
    { key: 'technical', label: 'Technical', w: '25%' },
];

const sc = (s) => s >= 1 ? 'var(--color-up)' : s >= 0 ? 'var(--color-accent)' : s >= -1 ? 'var(--color-neutral)' : 'var(--color-down)';

export default function SignalCard({ signal }) {
    if (!signal) return null;
    const fs = signal.factor_scores || {};

    return (
        <div className="card">
            <div className="card-hd"><span className="dot dot-green" />Factor Breakdown</div>
            <div className="factor-bars">
                {FACTORS.map(({ key, label, w }) => {
                    const s = fs[key] ?? 0;
                    const pct = ((s + 2) / 4) * 100;
                    const c = sc(s);
                    return (
                        <div className="factor-row" key={key}>
                            <span className="factor-name">{label} <span style={{ opacity: 0.4, fontSize: 9 }}>({w})</span></span>
                            <div className="factor-track">
                                <div className="factor-fill" style={{ width: `${pct}%`, background: c }} />
                            </div>
                            <span className="factor-score" style={{ color: c }}>
                                {s >= 0 ? '+' : ''}{s.toFixed(2)}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="factor-tags">
                {signal.rsi_signal && signal.rsi_signal !== 'N/A' && <span className="factor-tag">RSI: {signal.rsi_signal}</span>}
                {signal.macd_signal && signal.macd_signal !== 'N/A' && <span className="factor-tag">MACD: {signal.macd_signal}</span>}
                {signal.sma_signal && signal.sma_signal !== 'N/A' && <span className="factor-tag">SMA: {signal.sma_signal}</span>}
            </div>
        </div>
    );
}

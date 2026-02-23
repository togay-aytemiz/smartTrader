/* ── Technical Indicators ──────────────────────────────────────────── */

const getRsiClass = (rsi) => {
    if (!rsi) return 'neutral';
    if (rsi < 30) return 'bullish';
    if (rsi > 70) return 'bearish';
    return 'neutral';
};

const getSmaClass = (price, sma) => {
    if (!sma || !price) return 'neutral';
    return price > sma ? 'bullish' : 'bearish';
};

const getPillColor = (cls) => {
    if (cls === 'bullish') return 'var(--color-up)';
    if (cls === 'bearish') return 'var(--color-down)';
    return 'var(--text-muted)';
};

const getPillBg = (cls) => {
    if (cls === 'bullish') return 'rgba(0,184,122,0.1)';
    if (cls === 'bearish') return 'rgba(242,54,69,0.1)';
    return 'rgba(255,255,255,0.05)';
};

export default function TechnicalCard({ technicals, signal, currentPrice }) {
    if (!technicals) return null;
    const { rsi_14, sma_50, sma_200 } = technicals;

    const rsiCls = getRsiClass(rsi_14);
    const rsiLabel = rsi_14 < 30 ? 'Oversold' : rsi_14 > 70 ? 'Overbought' : 'Neutral';
    const rsiSub = rsi_14 < 30 ? 'Bullish, potentially undervalued' : rsi_14 > 70 ? 'Bearish, potentially overvalued' : 'Momentum is balanced';

    const sma50Cls = getSmaClass(currentPrice, sma_50);
    const sma200Cls = getSmaClass(currentPrice, sma_200);

    return (
        <div className="card">
            <div className="card-hd"><span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>Technical Indicators</span></div>

            <div className="tech-container">
                {/* RSI */}
                <div className="tech-row-ref">
                    <div className="tech-row-left">
                        <div className="tech-row-title">RSI (14) <span>{rsi_14?.toFixed(2) || '—'}</span></div>
                        <div className="tech-row-sub">{rsiSub}</div>
                    </div>
                    <div className="tech-row-right">
                        <span className="sni-pill" style={{ color: getPillColor(rsiCls), backgroundColor: getPillBg(rsiCls) }}>
                            {rsiLabel}
                        </span>
                    </div>
                </div>

                <div className="tech-cat-title">Moving Averages</div>

                {/* SMA 50 */}
                <div className="tech-row-ref">
                    <div className="tech-row-left">
                        <div className="tech-row-title">SMA 50 <span>${sma_50?.toFixed(2) || '—'}</span></div>
                        <div className="tech-row-sub">Price is trading {sma50Cls === 'bullish' ? 'above' : 'below'} 50-day SMA</div>
                    </div>
                    <div className="tech-row-right">
                        <span className="sni-pill" style={{ color: getPillColor(sma50Cls), backgroundColor: getPillBg(sma50Cls) }}>
                            {sma50Cls === 'bullish' ? 'Above' : 'Below'}
                        </span>
                        <span className="sni-pill" style={{ color: getPillColor(sma50Cls), backgroundColor: getPillBg(sma50Cls) }}>
                            {sma50Cls === 'bullish' ? 'Bullish' : 'Bearish'}
                        </span>
                    </div>
                </div>

                {/* SMA 200 */}
                <div className="tech-row-ref">
                    <div className="tech-row-left">
                        <div className="tech-row-title">SMA 200 <span>${sma_200?.toFixed(2) || '—'}</span></div>
                        <div className="tech-row-sub">Price is trading {sma200Cls === 'bullish' ? 'above' : 'below'} 200-day SMA</div>
                    </div>
                    <div className="tech-row-right">
                        <span className="sni-pill" style={{ color: getPillColor(sma200Cls), backgroundColor: getPillBg(sma200Cls) }}>
                            {sma200Cls === 'bullish' ? 'Above' : 'Below'}
                        </span>
                        <span className="sni-pill" style={{ color: getPillColor(sma200Cls), backgroundColor: getPillBg(sma200Cls) }}>
                            {sma200Cls === 'bullish' ? 'Bullish' : 'Bearish'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

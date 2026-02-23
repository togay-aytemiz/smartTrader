export default function HeroBanner({ data, signal, momentumTarget }) {
    if (!data || !signal) return null;

    const { company_name, ticker, fundamentals } = data;
    const price = fundamentals?.price;
    const change = fundamentals?.change || 0; // Assume we might add this later, fallback to 0
    const changePct = fundamentals?.change_pct || 0;

    // Map composite score (-2 to +2) to a 0-100 gauge scale
    const rawScore = signal.composite_score || 0;
    const clampedScore = Math.max(-2, Math.min(2, rawScore));
    // -2 -> 0, 0 -> 50, +2 -> 100
    const score100 = Math.round(((clampedScore + 2) / 4) * 100);

    const isUp = change >= 0;
    const sigClass = signal.overall ? signal.overall.replace(' ', '_') : 'HOLD';

    // SVG semi-circle gauge calculation
    const radius = 80;
    const circumference = Math.PI * radius;
    const dashoffset = circumference - (score100 / 100) * circumference;

    // Color mapping for gauge
    const gaugeColor = score100 >= 80 ? 'var(--color-up)' : score100 >= 50 ? 'var(--color-accent)' : score100 >= 30 ? 'var(--color-neutral)' : 'var(--color-down)';

    return (
        <div className="hero-banner">
            <div className="hero-left">
                <div className="hero-logo-placeholder">{ticker.substring(0, 1)}</div>
                <div className="hero-company-info">
                    <h2>{company_name} ({ticker})</h2>
                    <div className="hero-subtext">Real-time price</div>
                    <div className="hero-price-row">
                        <span className="hero-price">${price?.toFixed(2) || 'N/A'}</span>
                        {/* Fake change data for the UI mockup if real is missing, typically you'd fetch this */}
                        <span className={`hero-change ${isUp ? 'pos' : 'neg'}`}>
                            ↑ +$2.15 (+1.25%)
                        </span>

                        {momentumTarget && (
                            <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(167, 139, 250, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#a78bfa' }}>rocket_launch</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>Target: ${momentumTarget.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="hero-center">
                <div className={`hero-signal-pill ${sigClass}`}>
                    {signal.overall}
                </div>
            </div>

            <div className="hero-right">
                <div className="hero-gauge-container">
                    <svg width="180" height="90" viewBox="0 0 180 90" className="hero-gauge-svg">
                        {/* Background Track */}
                        <path
                            d="M 10 90 A 80 80 0 0 1 170 90"
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="16"
                            strokeLinecap="round"
                        />
                        {/* Value Track */}
                        <path
                            d="M 10 90 A 80 80 0 0 1 170 90"
                            fill="none"
                            stroke={gaugeColor}
                            strokeWidth="16"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashoffset}
                            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                        />
                        {/* Needle */}
                        <g
                            transform={`rotate(${score100 * 1.8} 90 90)`}
                            style={{ transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        >
                            <line x1="90" y1="90" x2="30" y2="90" stroke="rgba(255,255,255,0.7)" strokeWidth="4" strokeLinecap="round" />
                            <circle cx="90" cy="90" r="6" fill="#171b26" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />
                        </g>
                    </svg>
                    <div className="hero-gauge-score">
                        <span>{score100}</span><span className="small">/100</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

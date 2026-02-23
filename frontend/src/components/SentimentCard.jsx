/* ── Sentiment Card ──────────────────────────────────────────── */

export default function SentimentCard({ sentiment }) {
    if (!sentiment) return null;
    const { sentiment_score: score, sentiment_label: label, top_headlines = [], headline_count } = sentiment;

    // Convert score to 0-100 gauge scale assuming score is -1 to 1 natively usually, or -2 +2.
    // Assuming backend returns -1 to 1 for sentiment_score, map to 0-100
    const clampedScore = Math.max(-1, Math.min(1, score));
    const score100 = Math.round(((clampedScore + 1) / 2) * 100);

    const radius = 80;
    const circumference = Math.PI * radius;
    const dashoffset = circumference - (score100 / 100) * circumference;

    const isPos = score >= 0;
    const color = isPos ? 'var(--color-up)' : 'var(--color-down)';

    // Fallback UI text if label is missing
    const displayLabel = label || (isPos ? 'Bullish' : 'Bearish');

    return (
        <div className="card">
            <div className="card-hd" style={{ justifyContent: 'space-between', display: 'flex' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '1px' }}>Sentiment Analysis</span>
                <span className="meta">Social mood ⓘ</span>
            </div>

            <div className="sentiment-top-row">
                <div className="sentiment-gauge-col">
                    <svg width="180" height="90" viewBox="0 0 180 90">
                        <path
                            d="M 10 90 A 80 80 0 0 1 170 90"
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="16"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 10 90 A 80 80 0 0 1 170 90"
                            fill="none"
                            stroke={color}
                            strokeWidth="16"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashoffset}
                            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                        />
                    </svg>
                    <div className="sentiment-gauge-text">
                        <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: 18 }}>{displayLabel}</span>
                        <span className="meta" style={{ fontSize: 14 }}>({score100}%)</span>
                    </div>
                </div>

                <div className="sentiment-divider" />

                <div className="sentiment-trend-col">
                    <div className="sentiment-trend-icon" style={{ background: isPos ? 'var(--color-up)' : 'var(--color-down)' }}>
                        {isPos ? '↗' : '↘'}
                    </div>
                    <div className="sentiment-trend-title" style={{ color: color }}>Very {displayLabel}</div>
                    <div className="meta">{headline_count} mentions</div>
                </div>
            </div>

            {top_headlines.length > 0 && (
                <div className="sentiment-news-list">
                    {top_headlines.slice(0, 3).map((h, i) => {
                        const isUp = h.score >= 0;
                        const hc = isUp ? 'var(--color-up)' : 'var(--color-down)';
                        const lbl = isUp ? 'Positive' : 'Negative';
                        const scoreDisp = `${isUp ? '+' : ''}${h.score.toFixed(2)}`;
                        return (
                            <div className="sentiment-news-item" key={i}>
                                <div className="sni-icon" style={{ background: isUp ? 'rgba(0,184,122,0.1)' : 'rgba(242,54,69,0.1)', color: hc }}>
                                    {isUp ? '↗' : '↘'}
                                </div>
                                <div className="sni-content">
                                    <a href={h.link || "#"} target="_blank" rel="noopener noreferrer" className="sni-title">{h.title}</a>
                                    <div className="sni-meta">{h.publisher} · 12h ago</div>
                                </div>
                                <div className="sni-pill" style={{ color: hc, backgroundColor: isUp ? 'rgba(0,184,122,0.15)' : 'rgba(242,54,69,0.15)', padding: '6px 12px', border: `1px solid ${isUp ? 'rgba(0,184,122,0.3)' : 'rgba(242,54,69,0.3)'}` }}>
                                    <span>{lbl}</span> {scoreDisp}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

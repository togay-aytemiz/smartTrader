const fmtLarge = (val) => {
    if (!val) return '—';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
    return `$${val.toLocaleString()}`;
};

export default function DCFCard({ dcf, latestFcf, dcfResearch, webEnriched }) {
    if (!dcf) {
        return (
            <div className="card">
                <div className="card-hd"><span className="dot dot-purple" />DCF Model</div>
                <p style={{ color: 'var(--text-dark)', fontSize: 12 }}>
                    DCF hesaplanamadı — FCF verisi yok veya negatif.
                </p>
            </div>
        );
    }

    const rows = [
        { k: 'Latest FCF', v: fmtLarge(latestFcf) },
        { k: 'FCF Growth', v: `${dcf.fcf_growth_rate_used}%/yr` },
        { k: 'WACC', v: `${(dcf.discount_rate * 100).toFixed(0)}%` },
        { k: 'Terminal Growth', v: `${(dcf.terminal_growth * 100).toFixed(0)}%` },
        { k: 'Period', v: '10y' },
        { k: 'PV Cash Flows', v: fmtLarge(dcf.total_intrinsic_value - dcf.pv_terminal) },
        { k: 'PV Terminal', v: fmtLarge(dcf.pv_terminal) },
        { k: 'Intrinsic Total', v: fmtLarge(dcf.total_intrinsic_value) },
        { k: 'Intrinsic/Share', v: `$${dcf.intrinsic_per_share?.toFixed(2)}` },
        { k: 'MoS', v: `${(dcf.margin_of_safety * 100).toFixed(0)}%` },
    ];

    return (
        <div className="card">
            <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span><span className="dot dot-purple" />DCF Model</span>
                {webEnriched && (
                    <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#60a5fa',
                        background: 'rgba(96, 165, 250, 0.1)',
                        border: '1px solid rgba(96, 165, 250, 0.2)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }}>
                        <span className="material-icons-round" style={{ fontSize: 12 }}>language</span>
                        Web-Enriched
                    </span>
                )}
            </div>
            {rows.map(({ k, v }) => (
                <div className="dcf-row" key={k}>
                    <span className="dcf-k">{k}</span>
                    <span className="dcf-v">{v}</span>
                </div>
            ))}
            {dcfResearch && dcfResearch.analyst_source && (
                <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-color)',
                    fontSize: 11,
                    color: 'var(--text-dark)',
                    lineHeight: 1.5,
                }}>
                    <span style={{ fontWeight: 600, color: '#60a5fa' }}>📡 Sources: </span>
                    {dcfResearch.analyst_source}
                    {dcfResearch.reasoning && (
                        <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>
                            {dcfResearch.reasoning}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

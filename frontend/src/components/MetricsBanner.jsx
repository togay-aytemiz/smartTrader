import React from 'react';

export default function MetricsBanner({ data }) {
    if (!data || !data.advanced_metrics) return null;

    const { volatility, institutional_flow: flow, macro } = data.advanced_metrics;

    // Macro Colors
    const macroRateColor = macro.rates === "Headwind" ? "var(--c-red)" : macro.rates === "Tailwind" ? "var(--c-green)" : "var(--c-yellow)";
    const macroInfColor = macro.inflation === "Headwind" ? "var(--c-red)" : macro.inflation === "Tailwind" ? "var(--c-green)" : "var(--c-yellow)";

    return (
        <section className="st-metrics-banner">

            {/* 1. Volatility Analysis */}
            <div className="st-metric-col">
                <div className="st-metric-head">
                    <h3 className="st-metric-title">Volatility Analysis</h3>
                    <span className="st-metric-badge yellow">30D Metrics</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="st-metric-row">
                        <div>
                            <p className="st-metric-subtext">Implied Vol (Proxy)</p>
                            <p className="st-metric-val-large">{volatility.implied_volatility}%</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p className="st-metric-badge" style={{ border: 'none', padding: 0, color: volatility.vol_diff_pct > 0 ? "var(--c-red)" : "var(--c-green)" }}>
                                {volatility.vol_diff_pct > 0 ? '+' : ''}{volatility.vol_diff_pct}% vs Hist
                            </p>
                            <div style={{ width: '96px', height: '4px', background: 'var(--st-border)', borderRadius: '9999px', overflow: 'hidden', marginTop: '4px', marginLeft: 'auto' }}>
                                <div style={{ height: '100%', background: 'var(--c-red)', width: `${Math.min(100, Math.max(0, 50 + volatility.vol_diff_pct))}%` }}></div>
                            </div>
                        </div>
                    </div>
                    <div className="st-mini-cards">
                        <div className="st-mini-card">
                            <p className="st-metric-subtext" style={{ fontSize: '8px', marginBottom: '4px' }}>Beta (1Y proxy)</p>
                            <p className="st-metric-val-large" style={{ fontSize: '12px' }}>{data.fundamentals?.beta?.toFixed(2) || '—'}</p>
                        </div>
                        <div className="st-mini-card">
                            <p className="st-metric-subtext" style={{ fontSize: '8px', marginBottom: '4px' }}>Avg Range</p>
                            <p className="st-metric-val-large" style={{ fontSize: '12px' }}>{volatility.avg_range_pct}%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Institutional Flow */}
            <div className="st-metric-col">
                <div className="st-metric-head">
                    <h3 className="st-metric-title">Institutional Flow</h3>
                    <span className="st-metric-badge"
                        style={{
                            background: flow.net_flow_usd > 0 ? 'rgba(50, 215, 75, 0.1)' : 'rgba(255, 69, 58, 0.1)',
                            color: flow.net_flow_usd > 0 ? 'var(--c-green)' : 'var(--c-red)',
                            borderColor: flow.net_flow_usd > 0 ? 'rgba(50, 215, 75, 0.2)' : 'rgba(255, 69, 58, 0.2)'
                        }}>
                        {flow.flow_status}
                    </span>
                </div>
                <div className="st-flow-bar-container">
                    <div className="st-flow-labels">
                        <span>NET SELL</span>
                        <span>NET BUY</span>
                    </div>
                    <div className="st-flow-bar">
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', width: `${flow.sell_pressure_pct}%`, backgroundColor: 'var(--c-red)' }}>
                            {flow.sell_pressure_pct > 60 && <span style={{ fontSize: '10px', fontWeight: 700, color: 'black', textTransform: 'uppercase' }}>Selling</span>}
                        </div>
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', width: `${flow.buy_pressure_pct}%`, backgroundColor: 'var(--c-green)' }}>
                            {flow.buy_pressure_pct > 60 && <span style={{ fontSize: '10px', fontWeight: 700, color: 'black', textTransform: 'uppercase' }}>Buying</span>}
                        </div>
                    </div>
                    <div className="st-metric-row" style={{ marginTop: '12px', marginBottom: 0 }}>
                        <span className="st-metric-subtext" style={{ color: '#9ca3af', fontSize: '10px' }}>Est. Block Net (30D)</span>
                        <span className="st-metric-val-large" style={{ fontSize: '10px', color: flow.net_flow_usd > 0 ? 'var(--c-green)' : 'var(--c-red)' }}>
                            {flow.net_flow_usd > 0 ? '+' : ''}${(flow.net_flow_usd / 1e6).toFixed(1)}M
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Macro Sentiment */}
            <div className="st-metric-col">
                <div className="st-metric-head">
                    <h3 className="st-metric-title">Macro Sentiment</h3>
                    <span className="material-symbols-outlined" style={{ color: '#4b5563', fontSize: '16px' }}>public</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="st-macro-item">
                        <div className="st-macro-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: macroRateColor }}>percent</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="st-macro-text-row">
                                <span style={{ fontSize: '10px', color: '#d1d5db', fontWeight: 500 }}>Interest Rates</span>
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: macroRateColor }}>{macro.rates}</span>
                            </div>
                            <p style={{ fontSize: '8px', color: '#6b7280', margin: '4px 0 0 0' }}>{macro.rates_desc}</p>
                        </div>
                    </div>
                    <div className="st-macro-item">
                        <div className="st-macro-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: macroInfColor }}>shopping_cart</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="st-macro-text-row">
                                <span style={{ fontSize: '10px', color: '#d1d5db', fontWeight: 500 }}>Inflation (CPI)</span>
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: macroInfColor }}>{macro.inflation}</span>
                            </div>
                            <p style={{ fontSize: '8px', color: '#6b7280', margin: '4px 0 0 0' }}>{macro.inflation_desc}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

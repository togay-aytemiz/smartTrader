import React from 'react';

export default function ConvergenceBlock({ data }) {
    if (!data || !data.advanced_metrics?.convergence) return null;

    const { convergence } = data.advanced_metrics;

    const bullW = (convergence.bullish / convergence.total) * 100;
    const bearW = (convergence.bearish / convergence.total) * 100;
    const neutW = (convergence.neutral / convergence.total) * 100;

    const mainCount = convergence.type === "BULLISH" ? convergence.bullish : convergence.bearish;
    const mainColor = convergence.type === "BULLISH" ? "var(--c-green)" : convergence.type === "BEARISH" ? "var(--c-red)" : "var(--c-yellow)";
    const mainLabel = convergence.type === "BULLISH" ? "BUY" : convergence.type === "BEARISH" ? "SELL" : "HOLD";

    return (
        <div className="st-convergence-block">
            <div className="st-convergence-head">
                <h3 className="st-convergence-title">AI Convergence</h3>
                <span className="st-metric-subtext">{convergence.total} Indicators</span>
            </div>

            <div className="st-convergence-bar-row">
                <div className="st-convergence-bar">
                    <div className="st-convergence-bar-segment" style={{ width: `${bullW}%`, backgroundColor: 'var(--c-green)' }}></div>
                    <div className="st-convergence-bar-segment" style={{ width: `${neutW}%`, backgroundColor: 'var(--c-yellow)' }}></div>
                    <div className="st-convergence-bar-segment" style={{ width: `${bearW}%`, backgroundColor: 'var(--c-red)', borderRight: 'none' }}></div>
                </div>
                <span className="st-metric-val-large" style={{ fontSize: '14px', color: mainColor }}>{mainCount}/{convergence.total}</span>
            </div>

            <p className="st-convergence-desc">
                <strong style={{ color: "white", fontWeight: 700 }}>{convergence.status}:</strong>{' '}
                <span style={{ color: "white", fontWeight: 600 }}>{((mainCount / convergence.total) * 100).toFixed(0)}%</span> of all AI-weighted indicators agree on a{' '}
                <span style={{ color: mainColor, fontWeight: 700, textTransform: 'uppercase' }}>
                    {mainLabel}
                </span> signal.
            </p>
        </div>
    );
}

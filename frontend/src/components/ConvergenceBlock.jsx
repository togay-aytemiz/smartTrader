import React from 'react';

export default function ConvergenceBlock({ data }) {
    if (!data || !data.advanced_metrics?.convergence) return null;

    const { convergence } = data.advanced_metrics;

    // Calculate percentage widths for the bar
    const bullW = (convergence.bullish / convergence.total) * 100;
    const bearW = (convergence.bearish / convergence.total) * 100;
    const neutW = (convergence.neutral / convergence.total) * 100;

    const mainCount = convergence.type === "BULLISH" ? convergence.bullish : convergence.bearish;
    const mainColor = convergence.type === "BULLISH" ? "var(--c-green)" : convergence.type === "BEARISH" ? "var(--c-red)" : "var(--c-yellow)";

    return (
        <div className="p-5 border-b border-border bg-[#0C0C0C]">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--c-blue)" }}>AI Convergence</h3>
                <span className="text-[8px] text-gray-500 uppercase font-bold">{convergence.total} Indicators</span>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden flex">
                        <div className="h-full border-r border-black/20" style={{ width: `${bullW}%`, backgroundColor: 'var(--c-green)' }}></div>
                        <div className="h-full border-r border-black/20" style={{ width: `${neutW}%`, backgroundColor: 'var(--c-yellow)' }}></div>
                        <div className="h-full" style={{ width: `${bearW}%`, backgroundColor: 'var(--c-red)' }}></div>
                    </div>
                    <span className="font-mono text-xs font-bold" style={{ color: mainColor }}>{mainCount}/{convergence.total}</span>
                </div>

                <p className="text-[10px] text-gray-500 leading-relaxed">
                    <strong style={{ color: "white", fontWeight: 600 }}>{convergence.status}:</strong>{' '}
                    <span className="text-white font-medium">{((mainCount / convergence.total) * 100).toFixed(0)}%</span> of all AI-weighted indicators agree on a{' '}
                    <span className="font-bold uppercase" style={{ color: mainColor }}>
                        {convergence.type === "BULLISH" ? "Buy" : convergence.type === "BEARISH" ? "Sell" : "Hold"}
                    </span> signal.
                </p>
            </div>
        </div>
    );
}

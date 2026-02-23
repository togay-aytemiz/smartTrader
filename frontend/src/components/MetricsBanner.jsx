import React from 'react';

export default function MetricsBanner({ data }) {
    if (!data || !data.advanced_metrics) return null;

    const { volatility, institutional_flow: flow, macro } = data.advanced_metrics;

    // Macro Colors
    const macroRateColor = macro.rates === "Headwind" ? "var(--c-red)" : macro.rates === "Tailwind" ? "var(--c-green)" : "var(--c-yellow)";
    const macroInfColor = macro.inflation === "Headwind" ? "var(--c-red)" : macro.inflation === "Tailwind" ? "var(--c-green)" : "var(--c-yellow)";

    return (
        <section className="st-metrics-banner grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-border bg-[#050505]">

            {/* 1. Volatility Analysis */}
            <div className="p-5 border-r border-border">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Volatility Analysis</h3>
                    <span className="text-[8px] bg-accent-yellow/10 text-accent-yellow px-1.5 py-0.5 rounded border border-accent-yellow/20">30D Metrics</span>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[9px] text-gray-500 uppercase font-semibold">Implied Vol (Proxy)</p>
                            <p className="text-xl font-bold font-mono text-white">{volatility.implied_volatility}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] uppercase font-bold" style={{ color: volatility.vol_diff_pct > 0 ? "var(--c-red)" : "var(--c-green)" }}>
                                {volatility.vol_diff_pct > 0 ? '+' : ''}{volatility.vol_diff_pct}% vs Hist
                            </p>
                            <div className="w-24 h-1 bg-border rounded-full overflow-hidden mt-1 ml-auto">
                                <div className="h-full bg-accent-red" style={{ width: `${Math.min(100, Math.max(0, 50 + volatility.vol_diff_pct))}%` }}></div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#0f0f0f] p-2 rounded border border-border">
                            <p className="text-[8px] text-gray-500 uppercase">Beta (1Y proxy)</p>
                            <p className="text-xs font-bold font-mono">{data.fundamentals?.beta?.toFixed(2) || '—'}</p>
                        </div>
                        <div className="bg-[#0f0f0f] p-2 rounded border border-border">
                            <p className="text-[8px] text-gray-500 uppercase">Avg Range</p>
                            <p className="text-xs font-bold font-mono">{volatility.avg_range_pct}%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Institutional Flow */}
            <div className="p-5 border-r border-border">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Institutional Flow</h3>
                    <span className="text-[8px] px-1.5 py-0.5 rounded border uppercase"
                        style={{
                            background: flow.net_flow_usd > 0 ? 'var(--c-green)15' : 'var(--c-red)15',
                            color: flow.net_flow_usd > 0 ? 'var(--c-green)' : 'var(--c-red)',
                            borderColor: flow.net_flow_usd > 0 ? 'var(--c-green)33' : 'var(--c-red)33'
                        }}>
                        {flow.flow_status}
                    </span>
                </div>
                <div className="flex flex-col h-[80px] justify-center relative">
                    <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-2">
                        <span>NET SELL</span>
                        <span>NET BUY</span>
                    </div>
                    <div className="h-6 w-full bg-[#0f0f0f] border border-border rounded flex overflow-hidden">
                        <div className="h-full flex items-center justify-center transition-all" style={{ width: `${flow.sell_pressure_pct}%`, backgroundColor: 'var(--c-red)' }}>
                            {flow.sell_pressure_pct > 60 && <span className="text-[10px] font-bold text-black uppercase">Selling</span>}
                        </div>
                        <div className="h-full transition-all" style={{ width: `${flow.buy_pressure_pct}%`, backgroundColor: 'var(--c-green)' }}>
                            {flow.buy_pressure_pct > 60 && <span className="text-[10px] font-bold text-black uppercase w-full text-center">Buying</span>}
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                        <span className="text-[10px] text-gray-400">Est. Block Net (30D)</span>
                        <span className="text-[10px] font-bold font-mono" style={{ color: flow.net_flow_usd > 0 ? 'var(--c-green)' : 'var(--c-red)' }}>
                            {flow.net_flow_usd > 0 ? '+' : ''}${(flow.net_flow_usd / 1e6).toFixed(1)}M
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Macro Sentiment */}
            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Macro Sentiment</h3>
                    <span className="material-symbols-outlined text-gray-600 text-base">public</span>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded border border-border flex items-center justify-center bg-[#0f0f0f]">
                            <span className="material-symbols-outlined text-sm" style={{ color: macroRateColor }}>percent</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-300 font-medium">Interest Rates</span>
                                <span className="text-[10px] font-bold uppercase" style={{ color: macroRateColor }}>{macro.rates}</span>
                            </div>
                            <p className="text-[8px] text-gray-500">{macro.rates_desc}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded border border-border flex items-center justify-center bg-[#0f0f0f]">
                            <span className="material-symbols-outlined text-sm" style={{ color: macroInfColor }}>shopping_cart</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-300 font-medium">Inflation (CPI)</span>
                                <span className="text-[10px] font-bold uppercase" style={{ color: macroInfColor }}>{macro.inflation}</span>
                            </div>
                            <p className="text-[8px] text-gray-500">{macro.inflation_desc}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

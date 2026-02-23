import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, LineSeries } from 'lightweight-charts';

const PERIOD_DAYS = {
    '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730,
};

export default function StockChart({ chartData, fairValue, momentumTarget, period, onPeriodChange }) {
    const containerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const fairLineRef = useRef(null);
    const momentumLineRef = useRef(null);

    // Slice data by period
    const filteredData = (() => {
        const days = PERIOD_DAYS[period] || 365;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return (chartData || []).filter(d => new Date(d.date) >= cutoff);
    })();

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            layout: {
                background: { color: 'transparent' },
                textColor: '#a1a1aa',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.06)' },
                horzLines: { color: 'rgba(255,255,255,0.06)' },
            },
            crosshair: {
                mode: 1,
                vertLine: { color: '#818cf8', labelBackgroundColor: '#818cf8' },
                horzLine: { color: '#818cf8', labelBackgroundColor: '#818cf8' },
            },
            rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
            timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
            handleScroll: true,
            handleScale: true,
        });

        chartRef.current = chart;

        const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: '#818cf8', /* Indigo */
            topColor: 'rgba(129, 140, 248, 0.25)',
            bottomColor: 'rgba(129, 140, 248, 0.0)',
            lineWidth: 2,
            priceLineVisible: false,
        });
        seriesRef.current = areaSeries;

        // Fair value line
        if (fairValue) {
            const lineSeries = chart.addSeries(LineSeries, {
                color: '#34d399', /* Emerald */
                lineWidth: 1,
                lineStyle: 2,
                title: 'Fair Value',
                priceLineVisible: false,
            });
            fairLineRef.current = lineSeries;
        }

        // Momentum line
        if (momentumTarget) {
            const mLineSeries = chart.addSeries(LineSeries, {
                color: '#a78bfa', /* Purple */
                lineWidth: 1,
                lineStyle: 2,
                title: 'Momentum Target',
                priceLineVisible: false,
            });
            momentumLineRef.current = mLineSeries;
        }

        const ro = new ResizeObserver(entries => {
            for (const e of entries) {
                chart.applyOptions({
                    width: e.contentRect.width,
                    height: e.contentRect.height
                });
            }
        });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            chart.remove();
        };
    }, []);

    // Update data when period/data changes
    useEffect(() => {
        if (!seriesRef.current || !filteredData.length) return;

        const areaData = filteredData.map(d => ({ time: d.date, value: d.close }));
        seriesRef.current.setData(areaData);

        if (fairLineRef.current && fairValue) {
            const lineData = filteredData.map(d => ({ time: d.date, value: fairValue }));
            fairLineRef.current.setData(lineData);
        }

        if (momentumLineRef.current && momentumTarget) {
            const mLineData = filteredData.map(d => ({ time: d.date, value: momentumTarget }));
            momentumLineRef.current.setData(mLineData);
        }

        chartRef.current?.timeScale().fitContent();
    }, [filteredData, fairValue, momentumTarget]);

    const periods = ['1M', '3M', '6M', '1Y', '2Y'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>Price Chart</span>
                <div style={{ display: 'flex', gap: 6 }}>
                    {periods.map(p => (
                        <button
                            key={p}
                            style={{
                                background: period === p ? 'var(--bg-panel)' : 'transparent',
                                border: period === p ? '1px solid var(--border-color)' : '1px solid transparent',
                                color: period === p ? 'var(--text-main)' : 'var(--text-muted)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            onClick={() => onPeriodChange(p)}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="chart-container" ref={containerRef} style={{ flex: 1, minHeight: 400 }} />

            <div style={{ display: 'flex', gap: '20px', marginTop: 16 }}>
                {fairValue && (
                    <p style={{ fontSize: 13, color: 'var(--color-up)', fontWeight: 500, margin: 0 }}>
                        — — — Intrinsic Fair Value (${fairValue.toFixed(2)})
                    </p>
                )}
                {momentumTarget && (
                    <p style={{ fontSize: 13, color: '#a78bfa', fontWeight: 500, margin: 0 }}>
                        — — — Momentum Target (${momentumTarget.toFixed(2)})
                    </p>
                )}
            </div>
        </div>
    );
}

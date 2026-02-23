import { useState, useCallback, useEffect } from 'react';

const LOADING_MESSAGES = [
    'Connecting to market data feeds...',
    'Fetching real-time price data...',
    'Calculating technical indicators...',
    'Running DCF valuation model...',
    'Researching analyst estimates via AI...',
    'Analyzing free cash flow projections...',
    'Computing fair value with margin of safety...',
    'Scanning news sentiment signals...',
    'Evaluating multi-factor signal engine...',
    'Generating AI investment commentary...',
];
import axios from 'axios';
import './index.css';
import StockChart from './components/StockChart';
import Portfolio from './components/Portfolio';
import HeroBanner from './components/HeroBanner';
import AiAnalysisCard from './components/AiAnalysisCard';
import MetricsBanner from './components/MetricsBanner';
import ConvergenceBlock from './components/ConvergenceBlock';
import CollapsibleSection from './components/CollapsibleSection';
import Watchlist from './components/Watchlist';
const API = 'http://localhost:8000';


const fmtLarge = (v) => {
    if (!v) return '—';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v.toLocaleString()}`;
};

const metricColor = (label, val) => {
    if (val == null) return 'var(--c-muted)';
    if (label === 'pe' || label === 'fwd_pe') return val > 40 ? 'var(--c-red)' : val > 25 ? 'var(--c-yellow)' : 'var(--c-green)';
    if (label === 'margin' || label === 'roe') return val > 0.3 ? 'var(--c-green)' : val > 0.1 ? 'var(--c-yellow)' : 'var(--c-red)';
    return 'var(--c-blue)';
};
const metricLabel = (label, val) => {
    if (val == null) return '—';
    if (label === 'pe' || label === 'fwd_pe') return val > 40 ? 'High' : val > 25 ? 'Elevated' : 'Low';
    if (label === 'margin') return val > 0.3 ? 'Excellent' : val > 0.1 ? 'Good' : 'Low';
    return 'Growth';
};

const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffH = (now - d) / 3600000;
    if (diffH < 1) return `${Math.round(diffH * 60)}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 48) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getMarketStatus = () => {
    // Convert to US Eastern Time
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay(); // 0=Sun, 6=Sat
    const h = et.getHours();
    const m = et.getMinutes();
    const mins = h * 60 + m;
    if (day === 0 || day === 6) return { label: 'Closed', color: '#6b7280', dot: '#6b7280' };
    if (mins >= 570 && mins < 960) return { label: 'Live', color: '#22c55e', dot: '#22c55e' };      // 9:30-16:00
    if (mins >= 240 && mins < 570) return { label: 'Pre-Market', color: '#eab308', dot: '#eab308' }; // 4:00-9:30
    if (mins >= 960 && mins < 1200) return { label: 'After-Hours', color: '#eab308', dot: '#eab308' }; // 16:00-20:00
    return { label: 'Closed', color: '#6b7280', dot: '#6b7280' };
};

function LoadingOverlay({ step }) {
    return (
        <div className="st-loading-overlay">
            <div className="st-grid-bg" />
            <div className="st-grid-fade" />
            <div className="st-loading-content">
                <div className="spinner" style={{ width: 36, height: 36 }} />
                <p className="st-loading-title">Running deep analysis...</p>
                <div className="st-loading-step-wrap">
                    <p className="st-loading-step" key={step}>{LOADING_MESSAGES[step % LOADING_MESSAGES.length]}</p>
                </div>
                <div className="st-loading-dots">
                    {LOADING_MESSAGES.map((_, i) => (
                        <span key={i} className={`st-loading-dot ${i === step % LOADING_MESSAGES.length ? 'active' : ''}`} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function TokenBadge({ usage }) {
    const [showTooltip, setShowTooltip] = useState(false);
    if (!usage || !usage.total_tokens) return null;
    const costStr = usage.total_cost_usd < 0.01
        ? `$${(usage.total_cost_usd * 100).toFixed(2)}¢`
        : `$${usage.total_cost_usd.toFixed(4)}`;
    return (
        <div className="st-token-badge"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>token</span>
            <span>{usage.total_tokens.toLocaleString()} tokens</span>
            <span className="st-token-cost">{costStr}</span>
            {showTooltip && (
                <div className="st-token-tooltip">
                    <div className="st-token-tooltip-header">Token Usage Breakdown</div>
                    <div className="st-token-tooltip-row st-token-tooltip-summary">
                        <span>Input</span><span>{usage.input_tokens.toLocaleString()}</span>
                    </div>
                    <div className="st-token-tooltip-row st-token-tooltip-summary">
                        <span>Output</span><span>{usage.output_tokens.toLocaleString()}</span>
                    </div>
                    {usage.cached_input_tokens > 0 && (
                        <div className="st-token-tooltip-row st-token-tooltip-summary">
                            <span>Cached</span><span>{usage.cached_input_tokens.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="st-token-tooltip-divider" />
                    <div className="st-token-tooltip-title">Per-call breakdown</div>
                    {usage.calls?.map((c, i) => (
                        <div key={i} className="st-token-tooltip-row">
                            <span>{c.label}</span>
                            <span className="mono-data">{(c.input_tokens + c.output_tokens).toLocaleString()}</span>
                        </div>
                    ))}
                    <div className="st-token-tooltip-divider" />
                    <div className="st-token-tooltip-row st-token-tooltip-summary">
                        <span>Total Cost</span>
                        <span className="st-token-cost-highlight">${usage.total_cost_usd.toFixed(6)}</span>
                    </div>
                    <div className="st-token-tooltip-pricing">gpt-4o-mini · $0.15/1M in · $0.60/1M out</div>
                </div>
            )}
        </div>
    );
}

export default function App() {
    const [view, setView] = useState('search');
    const [ticker, setTicker] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [chartPeriod, setChartPeriod] = useState('1Y');
    const [loadingStep, setLoadingStep] = useState(0);
    const [recent, setRecent] = useState(() => JSON.parse(localStorage.getItem('st_recent') || '[]'));
    const [watchlist, setWatchlist] = useState(() => JSON.parse(localStorage.getItem('st_watchlist') || '[]'));
    const [showNewsModal, setShowNewsModal] = useState(false);
    const [showTokenTooltip, setShowTokenTooltip] = useState(false);
    const [initialTrade, setInitialTrade] = useState(null);

    // Rotate loading messages every 3 seconds
    useEffect(() => {
        if (!loading) { setLoadingStep(0); return; }
        const iv = setInterval(() => setLoadingStep(s => s + 1), 3000);
        return () => clearInterval(iv);
    }, [loading]);

    // Auto-save watchlist
    useEffect(() => {
        localStorage.setItem('st_watchlist', JSON.stringify(watchlist));
    }, [watchlist]);

    const saveRecent = (t) => {
        const next = [t, ...recent.filter(x => x !== t)].slice(0, 5);
        setRecent(next);
        localStorage.setItem('st_recent', JSON.stringify(next));
    };

    const addToWatchlist = () => {
        if (!data) return;
        const snapshot = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            data: data
        };
        setWatchlist(prev => {
            const filtered = prev.filter(item => item.data.ticker !== data.ticker);
            return [snapshot, ...filtered];
        });
    };

    const analyze = useCallback(async (sym) => {
        const t = (sym || ticker).trim();
        if (!t) return;
        setLoading(true); setError(null); setData(null); setShowNewsModal(false); setShowTokenTooltip(false);
        try {
            const res = await axios.post(`${API}/analyze`, { ticker: t });
            setData(res.data);
            // Save the resolved ticker (from API) in recents, not the raw input
            const resolvedTicker = res.data?.ticker || t.toUpperCase();
            saveRecent(resolvedTicker);
        } catch (e) {
            setError(e.response?.data?.detail || 'Backend bağlantı hatası');
        }
        setLoading(false);
    }, [ticker, recent]);

    const goHome = () => { setData(null); setError(null); setTicker(''); setView('search'); };

    const openPortfolioWithTrade = (tickerToOpen, priceToOpen) => {
        setInitialTrade({ ticker: tickerToOpen, price: priceToOpen });
        setView('portfolio');
    };

    // AI commentary (New source of truth for signals)
    const aiData = data?.ai_commentary;
    const isStructured = typeof aiData === 'object' && aiData !== null;

    const aiScoreStr = isStructured && aiData.score ? parseInt(aiData.score, 10) : null;
    const aiSignalStr = isStructured && aiData.signal ? aiData.signal : null;
    const aiMomentumStr = isStructured && aiData.momentum_signal ? aiData.momentum_signal : null;

    // Derived data
    const adv = data?.advanced_metrics || {};
    const { volatility = null, institutional_flow: flow = null, macro = null } = adv;
    const macroRateColor = macro?.rates === "Headwind" ? "var(--c-red)" : macro?.rates === "Tailwind" ? "var(--c-green)" : "var(--c-yellow)";
    const macroInfColor = macro?.inflation === "Headwind" ? "var(--c-red)" : macro?.inflation === "Tailwind" ? "var(--c-green)" : "var(--c-yellow)";

    const sig = data?.signal;
    const price = data?.fundamentals?.price;
    const fv = data?.fair_value;
    const f = data?.fundamentals || {};
    const tech = data?.technicals || {};
    const dcf = data?.dcf || {};
    const sent = data?.sentiment || {};
    const tokenUsage = data?.token_usage || { total_tokens: 0, total_cost: 0, breakdown: [] };
    const composite = sig?.composite_score ?? 0;

    const signalText = aiSignalStr || sig?.overall || '—';
    const isGreen = signalText.includes('BUY');
    const isRed = signalText.includes('SELL');
    const signalColor = isGreen ? 'var(--c-green)' : isRed ? 'var(--c-red)' : 'var(--c-yellow)';
    const signalStrength = signalText.includes('STRONG') ? 'Strong' : '';
    const upside = sig?.upside_pct;
    const aiScore = aiScoreStr !== null ? aiScoreStr : Math.round(((composite + 2) / 4) * 100);

    const momentumText = aiMomentumStr || sig?.momentum_signal || '—';
    const isMomGreen = momentumText.includes('BULLISH');
    const isMomRed = momentumText.includes('BEARISH');
    const momentumColor = isMomGreen ? 'var(--c-green)' : isMomRed ? 'var(--c-red)' : 'var(--c-yellow)';
    const momentumStrength = momentumText.includes('STRONG') ? 'Strong' : '';

    // Technicals
    const sma50Signal = tech.sma_50 && price ? (price > tech.sma_50 ? 'BUY' : 'SELL') : 'HOLD';
    const sma200Signal = tech.sma_200 && price ? (price > tech.sma_200 ? 'BUY' : 'SELL') : 'HOLD';
    const macdSignal = tech.macd_bullish ? 'BUY' : 'SELL';
    const rsi = tech.rsi_14;
    const rsiLabel = rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';

    // Sentiment
    const sentLabel = sent.sentiment_label || 'Neutral';
    const sentPositive = sentLabel.toLowerCase().includes('positive') || sentLabel.toLowerCase().includes('bullish');
    const sentColor = sentPositive ? 'var(--c-green)' : sentLabel.toLowerCase().includes('negative') || sentLabel.toLowerCase().includes('bearish') ? 'var(--c-red)' : 'var(--c-yellow)';
    const headlines = sent.top_headlines || [];
    const fvColor = fv && price ? (fv > price ? 'var(--c-green)' : 'var(--c-red)') : 'var(--c-muted)';

    // Extract commentary body
    const aiSummary = isStructured ? aiData.summary : '';
    const aiPros = isStructured && Array.isArray(aiData.pros) ? aiData.pros : [];
    const aiCons = isStructured && Array.isArray(aiData.cons) ? aiData.cons : [];
    const aiReasoning = isStructured ? aiData.reasoning : typeof aiData === 'string' ? aiData : '';

    const showLanding = !data && !loading;

    return (
        <div className="st-app">
            {/* ─── Navbar ─── */}
            <nav className="st-nav">
                <div className="st-nav-inner">
                    <div className="st-nav-left">
                        <div className="st-nav-logo" onClick={goHome} style={{ cursor: 'pointer' }}>
                            <span className="material-symbols-outlined st-nav-icon">insights</span>
                            <span className="st-nav-brand">SmartTrader <span className="st-nav-pro">PRO</span></span>
                        </div>
                        {true && ( // Always show navigation
                            <>
                                <div className="st-nav-sep" />
                                <div className="st-nav-links">
                                    <a href="#" className={view === 'search' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setView('search'); }}>Search</a>
                                    <a href="#" className={view === 'portfolio' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setView('portfolio'); }}>Portfolio</a>
                                    <a href="#" className={view === 'watchlist' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setView('watchlist'); }}>Watchlist</a>
                                </div>
                            </>
                        )}
                    </div>
                    {view === 'search' && data && (
                        <div className="st-nav-right">
                            <div className="st-search-wrap">
                                <span className="material-symbols-outlined st-search-icon">search</span>
                                <input className="st-search-input" placeholder="Search ticker or company..."
                                    value={ticker} onChange={e => setTicker(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && analyze()} />
                            </div>
                            <button className="st-nav-btn" onClick={() => analyze()} disabled={loading || !ticker}>→</button>
                        </div>
                    )}
                </div>
            </nav>

            {view === 'portfolio' ? (
                <Portfolio initialTrade={initialTrade} />
            ) : view === 'watchlist' ? (
                <Watchlist watchlist={watchlist} setWatchlist={setWatchlist} onLoadSnapshot={(snapData) => { setData(snapData); setTicker(snapData.ticker); setView('search'); }} />
            ) : (
                <>
                    {/* ═══ LANDING PAGE ═══ */}
                    {showLanding && (
                        <main className="st-landing">
                            <div className="st-grid-bg" />
                            <div className="st-grid-fade" />

                            <div className="st-landing-content">
                                <div className="st-landing-hero">
                                    <h1 className="st-landing-title">Market Intelligence.</h1>
                                    <p className="st-landing-sub">AI-powered stock analysis at your fingertips.</p>
                                </div>

                                <div className="st-landing-search">
                                    <div className="st-landing-search-inner">
                                        <span className="material-symbols-outlined st-landing-search-icon">search</span>
                                        <input className="st-landing-input" placeholder="Search ticker, company..."
                                            value={ticker} onChange={e => setTicker(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && analyze()} autoFocus />
                                        <div className="st-landing-kbd">
                                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>keyboard_command_key</span>
                                            <span>K</span>
                                        </div>
                                    </div>
                                </div>

                                <button className="st-landing-go" onClick={() => analyze()} disabled={loading || !ticker}>
                                    {loading ? 'Analyzing...' : 'Analyze →'}
                                </button>

                                {error && <div className="st-error" style={{ marginTop: 16 }}>⚠️ {error}</div>}

                                {recent.length > 0 && (
                                    <div className="st-landing-recents">
                                        <div className="st-landing-recents-header">
                                            <span className="material-symbols-outlined" style={{ color: 'var(--c-green)', fontSize: 14 }}>trending_up</span>
                                            <span className="st-landing-recents-label">Recent</span>
                                        </div>
                                        <div className="st-landing-chips">
                                            {recent.map(r => (
                                                <button key={r} className="st-landing-chip" onClick={() => { setTicker(r); analyze(r); }}>
                                                    <span className="st-landing-chip-ticker">{r}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <footer className="st-footer st-footer-landing">
                                <p>© 2025 SmartTrader — AI-Powered Market Intelligence</p>
                                <div><a href="#">Risk Disclosure</a></div>
                            </footer>
                        </main>
                    )}

                    {/* Loading overlay */}
                    {loading && (
                        <LoadingOverlay step={loadingStep} />
                    )}

                    {/* ═══ RESULTS VIEW ═══ */}
                    {data && !loading && (
                        <main className="st-main">
                            {/* ─── LEFT COLUMN ─── */}
                            <div className="st-left">
                                {/* Hero */}
                                <section className="st-hero">
                                    <div className="st-hero-top">
                                        <div className="st-hero-info">
                                            <div className="st-hero-name-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                                                    <h1 className="st-hero-name">{data.company_name}</h1>
                                                    <span className="st-hero-ticker">{data.ticker}</span>
                                                    {(() => {
                                                        const ms = getMarketStatus(); return (<>
                                                            <div className="st-live-dot" style={{ background: ms.dot, boxShadow: `0 0 6px ${ms.dot}` }} />
                                                            <span className="st-live-text" style={{ color: ms.color }}>{ms.label}</span>
                                                        </>);
                                                    })()}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                                                    <button
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '2px',
                                                            background: 'rgba(10, 132, 255, 0.1)', border: '1px solid rgba(10, 132, 255, 0.2)',
                                                            color: 'var(--c-blue)', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase',
                                                            cursor: 'pointer', transition: 'background 0.15s'
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(10, 132, 255, 0.2)'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(10, 132, 255, 0.1)'}
                                                        onClick={() => openPortfolioWithTrade(data.ticker, price)}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                                                        Add to Portfolio
                                                    </button>
                                                    <button
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '2px',
                                                            background: 'rgba(255, 149, 0, 0.1)', border: '1px solid rgba(255, 149, 0, 0.2)',
                                                            color: 'var(--c-yellow)', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase',
                                                            cursor: 'pointer', transition: 'background 0.15s'
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 149, 0, 0.2)'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 149, 0, 0.1)'}
                                                        onClick={addToWatchlist}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>bookmark</span>
                                                        Save to Watchlist
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="st-hero-price-row" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span className="st-hero-price" style={{ lineHeight: '1' }}>${price?.toFixed(2)}</span>
                                                    {upside != null && (
                                                        <div className={`st-hero-change ${upside >= 0 ? 'green' : 'red'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                                                {upside >= 0 ? 'arrow_upward' : 'arrow_downward'}
                                                            </span>
                                                            <span style={{ fontSize: '16px', fontWeight: '600' }}>{Math.abs(upside).toFixed(2)}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {data.signal?.momentum_target && (
                                                    <>
                                                        <div style={{ width: '1px', height: '36px', background: 'var(--st-border)' }}></div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
                                                            <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em', lineHeight: '1' }}>Target Price</span>
                                                            <span style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--c-blue)', lineHeight: '1' }}>${data.signal.momentum_target.toFixed(2)}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="st-signal-block">
                                            <div className="st-score-col">
                                                <div className="st-score-label">AI Score</div>
                                                <div className="st-score-ring"><div className="st-score-circle" style={{ borderColor: signalColor }}><span className="st-score-val">{aiScore}</span></div></div>
                                            </div>
                                            <div className="st-signal-col">
                                                <div className="st-score-label">Signal</div>
                                                <div className="st-signal-row">
                                                    <span className="st-signal-text" style={{ color: signalColor }}>{signalText.replace('STRONG ', '')}</span>
                                                    {signalStrength && <span className="st-signal-badge" style={{ background: `${signalColor}15`, color: signalColor, borderColor: `${signalColor}33` }}>{signalStrength}</span>}
                                                </div>
                                            </div>
                                            <div className="st-signal-col" style={{ paddingLeft: '24px', borderLeft: '1px solid var(--st-border)' }}>
                                                <div className="st-score-label">Momentum</div>
                                                <div className="st-signal-row">
                                                    <span className="st-signal-text" style={{ color: momentumColor }}>{momentumText.replace('STRONG ', '')}</span>
                                                    {momentumStrength && <span className="st-signal-badge" style={{ background: `${momentumColor}15`, color: momentumColor, borderColor: `${momentumColor}33` }}>{momentumStrength}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* AI Analysis — redesigned inline */}
                                <section className="st-section st-ai-section">
                                    <div className="st-ai-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-blue)' }}>psychology</span>
                                            <h3 className="st-section-title" style={{ margin: 0 }}>AI Investment Analysis</h3>
                                        </div>
                                        {tokenUsage.total_tokens > 0 && (
                                            <div
                                                className="st-token-badge-container"
                                                onMouseEnter={() => setShowTokenTooltip(true)}
                                                onMouseLeave={() => setShowTokenTooltip(false)}
                                            >
                                                <div className="st-token-badge">
                                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>bolt</span>
                                                    <span>${tokenUsage.total_cost?.toFixed(3)}</span>
                                                </div>
                                                {showTokenTooltip && (
                                                    <div className="st-token-tooltip">
                                                        <div className="st-token-tooltip-head">
                                                            <span>API Usage</span>
                                                            <span className="st-token-total">{tokenUsage.total_tokens?.toLocaleString()} tokens</span>
                                                        </div>
                                                        <div className="st-token-tooltip-body">
                                                            {tokenUsage.breakdown.map((b, i) => (
                                                                <div key={i} className="st-token-row">
                                                                    <div className="st-token-row-left">
                                                                        <span className="st-token-name">{b.action}</span>
                                                                        <span className="st-token-model">{b.model}</span>
                                                                    </div>
                                                                    <span className="st-token-val">{b.tokens?.toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {aiSummary && <p className="st-ai-summary">{aiSummary}</p>}

                                    <div className="st-ai-grid">
                                        {aiCons.length > 0 && (
                                            <div className="st-ai-box st-ai-box-cons">
                                                <div className="st-ai-box-head">
                                                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--c-red)' }}>warning</span>
                                                    <span>Risks</span>
                                                </div>
                                                <ul className="st-ai-list">
                                                    {aiCons.map((c, i) => <li key={i}>{c}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {aiPros.length > 0 && (
                                            <div className="st-ai-box st-ai-box-pros">
                                                <div className="st-ai-box-head">
                                                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--c-green)' }}>trending_up</span>
                                                    <span>Strengths</span>
                                                </div>
                                                <ul className="st-ai-list">
                                                    {aiPros.map((p, i) => <li key={i}>{p}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {aiReasoning && (
                                        <div className="st-ai-reasoning">
                                            {aiReasoning.split('\n').filter(p => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
                                        </div>
                                    )}
                                </section>

                                {/* Chart */}
                                <section className="st-section st-chart-section">
                                    {data.chart_data?.length > 0 && (
                                        <div className="st-chart-container" style={{ height: '100%' }}>
                                            <StockChart chartData={data.chart_data} fairValue={fv} momentumTarget={data.signal?.momentum_target} period={chartPeriod} onPeriodChange={setChartPeriod} ticker={ticker} />
                                        </div>
                                    )}
                                </section>
                            </div>

                            {/* ─── RIGHT SIDEBAR ─── */}
                            <aside className="st-right">
                                {/* AI Convergence */}
                                {data.advanced_metrics && (
                                    <CollapsibleSection title="AI Convergence" defaultOpen={true}>
                                        <div style={{ marginLeft: '-20px', marginRight: '-20px', marginTop: '-16px' }}>
                                            <ConvergenceBlock data={data} />
                                        </div>
                                    </CollapsibleSection>
                                )}

                                {/* Volatility */}
                                {volatility && (
                                    <CollapsibleSection title="Volatility Analysis" defaultOpen={true} extraHeader={<span className="st-metric-badge yellow">30D Metrics</span>}>
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
                                                <div className="st-mini-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
                                                    <span className="st-metric-subtext" style={{ fontSize: '8px', marginBottom: 0, whiteSpace: 'nowrap' }}>BETA (1Y PROXY)</span>
                                                    <span className="st-metric-val-large" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{data.fundamentals?.beta?.toFixed(2) || '—'}</span>
                                                </div>
                                                <div className="st-mini-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
                                                    <span className="st-metric-subtext" style={{ fontSize: '8px', marginBottom: 0, whiteSpace: 'nowrap' }}>AVG RANGE</span>
                                                    <span className="st-metric-val-large" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{volatility.avg_range_pct}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleSection>
                                )}

                                {/* Institutional Flow */}
                                {flow && (
                                    <CollapsibleSection title="Institutional Flow" defaultOpen={true}
                                        extraHeader={<span className="st-metric-badge" style={{ background: flow.net_flow_usd > 0 ? 'rgba(50, 215, 75, 0.1)' : 'rgba(255, 69, 58, 0.1)', color: flow.net_flow_usd > 0 ? 'var(--c-green)' : 'var(--c-red)', borderColor: flow.net_flow_usd > 0 ? 'rgba(50, 215, 75, 0.2)' : 'rgba(255, 69, 58, 0.2)' }}>{flow.flow_status}</span>}>
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
                                    </CollapsibleSection>
                                )}

                                {/* Macro Sentiment */}
                                {macro && (
                                    <CollapsibleSection title="Macro Sentiment" defaultOpen={true} extraHeader={<span className="material-symbols-outlined" style={{ color: '#4b5563', fontSize: '16px' }}>public</span>}>
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
                                    </CollapsibleSection>
                                )}

                                {/* Financial Health */}
                                <CollapsibleSection title="Financial Health" defaultOpen={true}>
                                    <div className="st-metric-grid">
                                        {[
                                            { label: 'P/E (TTM)', key: 'pe', val: f.pe_ratio, fmt: v => v?.toFixed(2) },
                                            { label: 'Fwd P/E', key: 'fwd_pe', val: f.forward_pe, fmt: v => v?.toFixed(2) },
                                            { label: 'Net Margin', key: 'margin', val: f.net_margin, fmt: v => v != null ? `${(v * 100).toFixed(1)}%` : null },
                                            { label: 'EPS', key: 'eps', val: f.eps_ttm, fmt: v => v?.toFixed(2) },
                                        ].map(({ label, key, val, fmt }) => (
                                            <div key={label} className="st-metric-card">
                                                <div className="st-metric-label">{label}</div>
                                                <div className="st-metric-val" style={{ color: metricColor(key, val) }}>{fmt(val) || '—'}</div>
                                                <div className="st-metric-sub">{metricLabel(key, val)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleSection>

                                {/* DCF Model */}
                                <CollapsibleSection
                                    title="DCF Model"
                                    defaultOpen={true}
                                    extraHeader={data.web_enriched ? <span className="st-web-badge"><span className="material-symbols-outlined" style={{ fontSize: 11 }}>language</span>Web-Enriched</span> : null}
                                >
                                    <div className="st-dcf-rows">
                                        <div className="st-dcf-row"><span>Free Cash Flow</span><span className="st-dcf-val">{fmtLarge(data.latest_fcf)}</span></div>
                                        <div className="st-dcf-row"><span>WACC / Terminal</span><span className="st-dcf-val">{`${dcf.discount_rate ? `${(dcf.discount_rate * 100).toFixed(0)}%` : '—'} / ${dcf.terminal_growth ? `${(dcf.terminal_growth * 100).toFixed(0)}%` : '—'}`}</span></div>
                                        <div className="st-dcf-row"><span>MoS / Intrinsic</span><span className="st-dcf-val">{`${dcf.margin_of_safety ? `${(dcf.margin_of_safety * 100).toFixed(0)}%` : '—'} / $${dcf.intrinsic_per_share?.toFixed(2) || '—'}`}</span></div>
                                    </div>
                                    {dcf.projected_fcfs && dcf.projected_fcfs.length > 1 && (
                                        <div className="st-growth-projections">
                                            <div className="st-growth-label">Growth Projections</div>
                                            <div className="st-growth-bars">
                                                {dcf.projected_fcfs.map((f, i) => {
                                                    const fcfVal = typeof f === 'object' ? f.fcf : f;
                                                    const prevFcf = i === 0 ? data.latest_fcf : (typeof dcf.projected_fcfs[i - 1] === 'object' ? dcf.projected_fcfs[i - 1].fcf : dcf.projected_fcfs[i - 1]);
                                                    const growth = prevFcf > 0 ? ((fcfVal / prevFcf - 1) * 100) : 0;
                                                    const maxGrowth = 80;
                                                    const barW = Math.min(Math.max(Math.abs(growth) / maxGrowth * 100, 8), 100);
                                                    return (
                                                        <div key={i} className="st-growth-row">
                                                            <span className="st-growth-yr">Y{i + 1}</span>
                                                            <div className="st-growth-bar-track">
                                                                <div className="st-growth-bar-fill" style={{ width: `${barW}%`, background: growth >= 0 ? 'var(--c-green)' : 'var(--c-red)' }} />
                                                            </div>
                                                            <span className={`st-growth-pct ${growth >= 0 ? 'green' : 'red'}`}>{growth >= 0 ? '+' : ''}{growth.toFixed(0)}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {!(dcf.projected_fcfs && dcf.projected_fcfs.length > 1) && (
                                        <div className="st-dcf-rows">
                                            <div className="st-dcf-row"><span>Growth Rate</span><span className="st-dcf-val">{dcf.fcf_growth_rate_used != null ? `${dcf.fcf_growth_rate_used}%` : '—'}</span></div>
                                        </div>
                                    )}
                                    <div className="st-dcf-rows">
                                        <div className="st-dcf-fair"><span>Fair Value</span><span style={{ color: fvColor }}>${fv?.toFixed(2) || '—'}</span></div>
                                    </div>
                                    {data.dcf_research?.analyst_source && (
                                        <div className="st-dcf-source">📡 {data.dcf_research.analyst_source}</div>
                                    )}
                                </CollapsibleSection>

                                {/* Sentiment */}
                                <CollapsibleSection title="Sentiment" defaultOpen={true}>
                                    <div className="st-sent-header" style={{ background: `${sentColor}08`, borderColor: `${sentColor}1a` }}>
                                        <div className="st-sent-icon" style={{ background: `${sentColor}15` }}>
                                            <span className="material-symbols-outlined" style={{ color: sentColor, fontSize: 14 }}>{sentPositive ? 'trending_up' : 'trending_down'}</span>
                                        </div>
                                        <div>
                                            <div className="st-sent-label">Social Mood</div>
                                            <div className="st-sent-val" style={{ color: sentColor }}>{sentLabel.toUpperCase()}</div>
                                        </div>
                                    </div>
                                    <div className="st-news-list">
                                        {headlines.slice(0, 3).map((h, i) => (
                                            <div key={i} className="st-news-item">
                                                <p className="st-news-title">{h.link ? <a href={h.link} target="_blank" rel="noopener noreferrer">{h.title}</a> : h.title}</p>
                                                <div className="st-news-meta">
                                                    <span>{h.publisher}{h.published_at ? ` · ${fmtTime(h.published_at)}` : ''}</span>
                                                    <span style={{ color: h.score >= 0 ? 'var(--c-green)' : 'var(--c-red)' }} className="mono-data">
                                                        {h.score >= 0 ? '+' : ''}{h.score?.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {headlines.length > 3 && (
                                        <button className="st-show-more-btn" onClick={() => setShowNewsModal(true)}>
                                            Show All {headlines.length} Headlines
                                        </button>
                                    )}
                                </CollapsibleSection>

                                {/* Technicals */}
                                <CollapsibleSection title="Technicals" defaultOpen={true}>
                                    <div className="st-tech-rsi">
                                        <div className="st-tech-rsi-label">RSI (14)</div>
                                        <div className="st-tech-rsi-right">
                                            <div className="st-tech-rsi-val">{rsi?.toFixed(2) || '—'}</div>
                                            <div className="st-tech-rsi-sub">{rsiLabel}</div>
                                        </div>
                                    </div>
                                    <div className="st-tech-grid">
                                        {[{ label: 'SMA 50', signal: sma50Signal }, { label: 'SMA 200', signal: sma200Signal }, { label: 'MACD', signal: macdSignal }].map(({ label, signal }) => (
                                            <div key={label} className="st-tech-item">
                                                <div className="st-tech-item-label">{label}</div>
                                                <div className={`st-tech-badge ${signal === 'BUY' ? 'green' : signal === 'SELL' ? 'red' : 'neutral'}`}>{signal}</div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleSection>
                            </aside>
                        </main>
                    )}

                    {/* Footer (results view) */}
                    {data && !loading && (
                        <footer className="st-footer">
                            <p>© 2025 SmartTrader — AI-Powered Market Intelligence</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <TokenBadge usage={data.token_usage} />
                                <a href="#">Risk Disclosure</a>
                            </div>
                        </footer>
                    )}

                    {/* News Modal */}
                    {showNewsModal && headlines.length > 0 && (
                        <div className="st-modal-backdrop" onClick={() => setShowNewsModal(false)}>
                            <div className="st-modal" onClick={e => e.stopPropagation()}>
                                <div className="st-modal-header">
                                    <h3>All Headlines — {data.ticker}</h3>
                                    <button className="st-modal-close" onClick={() => setShowNewsModal(false)}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <div className="st-modal-body">
                                    {headlines.map((h, i) => (
                                        <div key={i} className="st-modal-news-item">
                                            <div className="st-modal-news-left">
                                                <p className="st-modal-news-title">
                                                    {h.link ? <a href={h.link} target="_blank" rel="noopener noreferrer">{h.title}</a> : h.title}
                                                </p>
                                                <div className="st-modal-news-meta">
                                                    <span>{h.publisher}</span>
                                                    {h.published_at ? <span className="st-modal-news-time">{fmtTime(h.published_at)}</span> : null}
                                                </div>
                                            </div>
                                            <span className={`st-modal-news-score ${h.score >= 0 ? 'green' : 'red'}`}>
                                                {h.score >= 0 ? '+' : ''}{h.score?.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                </>
            )}
        </div>
    );
}

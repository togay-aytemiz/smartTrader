import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../index.css';

const API = 'http://localhost:8000';

export default function Portfolio({ initialTrade }) {
    const [trades, setTrades] = useState(() => JSON.parse(localStorage.getItem('st_portfolio') || '[]'));
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(false);

    // Form state
    const [formTicker, setFormTicker] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formShares, setFormShares] = useState('');

    useEffect(() => {
        if (initialTrade) {
            setFormTicker(initialTrade.ticker || '');
            setFormPrice(initialTrade.price || '');
        }
    }, [initialTrade]);

    // Auto-save trades to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem('st_portfolio', JSON.stringify(trades));
    }, [trades]);

    const fetchPrices = useCallback(async () => {
        if (trades.length === 0) return;
        setLoading(true);
        const uniqueTickers = [...new Set(trades.map(t => t.ticker))];
        try {
            const res = await axios.post(`${API}/quotes`, { tickers: uniqueTickers });
            setPrices(res.data);
        } catch (e) {
            console.error("Failed to fetch quotes", e);
        }
        setLoading(false);
    }, [trades]);

    // Fetch prices on mount and when trades array changes
    useEffect(() => {
        fetchPrices();

        // Auto-refresh every 30 seconds
        const iv = setInterval(() => {
            fetchPrices();
        }, 30000);
        return () => clearInterval(iv);
    }, [fetchPrices]);

    const handleAddTrade = (e) => {
        e.preventDefault();
        if (!formTicker || !formPrice || !formShares) return;

        const newTrade = {
            id: Date.now().toString(),
            ticker: formTicker.toUpperCase().trim(),
            purchasePrice: parseFloat(formPrice),
            shares: parseFloat(formShares),
            date: new Date().toISOString()
        };

        setTrades([...trades, newTrade]);
        setFormTicker('');
        setFormPrice('');
        setFormShares('');
    };

    const removeTrade = (id) => {
        setTrades(trades.filter(t => t.id !== id));
    };

    // Calculate totals BEFORE rendering so we can show them at the top
    let totalInvested = 0;
    let totalCurrentValue = 0;

    trades.forEach(trade => {
        const currentPrice = prices[trade.ticker];
        const invested = trade.purchasePrice * trade.shares;
        if (currentPrice) {
            const currentValue = currentPrice * trade.shares;
            totalInvested += invested;
            totalCurrentValue += currentValue;
        }
    });

    return (
        <div className="st-portfolio-wrap" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', color: 'var(--c-text)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--c-blue)' }}>account_balance_wallet</span>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>My Portfolio</h1>
                </div>
                <button
                    className="st-landing-go"
                    style={{ padding: '0 16px', height: '36px', fontSize: '14px', width: 'auto', background: 'var(--bg-card)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={fetchPrices}
                    disabled={loading || trades.length === 0}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, lineHeight: 1 }}>refresh</span>
                    <span>{loading ? 'Refreshing...' : 'Refresh Prices'}</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                {/* SUMMARY WIDGET */}
                {trades.length > 0 && totalCurrentValue > 0 && (
                    <div className="st-ai-box" style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Portfolio Performance</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            <div className="st-metric-card" style={{ padding: '20px' }}>
                                <div className="st-metric-label">Total Invested</div>
                                <div className="st-metric-val">${totalInvested.toFixed(2)}</div>
                            </div>
                            <div className="st-metric-card" style={{ padding: '20px' }}>
                                <div className="st-metric-label">Current Value</div>
                                <div className="st-metric-val">${totalCurrentValue.toFixed(2)}</div>
                            </div>
                            <div className="st-metric-card" style={{ padding: '20px' }}>
                                <div className="st-metric-label">Total P/L</div>
                                <div className="st-metric-val" style={{ color: (totalCurrentValue - totalInvested) >= 0 ? 'var(--c-green)' : 'var(--c-red)' }}>
                                    {totalCurrentValue - totalInvested >= 0 ? '+' : '-'}${Math.abs(totalCurrentValue - totalInvested).toFixed(2)}
                                    <span style={{ fontSize: '14px', marginLeft: 8 }}>
                                        ({(((totalCurrentValue - totalInvested) / totalInvested) * 100).toFixed(2)}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ADD TRADE FORM */}
                <div className="st-ai-box" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Add Transaction</h3>
                    <form onSubmit={handleAddTrade} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ fontSize: '12px', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticker Symbol</label>
                            <input
                                className="st-form-input"
                                placeholder="e.g. AAPL"
                                value={formTicker}
                                onChange={e => setFormTicker(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ fontSize: '12px', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchase Price ($)</label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                className="st-form-input"
                                placeholder="0.00"
                                value={formPrice}
                                onChange={e => setFormPrice(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ fontSize: '12px', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shares</label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                className="st-form-input"
                                placeholder="Amount"
                                value={formShares}
                                onChange={e => setFormShares(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="st-landing-go" style={{ padding: '0 24px', height: '42px', width: 'auto', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Add
                        </button>
                    </form>
                </div>

                {/* TRADES TABLE */}
                <div className="st-ai-box" style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {trades.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--c-muted)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>inventory_2</span>
                            <p>No trades added yet. Add a transaction above to start tracking your portfolio.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--c-muted)', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '16px' }}>Asset</th>
                                    <th style={{ padding: '16px' }}>Purchase</th>
                                    <th style={{ padding: '16px' }}>Current</th>
                                    <th style={{ padding: '16px' }}>Shares</th>
                                    <th style={{ padding: '16px' }}>Total Invested</th>
                                    <th style={{ padding: '16px' }}>Current Value</th>
                                    <th style={{ padding: '16px' }}>P/L</th>
                                    <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map(trade => {
                                    const currentPrice = prices[trade.ticker];
                                    const invested = trade.purchasePrice * trade.shares;
                                    let currentValue = null;
                                    let plTotal = null;
                                    let plPct = null;

                                    if (currentPrice) {
                                        currentValue = currentPrice * trade.shares;
                                        plTotal = currentValue - invested;
                                        plPct = (plTotal / invested) * 100;
                                    }

                                    const isProfit = plTotal >= 0;
                                    const plColor = isProfit ? 'var(--c-green)' : 'var(--c-red)';

                                    return (
                                        <tr key={trade.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px' }}>
                                            <td style={{ padding: '16px', fontWeight: 600 }}>{trade.ticker}</td>
                                            <td style={{ padding: '16px', fontFamily: 'monospace' }}>${trade.purchasePrice.toFixed(2)}</td>
                                            <td style={{ padding: '16px', fontFamily: 'monospace' }}>
                                                {currentPrice ? `$${currentPrice.toFixed(2)}` : <span style={{ color: 'var(--c-muted)' }}>Loading...</span>}
                                            </td>
                                            <td style={{ padding: '16px' }}>{trade.shares}</td>
                                            <td style={{ padding: '16px', fontFamily: 'monospace' }}>${invested.toFixed(2)}</td>
                                            <td style={{ padding: '16px', fontFamily: 'monospace' }}>
                                                {currentValue ? `$${currentValue.toFixed(2)}` : '—'}
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                {plPct != null ? (
                                                    <div style={{ color: plColor, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                                            {isProfit ? 'trending_up' : 'trending_down'}
                                                        </span>
                                                        <span>{isProfit ? '+' : '-'}${Math.abs(plTotal).toFixed(2)}</span>
                                                        <span style={{ fontSize: '12px', opacity: 0.8 }}>({isProfit ? '+' : ''}{plPct.toFixed(2)}%)</span>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => removeTrade(trade.id)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--c-muted)', cursor: 'pointer' }}
                                                    title="Delete Trade"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>


            </div>
        </div>
    );
}

import React, { useState } from 'react';
import axios from 'axios';
import '../index.css';

const API = 'http://localhost:8000';

const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffH = (now - d) / 3600000;
    if (diffH < 1) return `${Math.round(diffH * 60)}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 48) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Watchlist({ watchlist, setWatchlist, onLoadSnapshot }) {
    const [refreshingId, setRefreshingId] = useState(null);

    const removeSnapshot = (id, e) => {
        e.stopPropagation();
        setWatchlist(prev => prev.filter(s => s.id !== id));
    };

    const handleRefresh = async (snap, e) => {
        e.stopPropagation();
        if (refreshingId) return;
        setRefreshingId(snap.id);
        try {
            const res = await axios.post(`${API}/analyze`, { ticker: snap.data.ticker });
            const updatedSnapshot = {
                id: snap.id, // keep the same ID so order doesn't jump
                date: new Date().toISOString(),
                data: res.data
            };
            setWatchlist(prev => prev.map(s => s.id === snap.id ? updatedSnapshot : s));
        } catch (err) {
            console.error("Refresh failed", err);
        }
        setRefreshingId(null);
    };

    return (
        <div className="st-portfolio-wrap" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', color: 'var(--c-text)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--c-yellow)' }}>bookmark</span>
                    <h1 style={{ margin: 0, fontSize: '24px' }}>My Watchlist</h1>
                </div>
            </div>

            <div className="st-ai-box" style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {watchlist.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--c-muted)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>bookmark_border</span>
                        <p>No snapshots saved yet. Search for a ticker and click 'Save to Watchlist' to save the analysis.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--c-muted)', textTransform: 'uppercase' }}>
                                <th style={{ padding: '16px' }}>Asset</th>
                                <th style={{ padding: '16px' }}>Price & Targets</th>
                                <th style={{ padding: '16px' }}>Signals</th>
                                <th style={{ padding: '16px', textAlign: 'center' }}>AI Score</th>
                                <th style={{ padding: '16px' }}>Saved Date</th>
                                <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {watchlist.map(snap => {
                                const data = snap.data;
                                const f = data?.fundamentals || {};
                                const price = f.price;
                                const fv = data?.fair_value;
                                const target = data?.signal?.momentum_target;
                                const aiData = data?.ai_commentary;
                                const isStructured = typeof aiData === 'object' && aiData !== null;
                                const aiSignalStr = isStructured && aiData.signal ? aiData.signal : data?.signal?.overall || '—';
                                const momentumStr = isStructured && aiData.momentum_signal ? aiData.momentum_signal : data?.signal?.momentum_signal || '—';
                                const aiScoreStr = isStructured && aiData.score ? parseInt(aiData.score, 10) : null;
                                const composite = data?.signal?.composite_score ?? 0;
                                const aiScore = aiScoreStr !== null ? aiScoreStr : Math.round(((composite + 2) / 4) * 100);

                                const isGreen = aiSignalStr.includes('BUY');
                                const isRed = aiSignalStr.includes('SELL');
                                const signalColor = isGreen ? 'var(--c-green)' : isRed ? 'var(--c-red)' : 'var(--c-yellow)';

                                const isMomGreen = momentumStr.includes('BULLISH');
                                const isMomRed = momentumStr.includes('BEARISH');
                                const momColor = isMomGreen ? 'var(--c-green)' : isMomRed ? 'var(--c-red)' : 'var(--c-yellow)';

                                return (
                                    <tr
                                        key={snap.id}
                                        style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => onLoadSnapshot(snap.data)}
                                    >
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 600 }}>{data.ticker}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--c-muted)' }}>{data.company_name}</div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 600 }}>${price?.toFixed(2) || '—'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                                                FV: ${fv?.toFixed(2) || '—'} <br />
                                                Tgt: ${target?.toFixed(2) || '—'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ color: signalColor, fontWeight: 500, fontSize: '13px' }}>
                                                {aiSignalStr.replace('STRONG ', '')}
                                                {aiSignalStr.includes('STRONG') && <span className="st-signal-badge" style={{ background: `${signalColor}15`, color: signalColor, borderColor: `${signalColor}33`, marginLeft: 6, padding: '1px 4px', fontSize: '8px' }}>STRONG</span>}
                                            </div>
                                            <div style={{ color: momColor, fontSize: '11px', marginTop: 4 }}>
                                                Mom: {momentumStr.replace('STRONG ', '')}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div className="st-score-ring" style={{ width: 32, height: 32, margin: '0 auto' }}><div className="st-score-circle" style={{ borderColor: signalColor, width: 28, height: 28, fontSize: '12px' }}><span className="st-score-val" style={{ fontSize: '12px' }}>{aiScore}</span></div></div>
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--c-muted)' }}>{fmtTime(snap.date)}</td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <button
                                                onClick={(e) => handleRefresh(snap, e)}
                                                disabled={refreshingId != null}
                                                style={{ background: 'transparent', border: 'none', color: refreshingId === snap.id ? 'var(--c-blue)' : 'var(--c-muted)', cursor: refreshingId !== null ? 'default' : 'pointer', padding: '4px', marginRight: '4px' }}
                                                title="Refresh Analysis"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{refreshingId === snap.id ? 'hourglass_empty' : 'refresh'}</span>
                                            </button>
                                            <button
                                                onClick={(e) => removeSnapshot(snap.id, e)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', padding: '4px' }}
                                                title="Remove from Watchlist"
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
    );
}

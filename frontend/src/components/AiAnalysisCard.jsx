import React from 'react';

export default function AiAnalysisCard({ data, signal }) {
    if (!data || !signal) return null;

    // Check if ai_commentary is an object (new format) or string (old format/fallback)
    const aiData = data.ai_commentary;
    const isStructured = typeof aiData === 'object' && aiData !== null;

    const summary = isStructured ? aiData.summary : "Detailed AI analysis unavailable. The model suggests a neutral outlook based on current data.";
    const pros = isStructured && Array.isArray(aiData.pros) ? aiData.pros : [];
    const cons = isStructured && Array.isArray(aiData.cons) ? aiData.cons : [];
    const reasoning = isStructured ? aiData.reasoning : typeof aiData === 'string' ? aiData : "";

    // Convert reasoning into paragraphs
    const paragraphs = reasoning.split('\n').filter(p => p.trim() !== '');

    return (
        <section className="ai-stitch-card">
            <div className="ai-stitch-inner">

                <div className="ai-stitch-header">
                    <span className="material-icons-round">psychology</span>
                    <h2 className="ai-stitch-header-title">AI Investment Analysis Report</h2>
                </div>

                <div className="ai-stitch-grid">

                    {/* Left Column: Pros & Cons Blocks */}
                    <div className="ai-stitch-col-left">
                        {cons.length > 0 && (
                            <div className="ai-stitch-box cons">
                                <h3 className="ai-stitch-box-title">
                                    <span className="material-icons-round">warning</span>
                                    Negative Factors
                                </h3>
                                <div className="ai-stitch-box-text">
                                    <ul>
                                        {cons.map((c, i) => <li key={`con-${i}`} style={{ marginBottom: cons.length > 1 ? 4 : 0 }}>{c}</li>)}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {pros.length > 0 && (
                            <div className="ai-stitch-box pros">
                                <h3 className="ai-stitch-box-title">
                                    <span className="material-icons-round">trending_up</span>
                                    Positive Factors
                                </h3>
                                <div className="ai-stitch-box-text">
                                    <ul>
                                        {pros.map((p, i) => <li key={`pro-${i}`} style={{ marginBottom: pros.length > 1 ? 4 : 0 }}>{p}</li>)}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Reasoning / Summary Text */}
                    <div className="ai-stitch-col-main">
                        {summary && <p style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '16px' }}>{summary}</p>}
                        {paragraphs.map((p, idx) => (
                            <p key={`p-${idx}`}>{p}</p>
                        ))}
                    </div>
                </div>

            </div>
        </section>
    );
}

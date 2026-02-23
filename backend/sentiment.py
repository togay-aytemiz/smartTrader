"""
SmartTrader — News Sentiment Analysis Module

Fetches Yahoo Finance news headlines for a ticker and scores them
using VADER + finance-specific keyword boosting.

Returns:
  sentiment_score  : float [-1.0 .. +1.0]
  sentiment_label  : str
  headline_count   : int
  top_headlines    : list[dict]
  summary          : str
"""
from __future__ import annotations
import re
from typing import Optional

# ─── VADER ────────────────────────────────────────────────────────────────────
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    _vader = SentimentIntensityAnalyzer()
    _vader.lexicon.update({
        # Positive
        "beat": 2.5, "beats": 2.5, "outperform": 2.5, "upgrade": 2.0,
        "raised": 1.5, "raises": 1.5, "buyback": 1.8, "dividend": 1.2,
        "record": 1.5, "profit": 1.3, "growth": 1.2, "surge": 2.0,
        "rally": 1.8, "bullish": 2.0, "exceed": 2.0, "exceeded": 2.0,
        "strong": 1.0, "soar": 2.0, "soars": 2.0, "upside": 1.5,
        "opportunity": 1.0, "undervalued": 2.0, "buy": 1.0,
        # Negative
        "miss": -2.5, "misses": -2.5, "downgrade": -2.0, "layoff": -1.5,
        "layoffs": -1.5, "lawsuit": -1.2, "recall": -1.2, "fraud": -3.0,
        "bearish": -2.0, "warning": -1.2, "concern": -0.8, "decline": -1.3,
        "cut": -1.0, "cuts": -1.0, "loss": -1.5, "losses": -1.5,
        "probe": -1.3, "investigation": -1.3, "fine": -1.2, "penalty": -1.5,
        "default": -3.0, "bankruptcy": -3.5, "overvalued": -1.5,
        "disappoint": -2.0, "disappointing": -2.0, "slump": -1.8,
        "crash": -2.5, "plunge": -2.0, "plunges": -2.0, "drop": -1.0,
    })
    VADER_AVAILABLE = True
except ImportError:
    _vader = None
    VADER_AVAILABLE = False


def _score_text(text: str) -> float:
    """Return compound sentiment in [-1.0, +1.0]."""
    if not text:
        return 0.0
    if VADER_AVAILABLE:
        return _vader.polarity_scores(text)["compound"]
    words = re.findall(r"[a-z]+", text.lower())
    pos = {"beat", "upgrade", "growth", "profit", "strong", "record", "surge", "rally"}
    neg = {"miss", "downgrade", "loss", "decline", "cut", "warning", "probe", "fraud"}
    s = sum(1 for w in words if w in pos) - sum(1 for w in words if w in neg)
    return max(-1.0, min(1.0, s * 0.2))


def _label(score: float) -> str:
    if score >= 0.35:
        return "VERY POSITIVE"
    if score >= 0.10:
        return "POSITIVE"
    if score > -0.10:
        return "NEUTRAL"
    if score > -0.35:
        return "NEGATIVE"
    return "VERY NEGATIVE"


def analyze_sentiment(ticker: str, news_items: Optional[list] = None) -> dict:
    """Analyse sentiment from Yahoo Finance news for `ticker`."""
    if news_items is None:
        news_items = _fetch_news(ticker)

    ticker_upper = ticker.upper()

    # Prefer articles that explicitly mention this ticker
    relevant = [
        n for n in news_items
        if ticker_upper in [t.upper() for t in n.get("relatedTickers", [])]
        or ticker_upper in n.get("title", "").upper()
    ]
    items = relevant if relevant else news_items

    if not items:
        return {
            "sentiment_score": 0.0,
            "sentiment_label": "NEUTRAL",
            "headline_count": 0,
            "top_headlines": [],
            "summary": "No recent news found.",
        }

    scored = []
    for item in items:
        title = item.get("title", "")
        desc = item.get("summary", "") or item.get("description", "")
        # Title weighted 2x over short description
        score = (_score_text(title) * 2.0 + _score_text(desc)) / 3.0
        scored.append({
            "title": title,
            "publisher": item.get("publisher", ""),
            "score": round(score, 3),
            "label": _label(score),
            "published_at": item.get("providerPublishTime", 0),
            "link": item.get("link", ""),
        })

    # Weighted mean: strongly worded headlines count more
    weights = [abs(a["score"]) + 0.1 for a in scored]
    total_w = sum(weights)
    avg = sum(a["score"] * w for a, w in zip(scored, weights)) / total_w

    all_sorted = sorted(scored, key=lambda x: abs(x["score"]), reverse=True)
    label = _label(avg)
    positive = sum(1 for a in scored if a["score"] >= 0.10)
    negative = sum(1 for a in scored if a["score"] <= -0.10)
    neutral = len(scored) - positive - negative

    summary = (
        f"{len(scored)} haber analiz edildi: {positive} pozitif, "
        f"{negative} negatif, {neutral} nötr. "
        f"Genel duygu: {label} ({avg:+.2f})."
    )

    return {
        "sentiment_score": round(avg, 3),
        "sentiment_label": label,
        "headline_count": len(scored),
        "top_headlines": all_sorted,
        "summary": summary,
    }


def _fetch_news(ticker: str, count: int = 20) -> list:
    """Standalone news fetch (used when called outside analyze_stock)."""
    try:
        from analyzer import _init_session, _BASE
        sess, crumb = _init_session()
        p = {"q": ticker, "newsCount": count, "quotesCount": 0, "crumb": crumb}
        r = sess.get(f"{_BASE}/v1/finance/search", params=p, timeout=15)
        if r.status_code == 200:
            return r.json().get("news", [])
    except Exception:
        pass
    return []

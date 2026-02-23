"""
SmartTrader — Core Analysis Engine
Fetches data via Yahoo Finance v8 HTTP API and computes:
  - DCF (Discounted Cash Flow) intrinsic value
  - Technical indicators: RSI(14), SMA(50), SMA(200)
  - Key fundamentals
"""

import time
import requests
import numpy as np
import pandas as pd
from typing import Optional

# ─── Yahoo Finance Session + Crumb ───────────────────────────────────────────
_BASE = "https://query1.finance.yahoo.com"
_BASE2 = "https://query2.finance.yahoo.com"

_session: requests.Session = None
_crumb: str = None


def _init_session() -> tuple:
    """
    Initialise a requests.Session with Yahoo Finance cookies and crumb.
    Parses crumb from the HTML page source — most reliable method.
    """
    import re as _re
    global _session, _crumb
    if _session and _crumb:
        return _session, _crumb

    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; bot)",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "en-US,en;q=0.5",
    })

    crumb = None
    for ticker_hint in ("AAPL", "AMZN"):
        try:
            r = s.get(f"https://finance.yahoo.com/quote/{ticker_hint}", timeout=20)
            if r.status_code == 200:
                m = _re.search(r'"crumb":"(.*?)"', r.text)
                if m:
                    crumb = m.group(1).replace("\\u002F", "/")
                    break
        except Exception:
            pass

    # Switch to JSON Accept for API calls
    s.headers["Accept"] = "application/json"

    _session = s
    _crumb = crumb or ""
    return _session, _crumb



def _get(url: str, params: dict = None, retries: int = 3) -> dict:
    """GET with Yahoo Finance crumb auth and retry."""
    import json as _json
    sess, crumb = _init_session()
    p = dict(params or {})
    if crumb:
        p["crumb"] = crumb
    for attempt in range(retries):
        try:
            r = sess.get(url, params=p, timeout=20)
            if r.status_code == 200:
                try:
                    return r.json()
                except Exception:
                    return _json.loads(r.content)
            if r.status_code == 429:
                time.sleep(4 * (attempt + 1))
        except Exception:
            pass
        time.sleep(2 * (attempt + 1))
    return {}


def fetch_chart(ticker: str, range_: str = "2y", interval: str = "1d") -> dict:
    """Fetch OHLCV chart data from Yahoo Finance v8."""
    url = f"{_BASE}/v8/finance/chart/{ticker}"
    data = _get(url, {"range": range_, "interval": interval})
    if not data:
        url = f"{_BASE2}/v8/finance/chart/{ticker}"
        data = _get(url, {"range": range_, "interval": interval})
    return data




def fetch_quote_summary(ticker: str, modules: str = "summaryDetail,defaultKeyStatistics,financialData,quoteType,assetProfile") -> dict:
    """Fetch fundamental data via quoteSummary."""
    url = f"{_BASE}/v10/finance/quoteSummary/{ticker}"
    data = _get(url, {"modules": modules})
    if not data:
        url = f"{_BASE2}/v10/finance/quoteSummary/{ticker}"
        data = _get(url, {"modules": modules})
    return data


def fetch_cashflow(ticker: str) -> dict:
    """Fetch annual cash flow statement."""
    url = f"{_BASE}/v10/finance/quoteSummary/{ticker}"
    data = _get(url, {"modules": "cashflowStatementHistory"})
    if not data:
        url = f"{_BASE2}/v10/finance/quoteSummary/{ticker}"
        data = _get(url, {"modules": "cashflowStatementHistory"})
    return data


# ─── DCF Configuration ───────────────────────────────────────────────────────
PROJECTION_YEARS = 10
TERMINAL_GROWTH_RATE = 0.03

# Sector-based WACC: reflects cost of capital per industry
SECTOR_WACC = {
    "Technology":          0.08,
    "Communication Services": 0.08,
    "Healthcare":          0.08,
    "Consumer Cyclical":   0.09,
    "Consumer Defensive":  0.07,
    "Financial Services":  0.09,
    "Industrials":         0.09,
    "Basic Materials":     0.09,
    "Energy":              0.10,
    "Real Estate":         0.07,
    "Utilities":           0.07,
}
DEFAULT_WACC = 0.09

# Margin of Safety: Removed (0%) to make valuation more realistic for finding buys
MARGIN_OF_SAFETY = 0.00


# ─── Helper: RSI ─────────────────────────────────────────────────────────────
def compute_rsi(prices: pd.Series, period: int = 14) -> float:
    """Compute RSI for the most recent trading day."""
    delta = prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return round(float(rsi.iloc[-1]), 2)


# ─── Helper: SMA ─────────────────────────────────────────────────────────────
def compute_sma(prices: pd.Series, period: int = 200) -> Optional[float]:
    """Compute Simple Moving Average for a given period."""
    if len(prices) < period:
        return None
    return round(float(prices.rolling(window=period).mean().iloc[-1]), 4)


# ─── Helper: MACD ─────────────────────────────────────────────────────────────
def compute_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    """Compute MACD line, signal line, and histogram."""
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return {
        "macd": round(float(macd_line.iloc[-1]), 4),
        "signal": round(float(signal_line.iloc[-1]), 4),
        "histogram": round(float(histogram.iloc[-1]), 4),
        # Bullish crossover: MACD just crossed above signal
        "crossover": (
            float(macd_line.iloc[-1]) > float(signal_line.iloc[-1]) and
            float(macd_line.iloc[-2]) <= float(signal_line.iloc[-2])
        ) if len(prices) > 27 else False,
        # Bearish crossover
        "crossunder": (
            float(macd_line.iloc[-1]) < float(signal_line.iloc[-1]) and
            float(macd_line.iloc[-2]) >= float(signal_line.iloc[-2])
        ) if len(prices) > 27 else False,
        "bullish": float(macd_line.iloc[-1]) > float(signal_line.iloc[-1]),
    }


# ─── DCF Model ────────────────────────────────────────────────────────────────
def calculate_dcf(
    latest_fcf: float,
    shares_outstanding: int,
    fcf_growth_rate: float,
    discount_rate: float = DEFAULT_WACC,
    terminal_growth: float = TERMINAL_GROWTH_RATE,
    years: int = 5,                          # 5 explicit years (industry standard)
    margin_of_safety: float = MARGIN_OF_SAFETY,
    projected_fcf_list: list = None,         # Year-by-year FCFs from analyst research
    net_cash_debt: float = 0,                # Net cash (+) or net debt (-) to add
) -> dict:
    """
    DCF Model with two modes:
      1. Analyst mode: uses projected_fcf_list (year-by-year FCFs from web research)
      2. Growth-rate mode: compounds latest_fcf at fcf_growth_rate (fallback)
    Adds net_cash_debt to total intrinsic value before per-share division.
    """
    projected_fcfs = []

    if projected_fcf_list and len(projected_fcf_list) >= 1:
        # ── Analyst mode: use explicit year-by-year FCFs ──────────────────
        effective_years = len(projected_fcf_list)
        for i, fcf_val in enumerate(projected_fcf_list):
            year = i + 1
            pv = fcf_val / ((1 + discount_rate) ** year)
            projected_fcfs.append({"year": year, "fcf": fcf_val, "pv": pv})
        years = effective_years
        # Compute implied avg annual growth for display
        first_fcf = projected_fcf_list[0]
        last_fcf = projected_fcf_list[-1]
        if first_fcf > 0 and effective_years > 1:
            implied_growth = (last_fcf / first_fcf) ** (1 / (effective_years - 1)) - 1
        else:
            implied_growth = fcf_growth_rate
    else:
        # ── Growth-rate mode: compound from latest_fcf ────────────────────
        current_fcf = latest_fcf
        implied_growth = fcf_growth_rate
        for year in range(1, years + 1):
            current_fcf = current_fcf * (1 + fcf_growth_rate)
            pv = current_fcf / ((1 + discount_rate) ** year)
            projected_fcfs.append({"year": year, "fcf": current_fcf, "pv": pv})

    # Terminal value (Gordon Growth Model)
    terminal_fcf = projected_fcfs[-1]["fcf"] * (1 + terminal_growth)
    terminal_value = terminal_fcf / (discount_rate - terminal_growth)
    pv_terminal = terminal_value / ((1 + discount_rate) ** years)

    total_pv_fcfs = sum(p["pv"] for p in projected_fcfs)
    total_pv = total_pv_fcfs + pv_terminal + net_cash_debt

    intrinsic_per_share = total_pv / shares_outstanding if shares_outstanding > 0 else 0
    fair_value_with_mos = intrinsic_per_share * (1 - margin_of_safety)

    return {
        "projected_fcfs": projected_fcfs,
        "terminal_value": round(terminal_value, 2),
        "pv_terminal": round(pv_terminal, 2),
        "total_intrinsic_value": round(total_pv, 2),
        "intrinsic_per_share": round(intrinsic_per_share, 2),
        "fair_value_with_mos": round(fair_value_with_mos, 2),
        "fcf_growth_rate_used": round(implied_growth * 100, 2),
        "discount_rate": discount_rate,
        "terminal_growth": terminal_growth,
        "margin_of_safety": margin_of_safety,
        "net_cash_debt": round(net_cash_debt / 1e9, 2),
        "projection_years": years,
        "scenarios": {
            "optimistic": round(intrinsic_per_share * 0.95, 2),
            "base": round(intrinsic_per_share * 0.85, 2),
            "conservative": round(intrinsic_per_share * 0.70, 2),
        },
    }



# ─── Multi-Factor Signal Engine ───────────────────────────────────────────────
def _score_clamp(v: float) -> float:
    """Clamp a score to [-2, +2]."""
    return max(-2.0, min(2.0, v))

def determine_signal(
    current_price: float,
    fair_value: Optional[float],
    rsi: float,
    sma50: Optional[float],
    sma200: Optional[float],
    macd: Optional[dict],
    fundamentals: dict,
    week_52_high: Optional[float] = None,
    week_52_low: Optional[float] = None,
) -> dict:
    """
    4-Pillar Hybrid Signal Engine (Value + GARP/Momentum):
      Pillar 1 — Intrinsic Valuation (DCF)      (30%)
      Pillar 2 — Relative Valuation (Multiples) (20%)
      Pillar 3 — Quality & Growth               (25%)
      Pillar 4 — Momentum & Technicals          (25%)
    """
    factor_scores = {}
    factor_details = {}

    # ── Pillar 1: DCF Valuation (30%) ─────────────────────────────────────────
    if fair_value and fair_value > 0:
        upside_pct = ((fair_value - current_price) / current_price) * 100
        if upside_pct > 15:
            dcf_s = 2.0
        elif upside_pct > 0:
            dcf_s = 1.0
        elif upside_pct > -15:
            dcf_s = 0.0
        elif upside_pct > -30:
            dcf_s = -1.0
        else:
            dcf_s = -2.0
        factor_scores["dcf"] = dcf_s
        factor_details["dcf"] = f"Upside {upside_pct:+.1f}%"
    else:
        upside_pct = None
        factor_scores["dcf"] = 0.0
        factor_details["dcf"] = "N/A"

    # ── Pillar 2: Relative Valuation (20%) ────────────────────────────────────
    pe = fundamentals.get("pe_ratio")
    fpe = fundamentals.get("forward_pe")
    best_pe = fpe if fpe else pe
    peg = fundamentals.get("peg_ratio")
    ev_ebitda = fundamentals.get("ev_ebitda")
    rev_growth = fundamentals.get("revenue_growth") or 0.0

    # Growth Exemption Rule
    growth_exemption = (rev_growth > 0.15) or (peg and peg < 2.0)
    max_penalty = -0.5 if growth_exemption else -2.0

    pe_s, pe_str = 0.0, "N/A"
    if best_pe and best_pe > 0:
        if best_pe < 20: pe_s = 2.0
        elif best_pe < 30: pe_s = 1.0
        elif best_pe < 45: pe_s = 0.0
        elif best_pe < 70: pe_s = max(-1.0, max_penalty)
        else: pe_s = max_penalty
        pe_str = f"P/E {best_pe:.1f}"

    peg_s, peg_str = 0.0, "N/A"
    if peg and peg > 0:
        if peg < 1.0: peg_s = 2.0
        elif peg < 1.5: peg_s = 1.0
        elif peg < 2.2: peg_s = 0.0
        elif peg < 3.0: peg_s = max(-1.0, max_penalty)
        else: peg_s = max_penalty
        peg_str = f"PEG {peg:.2f}"

    ev_s, ev_str = 0.0, "N/A"
    if ev_ebitda and ev_ebitda > 0:
        if ev_ebitda < 12: ev_s = 2.0
        elif ev_ebitda < 18: ev_s = 1.0
        elif ev_ebitda < 30: ev_s = 0.0
        elif ev_ebitda < 50: ev_s = max(-1.0, max_penalty)
        else: ev_s = max_penalty
        ev_str = f"EV/EBITDA {ev_ebitda:.1f}x"

    rv_scores = []
    if pe_str != "N/A": rv_scores.append(pe_s)
    if peg_str != "N/A": rv_scores.append(peg_s)
    if ev_str != "N/A": rv_scores.append(ev_s)
    
    factor_scores["relative_val"] = sum(rv_scores) / len(rv_scores) if rv_scores else 0.0
    
    details_list = [s for s in [pe_str, peg_str, ev_str] if s != "N/A"]
    factor_details["relative_val"] = " | ".join(details_list) if details_list else "N/A"
    if growth_exemption and factor_details["relative_val"] != "N/A":
        factor_details["relative_val"] += " (Exempt)"

    # ── Pillar 3: Quality & Growth (25%) ──────────────────────────────────────
    roa = fundamentals.get("roa")
    net_margin = fundamentals.get("net_margin")
    
    qg_scores = []
    qg_strs = []
    
    if rev_growth is not None:
        if rev_growth > 0.30: qg_scores.append(2.0)
        elif rev_growth > 0.15: qg_scores.append(1.0)
        elif rev_growth > 0.05: qg_scores.append(0.0)
        elif rev_growth > -0.05: qg_scores.append(-1.0)
        else: qg_scores.append(-2.0)
        qg_strs.append(f"RevG {rev_growth*100:+.1f}%")

    if roa is not None:
        if roa > 0.15: qg_scores.append(2.0)
        elif roa > 0.08: qg_scores.append(1.0)
        elif roa > 0.03: qg_scores.append(0.0)
        elif roa > 0.0: qg_scores.append(-1.0)
        else: qg_scores.append(-2.0)
        qg_strs.append(f"ROA {roa*100:+.1f}%")

    if net_margin is not None:
        if net_margin > 0.20: qg_scores.append(2.0)
        elif net_margin > 0.10: qg_scores.append(1.0)
        elif net_margin > 0.02: qg_scores.append(0.0)
        elif net_margin > -0.05: qg_scores.append(-1.0)
        else: qg_scores.append(-2.0)
        qg_strs.append(f"Mrgn {net_margin*100:+.1f}%")

    factor_scores["quality_growth"] = sum(qg_scores) / len(qg_scores) if qg_scores else 0.0
    factor_details["quality_growth"] = " | ".join(qg_strs) if qg_strs else "N/A"

    # ── Pillar 4: Technicals (25%) ────────────────────────────────────────────
    tech_points = 0.0
    tech_count = 0

    if rsi < 25:
        tech_points += 2.0
        rsi_signal = "OVERSOLD (Bullish)"
    elif rsi < 40:
        tech_points += 0.5
        rsi_signal = "LOW RSI (Mildly Bullish)"
    elif rsi > 80:
        tech_points -= 2.0
        rsi_signal = "EXTREMELY OVERBOUGHT (Bearish)"
    elif rsi > 70:
        tech_points -= 1.0
        rsi_signal = "OVERBOUGHT (Bearish)"
    else:
        rsi_signal = "NEUTRAL"
    tech_count += 1

    sma_signal = "N/A"
    if sma50 and sma200:
        if current_price > sma50 > sma200:
            tech_points += 2.0
            sma_signal = "BULLISH (Price > SMA50 > SMA200)"
        elif current_price > sma200:
            tech_points += 1.0
            sma_signal = "ABOVE SMA200 (Bullish)"
        elif current_price < sma50 < sma200:
            tech_points -= 2.0
            sma_signal = "BEARISH (Price < SMA50 < SMA200)"
        else:
            tech_points -= 1.0
            sma_signal = "BELOW SMA200 (Bearish)"
        tech_count += 1
    elif sma200:
        if current_price > sma200:
            tech_points += 1.0
            sma_signal = "ABOVE SMA200 (Bullish)"
        else:
            tech_points -= 1.0
            sma_signal = "BELOW SMA200 (Bearish)"
        tech_count += 1

    macd_signal_str = "N/A"
    if macd:
        if macd.get("crossover"):
            tech_points += 1.5
            macd_signal_str = "BULLISH CROSSOVER"
        elif macd.get("crossunder"):
            tech_points -= 1.5
            macd_signal_str = "BEARISH CROSSUNDER"
        elif macd.get("bullish"):
            tech_points += 0.5
            macd_signal_str = "BULLISH (MACD > Signal)"
        else:
            tech_points -= 0.5
            macd_signal_str = "BEARISH (MACD < Signal)"
        tech_count += 1

    if week_52_high and week_52_low:
        range_52w = (current_price - week_52_low) / (week_52_high - week_52_low) if week_52_high > week_52_low else 0
        if range_52w > 0.95:
            tech_points -= 0.5   # near 52w high = stretched
        tech_count += 1

    tech_score = _score_clamp(tech_points / tech_count if tech_count else 0)
    factor_scores["technical"] = tech_score
    factor_details["technical"] = f"RSI {rsi:.1f} | {sma_signal} | MACD {macd_signal_str}"

    # ── Weighted Final Score ──────────────────────────────────────────────────
    weights = {"dcf": 0.30, "relative_val": 0.20, "quality_growth": 0.25, "technical": 0.25}
    total_weight = 0.0
    weighted_sum = 0.0
    for k, w in weights.items():
        if factor_details.get(k) == "N/A" and k != "technical":
            continue
        weighted_sum += factor_scores.get(k, 0.0) * w
        total_weight += w

    composite = weighted_sum / total_weight if total_weight > 0 else 0.0

    if composite >= 0.8:
        overall = "STRONG BUY"
    elif composite >= 0.2:
        overall = "BUY"
    elif composite >= -0.3:
        overall = "HOLD"
    elif composite >= -0.8:
        overall = "SELL"
    else:
        overall = "STRONG SELL"

    # ── Narrative / Momentum Target Calculation ───────────────────────────────
    # Calculate a hype-driven target based on growth, quality, and momentum
    momentum_premium = 0.0
    
    # 1. Growth & Quality Hype
    if rev_growth and rev_growth > 0.20:
        momentum_premium += (rev_growth * 0.5)  # E.g. 50% growth adds 25% premium
    
    if qg_scores and max(qg_scores) == 2.0:
        momentum_premium += 0.10 # Extra 10% for having top-tier margins/ROA
    
    # 2. Tech / Trend Hype
    if tech_points > 0:
        momentum_premium += (tech_points * 0.05) # Up to 10% extra for perfect technicals
    
    # Floor and Ceiling for Momentum Premium based on Composite Score
    # We want momentum target to realistically reflect current hype, not drop severely unless the stock is awful
    base_target = current_price
    
    if composite > 1.0:
        momentum_premium = max(0.20, momentum_premium) # Exceptional stocks get min 20% premium
        momentum_premium = min(1.00, momentum_premium) # Cap at 100% upside
    elif composite > 0.0:
        momentum_premium = max(0.05, momentum_premium) 
        momentum_premium = min(0.50, momentum_premium) # Cap at 50% upside
    elif composite > -0.5:
        momentum_premium = max(-0.10, momentum_premium)
        momentum_premium = min(0.20, momentum_premium)
    else:
        # Terrible stocks go down
        momentum_premium = min(-0.15, momentum_premium - 0.20)
    
    momentum_target = base_target * (1 + momentum_premium)

    if momentum_premium >= 0.20:
        momentum_signal_str = "STRONG BULLISH"
    elif momentum_premium >= 0.05:
        momentum_signal_str = "BULLISH"
    elif momentum_premium <= -0.15:
        momentum_signal_str = "STRONG BEARISH"
    elif momentum_premium <= -0.05:
        momentum_signal_str = "BEARISH"
    else:
        momentum_signal_str = "NEUTRAL"

    return {
        "overall": overall,
        "composite_score": round(composite, 3),
        "upside_pct": round(upside_pct, 2) if upside_pct is not None else None,
        "momentum_target": round(momentum_target, 2),
        "momentum_signal": momentum_signal_str,
        "factor_scores": {k: round(v, 2) for k, v in factor_scores.items()},
        "factor_details": factor_details,
        "dcf_signal": factor_details.get("dcf", "N/A"),
        "rsi_signal": rsi_signal,
        "sma_signal": sma_signal,
        "macd_signal": macd_signal_str,
    }


# ─── Safe value extractor ─────────────────────────────────────────────────────
def _val(d: dict, key: str):
    v = d.get(key)
    if isinstance(v, dict):
        return v.get("raw")
    return v


# ─── Main Analysis Function ───────────────────────────────────────────────────
def analyze_stock(ticker: str) -> dict:
    ticker = ticker.upper().strip()

    # ── Chart / price history ─────────────────────────────────────────────────
    chart_raw = fetch_chart(ticker, range_="2y", interval="1d")
    try:
        result = chart_raw["chart"]["result"][0]
        timestamps = result["timestamp"]
        ohlcv = result["indicators"]["quote"][0]
        closes = ohlcv.get("close", [])
        opens = ohlcv.get("open", [])
        highs = ohlcv.get("high", [])
        lows = ohlcv.get("low", [])
        volumes = ohlcv.get("volume", [])

        # Filter out None values
        valid = [(t, o, h, l, c, v)
                 for t, o, h, l, c, v in zip(timestamps, opens, highs, lows, closes, volumes)
                 if c is not None]

        if not valid:
            raise ValueError(f"No price history found for ticker: {ticker}")

        dates = [pd.Timestamp(t, unit="s") for t, *_ in valid]
        close_prices = pd.Series([c for _, _, _, _, c, _ in valid], index=dates)

        chart_data = [
            {
                "date": str(pd.Timestamp(t, unit="s").date()),
                "open": round(o, 4) if o else None,
                "high": round(h, 4) if h else None,
                "low": round(l, 4) if l else None,
                "close": round(c, 4),
                "volume": int(v) if v else 0,
            }
            for t, o, h, l, c, v in valid
        ]

        current_price = round(close_prices.iloc[-1], 4)

        # 52w high/low
        week_52_high = round(max(h for _, _, h, _, _, _ in valid if h), 2)
        week_52_low = round(min(l for _, _, _, l, _, _ in valid if l), 2)

    except (KeyError, IndexError, TypeError) as e:
        raise ValueError(f"No price history found for ticker: {ticker}")

    # ── Quote Summary (fundamentals) ──────────────────────────────────────────
    summary_raw = fetch_quote_summary(ticker)
    qs = {}
    try:
        qs = summary_raw["quoteSummary"]["result"][0]
    except Exception:
        pass

    sd = qs.get("summaryDetail", {})
    ks = qs.get("defaultKeyStatistics", {})
    fd = qs.get("financialData", {})
    qt = qs.get("quoteType", {})
    ap = qs.get("assetProfile", {})

    company_name = qt.get("longName") or qt.get("shortName") or ticker
    sector = ap.get("sector") or fd.get("sector") or "N/A"
    industry = ap.get("industry") or fd.get("industry") or "N/A"

    # Sector-aware WACC
    wacc = SECTOR_WACC.get(sector, DEFAULT_WACC)

    market_cap = _val(sd, "marketCap") or _val(ks, "marketCap") or 0
    shares_outstanding = _val(ks, "sharesOutstanding") or 0

    # ── Fallback: fetch from v7/finance/quote when quoteSummary returns nothing ─
    # Some tickers (e.g. TSLA) intermittently drop defaultKeyStatistics fields.
    if not shares_outstanding or not market_cap:
        try:
            _sess, _crumb_token = _init_session()
            _q7resp = _sess.get(
                f"{_BASE}/v7/finance/quote",
                params={"symbols": ticker, "crumb": _crumb_token},
                timeout=12,
            )
            if _q7resp.status_code == 200:
                _q7 = _q7resp.json().get("quoteResponse", {}).get("result", [{}])
                _q7 = _q7[0] if _q7 else {}
                shares_outstanding = shares_outstanding or _q7.get("sharesOutstanding") or 0
                market_cap = market_cap or _q7.get("marketCap") or 0
                if not current_price:
                    current_price = _q7.get("regularMarketPrice") or current_price
        except Exception:
            pass

    # Last-resort: derive shares from market_cap / price
    if not shares_outstanding and market_cap and current_price:
        shares_outstanding = int(market_cap / current_price)

    # Use current price from financial data if available (more accurate)
    current_price_fd = _val(fd, "currentPrice")
    if current_price_fd:
        current_price = current_price_fd

    fundamentals = {
        "price": current_price,
        "market_cap": market_cap,
        "pe_ratio": _val(sd, "trailingPE"),
        "forward_pe": _val(sd, "forwardPE"),
        "peg_ratio": _val(ks, "pegRatio"),
        "pb_ratio": _val(ks, "priceToBook"),
        "ev_ebitda": _val(ks, "enterpriseToEbitda"),
        "roe": _val(fd, "returnOnEquity"),
        "roa": _val(fd, "returnOnAssets"),
        "net_margin": _val(fd, "profitMargins"),
        "revenue_growth": _val(fd, "revenueGrowth"),
        "earnings_growth": _val(fd, "earningsGrowth"),
        "eps_ttm": _val(ks, "trailingEps"),
        "debt_to_equity": _val(fd, "debtToEquity"),
        "current_ratio": _val(fd, "currentRatio"),
        "dividend_yield": _val(sd, "dividendYield"),
        "beta": _val(sd, "beta"),
        "week_52_high": week_52_high,
        "week_52_low": week_52_low,
        "avg_volume": _val(sd, "averageVolume"),
        "free_cashflow": _val(fd, "freeCashflow"),
        "total_cash": _val(fd, "totalCash"),
        "total_debt": _val(fd, "totalDebt"),
        "shares_outstanding": shares_outstanding,
    }

    # Compute net cash/debt from Yahoo Finance data (reliable)
    tc = fundamentals.get("total_cash") or 0
    td = fundamentals.get("total_debt") or 0
    fundamentals["net_cash_debt"] = tc - td if (tc or td) else 0

    # ── Technical Indicators ──────────────────────────────────────────────────
    rsi = compute_rsi(close_prices)
    sma50 = compute_sma(close_prices, 50)
    sma200 = compute_sma(close_prices, 200)
    macd_data = compute_macd(close_prices)

    technicals = {
        "rsi_14": rsi,
        "sma_50": sma50,
        "sma_200": sma200,
        "macd": macd_data["macd"],
        "macd_signal": macd_data["signal"],
        "macd_histogram": macd_data["histogram"],
        "macd_bullish": macd_data["bullish"],
    }

    # ── Cash Flow & DCF ───────────────────────────────────────────────────────
    latest_fcf = _val(fd, "freeCashflow") or 0

    # Estimate FCF growth rate by blending available signals:
    #   - Forward earningsGrowth (analyst estimate) — weight 1
    #   - Historical net income YoY growth — weight 2 (most reliable)
    #   - Revenue growth — weight 1
    growth_signals = []

    # Signal 1: Forward earnings growth from analysts
    eg = _val(fd, "earningsGrowth")
    if eg is not None and -0.5 < eg < 1.0:
        growth_signals.append(("earnings_fwd", eg, 1.0))

    # Signal 2: Historical net income growth from cashflow statements
    try:
        cf_raw = fetch_cashflow(ticker)
        stmts = cf_raw["quoteSummary"]["result"][0]["cashflowStatementHistory"]["cashflowStatements"]
        net_incomes = [_val(s, "netIncome") for s in stmts if _val(s, "netIncome") and _val(s, "netIncome") > 0]
        if len(net_incomes) >= 2:
            rates = []
            for i in range(len(net_incomes) - 1):
                rates.append((net_incomes[i] - net_incomes[i + 1]) / abs(net_incomes[i + 1]))
            if rates:
                ni_growth = float(np.mean(rates))
                growth_signals.append(("ni_historical", ni_growth, 2.0))
    except Exception:
        pass

    # Signal 3: Revenue growth
    rg = _val(fd, "revenueGrowth")
    if rg is not None and -0.5 < rg < 1.0:
        growth_signals.append(("revenue", rg, 1.0))

    # Weighted average of all signals
    if growth_signals:
        total_weight = sum(w for _, _, w in growth_signals)
        fcf_growth_rate = sum(v * w for _, v, w in growth_signals) / total_weight
    else:
        fcf_growth_rate = 0.05

    # Dynamically cap FCF growth rate. Standard max is 20%.
    # For hyper-growth companies (P/E > 40), cap it at 25% (still realistic for 10 years).
    max_growth_cap = 0.20
    min_growth_floor = -0.10
    if fundamentals.get("pe_ratio") and fundamentals["pe_ratio"] > 40:
        max_growth_cap = 0.25
        min_growth_floor = 0.05
    elif fundamentals.get("forward_pe") and fundamentals["forward_pe"] > 40:
        max_growth_cap = 0.25
        min_growth_floor = 0.05

    fcf_growth_rate = float(np.clip(fcf_growth_rate, min_growth_floor, max_growth_cap))

    if latest_fcf and latest_fcf > 0 and shares_outstanding and shares_outstanding > 0:
        yf_net_cash = fundamentals.get("net_cash_debt", 0) or 0
        dcf_result = calculate_dcf(
            latest_fcf=latest_fcf,
            shares_outstanding=shares_outstanding,
            fcf_growth_rate=fcf_growth_rate,
            discount_rate=wacc,
            net_cash_debt=float(yf_net_cash),
        )
        fair_value = dcf_result["fair_value_with_mos"]
    else:
        dcf_result = None
        fair_value = None

    # ── Multi-factor Signal (always runs, even without DCF) ───────────────────
    signal = determine_signal(
        current_price=current_price,
        fair_value=fair_value,
        rsi=rsi,
        sma50=sma50,
        sma200=sma200,
        macd=macd_data,
        fundamentals=fundamentals,
        week_52_high=week_52_high,
        week_52_low=week_52_low,
    )

    # ── News Sentiment ────────────────────────────────────────────────────────
    news_raw = []
    try:
        p = {"q": ticker, "newsCount": 20, "crumb": _crumb}
        news_resp = _session.get(f"{_BASE}/v1/finance/search", params=p, timeout=15)
        if news_resp.status_code == 200:
            news_raw = news_resp.json().get("news", [])
    except Exception:
        pass

    from sentiment import analyze_sentiment
    sentiment = analyze_sentiment(ticker, news_raw)

    from sentiment import analyze_sentiment
    sentiment = analyze_sentiment(ticker, news_raw)

    # ── Advanced Metrics ───────────────────────────────────────────────────────
    
    # 1. Volatility Analysis (30D)
    if len(close_prices) >= 30:
        last_30_closes = close_prices.iloc[-30:]
        returns = np.diff(last_30_closes) / last_30_closes[:-1]
        historical_volatility = float(np.std(returns) * np.sqrt(252))
        
        last_252_closes = close_prices.iloc[-min(252, len(close_prices)):]
        returns_1y = np.diff(last_252_closes) / last_252_closes[:-1]
        volatility_1y = float(np.std(returns_1y) * np.sqrt(252))
        
        vol_diff_pct = (historical_volatility - volatility_1y) / volatility_1y if volatility_1y else 0
        
        if len(valid) >= 30:
            last_30_valid = valid[-30:]
            ranges = [(h - l) / c for _, _, h, l, c, _ in last_30_valid if c > 0 and h is not None and l is not None]
            avg_range = float(np.mean(ranges)) if ranges else 0
        else:
            avg_range = 0
    else:
        historical_volatility = 0
        volatility_1y = 0
        vol_diff_pct = 0
        avg_range = 0

    volatility_metrics = {
        "implied_volatility": round(historical_volatility * 100, 1), # using hist val as proxy
        "volatility_1y": round(volatility_1y * 100, 1),
        "vol_diff_pct": round(vol_diff_pct * 100, 1),
        "avg_range_pct": round(avg_range * 100, 2),
    }

    # 2. Institutional Flow (Whale Activity) - Proxy via Volume Spikes
    avg_vol = fundamentals.get("avg_volume") or sum(volumes[-20:])/20 if volumes else 1
    whale_buy_vol = 0
    whale_sell_vol = 0
    if len(valid) > 20:
        last_20_valid = valid[-20:]
        for _, o, h, l, c, v in last_20_valid:
            if v and v > avg_vol * 1.2 and o is not None:
                if c > o:
                    whale_buy_vol += v * c
                else:
                    whale_sell_vol += v * c
    
    total_whale_vol = whale_buy_vol + whale_sell_vol
    if total_whale_vol > 0:
        buy_pressure_pct = whale_buy_vol / total_whale_vol
        sell_pressure_pct = whale_sell_vol / total_whale_vol
    else:
        buy_pressure_pct = 0.5
        sell_pressure_pct = 0.5
        
    net_flow_usd = whale_buy_vol - whale_sell_vol
    flow_status = "Whale Entry" if net_flow_usd > 0 else "Whale Exit" if net_flow_usd < 0 else "Neutral Flow"

    institutional_flow = {
        "buy_pressure_pct": round(buy_pressure_pct * 100, 1),
        "sell_pressure_pct": round(sell_pressure_pct * 100, 1),
        "net_flow_usd": net_flow_usd,
        "flow_status": flow_status
    }

    # 3. Macro Sentiment (Sector based static mapping)
    MACRO_MAPPING = {
        "Technology": {"rates": "Headwind", "rates_desc": "High rates discount future cash flows", "inflation": "Neutral", "inflation_desc": "Pricing power offset by wage inflation", "overall": "BEARISH"},
        "Healthcare": {"rates": "Neutral", "rates_desc": "Defensive sector, less rate sensitive", "inflation": "Tailwind", "inflation_desc": "Strong pricing power on inelastic goods", "overall": "BULLISH"},
        "Financial Services": {"rates": "Tailwind", "rates_desc": "Higher net interest margins", "inflation": "Neutral", "inflation_desc": "Credit risks monitored", "overall": "BULLISH"},
        "Energy": {"rates": "Neutral", "rates_desc": "Driven more by global demand", "inflation": "Tailwind", "inflation_desc": "Commodities hedge against inflation", "overall": "BULLISH"},
        "Consumer Cyclical": {"rates": "Headwind", "rates_desc": "Higher borrowing costs dampen spending", "inflation": "Headwind", "inflation_desc": "Margin compression and demand destruction", "overall": "BEARISH"},
        "Consumer Defensive": {"rates": "Neutral", "rates_desc": "Consistent dividend yields", "inflation": "Neutral", "inflation_desc": "Can pass costs, but volumes may drop", "overall": "NEUTRAL"},
    }
    macro_default = {"rates": "Neutral", "rates_desc": "Sector typical sensitivity", "inflation": "Neutral", "inflation_desc": "Standard inflation sensitivity", "overall": "NEUTRAL"}
    
    # Try exact match, otherwise default
    macro_sentiment = macro_default
    for key, val in MACRO_MAPPING.items():
        if key.lower() in sector.lower() or sector.lower() in key.lower():
            macro_sentiment = val
            break

    # 4. AI Convergence
    convergence = {"bullish": 0, "bearish": 0, "neutral": 0, "total": 12}
    def _add_sig(val):
        if val > 0.5: convergence["bullish"] += 1
        elif val < -0.5: convergence["bearish"] += 1
        else: convergence["neutral"] += 1

    fs = signal.get("factor_scores", {})
    _add_sig(fs.get("dcf", 0))
    _add_sig(fs.get("pe", 0))
    _add_sig(fs.get("peg", 0))
    _add_sig(fs.get("ev_ebitda", 0))
    _add_sig(fs.get("technical", 0))
    
    if rsi and rsi > 60: convergence["bullish"] += 1
    elif rsi and rsi < 40: convergence["bearish"] += 1
    else: convergence["neutral"] += 1
    
    if sma50 and current_price > sma50: convergence["bullish"] += 1
    else: convergence["bearish"] += 1
    
    if sma200 and current_price > sma200: convergence["bullish"] += 1
    else: convergence["bearish"] += 1
        
    if technicals.get("macd_bullish", False): convergence["bullish"] += 1
    else: convergence["bearish"] += 1
    
    if fundamentals.get("roe") and fundamentals["roe"] > 0.15: convergence["bullish"] += 1
    else: convergence["bearish"] += 1
        
    if fundamentals.get("net_margin") and fundamentals["net_margin"] > 0.10: convergence["bullish"] += 1
    else: convergence["bearish"] += 1
        
    if fundamentals.get("revenue_growth") and fundamentals["revenue_growth"] > 0.10: convergence["bullish"] += 1
    else: convergence["bearish"] += 1
        
    convergence_pct_bull = convergence["bullish"] / 12 * 100
    convergence_pct_bear = convergence["bearish"] / 12 * 100
    
    if convergence_pct_bull > 60:
        convergence["status"] = "Strong Bullish Convergence"
        convergence["type"] = "BULLISH"
    elif convergence_pct_bear > 60:
        convergence["status"] = "Strong Bearish Convergence"
        convergence["type"] = "BEARISH"
    elif convergence_pct_bull > 40:
        convergence["status"] = "Weak Bullish Convergence"
        convergence["type"] = "BULLISH"
    elif convergence_pct_bear > 40:
        convergence["status"] = "Weak Bearish Convergence"
        convergence["type"] = "BEARISH"
    else:
        convergence["status"] = "Mixed Signals"
        convergence["type"] = "NEUTRAL"

    return {
        "ticker": ticker,
        "company_name": company_name,
        "sector": sector,
        "industry": industry,
        "fundamentals": fundamentals,
        "technicals": technicals,
        "dcf": dcf_result,
        "fair_value": fair_value,
        "signal": signal,
        "chart_data": chart_data,
        "latest_fcf": latest_fcf,
        "sentiment": sentiment,
        "advanced_metrics": {
            "volatility": volatility_metrics,
            "institutional_flow": institutional_flow,
            "macro": macro_sentiment,
            "convergence": convergence
        }
    }

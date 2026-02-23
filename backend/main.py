"""
SmartTrader — FastAPI Backend
Endpoints:
  POST /analyze        → Full stock analysis with AI commentary
  POST /resolve        → Resolve company name to ticker
  GET  /health         → Health check
"""

import os, json, asyncio, time
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from analyzer import analyze_stock

load_dotenv()

app = FastAPI(title="SmartTrader API", version="1.0.0")

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── OpenAI Client ─────────────────────────────────────────────────────────
_openai_client = None
_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

if _OPENAI_KEY and not _OPENAI_KEY.startswith("your_"):
    try:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=_OPENAI_KEY)
        print("✅ OpenAI client initialized")
    except ImportError:
        print("⚠️  openai package not installed — AI commentary disabled")
    except Exception as e:
        print(f"⚠️  OpenAI init failed: {e}")
else:
    print("ℹ️  OPENAI_API_KEY not set — AI commentary disabled")

# ─── Token Usage Tracker ───────────────────────────────────────────────────
# gpt-4o-mini pricing per 1M tokens
PRICING = {
    "gpt-4o-mini": {"input": 0.15, "cached_input": 0.075, "output": 0.60},
    "gpt-4o":      {"input": 2.50, "cached_input": 1.25,  "output": 10.0},
}

class TokenTracker:
    def __init__(self):
        self.calls = []  # list of {label, model, input_tokens, output_tokens, cached_input_tokens}

    def track(self, label: str, model: str, usage):
        """Track a single API call's token usage."""
        if not usage:
            return
        input_tokens = getattr(usage, 'input_tokens', 0) or getattr(usage, 'prompt_tokens', 0) or 0
        output_tokens = getattr(usage, 'output_tokens', 0) or getattr(usage, 'completion_tokens', 0) or 0
        cached = getattr(usage, 'input_tokens_details', None)
        cached_input = 0
        if cached:
            cached_input = getattr(cached, 'cached_tokens', 0) or 0
        self.calls.append({
            "label": label,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cached_input_tokens": cached_input,
        })

    def summary(self) -> dict:
        total_input = sum(c["input_tokens"] for c in self.calls)
        total_output = sum(c["output_tokens"] for c in self.calls)
        total_cached = sum(c["cached_input_tokens"] for c in self.calls)
        total_tokens = total_input + total_output

        # Calculate cost
        total_cost = 0
        for c in self.calls:
            p = PRICING.get(c["model"], PRICING["gpt-4o-mini"])
            uncached_input = c["input_tokens"] - c["cached_input_tokens"]
            cost = (uncached_input / 1_000_000 * p["input"]
                   + c["cached_input_tokens"] / 1_000_000 * p["cached_input"]
                   + c["output_tokens"] / 1_000_000 * p["output"])
            total_cost += cost

        return {
            "total_tokens": total_tokens,
            "input_tokens": total_input,
            "output_tokens": total_output,
            "cached_input_tokens": total_cached,
            "total_cost_usd": round(total_cost, 6),
            "calls": self.calls,
        }


# ─── Pydantic Models ──────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    ticker: str

class ResolveRequest(BaseModel):
    query: str

class QuotesRequest(BaseModel):
    tickers: list[str]


# ─── Helper ────────────────────────────────────────────────────────────────────
def _fmt(val, prefix="", suffix="", decimals=2, scale=1):
    if val is None:
        return "N/A"
    try:
        return f"{prefix}{float(val) * scale:.{decimals}f}{suffix}"
    except Exception:
        return str(val)


# ─── AI Commentary ────────────────────────────────────────────────────────────
def generate_ai_commentary(analysis: dict, tracker: TokenTracker) -> str | None:
    if not _openai_client:
        return None

    f   = analysis.get("fundamentals", {})
    sig = analysis.get("signal", {})
    dcf = analysis.get("dcf") or {}
    tech = analysis.get("technicals", {})
    sent = analysis.get("sentiment", {})
    fs  = sig.get("factor_scores", {})
    sc  = dcf.get("scenarios", {})
    adv = analysis.get("advanced_metrics", {})
    vol = adv.get("volatility", {})
    flow = adv.get("institutional_flow", {})
    mac = adv.get("macro", {})
    conv = adv.get("convergence", {})

    headlines = sent.get("top_headlines", [])[:3]
    hl_block = "\n".join(
        f'  [{h["score"]:+.2f}] "{h["title"][:70]}" ({h["publisher"]})'
        for h in headlines
    ) or "  No headlines available"

    prompt = f"""You are a senior equity analyst writing a thorough but concise investment summary.

== COMPANY ==
Name:      {analysis.get('company_name')} ({analysis.get('ticker')})
Sector:    {analysis.get('sector')} / {analysis.get('industry')}

== VALUATION & TARGETS ==
Current price:       {_fmt(f.get('price'), '$')}
DCF Fair Value:      {_fmt(analysis.get('fair_value'), '$')}
DCF Upside:          {_fmt(sig.get('upside_pct'), suffix='%')}
Momentum Signal:     {sig.get('momentum_signal')}
Momentum Target:     {_fmt(sig.get('momentum_target'), '$')} (Driven by growth hype & technical trends)
Intrinsic/share:     {_fmt(dcf.get('intrinsic_per_share'), '$')}
FCF growth used:     {_fmt(dcf.get('fcf_growth_rate_used'), suffix='%', decimals=1)}
WACC:                {_fmt(dcf.get('discount_rate'), suffix='%', scale=100, decimals=0)}
Scenarios → Optimistic: {_fmt(sc.get('optimistic'), '$')} | Base: {_fmt(sc.get('base'), '$')} | Conservative: {_fmt(sc.get('conservative'), '$')}
Free Cash Flow:      {_fmt(analysis.get('latest_fcf'), '$', 'B', scale=1/1e9, decimals=1)}

== FUNDAMENTALS ==
Forward P/E:         {_fmt(f.get('forward_pe'), decimals=1)}
Trailing P/E:        {_fmt(f.get('pe_ratio'), decimals=1)}
PEG Ratio:           {_fmt(f.get('peg_ratio'), decimals=2)}
EV/EBITDA:           {_fmt(f.get('ev_ebitda'), decimals=1)}x
EPS (TTM):           {_fmt(f.get('eps_ttm'), '$')}
ROE:                 {_fmt(f.get('roe'), suffix='%', scale=100, decimals=1)}
Net Margin:          {_fmt(f.get('net_margin'), suffix='%', scale=100, decimals=1)}
Revenue Growth:      {_fmt(f.get('revenue_growth'), suffix='%', scale=100, decimals=1)}
Earnings Growth:     {_fmt(f.get('earnings_growth'), suffix='%', scale=100, decimals=1)}
Debt/Equity:         {_fmt(f.get('debt_to_equity'), decimals=2)}
Beta:                {_fmt(f.get('beta'), decimals=2)}
52-week range:       {_fmt(f.get('week_52_low'), '$')} – {_fmt(f.get('week_52_high'), '$')}
Market Cap:          {_fmt(f.get('market_cap'), '$', 'B', scale=1/1e9, decimals=1)}

== TECHNICAL INDICATORS ==
RSI(14):             {_fmt(tech.get('rsi_14'), decimals=1)} → {sig.get('rsi_signal', 'N/A')}
SMA Trend:           {sig.get('sma_signal', 'N/A')}
MACD:                {sig.get('macd_signal', 'N/A')}

== ADVANCED INSIGHTS ==
Volatility (30D):    {_fmt(vol.get('implied_volatility'), suffix='%')} | vs 1Y: {_fmt(vol.get('vol_diff_pct'), suffix='%')}
Whale Activity:      {flow.get('flow_status', 'N/A')} (Net Flow: {_fmt(flow.get('net_flow_usd', 0)/1e6, '$', 'M')})
Macro Sentiment:     {mac.get('overall', 'N/A')} (Rates: {mac.get('rates')} / Inflation: {mac.get('inflation')})
AI Convergence:      {conv.get('status', 'N/A')} ({conv.get('bullish')}/{conv.get('total')} Indicators Bullish)

== 5-FACTOR SIGNAL SCORES (range -2 to +2) ==
DCF Valuation (25%): {_fmt(fs.get('dcf'), decimals=2)}
P/E Ratio (20%):     {_fmt(fs.get('pe'), decimals=2)}
PEG Ratio (15%):     {_fmt(fs.get('peg'), decimals=2)}
EV/EBITDA (15%):     {_fmt(fs.get('ev_ebitda'), decimals=2)}
Technicals (25%):    {_fmt(fs.get('technical'), decimals=2)}
→ COMPOSITE:         {_fmt(sig.get('composite_score'), decimals=3)}  → {sig.get('overall')}

== NEWS SENTIMENT ==
Score: {_fmt(sent.get('sentiment_score'), decimals=3)} ({sent.get('sentiment_label')})
{sent.get('summary', '')}
Top headlines:
{hl_block}

== YOUR TASK ==
Write a structured investment analysis in JSON format.
You must return a valid JSON object with the following exact keys:
{{
  "signal": "One of: STRONG BUY, BUY, HOLD, SELL, STRONG SELL. Base this strictly on your synthesized analysis of all data provided.",
  "score": "An integer from 0 to 100 representing your conviction in the stock's overall health and upside.",
  "momentum_signal": "One of: STRONG BULLISH, BULLISH, NEUTRAL, BEARISH, STRONG BEARISH.",
  "summary": "1 sentence high-level overview of the verdict.",
  "pros": ["Pro point 1", "Pro point 2", "Pro point 3"],
  "cons": ["Con point 1", "Con point 2", "Con point 3"],
  "reasoning": "A 2-3 sentence flowing paragraph explaining the verdict based on valuation, momentum target, advanced insights (Whale activity, volatility, macro conditions, and AI Convergence status), operations, and risks. YOU MUST EXPLICITLY MENTION THE MOMENTUM TARGET AND THE AI CONVERGENCE CONCENSUS."
}}
Output ONLY valid JSON.
"""

    try:
        resp = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=600,
            temperature=0.35,
        )
        tracker.track("AI Commentary", "gpt-4o-mini", resp.usage)
        return json.loads(resp.choices[0].message.content.strip())
    except Exception as e:
        print(f"OpenAI error: {e}")
        return None


# ─── Multi-Search DCF Research (Perplexity-style) ─────────────────────────────
SEARCH_QUERIES = [
    # Query 1: FCF projections
    "{company} ({ticker}) free cash flow projections next 5 years analyst estimates FCF forecast",
    # Query 2: DCF valuation
    "{company} ({ticker}) DCF valuation fair value per share intrinsic value discounted cash flow",
    # Query 3: WACC & financials
    "{company} ({ticker}) WACC weighted average cost of capital beta cost of equity discount rate",
    # Query 4: Balance sheet
    "{company} ({ticker}) balance sheet total cash total debt net cash shares outstanding diluted",
    # Query 5: Revenue & growth outlook
    "{company} ({ticker}) revenue projections earnings growth outlook analyst consensus target price",
]

def _run_single_search(client, query: str, idx: int, tracker: TokenTracker) -> str:
    """Run a single web search and return the text."""
    try:
        resp = client.responses.create(
            model="gpt-4o-mini",
            input=query,
            tools=[{"type": "web_search_preview"}],
        )
        tracker.track(f"Web Search #{idx+1}", "gpt-4o-mini", resp.usage)
        return resp.output_text or ""
    except Exception as e:
        print(f"   ⚠️ Search #{idx+1} failed: {e}")
        return ""


def fetch_dcf_research(ticker: str, company_name: str, latest_fcf: float,
                       sector: str, tracker: TokenTracker) -> dict | None:
    """
    Multi-search approach: 5 separate web searches → merge → parse into structured JSON.
    Similar to how Perplexity uses 20+ searches for deep research.
    """
    if not _openai_client:
        return None

    fcf_b = latest_fcf / 1e9 if latest_fcf else 0

    # ── Step 1: Run 5 parallel web searches ────────────────────────────────
    print(f"🔍 Running 5 web searches for {ticker} DCF data...")
    queries = [q.format(company=company_name, ticker=ticker) for q in SEARCH_QUERIES]

    # Use ThreadPoolExecutor for parallel searches
    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [
            executor.submit(_run_single_search, _openai_client, q, i, tracker)
            for i, q in enumerate(queries)
        ]
        for i, future in enumerate(futures):
            try:
                text = future.result(timeout=60)
                if text:
                    results.append(f"=== SOURCE {i+1} ({['FCF Projections','DCF Valuation','WACC & Financials','Balance Sheet','Growth Outlook'][i]}) ===\n{text}")
                    print(f"   ✅ Search #{i+1}: {len(text)} chars")
            except Exception as e:
                print(f"   ⚠️ Search #{i+1} timed out: {e}")

    if not results:
        print("⚠️  All web searches failed")
        return None

    merged_research = "\n\n".join(results)
    print(f"📄 Merged research: {len(merged_research)} chars from {len(results)}/5 searches")

    # ── Step 2: Parse merged research into structured JSON ─────────────────
    parse_prompt = f"""You are a senior equity research analyst extracting DCF parameters from multiple sources about {company_name} ({ticker}).

=== MERGED RESEARCH ===
{merged_research}
=== END RESEARCH ===

The trailing 12-month Free Cash Flow is ${fcf_b:.1f}B.
Sector: {sector}

CRITICAL EXTRACTION RULES:
1. **Use FORWARD-LOOKING analyst estimates** for FCF — NOT the trailing TTM figure. Analysts often project significantly higher FCFs for high-growth companies.
2. **projected_fcfs must reflect ANALYST CONSENSUS estimates** from the sources. For high-growth companies (AI, cloud, semiconductors), near-term FCFs can grow 40-60%+ annually before tapering.
3. If sources mention revenue projections but not FCFs directly, estimate FCFs using the company's current FCF margin applied to projected revenues.
4. Cross-reference multiple sources. If different sources disagree, use the MEDIAN value.
5. ALL 5 projected_fcfs entries MUST be positive, non-zero dollar amounts.
6. For **terminal_growth_rate**: use 3-4% for large tech companies (not 2.5%).
7. For **net_cash_debt**: positive = net cash, negative = net debt. Use the most recent balance sheet.
8. For **shares_outstanding**: use DILUTED share count.

Return a JSON object with EXACTLY these keys:
{{
  "projected_fcfs": [<5 numbers: projected annual FCF in USD for years 1-5, e.g. [97e9, 158e9, 198e9, 247e9, 272e9]>],
  "fcf_growth_rate": <decimal, implied CAGR across the 5 years, e.g. 0.25>,
  "wacc": <decimal, e.g. 0.10 for 10%. null if not found>,
  "terminal_growth_rate": <decimal, e.g. 0.04 for 4%. null if not found>,
  "net_cash_debt": <number in USD. Positive=net cash, negative=net debt. 0 if unknown>,
  "shares_outstanding": <diluted share count. 0 if unknown>,
  "analyst_source": "<comma-separated list of sources>",
  "confidence": "<high/medium/low>",
  "reasoning": "<2-3 sentence rationale covering why these FCF projections make sense given the company's growth trajectory>"
}}

Return ONLY the JSON object."""

    try:
        print(f"📊 Parsing {len(results)} sources into structured DCF parameters...")
        parse_response = _openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": parse_prompt}],
            response_format={"type": "json_object"},
            max_tokens=800,
            temperature=0.15,
        )
        tracker.track("DCF Parse (multi-source)", "gpt-4o", parse_response.usage)

        raw_json = parse_response.choices[0].message.content.strip()
        result = json.loads(raw_json)

        print(f"✅ DCF research for {ticker}: "
              f"fcf_growth={result.get('fcf_growth_rate')}, "
              f"wacc={result.get('wacc')}, "
              f"terminal={result.get('terminal_growth_rate')}, "
              f"confidence={result.get('confidence')}, "
              f"source={result.get('analyst_source')}")
        return result

    except Exception as e:
        print(f"⚠️  DCF JSON parsing failed: {e}")
        return None


# ─── Ticker Resolution ─────────────────────────────────────────────────────
def resolve_ticker(query: str) -> dict:
    """Resolve a company name or partial ticker to a valid ticker symbol."""
    import yfinance as yf

    q = query.strip().upper()

    # If it looks like a ticker already (1-5 uppercase letters), try directly
    if len(q) <= 5 and q.isalpha():
        try:
            t = yf.Ticker(q)
            info = t.info or {}
            name = info.get("longName") or info.get("shortName")
            if name:
                return {"ticker": q, "name": name, "resolved": True}
        except Exception:
            pass

    # Otherwise use yfinance search
    try:
        from urllib.parse import quote
        import requests

        # Use Yahoo Finance search API
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={quote(query)}&quotesCount=5&newsCount=0"
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            quotes = data.get("quotes", [])
            for q in quotes:
                if q.get("quoteType") in ("EQUITY", "ETF"):
                    return {
                        "ticker": q.get("symbol"),
                        "name": q.get("longname") or q.get("shortname") or q.get("symbol"),
                        "exchange": q.get("exchange"),
                        "resolved": True,
                    }
    except Exception as e:
        print(f"⚠️ Ticker resolution failed: {e}")

    return {"ticker": query.upper().strip(), "name": None, "resolved": False}


# ─── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "SmartTrader API",
        "ai_enabled": _openai_client is not None,
    }


@app.post("/resolve")
async def resolve(req: ResolveRequest):
    """Resolve a company name (e.g. 'Tesla') to its ticker (TSLA)."""
    result = resolve_ticker(req.query)
    return result


@app.post("/quotes")
async def get_quotes(req: QuotesRequest):
    """Fetch current prices for a list of tickers using yfinance."""
    import yfinance as yf
    if not req.tickers:
        return {}
    
    try:
        # yfinance.Tickers expects a space-separated string or a list of strings
        # We need to use req.tickers directly instead of string joining
        data = yf.Tickers(" ".join([t.upper().strip() for t in req.tickers]))
        
        prices = {}
        for ticker in req.tickers:
            t_upper = ticker.upper().strip()
            try:
                # the dictionary returned by Tickers uses upper-cased keys
                t_obj = data.tickers.get(t_upper)
                if t_obj:
                    # sometimes fast_info is a dict-like object
                    if hasattr(t_obj.fast_info, 'last_price'):
                         prices[t_upper] = float(t_obj.fast_info.last_price)
                    else:
                         prices[t_upper] = float(t_obj.fast_info.get("last_price"))
                else:
                    prices[t_upper] = None
            except Exception as e:
                prices[t_upper] = None
        return prices
    except Exception as e:
        print(f"⚠️  /quotes error: {e}")
        return {}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    raw_input = req.ticker.strip()
    if not raw_input or len(raw_input) > 50:
        raise HTTPException(status_code=400, detail="Invalid ticker / company name.")

    # ── Resolve company name to ticker ─────────────────────────────────────
    # If input has spaces or is > 5 chars, try to resolve as company name
    if len(raw_input) > 5 or ' ' in raw_input:
        resolved = resolve_ticker(raw_input)
        ticker = resolved.get("ticker", raw_input.upper())
        if resolved.get("resolved"):
            print(f"🔍 Resolved '{raw_input}' → {ticker} ({resolved.get('name')})")
    else:
        ticker = raw_input.upper()

    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Could not resolve ticker symbol.")

    # ── Token tracker for this request ─────────────────────────────────────
    tracker = TokenTracker()

    try:
        analysis = analyze_stock(ticker)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

    # ── Multi-Search DCF ───────────────────────────────────────────────────
    dcf_research = None
    web_enriched = False
    latest_fcf = analysis.get("latest_fcf", 0)

    if _openai_client and latest_fcf and latest_fcf > 0:
        dcf_research = fetch_dcf_research(
            ticker=ticker,
            company_name=analysis.get("company_name", ticker),
            latest_fcf=latest_fcf,
            sector=analysis.get("sector", "N/A"),
            tracker=tracker,
        )

        if (dcf_research
                and dcf_research.get("confidence") in ("high", "medium")):
            import numpy as np
            from analyzer import calculate_dcf, determine_signal, SECTOR_WACC, DEFAULT_WACC, TERMINAL_GROWTH_RATE

            # FCF growth: use web-researched, clamp to [-10%, +60%]
            raw_growth = dcf_research.get("fcf_growth_rate", 0.15)
            web_growth = float(np.clip(raw_growth if raw_growth else 0.15, -0.10, 0.60))

            # Year-by-year projected FCFs from web research
            projected_fcf_list = dcf_research.get("projected_fcfs")
            TARGET_YEARS = 5
            if projected_fcf_list and isinstance(projected_fcf_list, list):
                try:
                    projected_fcf_list = [float(x) for x in projected_fcf_list if x and float(x) > 0]
                except (ValueError, TypeError):
                    projected_fcf_list = None

                if projected_fcf_list and len(projected_fcf_list) >= 2:
                    if len(projected_fcf_list) < TARGET_YEARS:
                        first_val = projected_fcf_list[0]
                        last_val = projected_fcf_list[-1]
                        n_available = len(projected_fcf_list)
                        if first_val > 0:
                            cagr = (last_val / first_val) ** (1 / max(n_available - 1, 1)) - 1
                            taper_factor = 0.7
                            while len(projected_fcf_list) < TARGET_YEARS:
                                yr_growth = cagr * taper_factor
                                next_fcf = projected_fcf_list[-1] * (1 + yr_growth)
                                projected_fcf_list.append(next_fcf)
                                taper_factor *= 0.85
                            print(f"   🌐 Extrapolated to {TARGET_YEARS} years (CAGR: {cagr:.1%})")

                    print(f"   🌐 Using {len(projected_fcf_list)} year-by-year FCF projections: "
                          f"{[f'${x/1e9:.1f}B' for x in projected_fcf_list]}")
                else:
                    projected_fcf_list = None
            else:
                projected_fcf_list = None

            # WACC
            sector = analysis.get("sector", "N/A")
            default_wacc = SECTOR_WACC.get(sector, DEFAULT_WACC)
            web_wacc = dcf_research.get("wacc")
            if web_wacc is not None and 0.04 <= float(web_wacc) <= 0.20:
                wacc = float(web_wacc)
                print(f"   🌐 Using web WACC: {wacc:.1%} (default was {default_wacc:.1%})")
            else:
                wacc = default_wacc

            # Terminal growth
            web_terminal = dcf_research.get("terminal_growth_rate")
            if web_terminal is not None and 0.01 <= float(web_terminal) <= 0.06:
                terminal_growth = float(web_terminal)
                print(f"   🌐 Using web terminal growth: {terminal_growth:.1%}")
            else:
                terminal_growth = TERMINAL_GROWTH_RATE

            # Net cash/debt
            net_cash_debt = float(dcf_research.get("net_cash_debt", 0) or 0)
            if net_cash_debt == 0:
                yf_net_cash = analysis["fundamentals"].get("net_cash_debt", 0) or 0
                if yf_net_cash != 0:
                    net_cash_debt = float(yf_net_cash)
                    print(f"   📊 Using Yahoo Finance net cash/debt: ${net_cash_debt/1e9:.1f}B")
            else:
                print(f"   🌐 Net cash/debt: ${net_cash_debt/1e9:.1f}B")

            # Shares outstanding
            yf_shares = analysis["fundamentals"].get("shares_outstanding", 0) or 0
            web_shares = dcf_research.get("shares_outstanding", 0) or 0
            price = analysis["fundamentals"].get("price", 0)
            shares = analysis["fundamentals"].get("market_cap", 0)

            if yf_shares and int(yf_shares) > 100_000_000:
                shares_outstanding = int(yf_shares)
            elif web_shares and int(web_shares) > 100_000_000:
                shares_outstanding = int(web_shares)
                print(f"   🌐 Using web shares outstanding: {shares_outstanding/1e9:.2f}B")
            else:
                shares_outstanding = int(shares / price) if shares and price else 0

            if shares_outstanding > 0:
                new_dcf = calculate_dcf(
                    latest_fcf=latest_fcf,
                    shares_outstanding=shares_outstanding,
                    fcf_growth_rate=web_growth,
                    discount_rate=wacc,
                    terminal_growth=terminal_growth,
                    projected_fcf_list=projected_fcf_list,
                    net_cash_debt=net_cash_debt,
                )
                new_fair_value = new_dcf["fair_value_with_mos"]

                # Sanity check: reject clearly wrong fair values
                if new_fair_value <= 0 or (price and new_fair_value < price * 0.05):
                    print(f"⚠️  DCF sanity check FAILED: FV ${new_fair_value:.2f} is invalid "
                          f"(price=${price:.2f}). Keeping original DCF.")
                else:
                    technicals = analysis.get("technicals", {})
                    new_signal = determine_signal(
                        current_price=price,
                        fair_value=new_fair_value,
                        rsi=technicals.get("rsi_14", 50),
                        sma50=technicals.get("sma_50"),
                        sma200=technicals.get("sma_200"),
                        macd={
                            "macd": technicals.get("macd"),
                            "signal": technicals.get("macd_signal"),
                            "histogram": technicals.get("macd_histogram"),
                            "bullish": technicals.get("macd_bullish", False),
                        },
                        fundamentals=analysis["fundamentals"],
                        week_52_high=analysis["fundamentals"].get("week_52_high"),
                        week_52_low=analysis["fundamentals"].get("week_52_low"),
                    )

                    analysis["dcf"] = new_dcf
                    analysis["fair_value"] = new_fair_value
                    analysis["signal"] = new_signal
                    web_enriched = True
                    yrs = new_dcf.get("projection_years", 5)
                    print(f"✅ DCF re-run ({yrs}yr): growth={new_dcf['fcf_growth_rate_used']:.1f}%, wacc={wacc:.1%}, "
                          f"terminal={terminal_growth:.1%}, net_cash=${net_cash_debt/1e9:.1f}B → FV ${new_fair_value:.2f}")

    # ── AI commentary ──────────────────────────────────────────────────────
    ai_commentary = generate_ai_commentary(analysis, tracker)

    chart_data = analysis.pop("chart_data", [])

    return {
        **analysis,
        "ai_commentary": ai_commentary,
        "chart_data": chart_data,
        "dcf_research": dcf_research,
        "web_enriched": web_enriched,
        "token_usage": tracker.summary(),
    }

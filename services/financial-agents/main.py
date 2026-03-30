"""
Financial Agents Microservice
Wraps TradingAgents (TauricResearch) and FinRobot (AI4Finance-Foundation)
for async per-ticker analysis. Runs on Railway, POSTs results back to
a CentrePlace webhook when done.

Also wraps the ai-hedge-fund LangGraph pipeline (virattt) which runs 18
investor-persona agents and produces per-ticker signals plus a portfolio decision.
"""

import asyncio
import os
import sys
import traceback
from datetime import datetime
from typing import Any

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

app = FastAPI(title="Financial Agents Service")


# ── Request / Response models ────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    job_id: str
    tickers: list[str]
    webhook_url: str
    webhook_secret: str
    analysis_date: str  # YYYY-MM-DD, e.g. "2025-03-27"


class AnalyzeResponse(BaseModel):
    status: str
    job_id: str


class HedgeFundRequest(BaseModel):
    job_id: str
    tickers: list[str]
    webhook_url: str
    webhook_secret: str
    analysis_date: str  # YYYY-MM-DD — used as end_date; start_date = 3 months prior


# ── TradingAgents helper ─────────────────────────────────────────────────────

def run_trading_agents_for_ticker(ticker: str, analysis_date: str) -> dict[str, Any]:
    """
    Run TradingAgents multi-agent pipeline for a single ticker.
    Returns a dict with the key state reports and final decision.
    Raises on hard failure; caller should catch.
    """
    from tradingagents.graph.trading_graph import TradingAgentsGraph
    from tradingagents.default_config import DEFAULT_CONFIG

    config = {
        **DEFAULT_CONFIG,
        "llm_provider": "anthropic",
        "backend_url": "https://api.anthropic.com/v1",
        "deep_think_llm": os.environ.get("DEEP_THINK_MODEL", "claude-opus-4-6"),
        "quick_think_llm": os.environ.get("QUICK_THINK_MODEL", "claude-haiku-4-5-20251001"),
        "max_debate_rounds": 1,       # keep latency reasonable
        "online_tools": True,
    }

    ta = TradingAgentsGraph(debug=False, config=config)
    state, decision = ta.propagate(ticker, analysis_date)

    return {
        "source": "TradingAgents",
        "decision": decision,
        "fundamentals_report": state.get("fundamentals_report") or "",
        "sentiment_report": state.get("sentiment_report") or "",
        "news_report": state.get("news_report") or "",
        "market_research_report": state.get("market_research_report") or "",
        "investment_debate": state.get("investment_debate_state") or {},
        "risk_debate": state.get("risk_debate_state") or {},
        "final_trade_decision": state.get("final_trade_decision") or decision,
    }


# ── FinRobot helper ──────────────────────────────────────────────────────────

def run_finrobot_for_ticker(ticker: str) -> dict[str, Any]:
    """
    Run FinRobot equity research report for a single ticker.
    FinRobot uses AutoGen under the hood — requires ANTHROPIC_API_KEY.
    Returns a dict with the research report text.
    FinRobot is supplementary; failures are captured and returned rather than raised.
    """
    ticker_result: dict[str, Any] = {"source": "FinRobot"}
    try:
        import autogen
        from finrobot.agents.workflow import SingleAssistantShadow
        from finrobot.functional import (
            get_stock_financials,
            get_company_profile,
        )

        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        config_list = [
            {
                "model": os.environ.get("DEEP_THINK_MODEL", "claude-opus-4-6"),
                "api_key": api_key,
                "base_url": "https://api.anthropic.com/v1",
            }
        ]
        llm_config = {
            "config_list": config_list,
            "temperature": 0,
            "timeout": 120,
        }

        # Build a research prompt
        today = datetime.now().strftime("%B %d, %Y")
        prompt = (
            f"You are a senior equity research analyst. As of {today}, produce a concise "
            f"investment research summary for {ticker} covering: (1) business overview, "
            f"(2) recent financial performance, (3) valuation, (4) key risks, "
            f"(5) overall investment thesis and recommendation (Buy / Hold / Sell). "
            f"Use available financial data tools. Be specific with numbers."
        )

        # Use SingleAssistantShadow which wraps AutoGen with FinRobot tooling
        assistant = SingleAssistantShadow(
            name="FinRobotAnalyst",
            llm_config=llm_config,
            max_consecutive_auto_reply=5,
            human_input_mode="NEVER",
        )

        user_proxy = autogen.UserProxyAgent(
            name="User",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=0,
            code_execution_config=False,
        )

        user_proxy.initiate_chat(assistant, message=prompt, clear_history=True)

        # Extract the last assistant message as the report
        chat_history = assistant.chat_messages.get(user_proxy, [])
        report = ""
        for msg in reversed(chat_history):
            if msg.get("role") == "assistant":
                report = msg.get("content", "")
                break

        ticker_result["research_report"] = report
    except Exception as e:
        ticker_result["error"] = str(e)

    return ticker_result


# ── Background analysis job ──────────────────────────────────────────────────

async def run_analysis_job(req: AnalyzeRequest) -> None:
    """
    Runs in a background thread pool. Analyses each ticker sequentially
    (TradingAgents is CPU+IO bound), then POSTs results to the webhook.
    """
    results: dict[str, Any] = {}

    for ticker in req.tickers:
        ticker_result: dict[str, Any] = {}

        # ── TradingAgents ────────────────────────────────────────────────────
        try:
            loop = asyncio.get_event_loop()
            ta_result = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    run_trading_agents_for_ticker,
                    ticker,
                    req.analysis_date,
                ),
                timeout=120.0,
            )
            ticker_result["tradingAgents"] = ta_result
        except asyncio.TimeoutError:
            ticker_result["tradingAgents"] = {"error": "TradingAgents timed out after 120s"}
        except Exception as exc:
            ticker_result["tradingAgents"] = {"error": str(exc), "traceback": traceback.format_exc()}

        # ── FinRobot (equity only — skip bonds, cash, etc.) ─────────────────
        # FinRobot is optional: if the import fails (not installed / missing
        # dependencies) we silently skip it for this ticker.
        try:
            loop = asyncio.get_event_loop()
            fr_result = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    run_finrobot_for_ticker,
                    ticker,
                ),
                timeout=90.0,
            )
            ticker_result["finRobot"] = fr_result
        except asyncio.TimeoutError:
            ticker_result["finRobot"] = {"error": "FinRobot timed out after 90s"}
        except ImportError:
            # FinRobot not installed — skip silently
            pass
        except Exception as exc:
            ticker_result["finRobot"] = {"error": str(exc)}

        results[ticker] = ticker_result

    # ── POST results back to CentrePlace webhook ─────────────────────────────
    payload = {
        "job_id": req.job_id,
        "status": "completed",
        "results": results,
        "completed_at": datetime.utcnow().isoformat() + "Z",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                req.webhook_url,
                json=payload,
                headers={
                    "x-agent-webhook-secret": req.webhook_secret,
                    "content-type": "application/json",
                },
            )
            resp.raise_for_status()
    except Exception as exc:
        # Log but don't crash — the job already ran
        print(f"[webhook] Failed to POST results for job {req.job_id}: {exc}")


# ── ai-hedge-fund helper ─────────────────────────────────────────────────────

def run_hedge_fund_pipeline(tickers: list[str], start_date: str, end_date: str) -> dict[str, Any]:
    """
    Run the ai-hedge-fund LangGraph pipeline for the given tickers.
    The hedge_fund_src/ directory (copied from virattt/ai-hedge-fund src/) must
    be present in /app. We temporarily insert /app into sys.path so that
    hedge_fund_src's internal imports (from src.agents.* etc.) resolve as
    expected by re-aliasing the package name.

    Returns the raw dict from run_hedge_fund: { decisions, analyst_signals }
    """
    # The ai-hedge-fund repo imports everything from "src.*". After copying
    # src/ to hedge_fund_src/ we inject a sys.modules alias so those imports
    # continue to work without patching any upstream files.
    import importlib
    import types

    app_dir = "/app"
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)

    # Create a "src" alias pointing to hedge_fund_src if not already present
    if "src" not in sys.modules:
        hedge_fund_src = importlib.import_module("hedge_fund_src")
        sys.modules["src"] = hedge_fund_src

    from src.main import run_hedge_fund  # noqa: E402

    # Build a minimal portfolio dict (no existing positions — pure signal run)
    portfolio = {
        "cash": 100_000.0,
        "positions": {ticker: {"long": 0, "short": 0, "long_cost_basis": 0.0, "short_cost_basis": 0.0} for ticker in tickers},
        "realized_gains": {ticker: {"long": 0.0, "short": 0.0} for ticker in tickers},
    }

    result = run_hedge_fund(
        tickers=tickers,
        start_date=start_date,
        end_date=end_date,
        portfolio=portfolio,
        show_reasoning=False,
        selected_analysts=[],   # empty = all analysts
        model_name="claude-sonnet-4-6",
        model_provider="Anthropic",
    )
    return result


# ── Background hedge-fund job ────────────────────────────────────────────────

async def run_hedge_fund_job(req: HedgeFundRequest) -> None:
    """
    Runs the ai-hedge-fund LangGraph pipeline in a background thread, then
    POSTs results back to the CentrePlace webhook.

    Result shape POSTed to webhook:
    {
      job_id, status, completed_at,
      results: {
        [ticker]: {
          signal: "bullish"|"bearish"|"neutral",
          conviction: 0-100,
          reasoning: str,
          agentSignals: {
            [agentName]: { signal, conviction, reasoning }
          }
        }
      },
      portfolioDecision: {
        [ticker]: { action, quantity, confidence, reasoning }
      }
    }
    """
    # Derive a 3-month look-back window from analysis_date
    from datetime import date, timedelta
    end_dt = datetime.strptime(req.analysis_date, "%Y-%m-%d").date()
    # Approximate 3 months as 91 days
    start_dt = end_dt - timedelta(days=91)
    start_date = start_dt.strftime("%Y-%m-%d")
    end_date = req.analysis_date

    raw: dict[str, Any] = {}
    error_msg: str | None = None

    try:
        loop = asyncio.get_event_loop()
        raw = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                run_hedge_fund_pipeline,
                req.tickers,
                start_date,
                end_date,
            ),
            timeout=600.0,  # 10 min ceiling — the pipeline is slow
        )
    except asyncio.TimeoutError:
        error_msg = "Hedge fund pipeline timed out after 600s"
    except Exception as exc:
        error_msg = f"{exc}\n{traceback.format_exc()}"

    if error_msg:
        payload = {
            "job_id": req.job_id,
            "status": "failed",
            "error": error_msg,
            "completed_at": datetime.utcnow().isoformat() + "Z",
        }
    else:
        # raw = { "decisions": { TICKER: { action, quantity, confidence, reasoning } },
        #         "analyst_signals": { agent_name: { TICKER: { signal, confidence, reasoning } } } }
        decisions: dict[str, Any] = raw.get("decisions") or {}
        analyst_signals: dict[str, Any] = raw.get("analyst_signals") or {}

        # Reshape analyst_signals from { agent: { ticker: {...} } }
        #                           to { ticker: { agentSignals: { agent: {...} } } }
        per_ticker: dict[str, Any] = {}
        for ticker in req.tickers:
            ticker_upper = ticker.upper()
            agent_map: dict[str, Any] = {}
            for agent_name, ticker_map in analyst_signals.items():
                if ticker_upper in ticker_map:
                    sig = ticker_map[ticker_upper]
                    agent_map[agent_name] = {
                        "signal": sig.get("signal", "neutral"),
                        "conviction": sig.get("confidence", 0),
                        "reasoning": sig.get("reasoning", ""),
                    }

            # Derive a top-level signal for this ticker by majority vote
            signals = [v["signal"] for v in agent_map.values() if v.get("signal")]
            bullish = signals.count("bullish")
            bearish = signals.count("bearish")
            if bullish > bearish:
                top_signal = "bullish"
            elif bearish > bullish:
                top_signal = "bearish"
            else:
                top_signal = "neutral"

            convictions = [v["conviction"] for v in agent_map.values() if isinstance(v.get("conviction"), (int, float))]
            avg_conviction = int(sum(convictions) / len(convictions)) if convictions else 0

            per_ticker[ticker_upper] = {
                "signal": top_signal,
                "conviction": avg_conviction,
                "reasoning": f"{bullish} bullish / {bearish} bearish across {len(signals)} analysts",
                "agentSignals": agent_map,
            }

        payload = {
            "job_id": req.job_id,
            "status": "completed",
            "results": per_ticker,
            "portfolioDecision": decisions,
            "completed_at": datetime.utcnow().isoformat() + "Z",
        }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                req.webhook_url,
                json=payload,
                headers={
                    "x-agent-webhook-secret": req.webhook_secret,
                    "content-type": "application/json",
                },
            )
            resp.raise_for_status()
    except Exception as exc:
        print(f"[webhook] Failed to POST hedge-fund results for job {req.job_id}: {exc}")


# ── Routes ───────────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks) -> AnalyzeResponse:
    """
    Accepts a list of tickers and schedules background analysis.
    Returns immediately with job_id; results arrive via webhook.
    """
    if not req.tickers:
        raise HTTPException(status_code=400, detail="tickers list is empty")
    if len(req.tickers) > 20:
        raise HTTPException(status_code=400, detail="max 20 tickers per job")

    background_tasks.add_task(run_analysis_job, req)
    return AnalyzeResponse(status="queued", job_id=req.job_id)


@app.post("/hedge-fund", response_model=AnalyzeResponse)
async def hedge_fund(req: HedgeFundRequest, background_tasks: BackgroundTasks) -> AnalyzeResponse:
    """
    Accepts a list of tickers and schedules the ai-hedge-fund LangGraph pipeline
    in the background. Returns immediately with job_id; results arrive via webhook.
    """
    if not req.tickers:
        raise HTTPException(status_code=400, detail="tickers list is empty")
    if len(req.tickers) > 20:
        raise HTTPException(status_code=400, detail="max 20 tickers per hedge-fund job")

    background_tasks.add_task(run_hedge_fund_job, req)
    return AnalyzeResponse(status="queued", job_id=req.job_id)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

"""
Financial Agents Microservice
Wraps TradingAgents (TauricResearch) and FinRobot (AI4Finance-Foundation)
for async per-ticker analysis. Runs on Railway, POSTs results back to
a CentrePlace webhook when done.
"""

import asyncio
import os
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
        "llm_provider": "openai",
        "backend_url": "https://api.openai.com/v1",
        "deep_think_llm": os.environ.get("DEEP_THINK_MODEL", "gpt-4o"),
        "quick_think_llm": os.environ.get("QUICK_THINK_MODEL", "gpt-4o-mini"),
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
    FinRobot uses AutoGen under the hood — requires OPENAI_API_KEY.
    Returns a dict with the research report text.
    Raises on hard failure; caller should catch.
    """
    import autogen
    from finrobot.agents.workflow import SingleAssistantShadow
    from finrobot.functional import (
        get_stock_financials,
        get_company_profile,
    )

    api_key = os.environ.get("OPENAI_API_KEY", "")
    config_list = [
        {
            "model": os.environ.get("DEEP_THINK_MODEL", "gpt-4o"),
            "api_key": api_key,
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

    return {
        "source": "FinRobot",
        "research_report": report,
    }


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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

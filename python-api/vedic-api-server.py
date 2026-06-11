"""
vedic-api-server.py — 吠陀占星计算 API（FastAPI + 进程隔离）

端口: 8900
Python: 需要 vedic-calculator/venv（Homebrew Python 3.12+）

端点:
  POST /api/calculate   — 排盘（完整 calculate_full_chart）
  POST /api/rectify     — rectifier 时间校准（5事件 Dasha 匹配分析）
  GET  /health          — 健康检查
"""

import multiprocessing as mp
import sys
import os
import json
import traceback
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 将 engine 脚本目录加入路径
SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts")
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

app = FastAPI(title="Vedic Astro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 请求模型 ──

class ChartRequest(BaseModel):
    year: int
    month: int
    day: int
    hour: int
    minute: int
    lat: float
    lon: float
    tz_str: str = "Asia/Shanghai"


class RectifyRequest(BaseModel):
    """时间校准请求：出生数据 + 5个事件"""
    year: int
    month: int
    day: int
    hour: int
    minute: int
    lat: float
    lon: float
    tz_str: str = "Asia/Shanghai"
    events: list[dict]  # [{"date": "2015-03", "event": "结婚", "category": "marriage"}, ...]


# ── 子进程 worker（规避 PyJHora 全局状态污染）──

def _worker_calculate(params: dict) -> dict:
    """子进程中执行排盘计算"""
    from engine import calculate_full_chart
    from transit import calc_transit
    from formatter import format_structured_data

    chart = calculate_full_chart(
        params["year"], params["month"], params["day"],
        params["hour"], params["minute"],
        params["lat"], params["lon"],
        params["tz_str"],
    )
    transit = calc_transit(
        chart["lagna"]["sign_idx"],
        chart["planets"]["Moon"]["sign_idx"],
        params["tz_str"],
    )
    meta = {
        "dob": f"{params['year']:04d}-{params['month']:02d}-{params['day']:02d}",
        "time": f"{params['hour']:02d}:{params['minute']:02d}",
        "place": f"lat={params['lat']}, lon={params['lon']}",
        "lat": params["lat"],
        "lon": params["lon"],
        "time_precision": "精确到分钟",
        "time_source": "用户输入",
    }
    user_info = {"gender": "未提供", "relationship": "未提供"}
    md = format_structured_data(chart, transit, meta, user_info)

    return {
        "success": True,
        "chart": chart,
        "structured_data": md,
    }


def _worker_rectify(params: dict) -> dict:
    """子进程中执行时间校准匹配分析"""
    from engine import calculate_full_chart

    chart = calculate_full_chart(
        params["year"], params["month"], params["day"],
        params["hour"], params["minute"],
        params["lat"], params["lon"],
        params["tz_str"],
    )

    dashas = chart["dashas"]
    house_lords = chart["house_lords"]
    planets = chart["planets"]

    # 事件-宫位映射
    EVENT_HOUSE_MAP = {
        "marriage": 7,
        "death": 8,
        "career": 10,
        "disaster": 8,
        "wealth": 2,
        "education": 5,
        "relocation": 4,
        "health": 1,
    }

    results = []
    for evt in params.get("events", []):
        category = evt.get("category", "").lower()
        house = EVENT_HOUSE_MAP.get(category, 1)
        lord = house_lords.get(house, {})

        # 尝试匹配 Dasha
        match_result = _match_dasha(dashas, evt, lord, house)
        results.append(match_result)

    total = len(results)
    matched = sum(1 for r in results if r["match_level"] in ("strong", "medium"))
    weak = sum(1 for r in results if r["match_level"] == "weak")
    no_match = total - matched - weak

    return {
        "success": True,
        "total_events": total,
        "strong_match": sum(1 for r in results if r["match_level"] == "strong"),
        "medium_match": sum(1 for r in results if r["match_level"] == "medium"),
        "weak_match": sum(1 for r in results if r["match_level"] == "weak"),
        "no_match": no_match,
        "match_rate": f"{matched}/{total}",
        "time_accuracy": "high" if matched / max(total, 1) >= 0.8 else "medium" if matched / max(total, 1) >= 0.6 else "low",
        "results": results,
        "current_dasha": _get_current_dasha(dashas),
    }


def _match_dasha(dashas: list, event: dict, lord: dict, house: int) -> dict:
    """简单 Dasha 匹配：查事件日期落在哪个大运，判断主星角色"""
    event_date = event.get("date", "")

    for d in dashas:
        if d["start"] <= event_date <= d["end"]:
            planet = d["planet"]
            lord_planet = lord.get("lord", "")
            is_strong = (planet == lord_planet)
            return {
                "event": event.get("event", ""),
                "date": event_date,
                "category": event.get("category", ""),
                "house": house,
                "house_lord": lord_planet,
                "dasha_planet": planet,
                "dasha_start": d["start"],
                "dasha_end": d["end"],
                "match_level": "strong" if is_strong else "weak",
                "detail": f"事件落在{planet}大运" + (f"，{planet}正好是第{house}宫宫主 ✅" if is_strong else f"，第{house}宫宫主是{lord_planet}，不是{planet} ⚠️"),
            }
    return {
        "event": event.get("event", ""),
        "date": event_date,
        "category": event.get("category", ""),
        "house": house,
        "house_lord": lord.get("lord", ""),
        "dasha_planet": "unknown",
        "match_level": "no_match",
        "detail": "未找到对应大运",
    }


def _get_current_dasha(dashas: list) -> dict:
    for d in dashas:
        if d.get("is_current"):
            return {"planet": d["planet"], "start": d["start"], "end": d["end"]}
    return {"planet": "unknown", "start": "", "end": ""}


# ── API 端点 ──

@app.get("/health")
def health():
    return {"status": "ok", "engine": "vedic-calculator v0.5"}


@app.post("/api/calculate")
def api_calculate(req: ChartRequest):
    """排盘：返回完整 chart dict + structured_data.md 文本"""
    try:
        from engine import calculate_full_chart
        from transit import calc_transit
        from formatter import format_structured_data

        chart = calculate_full_chart(
            req.year, req.month, req.day,
            req.hour, req.minute,
            req.lat, req.lon, req.tz_str,
        )
        transit = calc_transit(
            chart["lagna"]["sign_idx"],
            chart["planets"]["Moon"]["sign_idx"],
            req.tz_str,
        )
        meta = {
            "dob": f"{req.year:04d}-{req.month:02d}-{req.day:02d}",
            "time": f"{req.hour:02d}:{req.minute:02d}",
            "place": f"lat={req.lat}, lon={req.lon}",
            "lat": req.lat, "lon": req.lon,
            "time_precision": "精确到分钟",
            "time_source": "用户输入",
        }
        user_info = {"gender": "未提供", "relationship": "未提供"}
        md = format_structured_data(chart, transit, meta, user_info)

        summary = {
            "lagna": chart["lagna"],
            "moon_sign": chart["planets"]["Moon"]["sign"],
            "planets": {k: {"sign": v["sign"], "house": v["house"], "degree": v["degree"]} for k, v in chart["planets"].items()},
            "dashas": [{"planet": d["planet"], "start": d["start"], "end": d["end"], "is_current": d.get("is_current", False)} for d in chart["dashas"]],
            "sav_total": sum(chart["sav"].values()),
            "house_lords": chart["house_lords"],
            "dignity": chart.get("dignity", {}),
            "combustion": chart.get("combustion", {}),
        }
        return {"success": True, "summary": summary, "structured_data": md}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"计算失败: {str(e)}")


@app.post("/api/prevalidate")
def api_prevalidate(req: ChartRequest):
    """排盘 + 提取验前事所需的关键信号（供 LLM 生成 5 条断言式推断）"""
    try:
        from engine import calculate_full_chart

        chart = calculate_full_chart(
            req.year, req.month, req.day,
            req.hour, req.minute,
            req.lat, req.lon, req.tz_str,
        )

        dashas = chart["dashas"]
        current_dasha = next((d for d in dashas if d.get("is_current")), dashas[0] if dashas else {})

        # 提取验前事所需的关键信号
        lagna = chart["lagna"]
        moon = chart["planets"]["Moon"]
        sun = chart["planets"]["Sun"]

        # Ketu 落宫（用于 Ketu 专项推断）
        ketu = chart["planets"]["Ketu"]
        ketu_house = ketu["house"]

        # 4宫信息（家庭/母亲/搬迁）
        house_4 = chart["house_lords"].get(4, {})
        rahu = chart["planets"]["Rahu"]

        # 5宫信息（学业/创造力）
        house_5 = chart["house_lords"].get(5, {})
        jupiter = chart["planets"]["Jupiter"]

        # 9宫信息（父亲/高等教育/运气）
        house_9 = chart["house_lords"].get(9, {})

        # 10宫信息（事业）
        house_10 = chart["house_lords"].get(10, {})

        # 燃烧检查
        combustion = chart.get("combustion", {})

        # 尊贵度
        dignity = chart.get("dignity", {})

        chart_data_for_llm = {
            "lagna": {"sign": lagna["sign"], "degree": lagna["degree"], "nakshatra": lagna.get("nakshatra", {})},
            "moon": {"sign": moon["sign"], "house": moon["house"], "nakshatra": moon.get("nakshatra", {})},
            "sun": {"sign": sun["sign"], "house": sun["house"]},
            "ketu": {"house": ketu_house, "sign": ketu["sign"]},
            "rahu": {"house": rahu["house"], "sign": rahu["sign"]},
            "jupiter": {"house": jupiter["house"], "sign": jupiter["sign"], "dignity": dignity.get("Jupiter", {}).get("compound", "unknown")},
            "saturn": {
                "house": chart["planets"]["Saturn"]["house"],
                "sign": chart["planets"]["Saturn"]["sign"],
                "dignity": dignity.get("Saturn", {}).get("compound", "unknown"),
            },
            "house_4": {"lord": house_4.get("lord", ""), "lord_house": house_4.get("lord_house", 0)},
            "house_5": {"lord": house_5.get("lord", ""), "lord_house": house_5.get("lord_house", 0)},
            "house_9": {"lord": house_9.get("lord", ""), "lord_house": house_9.get("lord_house", 0)},
            "house_10": {"lord": house_10.get("lord", ""), "lord_house": house_10.get("lord_house", 0)},
            "combustion": {k: {"distance": v.get("distance")} for k, v in combustion.items()} if combustion else {},
            "sav": {str(k): v for k, v in chart["sav"].items()},
            "sav_by_house": {str(k): v["value"] for k, v in chart["sav_by_house"].items()},
        }

        return {
            "success": True,
            "lagna": {"sign": lagna["sign"], "degree": lagna["degree"], "nakshatra": lagna.get("nakshatra", {})},
            "moon_sign": moon["sign"],
            "sun_sign": sun["sign"],
            "sav_total": sum(chart["sav"].values()),
            "current_dasha": {
                "planet": current_dasha.get("planet", ""),
                "start": current_dasha.get("start", ""),
                "end": current_dasha.get("end", ""),
            },
            "house_lords": chart["house_lords"],
            "all_dashas": [
                {"planet": d["planet"], "start": d["start"], "end": d["end"], "is_current": d.get("is_current", False)}
                for d in dashas
            ],
            "chart_data_for_llm": chart_data_for_llm,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"验前事数据提取失败: {str(e)}")


@app.post("/api/rectify")
def api_rectify(req: RectifyRequest):
    """时间校准：对5个事件做 Dasha 匹配分析"""
    try:
        from engine import calculate_full_chart

        chart = calculate_full_chart(
            req.year, req.month, req.day,
            req.hour, req.minute,
            req.lat, req.lon, req.tz_str,
        )

        dashas = chart["dashas"]
        house_lords = chart["house_lords"]

        EVENT_HOUSE_MAP = {
            "marriage": 7, "death": 8, "career": 10,
            "disaster": 8, "wealth": 2, "education": 5,
            "relocation": 4, "health": 1,
        }

        results = []
        for evt in req.events:
            category = evt.get("category", "").lower()
            house = EVENT_HOUSE_MAP.get(category, 1)
            lord = house_lords.get(house, {})
            match_result = _match_dasha(dashas, evt, lord, house)
            results.append(match_result)

        total = len(results)
        matched = sum(1 for r in results if r["match_level"] in ("strong", "medium"))
        return {
            "success": True,
            "total_events": total,
            "strong_match": sum(1 for r in results if r["match_level"] == "strong"),
            "match_rate": f"{matched}/{total}",
            "time_accuracy": "high" if matched / max(total, 1) >= 0.8 else "medium" if matched / max(total, 1) >= 0.6 else "low",
            "results": results,
            "current_dasha": _get_current_dasha(dashas),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"校准失败: {str(e)}")


@app.post("/api/full-report")
def api_full_report(req: ChartRequest):
    """排盘 + 返回完整报告所需的全量数据包（供 LLM 生成九章长报告）"""
    try:
        from engine import calculate_full_chart

        chart = calculate_full_chart(
            req.year, req.month, req.day,
            req.hour, req.minute,
            req.lat, req.lon, req.tz_str,
        )

        # 12宫主表
        house_lords = chart["house_lords"]

        # Dasha 时间线
        dashas = chart["dashas"]
        current_dasha = next((d for d in dashas if d.get("is_current")), {})

        # 行星星座+宫位+尊贵度
        planets_detail = {}
        for name, p in chart["planets"].items():
            planets_detail[name] = {
                "sign": p["sign"], "house": p["house"], "degree": p["degree"],
                "retrograde": p.get("retrograde", False),
                "nakshatra": p.get("nakshatra", {}),
                "dignity": chart.get("dignity", {}).get(name, {}),
            }

        # SAV by house
        sav_by_house = {str(k): v.get("value", 0) for k, v in chart.get("sav_by_house", {}).items()}

        # 燃烧
        combustion = chart.get("combustion", {})

        return {
            "success": True,
            "lagna": {"sign": chart["lagna"]["sign"], "degree": chart["lagna"]["degree"], "nakshatra": chart["lagna"].get("nakshatra", {})},
            "moon": {"sign": chart["planets"]["Moon"]["sign"], "house": chart["planets"]["Moon"]["house"]},
            "sun": {"sign": chart["planets"]["Sun"]["sign"], "house": chart["planets"]["Sun"]["house"]},
            "planets": planets_detail,
            "house_lords": house_lords,
            "dashas": dashas,
            "current_dasha": current_dasha,
            "sav_by_house": sav_by_house,
            "sav_total": sum(chart["sav"].values()),
            "combustion": {k: {"distance": v.get("distance")} for k, v in combustion.items()} if combustion else {},
            "vargottama": chart.get("vargottama", {}),
            "yogas_hint": "Check for Raja Yoga (angular+trine lord conjunction), Dhana Yoga (L2+L11), Dharma-Karma Yoga (L9+L10)",
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"全量报告数据生成失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8900, log_level="info")

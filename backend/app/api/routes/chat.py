from fastapi import APIRouter, Request, Form, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import google.generativeai as genai
import json
import os
import re
import pandas as pd
import numpy as np

from app.config import settings
from app.db.dataset_store import dataset_store
from app.utils import cache

router = APIRouter(prefix="/chat", tags=["NLP Chatbot (BizzBOT)"])
root_router = APIRouter(tags=["NLP Chatbot (BizzBOT)"])

class ChatMessageRequest(BaseModel):
    message: Optional[str] = None
    user_query: Optional[str] = None
    session_id: Optional[str] = "session_001"

class SampleLoadRequest(BaseModel):
    sample_type: str = "sales"

SAMPLE_DATASETS = {
    "sales": {
        "filename": "smartbiziq_sales_forecasting.csv",
        "title": "📈 Sales & Revenue Time-Series",
        "description": "Historical sales revenue, pricing, and unit demand data"
    },
    "business": {
        "filename": "sample_business_data.csv",
        "title": "🏢 Retail Business Performance",
        "description": "Store locations, marketing spend, footfall, and profit margins"
    },
    "segmentation": {
        "filename": "smartbiziq_customer_segmentation.csv",
        "title": "👥 Customer Demographics & Spending",
        "description": "Age, gender, annual income, and spending scores"
    },
    "churn": {
        "filename": "smartbiziq_customer_churn.csv",
        "title": "⚠️ Customer Churn & Retention",
        "description": "Tenure, monthly charges, contract types, and churn labels"
    },
    "anomaly": {
        "filename": "smartbiziq_anomaly_detection.csv",
        "title": "🔍 System & Transaction Anomalies",
        "description": "Time-stamped metrics with outlier activity spikes"
    }
}

def _get_data_dir() -> str:
    # Check parent data dir or local data dir
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data")),
        os.path.abspath(r"..\data"),
        os.path.abspath(r"data")
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

def _find_matching_column(query: str, columns: list) -> Optional[str]:
    q = query.lower().replace("_", " ").replace("-", " ")
    # Exact match after normalization
    for col in columns:
        col_norm = col.lower().replace("_", " ").replace("-", " ")
        if col_norm in q:
            return col
    # Word overlap matching
    q_words = re.findall(r'\b\w+\b', q)
    best_col = None
    max_score = 0
    for col in columns:
        col_words = set(re.findall(r'\b\w+\b', col.lower().replace("_", " ")))
        matching = sum(1 for w in q_words if w in col_words or any(w.startswith(cw) or cw.startswith(w) for cw in col_words if len(cw) > 2 and len(w) > 2))
        if matching > max_score:
            max_score = matching
            best_col = col
    return best_col if max_score > 0 else None

def _generate_followup_suggestions(df: pd.DataFrame, num_cols: List[str], cat_cols: List[str], date_col: Optional[str]) -> List[str]:
    suggestions = []
    if num_cols and cat_cols:
        suggestions.append(f"Show breakdown of {num_cols[0].replace('_', ' ')} by {cat_cols[0].replace('_', ' ')}")
    if len(num_cols) >= 2:
        suggestions.append(f"Check correlation between {num_cols[0].replace('_', ' ')} and {num_cols[1].replace('_', ' ')}")
    if num_cols:
        suggestions.append(f"Are there any outliers or anomalies in {num_cols[0].replace('_', ' ')}?")
        suggestions.append(f"What is the average and total {num_cols[0].replace('_', ' ')}?")
    if date_col:
        suggestions.append(f"Analyze trend over time by {date_col.replace('_', ' ')}")
    suggestions.append("Give me executive business recommendations based on this dataset")
    return suggestions[:4]

def analyze_dataset_query_comprehensive(df: pd.DataFrame, query_text: str, filename: str, summary: dict) -> Dict[str, Any]:
    """
    Intelligent NLP Business Analytics Engine:
    Computes statistical answers, extracts structured chart data, and produces actionable insights.
    """
    q_lower = query_text.lower()
    columns = list(df.columns)
    num_cols = list(df.select_dtypes(include=[np.number]).columns)
    cat_cols = list(df.select_dtypes(include=['object', 'category']).columns)
    
    # 1. Detect Date Column
    date_col = next((c for c in columns if c.lower() in ["date", "ds", "time", "timestamp", "datetime", "year", "month"]), None)
    if not date_col:
        for c in columns:
            if df[c].dtype == 'object':
                try:
                    pd.to_datetime(df[c].head(5))
                    date_col = c
                    break
                except Exception:
                    pass

    target_num_col = _find_matching_column(query_text, num_cols)
    target_cat_col = _find_matching_column(query_text, cat_cols)
    target_general_col = _find_matching_column(query_text, columns)

    # 2. Executive Business Recommendations / Strategy Query
    if any(k in q_lower for k in ["recommend", "strategy", "action", "advice", "improve", "decision", "grow", "boost", "swot", "suggestion"]):
        insights = []
        if num_cols:
            primary_num = num_cols[0]
            val_mean = df[primary_num].mean()
            val_max = df[primary_num].max()
            val_min = df[primary_num].min()
            insights.append(f"🎯 **Optimize {primary_num.replace('_', ' ').title()} Performance**: Your benchmark average is `{val_mean:,.2f}`, with top-tier peak reaching `{val_max:,.2f}`. Focus operational resources on raising the lower quartile (`{val_min:,.2f}`).")
        
        if cat_cols and num_cols:
            grouped = df.groupby(cat_cols[0])[num_cols[0]].mean().sort_values(ascending=False)
            top_cat = grouped.index[0]
            bottom_cat = grouped.index[-1]
            insights.append(f"🚀 **Target High-Yield Segments**: Segment **{top_cat}** drives the highest average `{num_cols[0]}` (`{grouped.iloc[0]:,.2f}`). Replicate these best practices across underperforming segment **{bottom_cat}** (`{grouped.iloc[-1]:,.2f}`).")
        
        if len(num_cols) >= 2:
            corr = df[num_cols[0]].corr(df[num_cols[1]])
            if abs(corr) > 0.4:
                direction = "positive" if corr > 0 else "inverse"
                insights.append(f"📈 **Leverage Key Growth Driver**: Strong {direction} correlation (`{corr:.2f}`) detected between `{num_cols[0]}` and `{num_cols[1]}`. Scaling investments in `{num_cols[1]}` directly impacts `{num_cols[0]}`.")

        insights.append("🛡️ **Automated Risk Mitigation**: Implement real-time threshold monitoring and proactive retention initiatives to minimize churn risk and unexpected variance.")

        answer = (
            f"💡 **Executive Strategic Recommendations for `{filename}`**:\n\n"
            + "\n\n".join(insights)
            + "\n\n📌 _Generated by SmartBizIQ Autonomous Decision Copilot._"
        )
        return {
            "answer": answer,
            "structured_data": None,
            "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
        }

    # 3. Correlation & Relationship Query
    if any(k in q_lower for k in ["correlation", "relationship", "relation", "impact", "correlate", "driver"]):
        if len(num_cols) >= 2:
            corr_matrix = df[num_cols].corr()
            corr_pairs = []
            for i in range(len(num_cols)):
                for j in range(i + 1, len(num_cols)):
                    c1, c2 = num_cols[i], num_cols[j]
                    val = corr_matrix.loc[c1, c2]
                    if not np.isnan(val):
                        corr_pairs.append((abs(val), c1, c2, val))
            corr_pairs.sort(reverse=True)
            
            lines = []
            chart_labels = []
            chart_values = []
            for _, c1, c2, val in corr_pairs[:6]:
                strength = "Strong Positive 🔥" if val > 0.7 else ("Moderate Positive 📈" if val > 0.3 else ("Strong Negative 🔻" if val < -0.6 else "Weak / Neutral ⚖️"))
                lines.append(f"- **{c1.replace('_', ' ').title()}** ↔ **{c2.replace('_', ' ').title()}**: `{val:.3f}` ({strength})")
                chart_labels.append(f"{c1} vs {c2}")
                chart_values.append(round(float(val), 3))

            answer = (
                f"🔗 **Correlation & Key Driver Analysis (`{filename}`)**:\n\n"
                + "\n".join(lines) + "\n\n"
                + f"💡 **Key Insight**: Highest correlation is between **{corr_pairs[0][1]}** and **{corr_pairs[0][2]}** (`{corr_pairs[0][3]:.3f}`)."
            )
            structured_data = {
                "chart_type": "bar",
                "title": "Correlation Coefficients Matrix",
                "labels": chart_labels,
                "values": chart_values
            }
            return {
                "answer": answer,
                "structured_data": structured_data,
                "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
            }

    # 4. Outliers & Anomaly Detection Query
    if any(k in q_lower for k in ["anomaly", "anomalies", "outlier", "outliers", "drop", "spike", "unusual", "irregular", "abnormal"]):
        anomaly_reports = []
        outlier_data = []
        cols_to_check = [target_num_col] if (target_num_col and target_num_col in num_cols) else num_cols[:4]
        for col in cols_to_check:
            vals = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(vals) > 4:
                q25, q75 = vals.quantile(0.25), vals.quantile(0.75)
                iqr = q75 - q25
                lower_bound = q25 - 1.5 * iqr
                upper_bound = q75 + 1.5 * iqr
                outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
                
                if len(outliers) > 0:
                    for idx, row in outliers.head(3).iterrows():
                        date_str = f" on `{row[date_col]}`" if date_col else f" (Row #{idx+1})"
                        anomaly_reports.append(
                            f"- ⚠️ **{col.replace('_', ' ').title()}**{date_str}: Value = `{row[col]:,}` (Normal range: `{lower_bound:,.1f}` to `{upper_bound:,.1f}`)"
                        )
                        outlier_data.append({"metric": col, "value": float(row[col]), "row": int(idx)})

        if anomaly_reports:
            answer = (
                f"🚨 **Detected Outliers & Statistical Anomalies ({len(anomaly_reports)} identified)**:\n\n"
                + "\n".join(anomaly_reports)
                + "\n\n💡 **Recommended Action**: Inspect these specific data points for transaction errors, sudden market shifts, or high-value VIP behavior."
            )
        else:
            answer = "✅ **No statistical anomalies detected**: All metric distributions are operating safely within the standard 1.5× IQR interquartile threshold."

        return {
            "answer": answer,
            "structured_data": None,
            "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
        }

    # 5. Top N / Bottom N / Highest / Lowest Records
    is_top = any(k in q_lower for k in ["top", "highest", "best", "max", "peak", "maximum", "largest", "leader"])
    is_bottom = any(k in q_lower for k in ["bottom", "lowest", "worst", "min", "minimum", "smallest", "least"])
    
    n_match = re.search(r'\b(top|bottom|first|last)\s+(\d+)\b', q_lower)
    n_count = int(n_match.group(2)) if n_match else 5

    if (is_top or is_bottom) and (target_num_col or num_cols):
        metric = target_num_col if (target_num_col and target_num_col in num_cols) else num_cols[0]
        sorted_df = df.sort_values(by=metric, ascending=not is_top).head(n_count)
        
        display_col = cat_cols[0] if cat_cols else (columns[0] if columns else metric)
        rows_text = []
        labels = []
        values = []
        
        for rank, (idx, r) in enumerate(sorted_df.iterrows(), 1):
            val = r[metric]
            identifier = f"**{r[display_col]}**" if display_col != metric else f"Record #{idx+1}"
            rows_text.append(f"{rank}. {identifier} — `{metric.replace('_', ' ').title()}`: **{val:,}**")
            labels.append(str(r[display_col]))
            values.append(float(val))

        direction_label = f"Top {n_count} Highest" if is_top else f"Bottom {n_count} Lowest"
        answer = (
            f"🏆 **{direction_label} Records by `{metric.replace('_', ' ').title()}`**:\n\n"
            + "\n".join(rows_text)
        )
        structured_data = {
            "chart_type": "bar",
            "title": f"{direction_label} {metric.replace('_', ' ').title()}",
            "labels": labels,
            "values": values
        }
        return {
            "answer": answer,
            "structured_data": structured_data,
            "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
        }

    # 6. Group by / Categorical Breakdown Query
    is_breakdown = any(k in q_lower for k in ["breakdown", "group by", "grouped", "by location", "by gender", "by store", "by category", "distribution", "share", "split", "each"])
    if is_breakdown or (target_cat_col and target_num_col):
        group_cat = target_cat_col if target_cat_col else (cat_cols[0] if cat_cols else None)
        agg_num = target_num_col if target_num_col else (num_cols[0] if num_cols else None)
        
        if group_cat and agg_num:
            grouped = df.groupby(group_cat)[agg_num].agg(['sum', 'mean', 'count']).reset_index()
            grouped = grouped.sort_values(by='sum', ascending=False)
            
            lines = []
            labels = []
            values = []
            for _, row in grouped.head(10).iterrows():
                lines.append(
                    f"- **{row[group_cat]}**: Total = **{row['sum']:,.2f}** | Average = `{row['mean']:,.2f}` ({int(row['count'])} records)"
                )
                labels.append(str(row[group_cat]))
                values.append(round(float(row['sum']), 2))

            answer = (
                f"📊 **Breakdown of `{agg_num.replace('_', ' ').title()}` by `{group_cat.replace('_', ' ').title()}`**:\n\n"
                + "\n".join(lines)
            )
            structured_data = {
                "chart_type": "pie" if len(labels) <= 6 else "bar",
                "title": f"Total {agg_num.replace('_', ' ').title()} by {group_cat.replace('_', ' ').title()}",
                "labels": labels,
                "values": values
            }
            return {
                "answer": answer,
                "structured_data": structured_data,
                "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
            }

    # 7. Date Range & Time-Series Trend Query
    is_trend = any(k in q_lower for k in ["trend", "over time", "monthly", "yearly", "growth", "timeline", "sales over", "revenue over", "history"])
    dates_found = re.findall(r'\b(\d{4}-\d{2}-\d{2})\b', query_text) or re.findall(r'\b(20\d{2})\b', query_text)
    
    if date_col and (is_trend or dates_found or "time" in q_lower):
        df_work = df.copy()
        try:
            df_work['_parsed_date'] = pd.to_datetime(df_work[date_col], errors='coerce')
            df_work = df_work.dropna(subset=['_parsed_date']).sort_values('_parsed_date')
            
            agg_num = target_num_col if target_num_col else (num_cols[0] if num_cols else None)
            if agg_num:
                labels = [str(d)[:10] for d in df_work['_parsed_date'].head(15)]
                values = [round(float(v), 2) for v in df_work[agg_num].head(15)]
                
                first_val = values[0] if values else 0
                last_val = values[-1] if values else 0
                pct_change = ((last_val - first_val) / first_val * 100) if first_val != 0 else 0
                trend_dir = "📈 Growth Momentum" if pct_change > 0 else "🔻 Decline Notice"
                
                answer = (
                    f"📅 **Time-Series Trend for `{agg_num.replace('_', ' ').title()}` ({date_col})**:\n\n"
                    f"- **Historical Range**: `{labels[0]}` to `{labels[-1]}`\n"
                    f"- **Net Period Trajectory**: **{pct_change:+.2f}%** ({trend_dir})\n"
                    f"- **Starting Value**: `{first_val:,.2f}` ➔ **Current**: `{last_val:,.2f}`\n"
                    f"- **Historical Peak**: `{max(values):,.2f}` | **Trough**: `{min(values):,.2f}`\n"
                )
                structured_data = {
                    "chart_type": "line",
                    "title": f"{agg_num.replace('_', ' ').title()} Over Time",
                    "labels": labels,
                    "values": values
                }
                return {
                    "answer": answer,
                    "structured_data": structured_data,
                    "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
                }
        except Exception:
            pass

    # 8. Statistical Aggregations (Average, Sum, Count, Min, Max)
    is_avg = any(k in q_lower for k in ["average", "avg", "mean", "median", "middle"])
    is_sum = any(k in q_lower for k in ["total", "sum", "overall", "aggregate", "revenue", "how much", "how many"])
    
    if (is_avg or is_sum) and (target_num_col or num_cols):
        col = target_num_col if target_num_col else num_cols[0]
        col_series = pd.to_numeric(df[col], errors='coerce').dropna()
        
        sum_v = col_series.sum()
        mean_v = col_series.mean()
        median_v = col_series.median()
        min_v = col_series.min()
        max_v = col_series.max()
        std_v = col_series.std()

        answer = (
            f"📈 **Statistical Summary for `{col.replace('_', ' ').title()}`**:\n\n"
            f"- 💰 **Total Sum**: **{sum_v:,.2f}**\n"
            f"- 📊 **Average (Mean)**: **{mean_v:,.2f}**\n"
            f"- 🎯 **Median**: `{median_v:,.2f}`\n"
            f"- 🔻 **Minimum**: `{min_v:,.2f}` | 🔺 **Maximum**: `{max_v:,.2f}`\n"
            f"- 📐 **Std Deviation**: `{std_v:,.2f}` | 🔢 **Valid Records**: `{len(col_series):,}`"
        )
        structured_data = {
            "chart_type": "kpis",
            "title": f"{col.replace('_', ' ').title()} KPIs",
            "kpi_list": [
                {"label": "Total Sum", "value": f"{sum_v:,.0f}"},
                {"label": "Mean Avg", "value": f"{mean_v:,.1f}"},
                {"label": "Median", "value": f"{median_v:,.1f}"},
                {"label": "Peak Max", "value": f"{max_v:,.0f}"}
            ]
        }
        return {
            "answer": answer,
            "structured_data": structured_data,
            "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
        }

    # 9. Default Overview & Dataset KPIs
    kpis = summary.get("kpis", {})
    kpi_lines = []
    for k, v in list(kpis.items())[:5]:
        kpi_lines.append(f"- **{k.replace('_', ' ').title()}**: Total = `{v.get('total', 0):,}` | Avg = `{v.get('mean', 0):,}` (Range: `{v.get('min', 0):,}` – `{v.get('max', 0):,}`)")

    cat_lines = []
    for k, v in list(summary.get("categories", {}).items())[:3]:
        top_cats = ", ".join([f"{cat} ({count})" for cat, count in list(v.items())[:3]])
        cat_lines.append(f"- **{k.replace('_', ' ').title()}**: {top_cats}")

    answer = (
        f"📊 **SmartBizIQ Intelligence Report: `{filename}`**\n\n"
        f"- **Dataset Size**: `{len(df)}` rows × `{len(columns)}` attributes\n"
        f"- **Numeric Metrics**: {', '.join([c.replace('_', ' ').title() for c in num_cols]) if num_cols else 'None'}\n"
        f"- **Categorical Dimensions**: {', '.join([c.replace('_', ' ').title() for c in cat_cols]) if cat_cols else 'None'}\n\n"
        f"**Key Metric Summaries**:\n"
        + ("\n".join(kpi_lines) if kpi_lines else "_No numeric metrics available._")
    )
    if cat_lines:
        answer += "\n\n**Categorical Distributions**:\n" + "\n".join(cat_lines)

    answer += "\n\n💬 _Ask me to compare metrics, detect anomalies, forecast trends, or give strategic recommendations!_"

    # Generate overview mini KPI card
    kpi_cards = []
    for k, v in list(kpis.items())[:4]:
        kpi_cards.append({"label": k.replace('_', ' ').title(), "value": f"{v.get('mean', 0):,.1f} avg"})

    structured_data = {
        "chart_type": "kpis",
        "title": "Dataset Snapshot",
        "kpi_list": kpi_cards
    } if kpi_cards else None

    return {
        "answer": answer,
        "structured_data": structured_data,
        "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, date_col)
    }

def generate_ai_chat_response(query_text: str) -> Dict[str, Any]:
    query_clean = query_text.strip() if query_text else "Summarize dataset"
    
    if dataset_store.is_empty():
        return {
            "answer": (
                "🤖 **Hello! I am BizzBOT, your AI Business Analyst and Data Copilot.**\n\n"
                "I can analyze trends, calculate KPI metrics, detect anomalies, model customer churn, and provide executive decision advice.\n\n"
                "👉 **To get started**, click any **Sample Business Dataset** above or upload your own CSV file!"
            ),
            "structured_data": None,
            "has_data": False,
            "follow_ups": [
                "Load Sales & Revenue Sample",
                "Load Customer Segmentation Data",
                "Load Churn Risk Dataset",
                "What capabilities does BizzBOT have?"
            ]
        }

    df = dataset_store.df
    summary = dataset_store.summary

    # Attempt Gemini API if key is available and valid
    if settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("AQ."):
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")
            preview_rows = df.head(15).to_dict(orient="records")
            preview_str = json.dumps(preview_rows, indent=2, default=str)
            prompt = f"""You are SmartBizIQ's intelligent AI Business Analyst and Data Copilot (BizzBOT).
Dataset Name: {dataset_store.filename}
Total Records: {len(df)}
Columns: {list(df.columns)}
Summary KPIs: {summary.get('kpis', {})}
Preview Data:
{preview_str}

User Question: {query_clean}
Provide a direct, precise, executive-grade formatted markdown answer with key business insights."""
            response = model.generate_content(prompt)
            if response and response.text:
                num_cols = list(df.select_dtypes(include=[np.number]).columns)
                cat_cols = list(df.select_dtypes(include=['object', 'category']).columns)
                return {
                    "answer": response.text,
                    "structured_data": None,
                    "has_data": True,
                    "follow_ups": _generate_followup_suggestions(df, num_cols, cat_cols, None)
                }
        except Exception:
            pass

    # Deterministic analytics engine with structured data
    result = analyze_dataset_query_comprehensive(df, query_clean, dataset_store.filename, summary)
    result["has_data"] = True
    return result

@router.get("/samples")
def get_sample_datasets():
    """Return available sample datasets with descriptions."""
    return {
        "status": "success",
        "samples": [
            {"id": k, "title": v["title"], "description": v["description"], "filename": v["filename"]}
            for k, v in SAMPLE_DATASETS.items()
        ]
    }

@router.post("/load-sample/{sample_id}")
@root_router.post("/api/chat/load-sample/{sample_id}")
def load_sample_dataset(sample_id: str):
    """Instant one-click sample loader for BizzBOT."""
    if sample_id not in SAMPLE_DATASETS:
        sample_id = "sales"
    
    sample_info = SAMPLE_DATASETS[sample_id]
    data_dir = _get_data_dir()
    filepath = os.path.join(data_dir, sample_info["filename"])
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"Sample dataset file not found: {sample_info['filename']}")
    
    df = pd.read_csv(filepath)
    summary = dataset_store.set_dataset(df, sample_info["filename"])
    cache.clear()
    
    welcome_msg = (
        f"✅ Loaded sample dataset **{sample_info['title']}** (`{sample_info['filename']}` with `{len(df)}` records).\n\n"
        f"Columns: `{', '.join(list(df.columns))}`.\n\n"
        f"What would you like me to analyze?"
    )
    
    return {
        "status": "success",
        "sample_id": sample_id,
        "filename": sample_info["filename"],
        "rows": len(df),
        "columns": list(df.columns),
        "welcome_message": welcome_msg,
        "summary": summary
    }

@router.get("/status")
@router.get("/dataset-info")
def get_chat_dataset_info():
    """Return active dataset status for BizzBOT."""
    if dataset_store.is_empty():
        return {
            "has_data": False,
            "filename": None,
            "rows": 0,
            "columns": []
        }
    return {
        "has_data": True,
        "filename": dataset_store.filename,
        "rows": len(dataset_store.df),
        "columns": list(dataset_store.df.columns),
        "numeric_columns": list(dataset_store.df.select_dtypes(include=[np.number]).columns),
        "categorical_columns": list(dataset_store.df.select_dtypes(include=['object', 'category']).columns)
    }

@router.post("")
@router.post("/message")
@router.post("/chat")
@root_router.post("/chat")
async def chat_endpoint(request: Request):
    query_text = ""
    
    # Parse JSON or Form Data
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                query_text = body.get("user_query") or body.get("message") or ""
        except Exception:
            pass
    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        try:
            form = await request.form()
            query_text = form.get("user_query") or form.get("message") or ""
        except Exception:
            pass
    
    if not query_text:
        try:
            body = await request.json()
            if isinstance(body, dict):
                query_text = body.get("user_query") or body.get("message") or ""
        except Exception:
            try:
                form = await request.form()
                query_text = form.get("user_query") or form.get("message") or ""
            except Exception:
                pass

    if not query_text:
        query_text = "Summarize the dataset"

    response_payload = generate_ai_chat_response(query_text)
    answer = response_payload.get("answer", "")
    structured_data = response_payload.get("structured_data")
    follow_ups = response_payload.get("follow_ups", [])

    return {
        "status": "success",
        "answer": answer,
        "response": answer,
        "structured_data": structured_data,
        "follow_ups": follow_ups,
        "has_data": not dataset_store.is_empty(),
        "filename": dataset_store.filename if not dataset_store.is_empty() else None,
        "visualizations": ["metric_distribution", "column_correlations"],
        "nextActions": ["Explore Dataset Metrics", "Generate Forecast"]
    }

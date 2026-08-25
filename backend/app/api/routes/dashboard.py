from fastapi import APIRouter
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from app.db.dataset_store import dataset_store

router = APIRouter(prefix="/dashboard", tags=["Dashboard KPIs"])


@router.get("/metrics")
def get_all_kpis():
    """Returns business metrics generated dynamically from the uploaded data only."""
    if dataset_store.is_empty():
        return {
            "status": "success",
            "has_data": False,
            "filename": None,
            "total_records": 0,
            "numeric_columns": [],
            "categorical_columns": [],
            "kpis": {},
            "categories": {},
            "message": "No active dataset. Upload a CSV file to generate real-time analytics."
        }

    df = dataset_store.df
    summary = dataset_store.summary
    num_cols = summary.get("numeric_columns", [])
    cat_cols = summary.get("categorical_columns", [])
    date_cols = summary.get("date_columns", [])
    total_records = len(df)
    missing_cells = int(df.isna().sum().sum())
    total_cells = df.size if df.size > 0 else 1
    cleanliness_pct = round(100.0 * (1.0 - (missing_cells / total_cells)), 1)

    categories: Dict[str, Any] = {}

    # Category 1: Key Performance Metrics (Sums & Averages of Numeric Columns)
    core_metrics = []
    for col in num_cols:
        col_series = pd.to_numeric(df[col], errors='coerce').dropna()
        if len(col_series) > 0:
            total_v = col_series.sum()
            avg_v = col_series.mean()
            core_metrics.append({
                "id": f"metric_{col}",
                "name": col.replace('_', ' ').title(),
                "value": f"{total_v:,.2f}" if abs(total_v) >= 1000 else f"{total_v:,.2f}",
                "change": f"Avg: {avg_v:,.2f} | Peak: {col_series.max():,.2f}"
            })
    if core_metrics:
        categories["Core Metrics"] = core_metrics

    # Category 2: Statistical Distribution
    stats_metrics = []
    for col in num_cols[:6]:
        col_series = pd.to_numeric(df[col], errors='coerce').dropna()
        if len(col_series) > 0:
            stats_metrics.append({
                "id": f"stat_{col}",
                "name": f"{col.replace('_', ' ').title()} Range",
                "value": f"{col_series.min():,.1f} → {col_series.max():,.1f}",
                "change": f"Std Dev: {col_series.std():,.2f} | Median: {col_series.median():,.2f}"
            })
    if stats_metrics:
        categories["Statistical Distributions"] = stats_metrics

    # Category 3: Categorical & Segmentation Insights
    cat_metrics = []
    for col in cat_cols[:5]:
        val_counts = df[col].value_counts()
        if not val_counts.empty:
            top_val = val_counts.index[0]
            top_count = int(val_counts.iloc[0])
            cat_metrics.append({
                "id": f"cat_{col}",
                "name": col.replace('_', ' ').title(),
                "value": f"{len(val_counts)} Unique Values",
                "change": f"Top: {str(top_val)[:20]} ({top_count} entries)"
            })
    if cat_metrics:
        categories["Categorical Breakdown"] = cat_metrics

    # Category 4: Dataset Integrity & Health
    integrity_metrics = [
        {
            "id": "health_records",
            "name": "Total Records Ingested",
            "value": f"{total_records:,} rows",
            "change": f"{len(df.columns)} total attributes"
        },
        {
            "id": "health_cleanliness",
            "name": "Data Cleanliness Score",
            "value": f"{cleanliness_pct}%",
            "change": f"{missing_cells} missing values detected"
        },
        {
            "id": "health_dims",
            "name": "Numeric vs Categorical",
            "value": f"{len(num_cols)} Num / {len(cat_cols)} Cat",
            "change": f"{len(date_cols)} date/time dimensions"
        }
    ]
    categories["Dataset Health & Dimensions"] = integrity_metrics

    return {
        "status": "success",
        "has_data": True,
        "filename": dataset_store.filename,
        "total_records": total_records,
        "numeric_columns": num_cols,
        "categorical_columns": cat_cols,
        "date_columns": date_cols,
        "kpis": summary.get("kpis", {}),
        "categories": categories
    }


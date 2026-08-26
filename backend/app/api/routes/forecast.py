from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import pandas as pd
import numpy as np
import io

from app.models.forecast import run_all_forecasting_models
from app.db.dataset_store import dataset_store
from app.utils import cache

router = APIRouter(tags=["Forecasting"])

class ForecastRequest(BaseModel):
    metric_id: Optional[str] = None
    periods: int = 5
    models: Optional[List[str]] = ["prophet", "arima", "lstm", "gru"]
    confidence: float = 0.95

@router.post("/forecasting")
@router.post("/forecast/upload")
async def forecast_upload(model: str = Query("prophet"), file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported.")
    
    try:
        contents = await file.read()
        df_user = pd.read_csv(io.BytesIO(contents))
        dataset_store.set_dataset(df_user, file.filename)
        
        # Identify date column and target value column
        cols = list(df_user.columns)
        date_col = next((c for c in cols if c.lower() in ["date", "ds", "year", "time", "timestamp"]), cols[0])
        num_cols = list(df_user.select_dtypes(include=[np.number]).columns)
        val_col = next((c for c in num_cols if c.lower() in ["revenue", "sales", "value", "y", "amount"]), num_cols[0] if num_cols else cols[-1])

        # Prepare ts dataframe
        try:
            ds_series = pd.to_datetime(df_user[date_col])
        except Exception:
            ds_series = pd.date_range(end=datetime.today(), periods=len(df_user), freq='W')

        y_vals = pd.to_numeric(df_user[val_col], errors='coerce').fillna(0)
        df_ts = pd.DataFrame({"ds": ds_series, "y": y_vals}).dropna().sort_values("ds")

        if len(df_ts) < 3:
            raise ValueError("Dataset needs at least 3 historical data points for time-series forecasting.")

        # Run time-based holdout evaluation across all models with standardized dates
        res = run_all_forecasting_models(df_ts, periods=5, target_model=model)

        return {
            "status": "success",
            "model": res["selected_model"],
            "best_model": res["best_model"],
            "best_model_name": res["best_model_name"],
            "forecast": res["forecast"],
            "metrics": res["metrics"],
            "summary": res["summary"],
            "bi_insights": res["bi_insights"],
            "all_models": res["all_models"],
            "test_period": res["test_period"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process forecasting CSV: {str(e)}")

@router.post("/forecast/generate")
def generate_forecast(req: ForecastRequest):
    if dataset_store.is_empty():
        return {
            "status": "success",
            "has_data": False,
            "message": "No dataset uploaded. Please upload a CSV dataset to generate time-series forecasts.",
            "data": {"forecast": [], "model_comparison": {}}
        }

    df_user = dataset_store.df
    numeric_cols = dataset_store.summary.get("numeric_columns", [])
    
    if not numeric_cols:
        return {
            "status": "error",
            "has_data": False,
            "message": "No numeric columns found in the uploaded dataset for forecasting."
        }

    target_col = req.metric_id if req.metric_id and req.metric_id in numeric_cols else numeric_cols[0]

    cache_key = f"forecast_eval_{dataset_store.filename}_{target_col}_{req.periods}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Prepare time-series dataframe
    date_cols = dataset_store.summary.get("date_columns", [])
    if date_cols:
        ds_series = pd.to_datetime(df_user[date_cols[0]])
    else:
        ds_series = pd.date_range(end=datetime.today(), periods=len(df_user), freq='W')

    df_ts = pd.DataFrame({"ds": ds_series, "y": df_user[target_col].astype(float)}).dropna()
    df_ts = df_ts.sort_values("ds")

    res = run_all_forecasting_models(df_ts, periods=req.periods, target_model="prophet")
    
    result = {
        "status": "success",
        "has_data": True,
        "target_metric": target_col,
        "available_metrics": numeric_cols,
        "data": {
            "forecast": res["forecast"],
            "best_model": res["best_model_name"],
            "model_comparison": {
                m["model"]: {
                    "rmse": m["metrics"]["RMSE"],
                    "mae": m["metrics"]["MAE"],
                    "mape": m["metrics"]["MAPE"],
                    "is_best": m.get("is_best", False)
                } for m in res["all_models"]
            }
        },
        "summary": res["summary"],
        "bi_insights": res["bi_insights"]
    }

    cache.set(cache_key, result, ttl_seconds=300)
    return result

@router.get("/compare")
def compare_models(metric_id: Optional[str] = None):
    if dataset_store.is_empty():
        return {
            "has_data": False,
            "metric_id": metric_id,
            "models": {}
        }
    numeric_cols = dataset_store.summary.get("numeric_columns", [])
    target = metric_id if metric_id in numeric_cols else (numeric_cols[0] if numeric_cols else "metric")
    
    df_user = dataset_store.df
    date_cols = dataset_store.summary.get("date_columns", [])
    ds_series = pd.to_datetime(df_user[date_cols[0]]) if date_cols else pd.date_range(end=datetime.today(), periods=len(df_user), freq='W')
    df_ts = pd.DataFrame({"ds": ds_series, "y": df_user[target].astype(float)}).dropna().sort_values("ds")
    
    res = run_all_forecasting_models(df_ts, periods=5)
    
    models_dict = {}
    for m in res["all_models"]:
        models_dict[m["model"]] = {
            "rmse": m["metrics"]["RMSE"],
            "mae": m["metrics"]["MAE"],
            "mape": m["metrics"]["MAPE"],
            "recommended": m.get("is_best", False)
        }
        
    return {
        "has_data": True,
        "metric_id": target,
        "best_model": res["best_model_name"],
        "models": models_dict
    }

@router.get("/{metric_id}/history")
def forecast_history(metric_id: str):
    if dataset_store.is_empty():
        return {"has_data": False, "metric_id": metric_id, "history": []}
    
    df_user = dataset_store.df
    if metric_id in df_user.columns:
        date_cols = dataset_store.summary.get("date_columns", [])
        dates = df_user[date_cols[0]].astype(str) if date_cols else [f"Record {i+1}" for i in range(len(df_user))]
        history = [
            {"date": str(d), "actual": float(v)}
            for d, v in zip(dates.iloc[-20:], df_user[metric_id].iloc[-20:])
        ]
        return {"has_data": True, "metric_id": metric_id, "history": history}
    
    return {"has_data": False, "metric_id": metric_id, "history": []}

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import io
from datetime import datetime

from app.models.anomaly import detect_metric_anomalies, detect_dataframe_anomalies
from app.db.dataset_store import dataset_store

router = APIRouter(prefix="/anomaly", tags=["Anomaly Detection"])

# Top-level alias so the frontend's POST /anomaly-detection route works directly
root_router = APIRouter(tags=["Anomaly Detection"])

class AnomalyDetectRequest(BaseModel):
    metric_id: Optional[str] = None
    lookback_days: int = 90
    sensitivity: str = "medium"

class AcknowledgeRequest(BaseModel):
    alert_id: str

@router.post("/detect")
@router.post("/anomaly-detection")
async def detect_anomalies(
    method: str = Query("isolation_forest"),
    file: Optional[UploadFile] = File(None),
    req: Optional[AnomalyDetectRequest] = None
):
    if file:
        if not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files supported.")
        contents = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {str(e)}")

        results = detect_dataframe_anomalies(df, method=method)
        return {"status": "success", "data": results}

    if dataset_store.is_empty():
        return {
            "status": "success",
            "has_data": False,
            "message": "No dataset uploaded yet. Upload a CSV dataset to run anomaly detection.",
            "data": {"anomalies": []}
        }

    df_user = dataset_store.df
    numeric_cols = dataset_store.summary.get("numeric_columns", [])
    
    if not numeric_cols:
        return {
            "status": "error",
            "has_data": False,
            "message": "No numeric metrics found in dataset for anomaly detection."
        }

    sensitivity = req.sensitivity if req and req.sensitivity else "medium"
    target_col = req.metric_id if (req and req.metric_id and req.metric_id in numeric_cols) else numeric_cols[0]
    date_cols = dataset_store.summary.get("date_columns", [])
    dates = df_user[date_cols[0]].astype(str) if date_cols else [f"Record {i+1}" for i in range(len(df_user))]

    data_points = [
        {"date": str(d), "value": float(v)}
        for d, v in zip(dates, df_user[target_col])
        if pd.notnull(v)
    ]

    anomalies = detect_metric_anomalies(data_points, sensitivity=sensitivity, method=method)
    
    return {
        "status": "success",
        "has_data": True,
        "metric_id": target_col,
        "data": {"anomalies": anomalies}
    }

# Root-level alias: POST /anomaly-detection (no /anomaly prefix)
@root_router.post("/anomaly-detection")
async def detect_anomalies_root(
    method: str = Query("isolation_forest"),
    file: Optional[UploadFile] = File(None)
):
    return await detect_anomalies(method=method, file=file, req=None)

@router.get("/alerts")
def get_active_alerts():
    if dataset_store.is_empty():
        return {
            "status": "success",
            "has_data": False,
            "data": {"alerts": []}
        }

    df_user = dataset_store.df
    numeric_cols = dataset_store.summary.get("numeric_columns", [])
    
    alerts = []
    if numeric_cols:
        target_col = numeric_cols[0]
        date_cols = dataset_store.summary.get("date_columns", [])
        dates = df_user[date_cols[0]].astype(str) if date_cols else [f"Record {i+1}" for i in range(len(df_user))]
        data_points = [{"date": str(d), "value": float(v)} for d, v in zip(dates, df_user[target_col]) if pd.notnull(v)]
        detected = detect_metric_anomalies(data_points, sensitivity="medium")
        
        for idx, a in enumerate(detected[:5]):
            alerts.append({
                "id": f"alert_{idx+1}",
                "type": "anomaly",
                "severity": a.get("severity", "medium"),
                "metric": target_col,
                "message": a.get("message", "Anomaly detected in dataset record."),
                "acknowledged": False,
                "created_at": datetime.now().isoformat()
            })

    return {
        "status": "success",
        "has_data": True,
        "data": {"alerts": alerts}
    }

@router.post("/acknowledge")
def acknowledge_alert(req: AcknowledgeRequest):
    return {"status": "success", "alert_id": req.alert_id, "acknowledged": True}

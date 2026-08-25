from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import io

from app.models.churn import train_and_predict_churn, get_retention_actions
from app.db.dataset_store import dataset_store

router = APIRouter(prefix="/churn", tags=["Churn Prediction"])

class ChurnPredictRequest(BaseModel):
    customer_ids: Optional[List[str]] = None

class InterventionRequest(BaseModel):
    customer_id: str
    risk_segment: str = "high"

@router.post("/predict")
@router.post("/predict-churn")
async def predict_churn(file: Optional[UploadFile] = File(None), req: Optional[ChurnPredictRequest] = None):
    if file:
        if not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files supported.")
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        results = []
        for idx, row in df.iterrows():
            cust = str(row.get('Customer', row.get('CustomerID', row.get('name', row.get('id', f"Cust-{idx+1}")))))
            gender = int(row.get('Gender', 1 if idx % 2 == 0 else 0))
            age = int(row.get('Age', 30 + (idx % 25)))
            tenure = int(row.get('Tenure', row.get('tenure_months', 12)))
            monthly = float(row.get('MonthlyCharges', row.get('monthly_charges', 75.0)))
            total = float(row.get('TotalCharges', row.get('total_charges', tenure * monthly)))
            tickets = int(row.get('support_tickets', 2))
            
            prob = round(float(np.clip((tickets * 12 + monthly * 0.3 - tenure * 1.5) / 100, 0.05, 0.95)), 2)
            prob_pct = int(prob * 100)
            label = "🔴 Likely to Churn" if prob >= 0.5 else "🟢 Retained"
            
            results.append({
                "Customer": cust,
                "Gender": gender,
                "Age": age,
                "Tenure": tenure,
                "MonthlyCharges": monthly,
                "TotalCharges": total,
                "ChurnProbability": prob_pct,
                "ChurnLabel": label
            })
        return {"status": "success", "data": results}

    if dataset_store.is_empty():
        return {
            "status": "success",
            "has_data": False,
            "message": "No dataset uploaded yet. Please upload a customer CSV dataset to analyze churn risk.",
            "data": {"predictions": []}
        }

    records = dataset_store.df.to_dict(orient="records")
    predictions = train_and_predict_churn(records)
    
    if req and req.customer_ids:
        predictions = [p for p in predictions if p["customer_id"] in req.customer_ids]

    return {"status": "success", "has_data": True, "data": {"predictions": predictions}}

@router.get("/segments")
def get_churn_segments():
    if dataset_store.is_empty():
        return {
            "status": "success",
            "has_data": False,
            "message": "No dataset uploaded yet.",
            "data": {"segments": {}}
        }

    records = dataset_store.df.to_dict(orient="records")
    predictions = train_and_predict_churn(records)
    total = len(predictions) if predictions else 1

    high_risk = [p for p in predictions if p.get("risk_segment") == "high"]
    medium_risk = [p for p in predictions if p.get("risk_segment") == "medium"]
    low_risk = [p for p in predictions if p.get("risk_segment") == "low"]

    return {
        "status": "success",
        "has_data": True,
        "data": {
            "segments": {
                "high_risk": {
                    "count": len(high_risk),
                    "percentage": f"{(len(high_risk)/total)*100:.1f}%",
                    "avg_monthly_revenue": "N/A"
                },
                "medium_risk": {
                    "count": len(medium_risk),
                    "percentage": f"{(len(medium_risk)/total)*100:.1f}%",
                    "avg_monthly_revenue": "N/A"
                },
                "low_risk": {
                    "count": len(low_risk),
                    "percentage": f"{(len(low_risk)/total)*100:.1f}%",
                    "avg_monthly_revenue": "N/A"
                }
            }
        }
    }

@router.post("/interventions")
def get_interventions(req: InterventionRequest):
    actions = get_retention_actions(req.risk_segment, ["Behavioral anomaly detected"])
    return {
        "customer_id": req.customer_id,
        "risk_segment": req.risk_segment,
        "recommended_interventions": actions
    }


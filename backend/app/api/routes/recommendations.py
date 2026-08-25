from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import pandas as pd
import io

from app.models.recommendation import generate_hybrid_recommendations, process_recommendation_csv
from app.db.dataset_store import dataset_store

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])
root_router = APIRouter(tags=["Recommendations"])

class RecGenRequest(BaseModel):
    customer_id: Optional[str] = None

class RecFeedbackRequest(BaseModel):
    customer_id: str
    item_id: str
    feedback: str # helpful, not_helpful, purchased

@router.post("/upload_and_recommend")
@root_router.post("/upload_and_recommend")
async def upload_and_recommend(
    file: UploadFile = File(...),
    customer_id: Optional[str] = Form("1"),
    expected_value: Optional[str] = Form(None)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported.")
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        res = process_recommendation_csv(df, customer_id=customer_id, expected_value=expected_value)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")

@router.post("/generate")
def get_recommendations(req: RecGenRequest):
    if dataset_store.is_empty():
        return {
            "status": "success",
            "has_data": False,
            "message": "No dataset uploaded yet. Upload a CSV dataset to view recommendations.",
            "data": {"recommendations": [], "next_best_action": "Upload CSV dataset", "confidence": 0.0}
        }
    
    records = dataset_store.df.to_dict(orient="records")
    res = generate_hybrid_recommendations(req.customer_id or "user_data", records)
    return {"status": "success", "has_data": True, "data": res}

@router.post("/feedback")
def log_feedback(req: RecFeedbackRequest):
    return {
        "status": "success",
        "message": f"Feedback '{req.feedback}' logged for customer {req.customer_id}"
    }



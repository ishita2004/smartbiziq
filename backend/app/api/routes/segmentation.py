from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Optional
import pandas as pd
import io

from app.models.segmentation import perform_customer_segmentation

router = APIRouter(prefix="/segmentation", tags=["Customer Segmentation"])

@router.post("/segment-customers")
async def segment_customers(
    method: str = Query("kmeans"),
    file: Optional[UploadFile] = File(None)
):
    """
    Segments customers using KMeans or DBSCAN algorithms.
    Accepts CSV upload with Age, Annual_Income, and Spending_Score columns.
    """
    if not file:
        raise HTTPException(status_code=400, detail="CSV file is required for customer segmentation.")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")

        results, summaries = perform_customer_segmentation(df, method=method)

        return {
            "status": "success",
            "method": method,
            "total_customers": len(results),
            "data": results,
            "summaries": summaries
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")

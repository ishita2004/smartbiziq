from fastapi import APIRouter, UploadFile, File, HTTPException
import io
import pandas as pd
from app.db.dataset_store import dataset_store
from app.utils import cache

router = APIRouter(prefix="/etl", tags=["Data Pipeline & ETL"])
root_router = APIRouter(tags=["Data Pipeline & ETL"])

@router.post("/ingest")
@router.post("/upload")
@root_router.post("/upload")
async def ingest_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported.")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        summary = dataset_store.set_dataset(df, file.filename)
        cache.clear() # clear cached recommendations / forecasts when new dataset is uploaded
        
        return {
            "status": "success",
            "message": "CSV uploaded and parsed successfully",
            "rows": len(df),
            "filename": file.filename,
            "records_ingested": len(df),
            "columns": list(df.columns),
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")

@router.post("/process")
@root_router.post("/api/etl/process")
async def process_etl_pipeline(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported.")
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        initial_rows = len(df)
        missing_count = int(df.isna().sum().sum())
        
        # Data Cleaning: fill missing numeric with median, categoricals with mode, drop full duplicates
        for col in df.select_dtypes(include=['number']).columns:
            median_val = df[col].median()
            if pd.notna(median_val):
                df[col] = df[col].fillna(median_val)
        for col in df.select_dtypes(include=['object']).columns:
            if not df[col].mode().empty:
                df[col] = df[col].fillna(df[col].mode()[0])
        df = df.drop_duplicates()
        
        summary = dataset_store.set_dataset(df, file.filename)
        cache.clear()
        
        return {
            "status": "success",
            "message": "ETL pipeline executed successfully",
            "initial_rows": initial_rows,
            "cleaned_rows": len(df),
            "missing_values_handled": missing_count,
            "filename": file.filename,
            "columns": list(df.columns),
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETL processing error: {str(e)}")

@router.get("/status")
def etl_pipeline_status():
    if dataset_store.is_empty():
        return {
            "status": "operational",
            "has_data": False,
            "ingested_records_total": 0,
            "filename": None,
            "message": "No dataset uploaded yet."
        }
    
    return {
        "status": "operational",
        "has_data": True,
        "filename": dataset_store.filename,
        "ingested_records_total": dataset_store.summary.get("total_records", 0),
        "columns": list(dataset_store.df.columns)
    }

@router.post("/clear")
def clear_active_dataset():
    dataset_store.clear()
    cache.clear()
    return {"status": "success", "message": "Dataset cleared."}


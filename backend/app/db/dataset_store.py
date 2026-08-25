import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
import io

class DatasetStore:
    def __init__(self):
        self.df: Optional[pd.DataFrame] = None
        self.filename: Optional[str] = None
        self.summary: Dict[str, Any] = {}

    def is_empty(self) -> bool:
        return self.df is None or len(self.df) == 0

    def set_dataset(self, df: pd.DataFrame, filename: str) -> Dict[str, Any]:
        self.df = df.copy()
        self.filename = filename
        
        records_count = len(df)
        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        categorical_cols = list(df.select_dtypes(include=['object', 'category']).columns)
        date_cols = []
        
        # Try converting potential date columns
        for col in categorical_cols.copy():
            if 'date' in col.lower() or 'time' in col.lower() or 'day' in col.lower():
                try:
                    self.df[col] = pd.to_datetime(self.df[col])
                    date_cols.append(col)
                    categorical_cols.remove(col)
                except Exception:
                    pass

        # Calculate metrics for each numeric column
        kpis = {}
        for col in numeric_cols:
            col_series = self.df[col].dropna()
            if len(col_series) > 0:
                kpis[col] = {
                    "total": round(float(col_series.sum()), 2),
                    "mean": round(float(col_series.mean()), 2),
                    "min": round(float(col_series.min()), 2),
                    "max": round(float(col_series.max()), 2),
                    "count": int(len(col_series))
                }

        # Calculate breakdown for categorical columns
        category_breakdowns = {}
        for col in categorical_cols[:5]: # limit to top 5 categorical cols
            val_counts = self.df[col].value_counts().head(5).to_dict()
            category_breakdowns[col] = {str(k): int(v) for k, v in val_counts.items()}

        self.summary = {
            "status": "success",
            "has_data": True,
            "filename": filename,
            "total_records": records_count,
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "date_columns": date_cols,
            "kpis": kpis,
            "categories": category_breakdowns
        }
        return self.summary

    def clear(self):
        self.df = None
        self.filename = None
        self.summary = {}

dataset_store = DatasetStore()

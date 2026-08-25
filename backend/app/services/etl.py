import pandas as pd
from typing import Dict, Any

class ETLService:
    @staticmethod
    def process_and_clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        df = df.dropna(how='all')
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].astype(str).str.strip()
        return df

    @staticmethod
    def compute_summary_stats(df: pd.DataFrame) -> Dict[str, Any]:
        return {
            "row_count": len(df),
            "column_count": len(df.columns),
            "numeric_columns": list(df.select_dtypes(include=['number']).columns)
        }

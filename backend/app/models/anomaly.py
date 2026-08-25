import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler

def detect_dataframe_anomalies(df: pd.DataFrame, method: str = "isolation_forest") -> List[Dict[str, Any]]:
    """Runs ML anomaly detection (Isolation Forest, One-Class SVM, or Z-Score) on pandas DataFrame."""
    if df.empty:
        return []

    df_clean = df.copy()
    num_cols = list(df_clean.select_dtypes(include=[np.number]).columns)
    
    if not num_cols:
        # Fallback if no numeric columns
        results = []
        for idx, row in df_clean.iterrows():
            row_dict = {c: (str(v) if not isinstance(v, (int, float, np.number)) else float(v)) for c, v in row.items()}
            row_dict["Feature1"] = 0.0
            row_dict["Feature2"] = 0.0
            row_dict["Anomaly"] = 0
            results.append(row_dict)
        return results

    col1 = num_cols[0]
    col2 = num_cols[1] if len(num_cols) > 1 else col1

    X = df_clean[num_cols].fillna(0)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    method_clean = method.lower()
    if method_clean == "svm":
        model = OneClassSVM(nu=0.1, kernel="rbf", gamma="scale")
        preds = model.fit_predict(X_scaled)
        is_anomaly_mask = (preds == -1)
    elif method_clean == "zscore":
        zscores = np.abs((X - X.mean()) / (X.std().replace(0, 1)))
        is_anomaly_mask = (zscores > 2.5).any(axis=1).values
    else: # isolation_forest default
        model = IsolationForest(contamination=0.1, random_state=42)
        preds = model.fit_predict(X_scaled)
        is_anomaly_mask = (preds == -1)

    results = []
    for idx, row in df_clean.iterrows():
        val1 = float(row[col1]) if pd.notnull(row[col1]) and isinstance(row[col1], (int, float, np.number)) else 0.0
        val2 = float(row[col2]) if pd.notnull(row[col2]) and isinstance(row[col2], (int, float, np.number)) else val1
        
        row_dict = {}
        for c in df_clean.columns:
            val = row[c]
            row_dict[c] = float(val) if isinstance(val, (int, float, np.number)) and pd.notnull(val) else str(val)

        row_dict["Feature1"] = val1
        row_dict["Feature2"] = val2
        row_dict["Anomaly"] = 1 if is_anomaly_mask[idx] else 0
        results.append(row_dict)

    return results

def detect_metric_anomalies(data_points: List[Dict[str, Any]], sensitivity: str = "medium", method: str = "isolation_forest") -> List[Dict[str, Any]]:
    """Detects unusual metric spikes or drops using Isolation Forest or Z-Score."""
    if not data_points:
        return []

    df = pd.DataFrame(data_points)
    if 'value' not in df.columns:
        return []

    values = df[['value']].fillna(0).values
    
    contamination_map = {"low": 0.03, "medium": 0.05, "high": 0.10}
    contamination = contamination_map.get(sensitivity.lower(), 0.05)

    if method.lower() == "svm":
        model = OneClassSVM(nu=contamination, kernel="rbf", gamma="scale")
        predictions = model.fit_predict(values)
    elif method.lower() == "zscore":
        mean_val = float(df['value'].mean())
        std_val = float(df['value'].std()) if len(df) > 1 else 1.0
        std_val = std_val if std_val != 0 else 1.0
        z_scores = np.abs((df['value'] - mean_val) / std_val)
        predictions = np.where(z_scores > 2.0, -1, 1)
    else:
        iso = IsolationForest(contamination=contamination, random_state=42)
        predictions = iso.fit_predict(values)

    mean_val = float(df['value'].mean())

    anomalies = []
    for idx, row in df.iterrows():
        is_anomaly = predictions[idx] == -1
        val = float(row['value'])
        deviation = round(((val - mean_val) / (mean_val if mean_val != 0 else 1.0)) * 100, 2)

        if is_anomaly:
            abs_dev = abs(deviation)
            severity = "high" if abs_dev >= 40 else ("medium" if abs_dev >= 20 else "low")
            
            anomalies.append({
                "date": str(row.get('date', f"Day {idx+1}")),
                "value": val,
                "expected": round(mean_val, 2),
                "deviation": deviation,
                "severity": severity,
                "message": f"Metric value deviated by {deviation}% from historical mean of ${round(mean_val, 2)}"
            })

    return anomalies

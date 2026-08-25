import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler

def perform_customer_segmentation(df: pd.DataFrame, method: str = "kmeans") -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """
    Segments customers using KMeans or DBSCAN clustering algorithm.
    Extracts or maps Age, Annual_Income, and Spending_Score columns.
    Returns processed records with Cluster & Label and human-readable cluster summaries.
    """
    if df.empty:
        return [], {}

    cols_lower = {str(c).strip().lower(): c for c in df.columns}

    # Find Age column
    age_col = cols_lower.get("age") or cols_lower.get("customer_age")
    if not age_col:
        num_cols = list(df.select_dtypes(include=[np.number]).columns)
        age_col = num_cols[0] if len(num_cols) > 0 else df.columns[0]

    # Find Annual Income column
    income_col = (
        cols_lower.get("annual_income")
        or cols_lower.get("income")
        or cols_lower.get("annualincome")
        or cols_lower.get("salary")
        or cols_lower.get("revenue")
    )
    if not income_col:
        num_cols = list(df.select_dtypes(include=[np.number]).columns)
        income_col = num_cols[1] if len(num_cols) > 1 else (num_cols[0] if num_cols else df.columns[0])

    # Find Spending Score column
    score_col = (
        cols_lower.get("spending_score")
        or cols_lower.get("spending")
        or cols_lower.get("score")
        or cols_lower.get("spendingscore")
    )
    if not score_col:
        num_cols = list(df.select_dtypes(include=[np.number]).columns)
        score_col = num_cols[2] if len(num_cols) > 2 else (num_cols[-1] if num_cols else df.columns[0])

    # Prepare feature matrix for clustering
    features_df = pd.DataFrame()
    features_df["Age"] = pd.to_numeric(df[age_col], errors="coerce").fillna(30).astype(int)
    features_df["Annual_Income"] = pd.to_numeric(df[income_col], errors="coerce").fillna(50000).astype(float)
    features_df["Spending_Score"] = pd.to_numeric(df[score_col], errors="coerce").fillna(50).astype(int)

    scaler = StandardScaler()
    scaled_matrix = scaler.fit_transform(features_df[["Age", "Annual_Income", "Spending_Score"]])

    n_samples = len(features_df)

    if method.lower() == "dbscan":
        # DBSCAN clustering
        clustering = DBSCAN(eps=0.8, min_samples=min(2, n_samples))
        labels = clustering.fit_predict(scaled_matrix)
    else:
        # KMeans clustering
        n_clusters = min(4, n_samples) if n_samples > 1 else 1
        clustering = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = clustering.fit_predict(scaled_matrix)

    features_df["Cluster"] = labels.tolist()

    # Generate Cluster Labels & Summaries
    cluster_summaries = {}
    label_map = {}

    unique_clusters = sorted(list(set(labels)))

    for c in unique_clusters:
        if c == -1:
            label_name = "Outliers / Unclustered"
            summary_text = "Customers exhibiting unique behavioral patterns not fitting standard density clusters."
        else:
            cluster_data = features_df[features_df["Cluster"] == c]
            avg_income = cluster_data["Annual_Income"].mean()
            avg_score = cluster_data["Spending_Score"].mean()
            avg_age = cluster_data["Age"].mean()

            if avg_income >= 60000 and avg_score >= 60:
                label_name = "High Spenders (Target Luxury Segment)"
            elif avg_income >= 60000 and avg_score < 60:
                label_name = "High Earners, Low Spenders (Careful)"
            elif avg_income < 60000 and avg_score >= 60:
                label_name = "Low Earners, High Spenders (Trendsetters)"
            else:
                label_name = "Budget Conscious / Low Engagement"

            summary_text = (
                f"Cluster {c} ({label_name}): Avg Age ~{round(avg_age)}, "
                f"Avg Income ${round(avg_income):,}, Avg Spending Score {round(avg_score)}/100."
            )

        label_map[c] = label_name
        cluster_summaries[f"Cluster {c}"] = summary_text

    results = []
    for idx, row in features_df.iterrows():
        c_val = int(row["Cluster"])
        results.append({
            "Age": int(row["Age"]),
            "Annual_Income": float(row["Annual_Income"]),
            "Spending_Score": int(row["Spending_Score"]),
            "Cluster": c_val,
            "Label": label_map.get(c_val, f"Cluster {c_val}")
        })

    return results, cluster_summaries

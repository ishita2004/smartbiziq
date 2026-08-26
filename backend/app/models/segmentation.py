import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler

def perform_customer_segmentation(df: pd.DataFrame, method: str = "kmeans") -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """
    Segments customers using KMeans or DBSCAN clustering algorithm.
    Extracts or maps Age, Annual_Income, and Spending_Score columns.
    Calculates actual cluster centroids after clustering and dynamically assigns
    business persona labels based on each cluster's actual computed mean relative
    to overall dataset medians.
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

    # Clean numerical columns (handle strings with currency symbols or commas)
    clean_age = pd.to_numeric(df[age_col].astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce").fillna(30).astype(int)
    clean_income = pd.to_numeric(df[income_col].astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce").fillna(50000).astype(float)
    clean_score = pd.to_numeric(df[score_col].astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce").fillna(50).astype(int)

    features_df = pd.DataFrame({
        "Age": clean_age,
        "Annual_Income": clean_income,
        "Spending_Score": clean_score
    })

    n_samples = len(features_df)
    scaler = StandardScaler()
    scaled_matrix = scaler.fit_transform(features_df[["Annual_Income", "Spending_Score"]])

    if method.lower() == "dbscan":
        # DBSCAN density-based clustering
        clustering = DBSCAN(eps=0.8, min_samples=min(3, max(2, n_samples // 20)))
        labels = clustering.fit_predict(scaled_matrix)
    else:
        # KMeans clustering (default 5 clusters for standard customer segmentation grid, or min(5, n_samples))
        n_clusters = min(5, n_samples) if n_samples > 1 else 1
        clustering = KMeans(n_clusters=n_clusters, random_state=42, n_init=20)
        labels = clustering.fit_predict(scaled_matrix)

    features_df["Cluster"] = labels.tolist()

    # Calculate overall dataset medians for relative segment labeling
    overall_median_income = features_df["Annual_Income"].median()
    overall_median_score = features_df["Spending_Score"].median()

    cluster_summaries = {}
    label_map = {}
    unique_clusters = sorted(list(set(labels)))

    for c in unique_clusters:
        if c == -1:
            label_name = "Outliers / Unclustered"
            summary_text = "Customers with unique behavior not fitting standard density clusters."
        else:
            cluster_data = features_df[features_df["Cluster"] == c]
            avg_income = float(cluster_data["Annual_Income"].mean())
            avg_score = float(cluster_data["Spending_Score"].mean())
            avg_age = float(cluster_data["Age"].mean())

            # Determine business persona dynamically from actual cluster centroids
            is_high_income = avg_income >= overall_median_income
            is_high_spending = avg_score >= overall_median_score

            if is_high_income and is_high_spending:
                label_name = "High Earners, High Spenders (Target Luxury)"
            elif is_high_income and not is_high_spending:
                label_name = "High Earners, Low Spenders (Careful / Savers)"
            elif not is_high_income and is_high_spending:
                label_name = "Low Earners, High Spenders (Trendsetters)"
            else:
                label_name = "Low Earners, Low Spenders (Budget Conscious)"

            summary_text = (
                f"Cluster {c} ({label_name}): Count={len(cluster_data)}, "
                f"Avg Age ~{round(avg_age)}, Avg Income ${round(avg_income):,}, "
                f"Avg Spending Score {round(avg_score, 1)}/100."
            )

        label_map[c] = label_name
        cluster_summaries[f"Cluster {c}"] = summary_text

    results = []
    for idx, row in features_df.iterrows():
        c_val = int(row["Cluster"])
        lbl = label_map.get(c_val, f"Cluster {c_val}")
        results.append({
            "Age": int(row["Age"]),
            "Annual_Income": float(row["Annual_Income"]),
            "Spending_Score": int(row["Spending_Score"]),
            "Cluster": c_val,
            "Label": f"Cluster {c_val} ({lbl})" if c_val != -1 else lbl
        })

    return results, cluster_summaries

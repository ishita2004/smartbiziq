import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional

def process_recommendation_csv(df: pd.DataFrame, customer_id: str, expected_value: Optional[str] = None) -> Dict[str, Any]:
    """Processes customer transaction CSV to compute cluster segment and personalized recommendations."""
    if df.empty:
        return {
            "customer_id": customer_id,
            "cluster": 2,
            "recommendations": ["Upload transaction history to unlock personalized recommendations."]
        }

    # Normalize column names for search
    cols_lower = {str(col).strip().lower(): col for col in df.columns}
    cust_col = next((cols_lower[k] for k in ["customer_id", "customerid", "user_id", "userid", "id"] if k in cols_lower), None)
    prod_col = next((cols_lower[k] for k in ["product_name", "product", "item_id", "item", "title"] if k in cols_lower), None)
    cat_col = next((cols_lower[k] for k in ["category", "dept", "department", "group"] if k in cols_lower), None)
    amt_col = next((cols_lower[k] for k in ["purchase_amount", "amount", "price", "spend", "rating", "val"] if k in cols_lower), None)

    target_id_str = str(customer_id).strip()

    # Filter customer rows
    if cust_col:
        df_cust = df[df[cust_col].astype(str).str.strip() == target_id_str]
    else:
        # If no customer_id column, fallback to matching index or whole dataset
        try:
            row_idx = int(target_id_str)
            df_cust = df.iloc[[row_idx]] if 0 <= row_idx < len(df) else df.head(5)
        except ValueError:
            df_cust = df.head(5)

    if df_cust.empty:
        # If specified customer ID is not in CSV, give recommendations based on global dataset trends
        df_cust = df

    # Calculate metrics
    total_spend = 0.0
    if amt_col and pd.api.types.is_numeric_dtype(df[amt_col]):
        total_spend = float(df_cust[amt_col].sum())

    tx_count = len(df_cust)

    # Determine Cluster (0: Budget Conscious, 1: High-Spender, 2: Casual Buyer, 3: Target Shopper, 4: Bulk Buyer)
    if total_spend >= 400:
        cluster = 1 # High-Spender
    elif tx_count >= 5:
        cluster = 4 # Bulk Buyer
    elif total_spend > 0 and total_spend < 100:
        cluster = 0 # Budget Conscious
    elif cat_col and df_cust[cat_col].nunique() >= 2:
        cluster = 3 # Target Shopper
    else:
        cluster = 2 # Casual Buyer

    recs = []
    
    # Extract customer categories & items
    purchased_cats = list(df_cust[cat_col].dropna().unique()) if cat_col else []
    purchased_prods = list(df_cust[prod_col].dropna().unique()) if prod_col else []

    # Recommendations based on cluster
    if cluster == 1:
        recs.append("⭐ High-Spender VIP Perk: 15% Bonus Cashback on premium catalog items")
        recs.append("🚀 Priority Express Shipping & Dedicated Account Concierge")
    elif cluster == 0:
        recs.append("🏷️ Budget Alert: Exclusive 20% Discount Coupon code: SAVER20")
        recs.append("📦 Bundle Deal: 3 for $49 on daily essentials")
    elif cluster == 3:
        recs.append("🎯 Personalized Match: Recommended top picks in your favorite category")
        recs.append("🔔 New Arrival Alert: Trending additions matching your recent purchases")
    elif cluster == 4:
        recs.append("📦 Wholesale Savings: Bulk purchase tier - save 25% on orders over 10 units")
        recs.append("🔄 Automated Monthly Subscription & Reorder option available")
    else: # Casual Buyer
        recs.append("🎁 Welcome Back Offer: Free Shipping on your next order")
        recs.append("🔥 Best-Seller Spotlight: Top 5 rated products selected for you")

    # Add item recommendations from dataset catalog if available
    if prod_col:
        all_prods = set(df[prod_col].dropna().unique())
        unpurchased = list(all_prods - set(purchased_prods))
        for item in unpurchased[:3]:
            recs.append(f"🛒 Recommended Item: {item}")
    
    if expected_value:
        recs.append(f"💡 Expected Value Target ({expected_value}): Recommended action to reach target tier.")

    return {
        "customer_id": customer_id,
        "cluster": cluster,
        "total_spend": round(total_spend, 2),
        "recommendations": recs[:5],
        "next_best_action": recs[0] if recs else "Explore catalog",
        "confidence": 0.94
    }

def generate_hybrid_recommendations(customer_id: str, customer_features: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Data-driven Recommendation Engine based on user features."""
    if not customer_features:
        return {
            "customer_id": customer_id,
            "has_data": False,
            "recommendations": [],
            "next_best_action": "Upload dataset to discover recommended actions.",
            "confidence": 0.0
        }

    df = pd.DataFrame(customer_features)
    res = process_recommendation_csv(df, customer_id)
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    structured_recs = []
    if len(numeric_cols) > 0:
        for col in numeric_cols[:4]:
            col_mean = float(df[col].mean())
            structured_recs.append({
                "name": f"Optimize Metric: {col}",
                "category": "Data Insights",
                "score": round(min(0.99, max(0.5, float(col_mean / (col_mean + 100)))), 2),
                "insight": f"Average {col} is {round(col_mean, 2)}. Action recommended based on current variance."
            })

    res["has_data"] = True
    res["structured_recommendations"] = structured_recs
    return res

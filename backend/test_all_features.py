import requests
import os
import json

BASE_URL = "http://localhost:8000"
DATA_DIR = os.path.abspath(r"..\data")

print(f"Testing against {BASE_URL}")
print(f"Data directory: {DATA_DIR}")

# 1. Health check
res = requests.get(f"{BASE_URL}/health")
print(f"1. /health -> {res.status_code}: {res.json()}")

# 2. Root check
res = requests.get(f"{BASE_URL}/")
print(f"2. / -> {res.status_code}: {res.json()}")

# 3. Dashboard metrics
res = requests.get(f"{BASE_URL}/dashboard/metrics")
print(f"3. /dashboard/metrics -> {res.status_code}: {res.json()}")

# 4. ETL Ingest dataset (Customer segmentation CSV)
seg_file = os.path.join(DATA_DIR, "smartbiziq_customer_segmentation.csv")
with open(seg_file, "rb") as f:
    res = requests.post(f"{BASE_URL}/etl/ingest", files={"file": ("segmentation.csv", f, "text/csv")})
print(f"4. /etl/ingest -> {res.status_code}: {res.json() if res.status_code == 200 else res.text}")

# 5. Forecast Generate
res = requests.post(f"{BASE_URL}/forecast/generate", json={"periods": 6, "confidence": 0.95})
print(f"5. /forecast/generate -> {res.status_code}")
if res.status_code == 200:
    data = res.json()
    print(f"   Success: model={data.get('model_used')}, periods={len(data.get('predictions', []))}")

# 6. Churn Prediction
churn_file = os.path.join(DATA_DIR, "smartbiziq_customer_churn.csv")
with open(churn_file, "rb") as f:
    res = requests.post(f"{BASE_URL}/churn/predict", files={"file": ("churn.csv", f, "text/csv")})
print(f"6. /churn/predict (with file) -> {res.status_code}")
if res.status_code == 200:
    data = res.json()
    print(f"   Success: records={len(data.get('records', []))}, summary={data.get('summary')}")

# 7. Anomaly Detection
res = requests.post(f"{BASE_URL}/anomaly/detect", json={"lookback_days": 90, "sensitivity": "medium"})
print(f"7. /anomaly/detect -> {res.status_code}")
if res.status_code == 200:
    data = res.json()
    print(f"   Success: total_points={data.get('total_points')}, anomalies_found={data.get('anomalies_found')}")

# 8. Recommendations Upload & Generate
rec_file = os.path.join(DATA_DIR, "smartbiziq_recommendations.csv")
with open(rec_file, "rb") as f:
    res = requests.post(f"{BASE_URL}/upload_and_recommend", files={"file": ("recs.csv", f, "text/csv")})
print(f"8. /upload_and_recommend -> {res.status_code}")
if res.status_code == 200:
    data = res.json()
    print(f"   Success: customer_id={data.get('customer_id')}, recommendations_count={len(data.get('recommendations', []))}")

# 9. Recommendations Generate (User ID)
res = requests.post(f"{BASE_URL}/recommendations/generate", json={"customer_id": "1"})
print(f"9. /recommendations/generate -> {res.status_code}")
if res.status_code == 200:
    data = res.json()
    print(f"   Success: recommendations={len(data.get('recommendations', []))}")

# 10. Chat Message (BizzBOT)
chat_payload = {
    "message": "Summarize the key trends and insights in the uploaded dataset."
}
res = requests.post(f"{BASE_URL}/chat/message", json=chat_payload)
print(f"10. /chat/message -> {res.status_code}")
if res.status_code == 200:
    data = res.json()
    reply_text = data.get('response', data.get('answer', ''))
    print(f"   Reply: {reply_text.encode('ascii', 'ignore').decode('ascii')[:120]}...")

else:
    print(f"   Error: {res.text}")

# 11. ETL Process
etl_file = os.path.join(DATA_DIR, "smartbiziq_etl_dirty.csv")
with open(etl_file, "rb") as f:
    res = requests.post(f"{BASE_URL}/api/etl/process", files={"file": ("dirty.csv", f, "text/csv")})
print(f"11. /api/etl/process -> {res.status_code}")
if res.status_code == 200:
    data = res.json()
    print(f"   Success: cleaned_rows={data.get('cleaned_rows')}, missing_handled={data.get('missing_values_handled')}")
else:
    print(f"   Error: {res.text}")

print("\n--- ALL BACKEND CHECKS COMPLETE ---")

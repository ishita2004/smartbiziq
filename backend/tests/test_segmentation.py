import io
import pytest
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.models.segmentation import perform_customer_segmentation

client = TestClient(app)

def test_perform_customer_segmentation_kmeans():
    df = pd.DataFrame({
        "Age": [25, 45, 30, 50, 22],
        "Annual_Income": [30000, 85000, 90000, 25000, 40000],
        "Spending_Score": [80, 20, 90, 15, 75]
    })
    
    results, summaries = perform_customer_segmentation(df, method="kmeans")
    
    assert len(results) == 5
    assert "Cluster" in results[0]
    assert "Label" in results[0]
    assert len(summaries) > 0

def test_perform_customer_segmentation_dbscan():
    df = pd.DataFrame({
        "Age": [25, 45, 30, 50, 22],
        "Annual_Income": [30000, 85000, 90000, 25000, 40000],
        "Spending_Score": [80, 20, 90, 15, 75]
    })
    
    results, summaries = perform_customer_segmentation(df, method="dbscan")
    
    assert len(results) == 5
    assert "Cluster" in results[0]

def test_column_name_mapping():
    df = pd.DataFrame({
        "customer_age": [28, 42],
        "salary": [50000, 100000],
        "spending": [40, 85]
    })
    results, _ = perform_customer_segmentation(df, method="kmeans")
    assert len(results) == 2

def test_api_segment_customers_success():
    csv_data = "Age,Annual_Income,Spending_Score\n25,30000,80\n45,85000,20\n30,90000,90"
    files = {"file": ("test.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    
    response = client.post("/segmentation/segment-customers?method=kmeans", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_customers"] == 3
    assert len(data["data"]) == 3

def test_api_invalid_file_extension():
    files = {"file": ("test.txt", io.BytesIO(b"dummy data"), "text/plain")}
    response = client.post("/segmentation/segment-customers", files=files)
    assert response.status_code == 400
    assert "Only CSV files are supported" in response.json()["detail"]

def test_api_missing_file():
    response = client.post("/segmentation/segment-customers")
    assert response.status_code == 400

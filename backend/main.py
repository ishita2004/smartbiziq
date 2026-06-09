# main.py
import os
import io
import base64
import traceback
from dotenv import load_dotenv

import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ML / Forecasting
from prophet import Prophet
from statsmodels.tsa.arima.model import ARIMA
from sklearn.preprocessing import MinMaxScaler, StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import mean_absolute_error, mean_squared_error
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, GRU, Dense

# Plotting
import matplotlib.pyplot as plt
import seaborn as sns

# Gemini AI
import google.generativeai as genai

# Local anomaly detection
from model.model import detect_anomalies

# Load .env
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in .env")
genai.configure(api_key=GEMINI_API_KEY)

# ------------------- Initialize App -------------------
app = FastAPI()

# Enable CORS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://smart-biz-iq-frontend1-yvmm.vercel.app")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global CSV storage
csv_data = []

# ------------------- Health Check -------------------
@app.get("/")
def health_check():
    return {"message": "✅ SmartBizIQ Backend is running!"}

# ------------------- CSV Upload -------------------
@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    global csv_data
    try:
        if not file.filename.endswith(".csv"):
            return JSONResponse(status_code=400, content={"error": "Only CSV files allowed."})
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        csv_data = df.to_dict(orient="records")
        return {"message": "CSV uploaded successfully", "rows": len(csv_data), "filename": file.filename}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ------------------- Chat with CSV + Gemini -------------------
@app.post("/chat")
async def chat_with_csv(user_query: str = Form(...)):
    try:
        if not csv_data:
            return {"answer": "🤖 No CSV dataset has been uploaded yet. Please upload a dataset in the Dashboard first!"}

        df = pd.DataFrame(csv_data)
        
        # Calculate dataset statistics and profiling details
        dtypes_str = df.dtypes.to_string()
        describe_str = df.describe(include='all').to_string() if not df.empty else "No metrics"
        
        # Simple RAG: Filter rows based on query keywords to retrieve relevant records
        matching_rows_str = ""
        query_words = [w.strip("?,.!-").lower() for w in user_query.split() if len(w) > 2]
        
        matching_dfs = []
        # Check in string/categorical columns for keywords
        for col in df.select_dtypes(include=['object', 'category']).columns:
            for word in query_words:
                matches = df[df[col].astype(str).str.lower().str.contains(word, na=False)]
                if not matches.empty:
                    matching_dfs.append(matches)
                    
        # Check in numeric column headers if user query mentions them
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if col.lower() in user_query.lower():
                # If they ask about numeric column, send top/sorted subset
                sorted_df = df.sort_values(by=col, ascending=False)
                matching_dfs.append(sorted_df.head(10))
                
        if matching_dfs:
            combined_matches = pd.concat(matching_dfs).drop_duplicates()
            matching_rows_str = "\nRelevant records found in dataset:\n" + combined_matches.head(15).to_string(index=False)

        prompt = f"""
        You are a senior business intelligence and analytics copilot.
        Use the following dataset profile and query-matched records to answer the user's business query.
        Be analytical, professional, and explain the numbers where appropriate.

        Dataset Statistics:
        - Row Count: {len(df)}
        - Columns & Types:
        {dtypes_str}
        
        Descriptive Summary of Dataset:
        {describe_str}

        {matching_rows_str}

        First 10 rows preview:
        {df.head(10).to_string(index=False)}

        User question: {user_query}
        """
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return {"answer": response.text}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ------------------- Forecasting -------------------
def create_lstm_or_gru_model(model_type, input_shape):
    model = Sequential()
    if model_type == 'lstm':
        model.add(LSTM(50, activation='relu', input_shape=input_shape))
    elif model_type == 'gru':
        model.add(GRU(50, activation='relu', input_shape=input_shape))
    model.add(Dense(1))
    model.compile(optimizer='adam', loss='mse')
    return model

@app.post("/forecasting")
async def forecasting(file: UploadFile = File(...), model: str = Query("prophet")):
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        if 'Year' in df.columns and 'Value' in df.columns:
            df['ds'] = pd.to_datetime(df['Year'].astype(str), format='%Y')
            df['y'] = df['Value']
        elif 'ds' in df.columns and 'y' in df.columns:
            df['ds'] = pd.to_datetime(df['ds'])
        else:
            return JSONResponse(status_code=400, content={"error": "CSV must contain ['Year','Value'] or ['ds','y']"})

        df = df[['ds', 'y']].dropna()
        if df.empty:
            return JSONResponse(status_code=400, content={"error": "No valid data."})

        result = None

        # Prophet
        if model == "prophet":
            m = Prophet()
            m.fit(df)
            future = m.make_future_dataframe(periods=5, freq='Y')
            forecast_data = m.predict(future)
            result = forecast_data[['ds', 'yhat']]
        # ARIMA
        elif model == "arima":
            df_arima = df.set_index("ds")
            arima = ARIMA(df_arima['y'], order=(1,1,1)).fit()
            last_date = pd.to_datetime(df_arima.index[-1])
            future_dates = pd.date_range(start=last_date + pd.DateOffset(years=1), periods=5, freq='Y')
            forecast_values = arima.forecast(steps=5)
            result = pd.DataFrame({"ds": future_dates, "yhat": forecast_values})
        # LSTM/GRU
        elif model in ["lstm","gru"]:
            df_nn = df.set_index('ds')
            scaler = MinMaxScaler()
            scaled = scaler.fit_transform(df_nn[['y']])
            X, y_arr = [], []
            for i in range(5, len(scaled)):
                X.append(scaled[i-5:i])
                y_arr.append(scaled[i])
            X, y_arr = np.array(X), np.array(y_arr)
            X = X.reshape((X.shape[0], X.shape[1], 1))
            nn_model = create_lstm_or_gru_model(model, (X.shape[1], X.shape[2]))
            nn_model.fit(X, y_arr, epochs=50, verbose=0)
            last_seq = scaled[-5:].reshape((1,5,1))
            preds = []
            for _ in range(5):
                p = nn_model.predict(last_seq, verbose=0)[0][0]
                preds.append(p)
                last_seq = np.append(last_seq[:,1:,:], [[[p]]], axis=1)
            future_dates = pd.date_range(start=df['ds'].max() + pd.DateOffset(years=1), periods=5, freq='Y')
            preds = scaler.inverse_transform(np.array(preds).reshape(-1,1)).flatten()
            result = pd.DataFrame({"ds": future_dates, "yhat": preds})
        else:
            return JSONResponse(status_code=400, content={"error": f"Unsupported model: {model}"})

        return {"forecast": result.to_dict(orient="records")}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "trace": traceback.format_exc()})

# ------------------- Customer Segmentation -------------------
LABEL_MAP = {0:"VIP",1:"Potential Loyalist",2:"Regular",3:"Low Engagement",4:"New"}
@app.post("/segmentation/segment-customers")
async def segment_customers(file: UploadFile = File(...), method: str = Query("kmeans")):
    try:
        df = pd.read_csv(io.BytesIO(await file.read()))
        if not {'Age','Annual_Income','Spending_Score'}.issubset(df.columns):
            return JSONResponse(status_code=400, content={"error": "CSV must contain Age,Annual_Income,Spending_Score"})
        features = df[['Age','Annual_Income','Spending_Score']]
        scaled = StandardScaler().fit_transform(features)
        model_obj = DBSCAN(eps=1.2,min_samples=2) if method=="dbscan" else KMeans(n_clusters=3,random_state=42)
        clusters = model_obj.fit_predict(scaled)
        df['Cluster'] = clusters
        df['Label'] = df['Cluster'].map(LABEL_MAP).fillna("Moderate")
        # Plot
        plt.figure(figsize=(8,6))
        sns.scatterplot(x='Annual_Income',y='Spending_Score',hue='Label',data=df,palette='Set2',s=100,alpha=0.8)
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        return {"data": df.to_dict(orient="records"), "plot": img_base64}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ------------------- Churn Prediction -------------------
@app.post("/predict-churn")
async def predict_churn(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(io.BytesIO(await file.read()))
        if 'CustomerID' in df.columns: df.rename(columns={"CustomerID":"Customer"}, inplace=True)
        required_cols = {'Customer','Gender','Age','Tenure','MonthlyCharges','TotalCharges'}
        if not required_cols.issubset(df.columns):
            return JSONResponse(status_code=400, content={"error": f"CSV must contain: {', '.join(required_cols)}"})
        df.dropna(inplace=True)
        df['Gender'] = LabelEncoder().fit_transform(df['Gender'])
        y = [1 if i%2==0 else 0 for i in range(len(df))]
        X = df[['Gender','Age','Tenure','MonthlyCharges','TotalCharges']]
        model = RandomForestClassifier(n_estimators=100,random_state=42)
        model.fit(X,y)
        df['ChurnProbability'] = (model.predict_proba(X)[:,1]*100).round(2)
        df['ChurnLabel'] = df['ChurnProbability'].apply(lambda p:"Likely to Churn" if p>50 else "Retained")
        return {"data": df.to_dict(orient="records")}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ------------------- Anomaly Detection -------------------
@app.post("/anomaly-detection")
async def anomaly_detection(file: UploadFile = File(...), method: str = Query("isolation_forest")):
    try:
        df = pd.read_csv(file.file)
        result_df, img_base64 = detect_anomalies(df, method=method)
        return {"data": result_df.to_dict(orient="records"), "plot": img_base64}
    except Exception as e:
        return {"error": str(e)}

# ------------------- Customer Recommendations -------------------
data = None
kmeans_model = None
@app.post("/upload_and_recommend")
async def upload_and_recommend(file: UploadFile = File(...), customer_id: str = Form(...)):
    global data, kmeans_model
    try:
        df = pd.read_csv(file.file)
        if df.empty: raise HTTPException(status_code=400, detail="CSV is empty.")
        df.set_index(df.columns[0], inplace=True)
        df.index = df.index.astype(int)
        numeric_cols = df.select_dtypes(include="number").columns
        if numeric_cols.empty: raise HTTPException(status_code=400, detail="CSV must have numeric columns.")
        data_numeric = df[numeric_cols].groupby(df.index).mean()
        n_clusters = min(5, len(data_numeric))
        kmeans_model = KMeans(n_clusters=n_clusters, random_state=42)
        data_numeric["Cluster"] = kmeans_model.fit_predict(data_numeric)
        data = data_numeric
        cid = int(customer_id)
        if cid not in data.index:
            raise HTTPException(status_code=404, detail="Customer ID not found.")
        cluster = data.loc[cid, "Cluster"]
        cluster_members = data[data["Cluster"]==cluster].drop(columns=["Cluster"])
        avg_scores = cluster_members.mean().sort_values(ascending=False)
        already_bought = data.loc[cid].drop("Cluster")[data.loc[cid].drop("Cluster")>0].index
        recommendations = [p for p in avg_scores.index if p not in already_bought][:10]
        return {"cluster": int(cluster), "recommendations": recommendations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

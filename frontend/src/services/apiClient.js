import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

export const uploadDatasetCSV = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post("/etl/ingest", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  } catch (err) {
    console.error("Upload dataset error:", err);
    throw err;
  }
};

export const clearActiveDataset = async () => {
  try {
    const res = await api.post("/etl/clear");
    return res.data;
  } catch (err) {
    console.error("Clear dataset error:", err);
    throw err;
  }
};

export const fetchDashboardMetrics = async () => {
  try {
    const res = await api.get("/dashboard/metrics");
    return res.data;
  } catch (err) {
    console.warn("Metrics fetch error:", err);
    return null;
  }
};

export const generateForecast = async (params = {}) => {
  try {
    const res = await api.post("/forecast/generate", {
      metric_id: params.metricId || null,
      periods: params.periods || 12,
      confidence: 0.95
    });
    return res.data;
  } catch (err) {
    console.error("Forecast API error:", err);
    throw err;
  }
};

export const fetchModelComparison = async (metricId = null) => {
  try {
    const res = await api.get(`/forecast/compare${metricId ? `?metric_id=${metricId}` : ''}`);
    return res.data;
  } catch (err) {
    console.error("Compare models error:", err);
    return null;
  }
};

export const predictChurn = async (customerIds = null) => {
  try {
    const res = await api.post("/churn/predict", { customer_ids: customerIds });
    return res.data;
  } catch (err) {
    console.error("Churn prediction error:", err);
    throw err;
  }
};

export const fetchChurnSegments = async () => {
  try {
    const res = await api.get("/churn/segments");
    return res.data;
  } catch (err) {
    console.error("Churn segments error:", err);
    return null;
  }
};

export const detectAnomalies = async (sensitivity = "medium") => {
  try {
    const res = await api.post("/anomaly/detect", {
      lookback_days: 90,
      sensitivity
    });
    return res.data;
  } catch (err) {
    console.error("Anomaly detection error:", err);
    throw err;
  }
};

export const fetchActiveAlerts = async () => {
  try {
    const res = await api.get("/anomaly/alerts");
    return res.data;
  } catch (err) {
    console.error("Fetch alerts error:", err);
    return null;
  }
};

export const acknowledgeAlert = async (alertId) => {
  try {
    const res = await api.post("/anomaly/acknowledge", { alert_id: alertId });
    return res.data;
  } catch (err) {
    console.error("Acknowledge alert error:", err);
    throw err;
  }
};

export const generateRecommendations = async (customerId = null) => {
  try {
    const res = await api.post("/recommendations/generate", { customer_id: customerId });
    return res.data;
  } catch (err) {
    console.error("Recommendations error:", err);
    throw err;
  }
};

export const sendChatMessage = async (userMessage) => {
  try {
    const res = await api.post("/chat/message", { message: userMessage });
    return res.data;
  } catch (err) {
    return {
      has_data: false,
      response: "Unable to connect to analytics server. Please ensure the backend service is running and upload your CSV dataset."
    };
  }
};


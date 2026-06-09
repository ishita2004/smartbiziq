import React, { useState } from "react";
import axios from "axios";
import "./RecommendationSystem.css"; // Keep your existing CSS
const BASE_URL = process.env.REACT_APP_BACKEND_URL || "https://smartbiziq-backend-clean-1.onrender.com";

const RecommendationSystem = () => {
  const [file, setFile] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [expectedValue, setExpectedValue] = useState(""); // NEW
  const [recommendations, setRecommendations] = useState([]);
  const [cluster, setCluster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const clusterLabels = {
    0: "🛍️ Budget Conscious",
    1: "💰 High-Spender",
    2: "🧍 Casual Buyer",
    3: "🎯 Target Shopper",
    4: "📦 Bulk Buyer",
  };

  const handleUpload = async () => {
    if (!file || !customerId) {
      setErrorMsg("⚠️ Please upload a file and enter a Customer ID.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setRecommendations([]);
    setCluster(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("customer_id", customerId);
    formData.append("expected_value", expectedValue); // NEW

    try {
  const response = await axios.post(
    `${BASE_URL}/upload_and_recommend`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );

  setRecommendations(response.data.recommendations || []);
  setCluster(response.data.cluster);
} catch (err) {
  const detail =
    err.response?.data?.detail || "🚨 Could not process recommendations.";
  setErrorMsg(detail);
} finally {
  setLoading(false);
}

  };

  return (
    <div className="recommendation-container recommendation-system-container">
      <div className="recommendation-card">
        <h2 className="recommendation-title">🛍️ Smart Product Recommender</h2>

        {/* Upload CSV Box */}
        <div
          className={`upload-box ${file ? "active" : ""}`}
          onClick={() => document.getElementById("fileInput").click()}
        >
          <input
            type="file"
            id="fileInput"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ display: "none" }}
          />
          <div className="upload-icon">⬆️</div>
          <h5>{file ? "File Selected" : "Upload CSV File"}</h5>
          <p>{file ? file.name : "Drag & drop or click to browse"}</p>
        </div>

        <div className="formGroup">
          <label className="label">Enter Customer ID:</label>
          <input
            type="text"
            className="inputText"
            value={customerId}
            placeholder="e.g. 3"
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </div>

        {/* NEW Expected Column Value */}
        <div className="formGroup">
          <label className="label">Expected Column Value:</label>
          <input
            type="text"
            className="inputText"
            value={expectedValue}
            placeholder="e.g. 1000"
            onChange={(e) => setExpectedValue(e.target.value)}
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? "⏳ Processing..." : "🔍 Get Recommendations"}
        </button>

        {errorMsg && <p className="error">{errorMsg}</p>}

        {recommendations.length > 0 && (
          <div className="results">
            <h3 className="resultsHeader">
              🎯 Recommendations for <strong>{customerId}</strong>
              <br />
              Cluster:{" "}
              <strong>{clusterLabels[cluster] ?? `Cluster ${cluster ?? "-"}`}</strong>
            </h3>
            <ul className="list">
              {recommendations.map((item, index) => (
                <li key={index} className="listItem">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && recommendations.length === 0 && cluster && (
          <p className="noResults">
            🙁 No personalized products found for this customer.
          </p>
        )}
      </div>
    </div>
  );
};

export default RecommendationSystem;

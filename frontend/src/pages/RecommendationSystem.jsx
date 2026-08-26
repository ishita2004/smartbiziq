import React, { useState } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

  const handleDownloadPDF = () => {
    try {
      if (!recommendations.length) return;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, 24, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.text("SmartBizIQ - Product Recommendation Report", 14, 11);

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(203, 213, 225);
      const clusterText = clusterLabels[cluster] || `Cluster ${cluster ?? "-"}`;
      pdf.text(`Customer ID: ${customerId} | Profile: ${clusterText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')} | Generated: ${new Date().toLocaleString()}`, 14, 18);

      const tableData = recommendations.map((item, idx) => [
        `#${idx + 1}`,
        item,
        "High Affinity",
        "Personalized Match"
      ]);

      autoTable(pdf, {
        startY: 32,
        head: [["#", "Recommended Product / Item", "Confidence", "Recommendation Engine"]],
        body: tableData,
        margin: { left: 14, right: 14 },
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 }
      });

      pdf.save(`Recommendations_Customer_${customerId}.pdf`);
    } catch (err) {
      console.error(err);
      alert(`❌ PDF Generation Error: ${err.message}`);
    }
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = "customer_id,product_name,category,purchase_amount\n" +
      "1,Wireless Headphones,Electronics,199.99\n" +
      "1,Mechanical Keyboard,Electronics,129.50\n" +
      "2,Espresso Coffee Beans,Grocery,24.99\n" +
      "2,Stainless Steel Water Bottle,Home,19.95\n" +
      "3,4K Ultra HD Monitor,Electronics,349.99\n" +
      "3,Ergonomic Chair,Furniture,229.00\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "smartbiziq_recommendations_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="recommendation-container recommendation-system-container">
      <div className="recommendation-card">
        <h2 className="recommendation-title">🛍️ Smart Product Recommender</h2>

        {/* Accepted CSV Formats Info Block */}
        <div className="csv-format-guide mb-4 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "14px", textAlign: "left" }}>
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span style={{ fontSize: "1.1rem" }}>📋</span>
              <strong style={{ color: "#60a5fa", fontSize: "0.95rem" }}>Accepted CSV Column Formats:</strong>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: "1.5" }}>
              <div>• <strong>Customer Identification:</strong> <code>customer_id</code>, <code>user_id</code>, or <code>CustomerID</code> (e.g. 1, 2, 3)</div>
              <div>• <strong>Item & Purchase Details:</strong> <code>product_name</code> (or <code>item_id</code>), <code>category</code>, <code>purchase_amount</code> (or <code>rating</code>)</div>
            </div>
          </div>
          <button className="btn btn-outline-primary btn-sm" type="button" onClick={handleDownloadSampleCSV} style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
            📥 Download Sample CSV
          </button>
        </div>

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
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h3 className="resultsHeader mb-0">
                🎯 Recommendations for <strong>{customerId}</strong>
                <br />
                Cluster:{" "}
                <strong>{clusterLabels[cluster] ?? `Cluster ${cluster ?? "-"}`}</strong>
              </h3>
              <button
                className="btn btn-outline-primary btn-sm"
                type="button"
                onClick={handleDownloadPDF}
                style={{ fontSize: "0.85rem", padding: "6px 14px" }}
              >
                📄 Download PDF Report
              </button>
            </div>
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

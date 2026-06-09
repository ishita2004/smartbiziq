import React, { useState, useCallback } from "react";
import API from "./api"; // centralized Axios with REACT_APP_BACKEND_URL
import { Container, Card, Form, Button, Alert, Spinner, OverlayTrigger, Tooltip as BootstrapTooltip } from "react-bootstrap";
import { useDropzone } from "react-dropzone";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "./ChurnPrediction.css";

const COLORS = ["#00C49F", "#FF4C4C"]; // Green for Retained, Red for Likely to Churn

const ChurnPrediction = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setFileName(selectedFile?.name || "");
    setResults([]);
    setError("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ".csv" });

  const handleUpload = async () => {
    if (!file) {
      alert("📂 Please upload a CSV file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      // Use centralized API instance (reads backend URL from REACT_APP_BACKEND_URL)
      const res = await API.post("/predict-churn", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(res.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  // Aggregate churn counts for Pie Chart
  const churnSummary = [
    { name: "Retained", value: results.filter(r => r.ChurnLabel.includes("🟢")).length },
    { name: "Likely to Churn", value: results.filter(r => r.ChurnLabel.includes("🔴")).length },
  ];

  return (
    <Container className="churn-container">
      <Card className="churn-card">
        <h2 className="churn-title">Customer Churn Prediction Dashboard</h2>
        <p className="churn-subtitle">
          Upload your customer CSV file to predict churn probability.
        </p>

        <Form className="mb-4">
          <div {...getRootProps()} className={`upload-box ${isDragActive ? "active" : ""}`}>
            <input {...getInputProps()} />
            <div className="upload-icon">⬆️</div>
            <h5>Upload CSV File</h5>
            <p>Drag & drop or click to browse</p>
            {fileName && <small className="text-muted">Selected File: {fileName}</small>}

            <small className="text-muted d-block mt-2">
              <OverlayTrigger
                placement="right"
                overlay={<BootstrapTooltip>CSV must include these columns</BootstrapTooltip>}
              >
                <span style={{ cursor: "help", color: "#0d6efd" }}>ⓘ</span>
              </OverlayTrigger>{" "}
              Supported Columns: <strong>Customer / CustomerID, Gender, Age, Tenure, MonthlyCharges, TotalCharges</strong>
            </small>
          </div>

          <Button variant="dark" className="mt-3" onClick={handleUpload} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : "Upload & Predict"}
          </Button>
        </Form>

        {error && <Alert variant="danger">{error}</Alert>}
        {!results.length && !loading && <Alert variant="info">ℹ️ Upload a CSV to start churn prediction.</Alert>}

        {results.length > 0 && (
          <>
            <h5 className="churn-section-title mt-4">📊 Churn Overview</h5>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={churnSummary}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {churnSummary.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff" }} formatter={(value) => `${value} Customers`} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <h5 className="churn-section-title mt-4">🔍 Prediction Details</h5>
            <div className="table-container">
              <table className="churn-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Gender</th>
                    <th>Age</th>
                    <th>Tenure</th>
                    <th>Monthly Charges</th>
                    <th>Total Charges</th>
                    <th>Churn %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.Customer}</td>
                      <td>{row.Gender === 0 ? "Female" : "Male"}</td>
                      <td>{row.Age}</td>
                      <td>{row.Tenure}</td>
                      <td>${Number(row.MonthlyCharges).toFixed(2)}</td>
                      <td>${Number(row.TotalCharges).toFixed(2)}</td>
                      <td>{row.ChurnProbability}%</td>
                      <td>{row.ChurnLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </Container>
  );
};

export default ChurnPrediction;

import React, { useState, useCallback } from "react";
import API from "./api"; // centralized Axios with REACT_APP_BACKEND_URL
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";
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

  const handleDownloadPDF = () => {
    try {
      if (!results.length) return;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, 24, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.text("SmartBizIQ - Customer Churn Risk Report", 14, 11);

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(203, 213, 225);
      const highRisk = results.filter(r => r.ChurnProbability >= 50).length;
      pdf.text(`Total Customers: ${results.length} | High Risk Churn: ${highRisk} | Generated: ${new Date().toLocaleString()}`, 14, 18);

      const tableRows = results.map(r => [
        r.Customer,
        r.Gender === 0 ? "Female" : "Male",
        r.Age,
        r.Tenure,
        `$${Number(r.MonthlyCharges).toFixed(2)}`,
        `$${Number(r.TotalCharges).toFixed(2)}`,
        `${r.ChurnProbability}%`,
        r.ChurnProbability >= 50 ? "High Risk" : "Retained"
      ]);

      autoTable(pdf, {
        startY: 32,
        head: [["Customer", "Gender", "Age", "Tenure", "Monthly", "Total", "Churn %", "Risk Status"]],
        body: tableRows,
        margin: { left: 14, right: 14 },
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        styles: { fontSize: 8.5, cellPadding: 2.5 }
      });

      pdf.save(`Churn_Prediction_Report.pdf`);
    } catch (err) {
      console.error(err);
      alert(`❌ PDF Generation Error: ${err.message}`);
    }
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = "id,name,tenure_months,monthly_charges,total_charges,support_tickets,contract_type\n" +
      "CUST-101,Acme Corp,24,120.50,2892.00,1,Two Year\n" +
      "CUST-102,Beta Logistics,3,145.00,435.00,5,Month-to-Month\n" +
      "CUST-103,Gamma Solutions,48,65.00,3120.00,0,One Year\n" +
      "CUST-104,Delta Traders,2,110.00,220.00,6,Month-to-Month\n" +
      "CUST-105,Epsilon Global,18,85.00,1530.00,2,Month-to-Month\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "smartbiziq_churn_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      const res = await API.post("/churn/predict-churn", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(res.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || "Prediction failed.");
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
          Upload your customer CSV file to predict churn probability and retention risk.
        </p>

        {/* Accepted CSV Formats Info Block */}
        <div className="csv-format-guide mb-4 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "14px" }}>
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span style={{ fontSize: "1.1rem" }}>📋</span>
              <strong style={{ color: "#60a5fa", fontSize: "0.95rem" }}>Accepted CSV Column Formats:</strong>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: "1.5" }}>
              <div>• <strong>Customer Identification:</strong> <code>Customer</code>, <code>CustomerID</code>, <code>name</code>, or <code>id</code></div>
              <div>• <strong>Customer Usage & Billing:</strong> <code>tenure_months</code> (or <code>Tenure</code>), <code>monthly_charges</code> (or <code>MonthlyCharges</code>), <code>total_charges</code> (or <code>TotalCharges</code>)</div>
              <div>• <strong>Optional Metadata:</strong> <code>support_tickets</code>, <code>contract_type</code>, <code>Gender</code>, <code>Age</code></div>
            </div>
          </div>
          <Button variant="outline-primary" size="sm" onClick={handleDownloadSampleCSV} style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
            📥 Download Sample CSV
          </Button>
        </div>

        <Form className="mb-4">
          <div {...getRootProps()} className={`upload-box ${isDragActive ? "active" : ""}`}>
            <input {...getInputProps()} />
            <div className="upload-icon">⬆️</div>
            <h5>Upload CSV File</h5>
            <p>Drag & drop or click to browse</p>
            {fileName && <small className="text-muted">Selected File: {fileName}</small>}
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

            <div className="d-flex justify-content-between align-items-center mt-4 mb-2 flex-wrap gap-2">
              <h5 className="churn-section-title mb-0">🔍 Prediction Details</h5>
              <Button variant="outline-primary" size="sm" onClick={handleDownloadPDF}>
                📄 Download PDF Report
              </Button>
            </div>
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

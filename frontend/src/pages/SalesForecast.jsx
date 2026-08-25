import React, { useState, useCallback } from "react";
import API from "./api"; // centralized Axios instance
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush
} from "recharts";
import { Spinner, Form, Button, Alert, Card, Container, Row, Col, OverlayTrigger, Tooltip as BootstrapTooltip } from "react-bootstrap";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useDropzone } from "react-dropzone";
import "./SalesForecast.css";

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const filtered = payload.filter(p => !isNaN(p.value));
    if (!filtered.length) return null;

    return (
      <div style={{ background: "#14191eff", border: "1px solid #090f15ff", borderRadius: "8px", padding: "10px", color: "#ffffff" }}>
        <p style={{ margin: 0, fontWeight: "bold" }}>Year: {label}</p>
        {filtered.map((p, idx) => (
          <p key={idx} style={{ color: p.stroke, margin: "4px 0" }}>
            <strong>{p.name}:</strong> ${p.value.toFixed(2)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SalesForecast = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [model, setModel] = useState("prophet");
  const [result, setResult] = useState(null);
  const [historical, setHistorical] = useState([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [allResults, setAllResults] = useState([]);

  // ✅ FIX: Use proper MIME type for CSV files
  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    if (fileRejections.length > 0) {
      setError("❌ Invalid file type or size. Please upload a CSV under 5MB.");
      return;
    }
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setFileName(selectedFile?.name || "");
    setError("");
    setResult(null);
    setSummary("");
    setHistorical([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] }, // ✅ Proper MIME type syntax
    maxSize: 5 * 1024 * 1024, // ✅ 5MB limit
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) {
      alert("📂 Please upload a CSV file before forecasting.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await API.post(`/forecasting?model=${model}`, formData, { headers: { "Content-Type": "multipart/form-data" } });

      // Parse uploaded file for historical data
      const fileText = await file.text();
      const rows = fileText.trim().split("\n");
      const headers = rows[0] ? rows[0].split(",").map(h => h.trim().toLowerCase()) : [];
      const dataRows = rows.slice(1);

      // Find date header index
      const dateHeaderIdx = headers.findIndex(h => ["year", "date", "ds", "time", "timestamp"].includes(h));
      const dateIdx = dateHeaderIdx !== -1 ? dateHeaderIdx : 0;

      // Find value header index
      const valHeaderIdx = headers.findIndex(h => ["value", "y", "sales", "revenue", "amount"].includes(h));
      const valIdx = valHeaderIdx !== -1 ? valHeaderIdx : (headers.length > 1 ? 1 : 0);

      const parsed = dataRows
        .filter(row => row.trim().length > 0)
        .map(row => {
          const values = row.split(",").map(v => v.trim());
          const rawDate = values[dateIdx] || "";
          let yearStr = rawDate;
          if (rawDate.includes("-") || rawDate.includes("/")) {
            const parsedDate = new Date(rawDate);
            if (!isNaN(parsedDate.getTime())) {
              yearStr = parsedDate.getFullYear().toString();
            }
          }
          const val = parseFloat(values[valIdx]) || 0;
          return { ds: yearStr, yhat: val, type: "Historical" };
        });

      setHistorical(parsed);

      const validYears = parsed.map(p => parseInt(p.ds)).filter(n => !isNaN(n));
      const lastHistoricalYear = validYears.length > 0 ? Math.max(...validYears) : 0;

      // Forecasted values from backend
      const forecasted = res.data.forecast
        .map(item => ({
          ds: typeof item.ds === "string" && item.ds.includes("-")
            ? new Date(item.ds).getFullYear().toString()
            : item.ds.toString(),
          yhat: item.yhat,
          type: "Forecast"
        }))
        .filter(f => {
          const fYr = parseInt(f.ds);
          return isNaN(fYr) || fYr > lastHistoricalYear;
        });

      const fullResult = {
        model,
        forecast: forecasted,
        metrics: res.data.metrics,
        summary: res.data.summary,
        bi_insights: res.data.bi_insights
      };

      setResult(fullResult);
      setAllResults(prev => [...prev.filter(r => r.model !== model), fullResult]);
      setSummary(res.data.summary);
      setError("");
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || "❌ Error processing the CSV file.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!result?.forecast?.length) return;
    const csvContent = "Year,Forecasted Sales\n" +
      result.forecast.map(row => `${row.ds},${row.yhat.toFixed(2)}`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${model}_forecast.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = "date,revenue,units_sold,marketing_spend\n" +
      "2024-01-01,45000,450,5000\n" +
      "2024-01-08,47200,470,5200\n" +
      "2024-01-15,46800,465,5100\n" +
      "2024-01-22,49000,490,5500\n" +
      "2024-01-29,51000,510,5800\n" +
      "2024-02-05,53200,530,6000\n" +
      "2024-02-12,52500,520,5900\n" +
      "2024-02-19,55000,550,6200\n" +
      "2024-02-26,58000,575,6500\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "smartbiziq_sales_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReport = async () => {
    const container = document.querySelector(".sales-forecast-container");
    if (!container) return;
    try {
      const canvas = await html2canvas(container, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${model}_forecast_report.pdf`);
    } catch (err) {
      console.error("Report generation failed:", err);
    }
  };

  const forecastedOnly = result?.forecast || [];
  const comparisonYears = Array.from(new Set(allResults.flatMap(r => r.forecast).map(f => f.ds)));

  return (
    <Container className="sales-forecast-container">
      <Card className="forecast-card">
        <h2 className="forecast-title">📈 Sales Forecasting Dashboard</h2>
        <p className="forecast-subtitle">
          Upload historical sales data and choose a forecasting model to predict future revenue & trend.
        </p>

        {/* Accepted CSV Formats Info Block */}
        <div className="csv-format-guide mb-4 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "14px" }}>
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span style={{ fontSize: "1.1rem" }}>📋</span>
              <strong style={{ color: "#60a5fa", fontSize: "0.95rem" }}>Accepted CSV Column Formats:</strong>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: "1.5" }}>
              <div>• <strong>Date Column:</strong> <code>date</code>, <code>ds</code>, <code>year</code>, <code>time</code>, or <code>timestamp</code> (e.g. <code>2024-01-01</code> or <code>2024</code>)</div>
              <div>• <strong>Value Column:</strong> <code>revenue</code>, <code>sales</code>, <code>value</code>, <code>y</code>, or <code>amount</code> (numeric values)</div>
            </div>
          </div>
          <Button variant="outline-primary" size="sm" onClick={handleDownloadSampleCSV} style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
            📥 Download Sample CSV
          </Button>
        </div>

        <Form className="mb-4">
          <Form.Group className="mb-3">
            <Form.Label>
              🔧 Choose Forecasting Model{" "}
              <OverlayTrigger placement="right" overlay={<BootstrapTooltip>
                Prophet is best for seasonality. ARIMA is classical. LSTM/GRU use deep learning.
              </BootstrapTooltip>}>
                <span style={{ cursor: "help", color: "#0d6efd" }}>ⓘ</span>
              </OverlayTrigger>
            </Form.Label>
            <Form.Select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="prophet">Prophet</option>
              <option value="arima">ARIMA</option>
              <option value="lstm">LSTM (Deep Learning)</option>
              <option value="gru">GRU (Deep Learning)</option>
            </Form.Select>
          </Form.Group>

          <div {...getRootProps()} className={`upload-box ${isDragActive ? "active" : ""}`}>
            <input {...getInputProps()} />
            <div className="upload-icon">⬆️</div>
            <h5>Upload CSV File</h5>
            <p>Drag & drop or click to browse</p>
            {fileName && <small className="text-muted">Selected File: {fileName}</small>}
          </div>

          <Button variant="dark" className="mt-3" onClick={handleUpload} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : "Upload & Forecast"}
          </Button>
        </Form>

        {error && <Alert variant="danger">{error}</Alert>}
        {!result && !loading && <Alert variant="info">
          ℹ️ Upload your CSV and choose a model to start forecasting.
        </Alert>}

        {forecastedOnly.length > 0 && (
          <>
            <h4 className="mt-4 mb-3">📈 Forecast Chart (Future Forecast Only)</h4>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={[...historical, ...forecastedOnly]}>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="ds" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="yhat" name={`${model.toUpperCase()} Forecast`} stroke="#007bff" dot={false} strokeWidth={2} />
                <Brush dataKey="ds" height={30} stroke="#8884d8" fill="#1e293b" />
              </LineChart>
            </ResponsiveContainer>

            <Row className="mt-4">
              <Col md={6}>
                <Card className="p-3 forecast-data-card">
                  <h5>Forecasted Sales (Next Years)</h5>
                  <ul>
                    {forecastedOnly.map((item, i) => (
                      <li key={i}><strong>{item.ds}:</strong> ${item.yhat.toFixed(2)}</li>
                    ))}
                  </ul>
                  <p className="text-success">{summary}</p>
                  <Button variant="outline-primary" className="ms-1" onClick={handleDownloadCSV}>⬇️ Download CSV</Button>
                  <Button variant="outline-primary" className="ms-1" onClick={handleDownloadReport}>📄 Download PDF</Button>
                </Card>
              </Col>

              <Col md={6}>
                <Card className="p-3 forecast-compare-card">
                  <h5>Model Comparison</h5>
                  <table className="table table-bordered table-sm model-comparison-table">
                    <thead>
                      <tr>
                        <th>Year</th>
                        {allResults.map(r => <th key={r.model}>{r.model.toUpperCase()}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonYears.map((year, i) => (
                        <tr key={i}>
                          <td>{year}</td>
                          {allResults.map(r => {
                            const found = r.forecast.find(f => f.ds === year);
                            return <td key={r.model}>{found ? `$${found.yhat.toFixed(2)}` : "-"}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {allResults.length > 0 && (
                    <div className="mt-3">
                      <h6>Model Metrics (MAE / MSE / RMSE)</h6>
                      <table className="table table-bordered table-sm">
                        <thead>
                          <tr>
                            <th>Model</th>
                            <th>MAE</th>
                            <th>MSE</th>
                            <th>RMSE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allResults.map(r => (
                            <tr key={r.model}>
                              <td>{r.model.toUpperCase()}</td>
                              <td>{r.metrics?.MAE ?? "-"}</td>
                              <td>{r.metrics?.MSE ?? "-"}</td>
                              <td>{r.metrics?.RMSE ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Card>
    </Container>
  );
};

export default SalesForecast;

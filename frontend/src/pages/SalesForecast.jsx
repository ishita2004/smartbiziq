import React, { useState, useCallback } from "react";
import API from "./api"; // centralized Axios instance
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush
} from "recharts";
import { Spinner, Form, Button, Alert, Card, Container, Row, Col, OverlayTrigger, Tooltip as BootstrapTooltip } from "react-bootstrap";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useDropzone } from "react-dropzone";
import "./SalesForecast.css";

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const filtered = payload.filter(p => p.value !== undefined && !isNaN(p.value));
    if (!filtered.length) return null;

    return (
      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "12px", color: "#ffffff", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
        <p style={{ margin: 0, fontWeight: "bold", color: "#94a3b8", fontSize: "0.85rem", borderBottom: "1px solid #334155", paddingBottom: "4px", marginBottom: "6px" }}>Period: {label}</p>
        {filtered.map((p, idx) => (
          <p key={idx} style={{ color: p.stroke || "#38bdf8", margin: "4px 0", fontSize: "0.9rem" }}>
            <strong>{p.name}:</strong> ${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

  // ✅ Proper MIME type for CSV files
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
    accept: { "text/csv": [".csv"] },
    maxSize: 5 * 1024 * 1024,
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
        .map((row, idx) => {
          const values = row.split(",").map(v => v.trim());
          const rawDate = values[dateIdx] || `P${idx + 1}`;
          const val = parseFloat(values[valIdx]) || 0;
          return { ds: rawDate, actual: val, type: "Historical" };
        });

      // Seamlessly connect the last historical point to the forecast line
      if (parsed.length > 0) {
        parsed[parsed.length - 1].forecast = parsed[parsed.length - 1].actual;
      }

      setHistorical(parsed);

      // Forecasted values from backend
      const forecasted = res.data.forecast.map(item => ({
        ds: String(item.ds),
        forecast: item.yhat,
        lower: item.lower,
        upper: item.upper,
        type: "Forecast"
      }));

      const fullResult = {
        model,
        forecast: forecasted,
        metrics: res.data.metrics,
        summary: res.data.summary,
        bi_insights: res.data.bi_insights
      };

      setResult(fullResult);

      if (res.data.all_models && res.data.all_models.length > 0) {
        setAllResults(res.data.all_models);
      } else {
        setAllResults([fullResult]);
      }

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
    const csvContent = "Period,Forecasted_Sales,Lower_Bound,Upper_Bound\n" +
      result.forecast.map(row => `${row.ds},${row.yhat.toFixed(2)},${row.lower ?? ""},${row.upper ?? ""}`).join("\n");
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

  const handleDownloadReport = () => {
    try {
      if (!result?.forecast?.length) {
        alert("Please generate a forecast first before downloading the PDF report.");
        return;
      }
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // 1. Executive Top Brand Header
      pdf.setFillColor(15, 23, 42); // Slate Navy
      pdf.rect(0, 0, pageWidth, 28, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("SmartBizIQ - Executive Forecasting Report", 14, 12);
      
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(203, 213, 225);
      pdf.text(`Model: ${model.toUpperCase()} | Generated: ${new Date().toLocaleString()} | Source: ${fileName || "Historical Data"}`, 14, 20);

      // 2. Executive Stat Cards
      let startY = 35;
      const cardWidth = (pageWidth - 28 - 9) / 4;
      const metricsData = [
        { label: "TARGET MODEL", val: model.toUpperCase(), color: [59, 130, 246] },
        { label: "RMSE (ERROR)", val: result.metrics?.RMSE != null ? `${result.metrics.RMSE}` : "N/A", color: [16, 185, 129] },
        { label: "MAE (VARIANCE)", val: result.metrics?.MAE != null ? `${result.metrics.MAE}` : "N/A", color: [245, 158, 11] },
        { label: "FORECAST PERIODS", val: `${result.forecast.length} Steps`, color: [139, 92, 246] }
      ];

      metricsData.forEach((m, idx) => {
        const x = 14 + idx * (cardWidth + 3);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(x, startY, cardWidth, 18, 2, 2, "FD");
        
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont("helvetica", "bold");
        pdf.text(m.label, x + 4, startY + 6);

        pdf.setFontSize(10.5);
        pdf.setTextColor(m.color[0], m.color[1], m.color[2]);
        pdf.setFont("helvetica", "bold");
        pdf.text(String(m.val), x + 4, startY + 14);
      });

      startY += 26;

      // 3. Section: Projected Revenue Breakdown
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text("Future Projected Revenue Breakdown", 14, startY);

      const tableBody = result.forecast.map((f, i) => [
        `#${i + 1}`,
        f.ds,
        `$${Number(f.yhat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        f.lower != null ? `$${Number(f.lower).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-",
        f.upper != null ? `$${Number(f.upper).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-",
        "Positive Growth"
      ]);

      autoTable(pdf, {
        startY: startY + 4,
        head: [["#", "Period / Date", "Predicted Revenue", "Lower Bound (95%)", "Upper Bound (95%)", "Trend Trajectory"]],
        body: tableBody,
        margin: { left: 14, right: 14 },
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontSize: 8.5,
          fontStyle: "bold",
          halign: "left"
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      let currentY = (pdf.lastAutoTable ? pdf.lastAutoTable.finalY : startY + 60) + 10;

      // 4. Model Comparison (if available)
      if (allResults.length > 0) {
        if (currentY > pageHeight - 55) {
          pdf.addPage();
          currentY = 20;
        }
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 41, 59);
        pdf.text("Model Performance Metrics (MAE / MSE / RMSE)", 14, currentY);

        const compBody = allResults.map(r => [
          r.model.toUpperCase(),
          r.metrics?.MAE != null ? String(r.metrics.MAE) : "-",
          r.metrics?.MSE != null ? String(r.metrics.MSE) : "-",
          r.metrics?.RMSE != null ? String(r.metrics.RMSE) : "-",
          r.model === "prophet" ? "Additive Trend & Seasonality" : (r.model === "arima" ? "Autoregressive Integrated" : "Deep Neural Sequence")
        ]);

        autoTable(pdf, {
          startY: currentY + 4,
          head: [["Model", "MAE", "MSE", "RMSE", "Architecture / Methodology"]],
          body: compBody,
          margin: { left: 14, right: 14 },
          theme: "grid",
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontSize: 8,
            fontStyle: "bold"
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 2.5
          }
        });
        currentY = (pdf.lastAutoTable ? pdf.lastAutoTable.finalY : currentY + 40) + 10;
      }

      // 5. Strategic BI Insights Box
      if (currentY > pageHeight - 45) {
        pdf.addPage();
        currentY = 20;
      }

      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(191, 219, 254);
      pdf.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, "FD");

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(29, 78, 216);
      pdf.text("Executive Intelligence & Actionable Next Steps", 18, currentY + 7);

      pdf.setFontSize(7.8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 58, 138);
      const insightText = result.bi_insights || "Forecast indicates steady upward revenue trajectory. Recommend optimizing inventory buffer stocks and aligning marketing spend with projected seasonal high-demand periods.";
      const splitInsights = pdf.splitTextToSize(insightText, pageWidth - 36);
      pdf.text(splitInsights, 18, currentY + 14);

      // 6. Professional Footer
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text("SmartBizIQ Analytics Platform - Confidential Executive Report", 14, pageHeight - 8);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 28, pageHeight - 8);
      }

      pdf.save(`${model.toUpperCase()}_Sales_Forecast_Report.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert(`❌ PDF Generation Error: ${err.message || "Unknown error"}`);
    }
  };

  const forecastedOnly = result?.forecast || [];

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
            <h4 className="mt-4 mb-3">📈 Sales Forecast</h4>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={[...historical, ...forecastedOnly]}>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="ds" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                <Line type="monotone" dataKey="actual" name="Actual Sales" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={true} />
                <Line type="monotone" dataKey="forecast" name={`${model === "prophet" ? "Prophet" : model.toUpperCase()} Forecast`} stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} connectNulls={true} />
                <Brush dataKey="ds" height={30} stroke="#8884d8" fill="#1e293b" />
              </LineChart>
            </ResponsiveContainer>

            {result?.bi_insights && (
              <div className="mt-3 p-3" style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "10px", color: "#cbd5e1" }}>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span style={{ fontSize: "1.1rem" }}>💡</span>
                  <strong style={{ color: "#60a5fa" }}>Evaluation & Holdout Strategy:</strong>
                </div>
                <div style={{ fontSize: "0.88rem", lineHeight: "1.5" }}>
                  {result.bi_insights}
                </div>
              </div>
            )}

            <Row className="mt-4">
              <Col md={6}>
                <Card className="p-3 forecast-data-card" style={{ height: "100%" }}>
                  <h5>Forecasted Sales</h5>
                  <ul className="mb-3" style={{ paddingLeft: "1.2rem" }}>
                    {forecastedOnly.map((item, i) => (
                      <li key={i} style={{ margin: "4px 0" }}>
                        <strong>{item.ds}:</strong> ${Number(item.forecast ?? item.yhat ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </li>
                    ))}
                  </ul>
                  {summary && (
                    <div className="mb-3 p-3" style={{ background: "rgba(16, 185, 129, 0.1)", borderLeft: "4px solid #10b981", borderRadius: "6px" }}>
                      <strong style={{ color: "#34d399", display: "block", marginBottom: "4px" }}>Summary:</strong>
                      <div style={{ color: "#f8fafc", fontSize: "0.9rem", lineHeight: "1.5" }}>
                        {summary}
                      </div>
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    <Button variant="outline-primary" size="sm" className="me-2" onClick={handleDownloadCSV}>⬇️ Download CSV</Button>
                    <Button variant="outline-primary" size="sm" onClick={handleDownloadReport}>📄 Download PDF</Button>
                  </div>
                </Card>
              </Col>

              <Col md={6}>
                <Card className="p-3 forecast-compare-card" style={{ height: "100%" }}>
                  <h5>{allResults.length > 1 ? "Model Comparison" : `${model === "prophet" ? "Prophet" : model.toUpperCase()} Model Performance`}</h5>
                  {allResults.length > 0 && (
                    <div className="mt-2">
                      <table className="table table-bordered table-sm text-center">
                        <thead className="table-dark">
                          <tr>
                            <th>Model</th>
                            <th>MAE</th>
                            <th>MSE</th>
                            <th>RMSE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allResults.map(r => (
                            <tr key={r.model} style={r.is_best ? { backgroundColor: "rgba(16, 185, 129, 0.15)", fontWeight: "bold" } : {}}>
                              <td className="text-start">{r.name || r.model.toUpperCase()} {r.is_best ? "🏆" : ""}</td>
                              <td>{r.metrics?.MAE != null ? `$${Number(r.metrics.MAE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</td>
                              <td>{r.metrics?.MSE != null ? Number(r.metrics.MSE).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}</td>
                              <td>{r.metrics?.RMSE != null ? `$${Number(r.metrics.RMSE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</td>
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

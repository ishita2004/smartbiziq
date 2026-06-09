import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Card, Button, Alert } from "react-bootstrap";
import { FaChartLine, FaUsers, FaExclamationTriangle, FaRobot, FaBrain } from "react-icons/fa";
import "./DashboardOverview.css";

const DashboardOverview = () => {
  const [data, setData] = useState([]);
  const [fileName, setFileName] = useState("");
  const [kpis, setKpis] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [dateCol, setDateCol] = useState("");
  const [valCol, setValCol] = useState("");
  const [error, setError] = useState("");

  const calculateKPIs = useCallback((rows, dateHeader, valHeader) => {
    let totalVal = 0;
    let validCounts = 0;
    const values = [];

    rows.forEach(r => {
      const parsed = parseFloat(r[valHeader]);
      if (!isNaN(parsed)) {
        totalVal += parsed;
        values.push(parsed);
        validCounts++;
      }
    });

    const averageVal = validCounts > 0 ? totalVal / validCounts : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 0;
    const minVal = values.length > 0 ? Math.min(...values) : 0;

    setKpis({
      total: totalVal,
      count: rows.length,
      average: averageVal,
      max: maxVal,
      min: minVal,
      valHeader,
      dateHeader
    });

    // Format chart data (limit to first 100 points for performance)
    const formattedChart = rows.slice(0, 100).map(r => ({
      name: r[dateHeader] || "",
      value: parseFloat(r[valHeader]) || 0
    }));
    setChartData(formattedChart);
  }, []);

  // Process CSV rows into structured metrics
  const processData = useCallback((parsedRows, name) => {
    try {
      if (!parsedRows.length) {
        throw new Error("The CSV file is empty.");
      }

      // Filter out empty rows
      const cleanRows = parsedRows.filter(row => Object.values(row).some(v => v !== null && v !== ""));
      if (!cleanRows.length) {
        throw new Error("No valid records found in the CSV.");
      }

      const headers = Object.keys(cleanRows[0]);
      setFileName(name);
      setData(cleanRows);

      // Try to identify date/time column and value column
      let foundDate = headers.find(h => ["year", "date", "ds", "time", "month"].includes(h.toLowerCase())) || headers[0];
      let foundVal = headers.find(h => ["value", "y", "sales", "amount", "revenue"].includes(h.toLowerCase())) || headers.find(h => !isNaN(parseFloat(cleanRows[0][h])));

      setDateCol(foundDate);
      setValCol(foundVal);

      calculateKPIs(cleanRows, foundDate, foundVal);
      setError("");
    } catch (err) {
      console.error(err);
      setError(`❌ Error parsing file: ${err.message}`);
    }
  }, [calculateKPIs]);

  // Dropzone Handlers
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        processData(results.data, file.name);
      },
      error: (err) => {
        setError(`❌ CSV parse error: ${err.message}`);
      }
    });
  }, [processData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false
  });

  // Load static demo dataset
  const loadDemoData = () => {
    const demoData = [
      { Year: "2015", Value: "44500" },
      { Year: "2016", Value: "47000" },
      { Year: "2017", Value: "49500" },
      { Year: "2018", Value: "52000" },
      { Year: "2019", Value: "54000" },
      { Year: "2020", Value: "55000" },
      { Year: "2021", Value: "59000" },
      { Year: "2022", Value: "62000" },
      { Year: "2023", Value: "64500" },
      { Year: "2024", Value: "66000" }
    ];
    processData(demoData, "demo_sales_trends.csv");
  };

  return (
    <div className="dashboard-container">
      <div className="welcome-section">
        <h1 className="welcome-title">SmartBizIQ 2.0</h1>
        <p className="welcome-subtitle">AI Business Operating System — Data, Analytics, & Insights</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Main Uploader / Dashboard Interface */}
      {data.length === 0 ? (
        <Card className="dashboard-card text-center">
          <div {...getRootProps()} className={`upload-zone ${isDragActive ? "active" : ""}`}>
            <input {...getInputProps()} />
            <span className="upload-zone-icon">📁</span>
            <h3>Upload Business Dataset</h3>
            <p className="text-muted">Drag and drop your transaction, sales, or financial CSV here, or click to browse</p>
          </div>
          <div className="mt-3">
            <span className="text-muted mr-3">Want to preview the system?</span>&nbsp;
            <Button onClick={loadDemoData} className="demo-btn">
              ✨ Load Demo Sales Data
            </Button>
          </div>
        </Card>
      ) : (
        <div>
          {/* Active File Banner */}
          <div className="active-dataset-banner d-flex justify-content-between align-items-center mb-4">
            <div>
              <span className="text-muted">Analyzing dataset:</span> <strong>{fileName}</strong>
            </div>
            <Button variant="outline-light" size="sm" onClick={() => setData([])}>
              Reset Dataset
            </Button>
          </div>

          {/* KPIs Summary Grid */}
          {kpis && (
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-title">Total {kpis.valHeader}</span>
                <span className="kpi-value">${kpis.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className="kpi-trend positive">▲ 100% Parsed</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-title">Average Transaction</span>
                <span className="kpi-value">${kpis.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className="kpi-trend neutral">Mean Value</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-title">Total Records</span>
                <span className="kpi-value">{kpis.count}</span>
                <span className="kpi-trend positive">Transactions Count</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-title">Peak Value</span>
                <span className="kpi-value">${kpis.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className="kpi-trend positive">Max Record</span>
              </div>
            </div>
          )}

          {/* Charts & Data Preview Grid */}
          <div className="dashboard-grid">
            <Card className="chart-card">
              <h4 className="mb-4 text-white">📈 Sales & Metric Trend</h4>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007bff" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#007bff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff" }} />
                  <Area type="monotone" dataKey="value" stroke="#007bff" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="table-card">
              <h4 className="mb-4 text-white">📋 Data Preview</h4>
              <div className="table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{dateCol}</th>
                      <th>{valCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{row[dateCol]}</td>
                        <td>{row[valCol]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Analytical Modules Access */}
          <Card className="dashboard-card">
            <h4 className="text-white">🧠 Run Analytics Modules</h4>
            <p className="text-muted">Take this dataset and feed it into our predictive model systems:</p>
            <div className="module-links-grid">
              <Link to="/sales-forecasting" className="module-link-card">
                <span className="module-link-icon"><FaChartLine /></span>
                <div>
                  <strong>Sales Forecasting</strong>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Prophet, ARIMA, LSTM</div>
                </div>
              </Link>
              <Link to="/customer-segmentation" className="module-link-card">
                <span className="module-link-icon"><FaUsers /></span>
                <div>
                  <strong>Segmentation</strong>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>KMeans, DBSCAN clustering</div>
                </div>
              </Link>
              <Link to="/churn-prediction" className="module-link-card">
                <span className="module-link-icon"><FaExclamationTriangle /></span>
                <div>
                  <strong>Churn Prediction</strong>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Random Forest retention</div>
                </div>
              </Link>
              <Link to="/anomaly-detection" className="module-link-card">
                <span className="module-link-icon"><FaRobot /></span>
                <div>
                  <strong>Anomaly Detection</strong>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Fraud & Outlier discovery</div>
                </div>
              </Link>
              <Link to="/recommendation-system" className="module-link-card">
                <span className="module-link-icon"><FaBrain /></span>
                <div>
                  <strong>Recommendations</strong>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>Cross-selling strategies</div>
                </div>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;

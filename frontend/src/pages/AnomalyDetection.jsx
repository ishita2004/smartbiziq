import React, { useState, useCallback } from 'react';
import API from './api'; // centralized Axios
import { Container, Card, Form, Button, Alert, Spinner, OverlayTrigger, Tooltip as BootstrapTooltip } from 'react-bootstrap';
import { useDropzone } from 'react-dropzone';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './AnomalyDetection.css';

const AnomalyDetection = () => {
  const [file, setFile] = useState(null);
  const [method, setMethod] = useState('isolation_forest');
  const [fileName, setFileName] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const methodDescriptions = {
    isolation_forest: "Uses decision trees to isolate anomalies quickly. Best for high-dimensional data.",
    svm: "One-Class Support Vector Machine. Good for data with tight boundaries.",
    zscore: "Identifies outliers using standard deviation thresholds. Simple but effective for numeric data."
  };

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setFileName(selectedFile?.name || '');
    setResults([]);
    setError('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: '.csv' });

  const handleUpload = async () => {
    if (!file) {
      alert('📂 Please upload a CSV file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await API.post(`/anomaly-detection?method=${method}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResults(res.data.data || []);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Detection failed. Please check your CSV format.');
    } finally {
      setLoading(false);
    }
  };

  const scatterData = results.map(r => ({
    x: r.Feature1,
    y: r.Feature2,
    anomaly: r.Anomaly
  }));

  return (
    <Container className="anomaly-container">
      <Card className="anomaly-card">
        <h2 className="anomaly-title">🔍 Anomaly Detection Dashboard</h2>
        <p className="anomaly-subtitle">
          Upload a CSV file and select a detection method to identify unusual patterns or outliers.
        </p>

        <Form className="mb-4">
          <Form.Group className="mb-3">
            <Form.Label>🧠 Detection Method</Form.Label>
            <Form.Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="isolation_forest">Isolation Forest</option>
              <option value="svm">One-Class SVM</option>
              <option value="zscore">Z-Score</option>
            </Form.Select>
            <Form.Text className="method-desc-text">{methodDescriptions[method]}</Form.Text>
          </Form.Group>

          <div {...getRootProps()} className={`upload-box ${isDragActive ? 'active' : ''}`}>
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
              Supported Columns: <strong>Feature1, Feature2 (numeric columns required)</strong>
            </small>
          </div>

          <Button variant="dark" className="mt-3" onClick={handleUpload} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : '🚀 Detect Anomalies'}
          </Button>
        </Form>

        {error && <Alert variant="danger">{error}</Alert>}

        {results.length > 0 && (
          <>
            <h5 className="anomaly-section-title mt-4">📊 Anomaly Scatter Plot</h5>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="Feature 1" stroke="#94a3b8" />
                  <YAxis type="number" dataKey="y" name="Feature 2" stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff" }} cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  <Scatter name="Data Points" data={scatterData} fill="#00C49F" shape="circle">
                    {scatterData.map((entry, index) => (
                      <circle
                        key={`dot-${index}`}
                        cx={0}
                        cy={0}
                        r={5}
                        fill={entry.anomaly === 1 ? '#FF4C4C' : '#00C49F'}
                        stroke="#644848ff"
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <h5 className="anomaly-section-title mt-4">📋 Detection Results</h5>
            <div className="table-container">
              <table className="anomaly-table">
                <thead>
                  <tr>
                    {Object.keys(results[0]).map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr key={idx} className={row.Anomaly === 1 ? 'anomaly-row-danger' : ''}>
                      {Object.values(row).map((val, i) => (
                        <td key={i}>{val}</td>
                      ))}
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

export default AnomalyDetection;

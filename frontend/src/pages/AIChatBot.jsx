import React, { useState, useCallback, useRef, useEffect } from "react";
import { Form, Button, Spinner, Alert, OverlayTrigger, Tooltip } from "react-bootstrap";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import { Link } from "react-router-dom";
import {
  FaRobot,
  FaUser,
  FaCopy,
  FaCheck,
  FaVolumeUp,
  FaVolumeMute,
  FaTrash,
  FaDownload,
  FaChartLine,
  FaUsers,
  FaExclamationTriangle,
  FaFileCsv,
  FaLightbulb,
  FaPaperPlane
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import "./AIChatBot.css";

// Auto-switch: Localhost for dev, Render for production
const BASE_URL =
  (process.env.NODE_ENV === "production"
    ? "https://smartbiziq-backend-clean-1.onrender.com"
    : process.env.REACT_APP_BACKEND_URL || "http://localhost:8000")?.trim();

const SAMPLE_PRESETS = [
  { id: "business", label: "🏢 Retail Business", desc: "Store revenue, footfall & margins" },
  { id: "sales", label: "📈 Sales Trends", desc: "Time-series revenue & demand" },
  { id: "segmentation", label: "👥 Segmentation", desc: "Income & spending patterns" },
  { id: "churn", label: "⚠️ Churn Risk", desc: "Customer tenure & churn labels" },
  { id: "anomaly", label: "🔍 Anomaly Detection", desc: "Outlier activity & spikes" },
];

const DEFAULT_SUGGESTIONS = [
  "📊 Summarize key metrics and insights in this dataset",
  "🏆 Which segment or location generates highest revenue?",
  "🚨 Are there any notable anomalies or outliers?",
  "💡 Give me strategic business recommendations",
  "🔗 Check correlations between numeric metrics",
];

const CHART_COLORS = ["#f8d34d", "#ff9800", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

// Custom Lightweight Markdown & Rich Content Formatter
const FormattedMarkdown = ({ content }) => {
  if (!content) return null;

  const renderFormattedText = (text) => {
    // Split text by lines
    const lines = text.split("\n");
    const elements = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Heading 3 or 4
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h4 key={idx} className="md-h3">
            {parseInline(trimmed.substring(4))}
          </h4>
        );
      } else if (trimmed.startsWith("## ") || trimmed.startsWith("📊 ") || trimmed.startsWith("🏆 ") || trimmed.startsWith("🚨 ") || trimmed.startsWith("💡 ") || trimmed.startsWith("📈 ") || trimmed.startsWith("🔗 ")) {
        elements.push(
          <h3 key={idx} className="md-h2">
            {parseInline(trimmed.startsWith("## ") ? trimmed.substring(3) : trimmed)}
          </h3>
        );
      } else if (trimmed.startsWith("# ")) {
        elements.push(
          <h2 key={idx} className="md-h1">
            {parseInline(trimmed.substring(2))}
          </h2>
        );
      }
      // Bullet list items
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <div key={idx} className="md-list-item">
            <span className="md-bullet">✦</span>
            <span>{parseInline(trimmed.substring(2))}</span>
          </div>
        );
      }
      // Numbered list items
      else if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s(.*)/);
        elements.push(
          <div key={idx} className="md-list-item numbered">
            <span className="md-number">{match[1]}.</span>
            <span>{parseInline(match[2])}</span>
          </div>
        );
      }
      // Empty line / spacer
      else if (trimmed === "") {
        elements.push(<div key={idx} className="md-spacer" />);
      }
      // Standard paragraph
      else {
        elements.push(
          <p key={idx} className="md-p">
            {parseInline(line)}
          </p>
        );
      }
    });

    return elements;
  };

  const parseInline = (str) => {
    // Replace bold **text** and code `text`
    const parts = [];
    // Regex for bold **..** and inline code `..`
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={match.index} className="md-bold">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code key={match.index} className="md-code">
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  return <div className="formatted-markdown-container">{renderFormattedText(content)}</div>;
};

// Inline Mini Visualization Component
const MiniChartCard = ({ data }) => {
  if (!data) return null;

  const { chart_type, title, labels, values, kpi_list } = data;

  if (chart_type === "kpis" && kpi_list && kpi_list.length > 0) {
    return (
      <div className="mini-chart-card">
        {title && <div className="mini-chart-title">{title}</div>}
        <div className="mini-kpi-grid">
          {kpi_list.map((kpi, i) => (
            <div key={i} className="mini-kpi-badge">
              <span className="mini-kpi-label">{kpi.label}</span>
              <span className="mini-kpi-val">{kpi.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!labels || !values || labels.length === 0) return null;

  const chartData = labels.map((lbl, idx) => ({
    name: lbl,
    value: values[idx] || 0,
  }));

  return (
    <div className="mini-chart-card">
      {title && <div className="mini-chart-title">📊 {title}</div>}
      <div className="mini-chart-wrapper">
        {chart_type === "line" ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "rgba(248, 211, 77, 0.3)",
                  borderRadius: "8px",
                  color: "#f8d34d",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f8d34d"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#ff9800" }}
                activeDot={{ r: 5, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : chart_type === "pie" ? (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={65}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "rgba(248, 211, 77, 0.3)",
                  borderRadius: "8px",
                  color: "#f8d34d",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "rgba(248, 211, 77, 0.3)",
                  borderRadius: "8px",
                  color: "#f8d34d",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill="#f8d34d" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`bar-cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

const AIChatbot = () => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "🤖 **Welcome to SmartBizIQ BizzBOT 2.0!**\n\nI am your Autonomous Business Intelligence Analyst. Select a sample business dataset below or upload a custom CSV to get instant statistical answers, correlation drivers, outlier alerts, and executive strategic recommendations.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [activeDataset, setActiveDataset] = useState(null);
  const [activeSuggestions, setActiveSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [speakingIdx, setSpeakingIdx] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Check dataset status on load
  const fetchDatasetStatus = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/chat/dataset-info`);
      if (res.data && res.data.has_data) {
        setActiveDataset(res.data);
      }
    } catch (e) {
      console.warn("Dataset status check error", e);
    }
  };

  useEffect(() => {
    fetchDatasetStatus();
  }, []);

  // Dropzone Setup
  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    if (fileRejections.length > 0) {
      setUploadMsg("❌ Invalid file format or size. Please upload a CSV file under 5MB.");
      setFile(null);
      setFileName("");
      return;
    }
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setUploadMsg("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  // Upload custom CSV Handler
  const handleUpload = async () => {
    if (!file) {
      setUploadMsg("⚠️ Please select a CSV file first!");
      return;
    }

    setUploading(true);
    setUploadMsg("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${BASE_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadMsg(`✅ ${res.data.message} (${res.data.rows} records)`);
      setActiveDataset({
        has_data: true,
        filename: file.name,
        rows: res.data.rows,
        columns: res.data.columns || [],
      });
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `📂 **Dataset Successfully Ingested**: \`${file.name}\` (${res.data.rows} rows, ${res.data.columns?.length || 0} columns).\n\nYou can now ask me to calculate totals, compare categories, detect anomalies, or forecast trends!`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      console.error(err);
      setUploadMsg("❌ CSV upload failed. Please verify file format.");
    } finally {
      setUploading(false);
    }
  };

  // Load Preset Sample Dataset
  const handleLoadSample = async (sampleId) => {
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/chat/load-sample/${sampleId}`);
      if (res.data.status === "success") {
        setActiveDataset({
          has_data: true,
          filename: res.data.filename,
          rows: res.data.rows,
          columns: res.data.columns,
        });
        setFileName(res.data.filename);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: res.data.welcome_message,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setActiveSuggestions([
          `Show breakdown of ${res.data.columns[1] || "metrics"} by ${res.data.columns[0]}`,
          `Are there any outliers in ${res.data.columns[res.data.columns.length - 1]}?`,
          "Give me executive business recommendations based on this dataset",
          "What are the top 5 highest records?",
        ]);
      }
    } catch (err) {
      console.error("Failed to load sample dataset", err);
    } finally {
      setLoading(false);
    }
  };

  // Ask AI Handler
  const handleAsk = async (customQuestion) => {
    const queryToSend = (customQuestion || question).trim();
    if (!queryToSend) return;

    // Append User message
    const userTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { sender: "user", text: queryToSend, time: userTime }]);
    setQuestion("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("user_query", queryToSend);

      const res = await axios.post(`${BASE_URL}/chat`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const reply = res.data.answer || res.data.response || "🤖 No response from AI.";
      const structuredData = res.data.structured_data || null;
      const aiTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: reply,
          structured_data: structuredData,
          time: aiTime,
        },
      ]);

      if (res.data.follow_ups && res.data.follow_ups.length > 0) {
        setActiveSuggestions(res.data.follow_ups);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "❌ **Connection Error**: Unable to reach backend analytics engine. Please make sure the backend server is running on `http://localhost:8000`.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Copy Message to Clipboard
  const handleCopy = (text, idx) => {
    const cleanText = text.replace(/[*_`#]/g, "");
    navigator.clipboard.writeText(cleanText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Text to Speech
  const handleSpeak = (text, idx) => {
    if (!window.speechSynthesis) return;

    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_`#]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingIdx(idx);
  };

  // Clear Chat History
  const handleClearChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setMessages([
      {
        sender: "ai",
        text: "🧹 Conversation history cleared. Ask me any new question about your business dataset!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  // Export Chat Conversation
  const handleExportChat = () => {
    const lines = messages.map(
      (m) => `[${m.time}] ${m.sender === "user" ? "User" : "BizzBOT"}:\n${m.text}\n`
    );
    const content = `SmartBizIQ BizzBOT Analytics Session Transcript\nExported on: ${new Date().toLocaleString()}\nDataset: ${activeDataset?.filename || "None"}\n\n===============================\n\n` + lines.join("\n-------------------------------\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SmartBizIQ_BizzBOT_Report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chat-container">
      <div className="chat-card">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="header-left">
            <div className="bot-avatar-pulse">
              <FaRobot className="bot-avatar-icon" />
              <span className="pulse-indicator" />
            </div>
            <div>
              <div className="title-row">
                <h2 className="chat-title">SmartBizIQ BizzBOT</h2>
                <span className="copilot-badge">AI Data Copilot</span>
              </div>
              <p className="chat-subtitle">
                Autonomous Natural Language Analytics & Executive Business Intelligence
              </p>
            </div>
          </div>

          <div className="header-actions">
            {activeDataset && activeDataset.has_data && (
              <div className="dataset-status-pill">
                <span className="status-dot online" />
                <span className="dataset-name-text">
                  {activeDataset.filename} ({activeDataset.rows} rows)
                </span>
              </div>
            )}
            <OverlayTrigger placement="bottom" overlay={<Tooltip>Export Chat Transcript</Tooltip>}>
              <button className="action-icon-btn" onClick={handleExportChat}>
                <FaDownload />
              </button>
            </OverlayTrigger>
            <OverlayTrigger placement="bottom" overlay={<Tooltip>Clear Conversation</Tooltip>}>
              <button className="action-icon-btn" onClick={handleClearChat}>
                <FaTrash />
              </button>
            </OverlayTrigger>
          </div>
        </div>

        {/* Quick Sample Dataset Bar */}
        <div className="quick-presets-bar">
          <span className="presets-label">
            <FaFileCsv style={{ color: "#f8d34d" }} /> Quick Datasets:
          </span>
          <div className="presets-chips">
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`preset-chip ${activeDataset?.filename?.includes(preset.id) ? "active" : ""}`}
                onClick={() => handleLoadSample(preset.id)}
                disabled={loading}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* CSV Upload Inline Bar */}
        <div className="chat-upload-bar">
          <div
            {...getRootProps()}
            className={`chat-dropzone ${isDragActive ? "active" : ""} ${fileName ? "selected" : ""}`}
          >
            <input {...getInputProps()} />
            {fileName ? (
              <span className="dropzone-text selected">📂 Active CSV: {fileName}</span>
            ) : (
              <span className="dropzone-text">
                📥 Drag & drop custom CSV here or click to browse (up to 5MB)
              </span>
            )}
          </div>
          <Button
            variant="warning"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="chat-upload-btn"
          >
            {uploading ? (
              <>
                <Spinner animation="border" size="sm" style={{ marginRight: "6px" }} /> Parsing...
              </>
            ) : (
              "Upload CSV"
            )}
          </Button>
        </div>

        {uploadMsg && (
          <Alert
            variant={uploadMsg.startsWith("❌") ? "danger" : "success"}
            className={`chat-alert ${uploadMsg.startsWith("❌") ? "error" : "success"}`}
          >
            {uploadMsg}
          </Alert>
        )}

        {/* Chat Messages Stream */}
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.sender}`}>
              <div className="message-avatar">
                {msg.sender === "ai" ? <FaRobot /> : <FaUser />}
              </div>
              <div className={`message-bubble ${msg.sender}`}>
                <div className="message-content">
                  {msg.sender === "ai" ? (
                    <>
                      <FormattedMarkdown content={msg.text} />
                      {msg.structured_data && <MiniChartCard data={msg.structured_data} />}
                    </>
                  ) : (
                    <span>{msg.text}</span>
                  )}
                </div>

                <div className="message-footer">
                  <span className="message-time">{msg.time}</span>
                  {msg.sender === "ai" && (
                    <div className="message-actions">
                      <button
                        className="bubble-action-btn"
                        onClick={() => handleCopy(msg.text, idx)}
                        title="Copy text"
                      >
                        {copiedIdx === idx ? <FaCheck style={{ color: "#10b981" }} /> : <FaCopy />}
                      </button>
                      <button
                        className="bubble-action-btn"
                        onClick={() => handleSpeak(msg.text, idx)}
                        title={speakingIdx === idx ? "Mute speech" : "Read aloud"}
                      >
                        {speakingIdx === idx ? (
                          <FaVolumeMute style={{ color: "#f87171" }} />
                        ) : (
                          <FaVolumeUp />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-wrapper ai">
              <div className="message-avatar">
                <FaRobot />
              </div>
              <div className="message-bubble ai loading-bubble">
                <div className="typing-indicator">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
                <span className="loading-text">BizzBOT is computing statistical insights...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Contextual Suggestion Chips */}
        <div className="suggestion-container">
          <div className="suggestion-title">
            <FaLightbulb style={{ color: "#f8d34d", marginRight: "6px" }} /> Recommended Questions:
          </div>
          <div className="suggestion-chips-grid">
            {activeSuggestions.map((sug, idx) => (
              <div
                key={idx}
                className="suggestion-chip"
                onClick={() => handleAsk(sug)}
                title="Click to ask"
              >
                {sug}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Module Jump Links */}
        <div className="module-shortcuts-bar">
          <span className="shortcuts-label">⚡ Direct Jump:</span>
          <Link to="/sales-forecasting" className="module-link">
            <FaChartLine /> Sales Forecast
          </Link>
          <Link to="/customer-segmentation" className="module-link">
            <FaUsers /> Segmentation
          </Link>
          <Link to="/anomaly-detection" className="module-link">
            <FaExclamationTriangle /> Anomaly Detection
          </Link>
        </div>

        {/* Chat Input Bar */}
        <div className="chat-input-bar">
          <Form.Control
            type="text"
            className="chat-input-field"
            placeholder="Ask BizzBOT anything (e.g. 'Show breakdown by location', 'Find top 3 sales records', 'Are there any anomalies?')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !loading) {
                e.preventDefault();
                handleAsk();
              }
            }}
          />
          <Button
            className="chat-send-btn"
            onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
          >
            <FaPaperPlane style={{ marginRight: "6px" }} /> Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatbot;

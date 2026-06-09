import React, { useState, useCallback, useRef, useEffect } from "react";
import { Form, Button, Spinner, Alert } from "react-bootstrap";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import "./AIChatBot.css";

// Auto-switch: Localhost for dev, Render for production
const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://smartbiziq-backend-clean-1.onrender.com"
    : process.env.REACT_APP_BACKEND_URL;

const SUGGESTIONS = [
  "What are the key statistics of the loaded dataset?",
  "Summarize the main patterns or insights in the data.",
  "Which columns have the highest value or correlation?",
  "Are there any notable anomalies or outliers in this data?",
];

const AIChatbot = () => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "🤖 Hello! Upload a CSV file and ask me anything about your business data.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // File Drop Handler
  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    if (fileRejections.length > 0) {
      setUploadMsg("❌ Invalid file type or size. Please upload a CSV under 5MB.");
      setFile(null);
      setFileName("");
      return;
    }
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setUploadMsg("");
  }, []);

  // Dropzone Setup
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxSize: 5 * 1024 * 1024, // 5 MB
    multiple: false,
  });

  // Upload CSV Handler
  const handleUpload = async () => {
    if (!file) {
      alert("📂 Please select a CSV file first!");
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
      setUploadMsg(`✅ ${res.data.message} (${res.data.rows} rows)`);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `📂 Successfully loaded "${file.name}" (${res.data.rows} rows). You can now ask questions about this dataset!`,
        },
      ]);
    } catch (err) {
      console.error(err);
      setUploadMsg("❌ CSV upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Ask AI Handler
  const handleAsk = async (customQuestion) => {
    const queryToSend = customQuestion || question;
    if (!queryToSend.trim()) return;

    // Append User message
    setMessages((prev) => [...prev, { sender: "user", text: queryToSend }]);
    setQuestion("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("user_query", queryToSend);

      const res = await axios.post(`${BASE_URL}/chat`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const reply = res.data.answer || "🤖 No response from AI.";
      setMessages((prev) => [...prev, { sender: "ai", text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "❌ Failed to retrieve a response. Please make sure the backend server is running and a dataset has been uploaded.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-card">
        {/* Chat Header */}
        <div className="chat-header">
          <h2 className="chat-title">SmartBizIQ BizzBOT</h2>
          <p className="chat-subtitle">CSV-aware Business Analytics Copilot</p>
        </div>

        {/* CSV Upload Inline Bar */}
        <div className="chat-upload-bar">
          <div
            {...getRootProps()}
            className={`chat-dropzone ${isDragActive ? "active" : ""} ${fileName ? "selected" : ""}`}
          >
            <input {...getInputProps()} />
            {fileName ? (
              <span className="dropzone-text selected">📂 {fileName}</span>
            ) : (
              <span className="dropzone-text">
                Drag & drop dataset CSV here or click to browse
              </span>
            )}
          </div>
          <Button
            variant="warning"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="chat-upload-btn"
          >
            {uploading ? <Spinner animation="border" size="sm" /> : "Upload"}
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

        {/* Chat Messages Log */}
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-bubble ${msg.sender}`}>
              {msg.text}
            </div>
          ))}
          {loading && (
            <div className="message-bubble ai" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Spinner animation="grow" size="sm" variant="warning" style={{ backgroundColor: "#f8d34d" }} />
              <span style={{ fontStyle: "italic", color: "#b0b0a5" }}>BizzBOT is analyzing your data...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="suggestion-container">
          {SUGGESTIONS.map((sug, idx) => (
            <div key={idx} className="suggestion-chip" onClick={() => handleAsk(sug)}>
              {sug}
            </div>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="chat-input-bar">
          <Form.Control
            type="text"
            className="chat-input-field"
            placeholder="Ask a question about your business dataset..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
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
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatbot;

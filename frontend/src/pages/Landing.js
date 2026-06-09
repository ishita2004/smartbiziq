import React from "react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div style={container}>
      <h1 style={title}>📊 Welcome to SmartBizIQ</h1>
      <p style={subtitle}>Empowering businesses with smart analytics & forecasting</p>
      <div style={btnContainer}>
        <Link to="/login">
          <button style={btn}>Login</button>
        </Link>
        <Link to="/signup">
          <button style={btn}>Sign Up</button>
        </Link>
      </div>
    </div>
  );
};

// Container styles
const container = {
  padding: "3rem 1rem",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
};

// Title and subtitle
const title = {
  fontSize: "2.5rem",
  marginBottom: "1rem",
  color: "#333",
};

const subtitle = {
  fontSize: "1.2rem",
  marginBottom: "2rem",
  color: "#555",
};

// Button container for spacing
const btnContainer = {
  display: "flex",
  flexWrap: "wrap",
  gap: "1rem",
  justifyContent: "center",
};

// Button style
const btn = {
  padding: "0.75rem 1.5rem",
  fontSize: "16px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  backgroundColor: "#007bff",
  color: "#fff",
  transition: "0.3s ease",
};

// Add hover effect using inline style object
btn[":hover"] = {
  backgroundColor: "#0056b3",
};

// Media queries with JS approach
if (window.innerWidth <= 600) {
  title.fontSize = "1.8rem";
  subtitle.fontSize = "1rem";
  btn.padding = "0.6rem 1.2rem";
  btn.fontSize = "14px";
}

export default Landing;

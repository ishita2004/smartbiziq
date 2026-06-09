import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

const SignupForm = () => {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSignup = () => {
    signup(email, password);
    navigate("/app");
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 400, margin: "auto", textAlign: "center" }}>
      <h2>Sign Up</h2>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
      <button onClick={handleSignup} style={buttonStyle}>Sign Up</button>
    </div>
  );
};

const inputStyle = {
  width: "100%", marginBottom: "1rem", padding: "0.75rem"
};

const buttonStyle = {
  width: "100%", padding: "0.75rem", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "6px"
};

export default SignupForm;

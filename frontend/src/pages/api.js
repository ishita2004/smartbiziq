import axios from "axios";

const backendUrl = (process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000").trim();

const API = axios.create({
  baseURL: backendUrl,
});

export default API;

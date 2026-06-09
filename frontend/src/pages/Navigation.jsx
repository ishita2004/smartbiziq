import React from 'react';
import { Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

const Navigation = () => {
  return (
    <div className="container mt-4">
      <h2>🚀 SmartBizIQ Modules</h2>
      <ul className="list-group mt-3">
        <li className="list-group-item">
          <Link to="/sales-forecasting">📈 Sales Forecasting</Link>
        </li>
        <li className="list-group-item">
          <Link to="/customer-segmentation">📊 Customer Segmentation</Link>
        </li>
        <li className="list-group-item">
          <Link to="/churn-prediction">🔁 Churn Prediction</Link>
        </li>
        <li className="list-group-item">
          <Link to="/anomaly-detection">🚨 Anomaly Detection</Link>
        </li>
        <li className="list-group-item">
          <Link to="/recommendation-system">🎁 Recommendation System</Link>
        </li>
      </ul>
    </div>
  );
};

export default Navigation;

import React from "react";
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const Navbar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary px-4">
      <Link className="navbar-brand" to="/">SmartBizIQ</Link>
      <div className="collapse navbar-collapse">
        <ul className="navbar-nav me-auto">
          <li className="nav-item"><Link className="nav-link" to="/forecasting">Sales Forecasting</Link></li>
          <li className="nav-item">
                    <a className="nav-link" href="/segmentation">Customer Segmentation</a>
          </li>
          <li className="nav-item"><Link className="nav-link" to="/churn">Churn Prediction</Link></li>
          <li className="nav-item"><Link className="nav-link" to="/anomaly">Anomaly Detection</Link></li>
          <li className="nav-item"><Link className="nav-link" to="/recommendation">Recommendation System</Link></li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes } from "react-icons/fa";
import './Layout.css';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const hideNavbarOn = ['/login', '/signup'];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isLoggedIn = !!localStorage.getItem('token');
  const showNavbar = !hideNavbarOn.includes(location.pathname);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <div className="layout-container">
      {showNavbar && (
        <nav className="navbar">
          <h3 className="logo">SmartBizIQ</h3>
          <div className={`links ${menuOpen ? 'open' : ''}`}>
            <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/sales-forecasting" onClick={() => setMenuOpen(false)}>Sales Forecasting</Link>
            <Link to="/customer-segmentation" onClick={() => setMenuOpen(false)}>Customer Segmentation</Link>
            <Link to="/churn-prediction" onClick={() => setMenuOpen(false)}>Churn Prediction</Link>
            <Link to="/anomaly-detection" onClick={() => setMenuOpen(false)}>Anomaly Detection</Link>
            <Link to="/recommendation-system" onClick={() => setMenuOpen(false)}>Recommendations</Link>
            <Link to="/dashboard" onClick={() => setMenuOpen(false)}>BizzBOT</Link>
            {isLoggedIn && (
              <button onClick={handleLogout} className="logout">Logout</button>
            )}
          </div>
          <div className="hamburger" onClick={toggleMenu}>
            {menuOpen ? <FaTimes /> : <FaBars />}
          </div>
        </nav>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

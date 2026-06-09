// src/App.js
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// App pages (no auth required now)
import DashboardOverview from './pages/DashboardOverview';
import SalesForecasting from './pages/SalesForecast';
import CustomerSegmentation from './pages/CustomerSegmentation';
import ChurnPrediction from './pages/ChurnPrediction';
import AnomalyDetection from './pages/AnomalyDetection';
import RecommendationSystem from './pages/RecommendationSystem';
import AIChatbot from './pages/AIChatBot';

function App() {
  return (
    <Router>
      <Routes>
        {/* Main Entry — go straight to app layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="sales-forecasting" element={<SalesForecasting />} />
          <Route path="customer-segmentation" element={<CustomerSegmentation />} />
          <Route path="churn-prediction" element={<ChurnPrediction />} />
          <Route path="anomaly-detection" element={<AnomalyDetection />} />
          <Route path="recommendation-system" element={<RecommendationSystem />} />
          <Route path="dashboard" element={<AIChatbot />} />
        </Route>

        {/* Redirect any unknown path to / */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

import React from "react";

const KPIBlock = ({ title, value, color = "bg-primary" }) => (
  <div className="col-md-3 mb-3">
    <div className={`card text-white ${color}`}>
      <div className="card-body">
        <h6>{title}</h6>
        <h4>{value}</h4>
      </div>
    </div>
  </div>
);

export default KPIBlock;

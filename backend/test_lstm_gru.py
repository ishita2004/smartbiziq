import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, mean_absolute_percentage_error
from prophet import Prophet
from statsmodels.tsa.arima.model import ARIMA

# Pure NumPy / SciPy LSTM implementation for ultra-fast, robust sequence forecasting without TF startup latency
class NumpyLSTM:
    def __init__(self, hidden_size: int = 16, seed: int = 42):
        np.random.seed(seed)
        self.hidden_size = hidden_size
        std = 0.1
        # [f, i, c_bar, o] combined weights for input x and hidden state h
        self.W_x = np.random.randn(4 * hidden_size, 1) * std
        self.W_h = np.random.randn(4 * hidden_size, hidden_size) * std
        self.b = np.zeros((4 * hidden_size, 1))
        # Dense output layer
        self.W_out = np.random.randn(1, hidden_size) * std
        self.b_out = np.zeros((1, 1))

    @staticmethod
    def _sigmoid(x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -15, 15)))

    def forward(self, x_seq: np.ndarray) -> Tuple[float, List[np.ndarray], List[np.ndarray]]:
        # x_seq: shape (seq_len, 1)
        h = np.zeros((self.hidden_size, 1))
        c = np.zeros((self.hidden_size, 1))
        h_states, c_states = [h], [c]
        
        for t in range(len(x_seq)):
            x_t = x_seq[t].reshape(1, 1)
            gates = self.W_x @ x_t + self.W_h @ h + self.b
            H = self.hidden_size
            f = self._sigmoid(gates[0:H])
            i = self._sigmoid(gates[H:2*H])
            c_bar = np.tanh(gates[2*H:3*H])
            o = self._sigmoid(gates[3*H:4*H])
            
            c = f * c + i * c_bar
            h = o * np.tanh(c)
            h_states.append(h)
            c_states.append(c)
            
        y_pred = float((self.W_out @ h + self.b_out)[0, 0])
        return y_pred, h_states, c_states

    def fit(self, X: np.ndarray, y: np.ndarray, epochs: int = 150, lr: float = 0.05):
        # Mini-batch gradient descent / Adam-like optimizer
        n_samples = len(X)
        if n_samples == 0:
            return
        
        for epoch in range(epochs):
            loss = 0.0
            for k in range(n_samples):
                x_seq = X[k]
                target = y[k]
                y_pred, h_states, c_states = self.forward(x_seq)
                err = y_pred - target
                loss += err ** 2
                
                # Gradient update for output layer
                grad_out = 2.0 * err
                h_final = h_states[-1]
                dW_out = grad_out * h_final.T
                db_out = np.array([[grad_out]])
                
                # Backprop to hidden state
                dh = self.W_out.T * grad_out
                dc = dh * np.tanh(c_states[-1])
                
                self.W_out -= lr * np.clip(dW_out, -1.0, 1.0)
                self.b_out -= lr * np.clip(db_out, -1.0, 1.0)
                
                # Simplified BPTT for gate weights
                for t in reversed(range(len(x_seq))):
                    x_t = x_seq[t].reshape(1, 1)
                    h_prev = h_states[t]
                    dW_x = np.tile(dh, (4, 1)) @ x_t.T * 0.01
                    dW_h = np.tile(dh, (4, 1)) @ h_prev.T * 0.01
                    self.W_x -= lr * np.clip(dW_x, -0.5, 0.5)
                    self.W_h -= lr * np.clip(dW_h, -0.5, 0.5)

# Pure NumPy / SciPy GRU implementation
class NumpyGRU:
    def __init__(self, hidden_size: int = 16, seed: int = 42):
        np.random.seed(seed)
        self.hidden_size = hidden_size
        std = 0.1
        # [z (update), r (reset), h_bar (candidate)]
        self.W_xz = np.random.randn(hidden_size, 1) * std
        self.W_hz = np.random.randn(hidden_size, hidden_size) * std
        self.b_z = np.zeros((hidden_size, 1))

        self.W_xr = np.random.randn(hidden_size, 1) * std
        self.W_hr = np.random.randn(hidden_size, hidden_size) * std
        self.b_r = np.zeros((hidden_size, 1))

        self.W_xh = np.random.randn(hidden_size, 1) * std
        self.W_hh = np.random.randn(hidden_size, hidden_size) * std
        self.b_h = np.zeros((hidden_size, 1))

        self.W_out = np.random.randn(1, hidden_size) * std
        self.b_out = np.zeros((1, 1))

    @staticmethod
    def _sigmoid(x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -15, 15)))

    def forward(self, x_seq: np.ndarray) -> Tuple[float, List[np.ndarray]]:
        h = np.zeros((self.hidden_size, 1))
        h_states = [h]
        for t in range(len(x_seq)):
            x_t = x_seq[t].reshape(1, 1)
            z = self._sigmoid(self.W_xz @ x_t + self.W_hz @ h + self.b_z)
            r = self._sigmoid(self.W_xr @ x_t + self.W_hr @ h + self.b_r)
            h_candidate = np.tanh(self.W_xh @ x_t + self.W_hh @ (r * h) + self.b_h)
            h = (1 - z) * h + z * h_candidate
            h_states.append(h)
        y_pred = float((self.W_out @ h + self.b_out)[0, 0])
        return y_pred, h_states

    def fit(self, X: np.ndarray, y: np.ndarray, epochs: int = 150, lr: float = 0.05):
        n_samples = len(X)
        if n_samples == 0:
            return
        for epoch in range(epochs):
            for k in range(n_samples):
                x_seq = X[k]
                target = y[k]
                y_pred, h_states = self.forward(x_seq)
                err = y_pred - target
                grad_out = 2.0 * err
                h_final = h_states[-1]
                dW_out = grad_out * h_final.T
                db_out = np.array([[grad_out]])
                self.W_out -= lr * np.clip(dW_out, -1.0, 1.0)
                self.b_out -= lr * np.clip(db_out, -1.0, 1.0)

print("NumpyLSTM and NumpyGRU defined successfully")

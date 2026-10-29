# 🔥 Wildfire Intelligence

An experimental wildfire monitoring and prediction dashboard built using React, Flask, PyTorch, and NASA FIRMS satellite fire observations.

## Overview

Wildfire Intelligence combines satellite fire detections, interactive mapping, and an experimental Spatio-Temporal Graph Convolutional Network (ST-GCN) model in a web dashboard.

The project demonstrates how satellite observations and graph-based machine learning can be explored through a web application.

**Important:** This is an experimental prototype. The included model and processed graph data are demo assets and have not been validated for operational wildfire forecasting. Do not use its predictions for emergency response or real-world safety decisions.

## Features

- Interactive map for exploring fire detections.
- NASA FIRMS satellite observation integration through the backend.
- Dashboard showing fire-detection information.
- Location search and map navigation.
- Flask API for fire data and prediction requests.
- PyTorch ST-GCN model prototype.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript, CSS |
| Backend | Python, Flask, Flask-CORS |
| Machine learning | PyTorch, ST-GCN |
| Mapping | Leaflet, React-Leaflet |
| Satellite data | NASA FIRMS |
| Data processing | NumPy, Pandas, SciPy, scikit-learn |
| Data format | CSV |

## Project Structure

```text
Wildfire_Intelligence_STGCN/
├── data/
│   └── processed/
│       ├── edges.csv
│       ├── nodes.csv
│       └── node_features_full_year.csv
├── public/
├── scripts/
│   └── create_demo_data_and_model.py
├── src/
│   ├── assets/
│   ├── components/
│   ├── services/
│   ├── App.css
│   ├── App.js
│   └── index.js
├── best_stgcn.pt
├── data_loader.py
├── server.py
├── requirements.txt
├── package.json
└── .gitignore
```

## Prerequisites

- Python 3
- Node.js and npm
- Git
- A NASA FIRMS map key, if required by the configured data source

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/iamssakthi/Wildfire_Intelligence_STGCN.git
cd Wildfire_Intelligence_STGCN
```

### 2. Set up the backend

Create and activate a Python virtual environment on Windows:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```powershell
python -m pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the project root if required by your backend configuration.

```dotenv
NASA_FIRMS_MAP_KEY=your_nasa_firms_key
```

Replace the placeholder with your own key. Never commit your actual `.env` file or expose API keys in frontend code.

### 4. Start the backend

```powershell
python server.py
```

The backend is configured to use port `5000`.

### 5. Start the frontend

Open a second terminal in the project root:

```powershell
npm install
npm start
```

Open the local address printed by the React development server.

## Model and Data

The repository includes a saved ST-GCN checkpoint and processed graph data for experimentation. The model's predictive performance has not been independently validated against a documented real-world benchmark.

Satellite fire detections represent observations, not guaranteed future wildfire events.

## Future Improvements

- Evaluate the model on documented historical wildfire datasets.
- Compare results against appropriate baseline models.
- Report evaluation metrics and prediction uncertainty.
- Improve error handling and data-source status reporting.
- Deploy the dashboard with secure server-side API key management.

## Acknowledgements

Satellite fire observations are sourced from NASA FIRMS, subject to the provider's access requirements and usage guidance.

## Author

**Sakthi S**

GitHub: [@iamssakthi](https://github.com/iamssakthi)

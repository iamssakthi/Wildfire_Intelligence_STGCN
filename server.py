
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from scipy.spatial import KDTree
from time import time

import torch
import pandas as pd
import numpy as np
import requests
import os
import csv
import io

from stgcn_model import STGCN
from data_loader import load_graph


# ---------------- ENVIRONMENT ----------------

load_dotenv()


# ---------------- CONFIG ----------------

MODEL_PATH = "best_stgcn.pt"
NODE_PATH = "data/processed/nodes.csv"
FEATURE_PATH = "data/processed/node_features_full_year.csv"

WINDOW = 3
HIDDEN_DIM = 32

device = torch.device("cpu")

# NASA FIRMS cache: 5 minutes
FIRE_CACHE = {
    "data": None,
    "timestamp": 0
}
FIRE_CACHE_TTL = 300


# ---------------- FLASK APP ----------------

app = Flask(__name__)
CORS(app)


# ---------------- LOAD NODE COORDINATES ----------------

print("Loading nodes...")

nodes = pd.read_csv(NODE_PATH)
node_coords = nodes[["lat", "lon"]].values
tree = KDTree(node_coords)

print("Nodes loaded:", len(nodes))


# ---------------- LOAD GRAPH ----------------

print("Loading graph...")

edge_index = load_graph()


# ---------------- LOAD MODEL ----------------

print("Loading trained model...")

df = pd.read_csv(FEATURE_PATH)

num_features = len(
    df.drop(
        columns=["node_id", "date", "fire", "ignition"],
        errors="ignore"
    ).columns
)

model = STGCN(
    in_channels=num_features,
    hidden_channels=HIDDEN_DIM,
    window_size=WINDOW
)

model.load_state_dict(
    torch.load(MODEL_PATH, map_location=device)
)
model.eval()

print("Model loaded successfully")


# ---------------- WEATHER API ----------------

def fetch_weather(lat, lon):
    """Fetch current weather from Open-Meteo."""

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current_weather=true"
    )

    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        data = response.json()
        weather = data.get("current_weather")

        if not weather:
            raise ValueError("Current weather data is unavailable")

        temperature = float(weather["temperature"])
        wind_speed = float(weather["windspeed"])
        wind_dir = float(weather["winddirection"])

        wind_u = wind_speed * np.cos(np.radians(wind_dir))
        wind_v = wind_speed * np.sin(np.radians(wind_dir))

        # These values are placeholders, not live observations.
        # Replace them with actual data before scientific evaluation.
        precipitation = 0
        humidity = 50

        return (
            temperature,
            wind_u,
            wind_v,
            precipitation,
            wind_speed,
            humidity
        )

    except (requests.RequestException, ValueError, KeyError) as exc:
        app.logger.warning("Weather request failed: %s", exc)
        return None


# ---------------- PREPARE FEATURE WINDOW ----------------

print("Preparing node features...")

grouped = df.groupby("date")
dates = sorted(df["date"].unique())
latest_dates = dates[-WINDOW:]


def build_tensor(df_day):
    df_day = df_day.sort_values("node_id")

    feature_df = df_day.drop(
        columns=["node_id", "date", "fire", "ignition"],
        errors="ignore"
    )

    feature_df = (
        feature_df.apply(pd.to_numeric, errors="coerce")
        .fillna(0)
    )

    feature_df = (
        (feature_df - feature_df.mean())
        / (feature_df.std() + 1e-6)
    )

    return torch.tensor(
        feature_df.values,
        dtype=torch.float
    )


daily_data = {
    date: build_tensor(grouped.get_group(date))
    for date in latest_dates
}

print("Node features prepared")


# ---------------- PREDICTION API ----------------

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True) or {}

        if "lat" not in data or "lon" not in data:
            return jsonify({
                "error": "Both lat and lon are required"
            }), 400

        lat = float(data["lat"])
        lon = float(data["lon"])

        if not (
            np.isfinite(lat)
            and np.isfinite(lon)
            and -90 <= lat <= 90
            and -180 <= lon <= 180
        ):
            return jsonify({
                "error": "Invalid latitude or longitude"
            }), 400

        print("Prediction request:", lat, lon)

        # Find nearest graph node
        dist, node_idx = tree.query([lat, lon])
        print("Nearest node:", node_idx)

        # Fetch current weather
        weather = fetch_weather(lat, lon)

        if weather is None:
            return jsonify({
                "error": "Current weather data is unavailable. Please try again."
            }), 502

        (
            temperature,
            wind_u,
            wind_v,
            precipitation,
            wind_speed,
            humidity
        ) = weather

        # Build temporal feature window
        x_seq = torch.stack(
            [daily_data[date] for date in latest_dates]
        ).clone()

        # Update weather features for the selected node.
        # This assumes the first four features are temperature,
        # wind_u, wind_v and precipitation, as in your original code.
        if x_seq.shape[2] >= 4:
            x_seq[:, node_idx, 0] = temperature
            x_seq[:, node_idx, 1] = wind_u
            x_seq[:, node_idx, 2] = wind_v
            x_seq[:, node_idx, 3] = precipitation

        with torch.no_grad():
            out = model(x_seq, edge_index)
            probs = torch.softmax(out, dim=1)
            fire_prob = float(probs[node_idx, 1])

        if fire_prob > 0.6:
            risk = "High"
        elif fire_prob > 0.3:
            risk = "Moderate"
        else:
            risk = "Low"

        return jsonify({
            "latitude": lat,
            "longitude": lon,
            "nearest_node": int(node_idx),
            "temperature": float(temperature),
            "wind_speed": float(wind_speed),
            "humidity": float(humidity),
            "fire_probability": fire_prob,
            "risk": risk
        })

    except (ValueError, TypeError, KeyError, IndexError) as exc:
        app.logger.exception("Invalid prediction request")
        return jsonify({
            "error": "Unable to process prediction request"
        }), 400

    except Exception:
        app.logger.exception("Prediction failed")
        return jsonify({
            "error": "Prediction failed"
        }), 500


# ---------------- NASA FIRMS FIRE API ----------------

@app.route("/fires", methods=["GET"])
def get_fires():
    """Return recent NASA FIRMS detections, cached for five minutes."""

    map_key = os.getenv("NASA_FIRMS_MAP_KEY")

    if not map_key:
        return jsonify({
            "error": "NASA FIRMS API key is not configured"
        }), 500

    # Serve recent cached data immediately.
    now = time()

    if (
        FIRE_CACHE["data"] is not None
        and now - FIRE_CACHE["timestamp"] < FIRE_CACHE_TTL
    ):
        return jsonify(FIRE_CACHE["data"])

    url = (
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
        f"{map_key}/VIIRS_SNPP_NRT/world/1"
    )

    try:
        response = requests.get(url, timeout=(10, 90))
        response.raise_for_status()

        reader = csv.DictReader(io.StringIO(response.text))
        fires = []

        for row in reader:
            try:
                lat = float(row["latitude"])
                lon = float(row["longitude"])
            except (KeyError, TypeError, ValueError):
                continue

            # Keep the existing India map bounds.
            if 6 < lat < 38 and 68 < lon < 98:
                fires.append({
                    "lat": lat,
                    "lon": lon
                })

        payload = {
            "fires": fires,
            "count": len(fires),
            "source": "NASA FIRMS VIIRS_SNPP_NRT",
            "fetched_at": time()
        }

        # Cache only successful responses.
        FIRE_CACHE["data"] = payload
        FIRE_CACHE["timestamp"] = time()

        print("NASA FIRMS detections loaded:", len(fires))

        return jsonify(payload)

    except requests.RequestException:
        app.logger.exception("NASA FIRMS request failed")

        # If a previous successful response exists, return it as stale.
        if FIRE_CACHE["data"] is not None:
            stale_payload = dict(FIRE_CACHE["data"])
            stale_payload["stale"] = True
            return jsonify(stale_payload)

        return jsonify({
            "error": "Unable to retrieve fire observations from NASA FIRMS"
        }), 502


# ---------------- ROOT / HEALTH CHECK ----------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "Wildfire AI Server Running"
    })


# ---------------- RUN SERVER ----------------

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )

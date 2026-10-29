
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.optim import Adam

# Locate the project root
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from stgcn_model import STGCN

# Reproducible demo data
rng = np.random.default_rng(42)
torch.manual_seed(42)

OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

N_NODES = 30
N_DAYS = 45
WINDOW = 3
HIDDEN = 32
EPOCHS = 2

FEATURES = [
    "temperature",
    "wind_u",
    "wind_v",
    "precipitation",
    "ndvi",
    "elevation",
    "slope",
    "humidity",
    "vegetation",
]

print("1. Creating synthetic graph nodes...")

nodes = []
for i in range(N_NODES):
    row, col = divmod(i, 6)
    nodes.append({
        "node_id": i,
        "lat": 18.0 + row * 0.35,
        "lon": 77.0 + col * 0.35,
    })

pd.DataFrame(nodes).to_csv(OUT / "nodes.csv", index=False)

print("2. Creating graph edges...")

edges = set()
for i in range(N_NODES):
    row, col = divmod(i, 6)

    if col < 5:
        edges.add((i, i + 1))
        edges.add((i + 1, i))

    if row < 4:
        edges.add((i, i + 6))
        edges.add((i + 6, i))

edge_df = pd.DataFrame(
    sorted(edges), columns=["source", "target"]
)
edge_df.to_csv(OUT / "edges.csv", index=False)

print("3. Creating synthetic environmental features...")

records = []
start_date = pd.Timestamp("2025-01-01")

for day in range(N_DAYS):
    date = (start_date + pd.Timedelta(days=day)).strftime("%Y-%m-%d")

    for node in range(N_NODES):
        temperature = rng.normal(29, 5)
        wind_speed = max(0.1, rng.normal(4, 2))
        wind_direction = rng.uniform(0, 360)

        wind_u = wind_speed * np.cos(np.radians(wind_direction))
        wind_v = wind_speed * np.sin(np.radians(wind_direction))

        precipitation = max(0, rng.exponential(1.5))
        ndvi = rng.uniform(0.1, 0.9)
        elevation = 200 + (node // 6) * 80 + rng.normal(0, 10)
        slope = rng.uniform(0, 25)
        humidity = rng.uniform(25, 90)
        vegetation = np.clip(ndvi + rng.normal(0, 0.05), 0, 1)

        # Artificial rule for demonstration labels only
        score = (
            0.10 * (temperature - 25)
            + 0.30 * wind_speed
            - 0.30 * precipitation
            - 1.0 * ndvi
            + rng.normal(0, 1)
        )

        fire = int(score > 1.5)

        records.append({
            "node_id": node,
            "date": date,
            "temperature": temperature,
            "wind_u": wind_u,
            "wind_v": wind_v,
            "precipitation": precipitation,
            "ndvi": ndvi,
            "elevation": elevation,
            "slope": slope,
            "humidity": humidity,
            "vegetation": vegetation,
            "fire": fire,
            "ignition": fire,
        })

df = pd.DataFrame(records)
df.to_csv(OUT / "node_features_full_year.csv", index=False)

print("4. Training a small demonstration ST-GCN model...")

edge_index = torch.tensor(
    edge_df[["source", "target"]].values.T,
    dtype=torch.long,
)

grouped = {
    date: group.sort_values("node_id")
    for date, group in df.groupby("date", sort=True)
}
dates = sorted(grouped)

daily = {}

for date in dates:
    day_df = grouped[date]
    features = day_df[FEATURES].astype(float)

    # Match the normalization approach used by server.py
    features = (
        features - features.mean()
    ) / (features.std() + 1e-6)

    x = torch.tensor(
        features.fillna(0).values,
        dtype=torch.float32,
    )
    y = torch.tensor(
        day_df["fire"].values,
        dtype=torch.long,
    )
    daily[date] = (x, y)

model = STGCN(
    in_channels=len(FEATURES),
    hidden_channels=HIDDEN,
    window_size=WINDOW,
)

optimizer = Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()

model.train()

for epoch in range(EPOCHS):
    losses = []

    for i in range(WINDOW, len(dates)):
        sequence = torch.stack([
            daily[dates[j]][0]
            for j in range(i - WINDOW, i)
        ])

        labels = daily[dates[i]][1]

        optimizer.zero_grad()
        logits = model(sequence, edge_index)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        losses.append(loss.item())

    print(
        f"Epoch {epoch + 1}/{EPOCHS} "
        f"- loss: {np.mean(losses):.4f}"
    )

model_path = ROOT / "best_stgcn.pt"
torch.save(model.state_dict(), model_path)

print("\nDemo files created successfully!")
print("Dataset:", OUT)
print("Model:", model_path)
print("WARNING: Synthetic data only; predictions are not validated.")

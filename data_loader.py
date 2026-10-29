import os
import pandas as pd
import torch
from torch_geometric.data import Data

# Automatically get project root directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "processed")



def load_graph():
    # Load edges
    edges_path = os.path.join(DATA_DIR, "edges.csv")
    edges = pd.read_csv(edges_path)

    edge_index = torch.tensor(
        edges[['source', 'target']].values.T,
        dtype=torch.long
    )

    return edge_index


def load_static_features():
    features_path = os.path.join(DATA_DIR, "node_features.csv")
    features = pd.read_csv(features_path)

    node_ids = features['node_id'].values

    # Drop non-feature columns
    feature_df = features.drop(
        columns=['node_id', 'date', 'fire', 'ignition'],
        errors='ignore'
    )

    # Convert to numeric just to be safe
    feature_df = feature_df.apply(pd.to_numeric, errors='coerce')
    feature_df = feature_df.fillna(0)

    x_static = torch.tensor(
        feature_df.values,
        dtype=torch.float
    )

    return node_ids, x_static


def load_fire_labels():
    labels_path = os.path.join(DATA_DIR, "fire_labels.csv")
    labels = pd.read_csv(labels_path)

    return labels


def load_weather_files():
    weather_data = []

    for file in os.listdir(DATA_DIR):
        if file.startswith("weather_"):
            df = pd.read_csv(os.path.join(DATA_DIR, file))
            weather_data.append(df)

    weather = pd.concat(weather_data, ignore_index=True)
    return weather


def build_graph_snapshot(date):
    edge_index = load_graph()

    # Load full dataset
    features_path = os.path.join(DATA_DIR, "node_features.csv")
    df = pd.read_csv(features_path)

    # Filter only selected date
    df_day = df[df['date'] == date]

    # Sort by node_id to keep consistent ordering
    df_day = df_day.sort_values('node_id')

    # Extract labels
    y = torch.tensor(df_day['fire'].values, dtype=torch.long)

    # Extract feature columns
    feature_df = df_day.drop(
        columns=['node_id', 'date', 'fire', 'ignition'],
        errors='ignore'
    )

    # 🔥 ADD THIS NORMALIZATION PART
    feature_df = feature_df.apply(pd.to_numeric, errors='coerce')
    feature_df = feature_df.fillna(0)

    # Standardization (VERY IMPORTANT)
    feature_df = (feature_df - feature_df.mean()) / (feature_df.std() + 1e-6)

    x = torch.tensor(feature_df.values, dtype=torch.float)

    data = Data(
        x=x,
        edge_index=edge_index,
        y=y
    )

    return data
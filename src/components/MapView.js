
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
  Circle,
} from "react-leaflet";

import { useEffect, useState } from "react";
import axios from "axios";
import L from "leaflet";

import "leaflet.heat";

import FireAnimation from "./FireAnimation";
import { predictFire } from "../services/api";
import fireIconImg from "../assets/fire.png";

/* ---------------- FIRE ICON ---------------- */

const fireIcon = new L.Icon({
  iconUrl: fireIconImg,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

/* ---------------- GLOBAL REGION ---------------- */

function getGlobalRegion(countryCode) {
  const code = (countryCode || "").toUpperCase();

  const regions = {
    IN: "South Asia",
    PK: "South Asia",
    BD: "South Asia",
    LK: "South Asia",
    NP: "South Asia",
    CN: "East Asia",
    JP: "East Asia",
    KR: "East Asia",
    TH: "Southeast Asia",
    VN: "Southeast Asia",
    SG: "Southeast Asia",
    MY: "Southeast Asia",
    ID: "Southeast Asia",
    PH: "Southeast Asia",
    AU: "Oceania",
    NZ: "Oceania",
    GB: "Europe",
    FR: "Europe",
    DE: "Europe",
    IT: "Europe",
    ES: "Europe",
    PT: "Europe",
    NL: "Europe",
    SE: "Europe",
    NO: "Europe",
    FI: "Europe",
    PL: "Europe",
    US: "North America",
    CA: "North America",
    MX: "North America",
    BR: "South America",
    AR: "South America",
    CL: "South America",
    CO: "South America",
    PE: "South America",
    EG: "Africa",
    ZA: "Africa",
    NG: "Africa",
    KE: "Africa",
    SA: "Western Asia",
    AE: "Western Asia",
    TR: "Western Asia",
    IR: "Western Asia",
  };

  return regions[code] || "Region not classified";
}

/* ---------------- MAP FOCUS ---------------- */

function MapFocus({ focusLocation }) {
  const map = useMap();

  useEffect(() => {
    if (
      Array.isArray(focusLocation) &&
      focusLocation.length === 2 &&
      Number.isFinite(focusLocation[0]) &&
      Number.isFinite(focusLocation[1])
    ) {
      map.flyTo(focusLocation, 8, {
        duration: 1.2,
      });
    }
  }, [focusLocation, map]);

  return null;
}

/* ---------------- MAP CLICK HANDLER ---------------- */

function MapClickHandler({
  setMarker,
  requestPrediction,
  setSelectedLocation,
  setMapError,
}) {
  useMapEvents({
    async click(event) {
      const lat = event.latlng.lat;
      const lon = event.latlng.lng;

      setMarker([lat, lon]);
      setMapError("");

      // Look up the nearest named place.
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`
        );

        if (!response.ok) {
          throw new Error("Reverse geocoding request failed.");
        }

        const place = await response.json();
        const address = place.address || {};

        const name =
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.hamlet ||
          address.county ||
          place.name ||
          "Unnamed location";

        setSelectedLocation({
          name,
          state:
            address.state ||
            address.province ||
            address.region ||
            address.state_district ||
            "Not available",
          country: address.country || "Not available",
          countryCode: (address.country_code || "").toUpperCase(),
          globalRegion: getGlobalRegion(address.country_code),
          latitude: lat,
          longitude: lon,
          displayName:
            place.display_name ||
            `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          placeType: place.type || place.class || "Location",
        });
      } catch (error) {
        console.error("Reverse geocoding error:", error);

        setSelectedLocation({
          name: "Selected coordinates",
          state: "Not available",
          country: "Not available",
          countryCode: "",
          globalRegion: "Not classified",
          latitude: lat,
          longitude: lon,
          displayName: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          placeType: "Map point",
        });

        setMapError(
          "Place details could not be retrieved. Coordinates are still available."
        );
      }

      // Request the prediction for the selected coordinates.
      if (requestPrediction) {
        requestPrediction(lat, lon);
      }
    },
  });

  return null;
}

/* ---------------- HEATMAP LAYER ---------------- */

function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 10,
    });

    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [points, map]);

  return null;
}

/* ---------------- MAIN MAP ---------------- */

export default function MapView({
  setPrediction,
  requestPrediction,
  focusLocation,
  setSelectedLocation,
  onSatelliteDataChange,
}) {
  const [marker, setMarker] = useState(null);
  const [fires, setFires] = useState([]);
  const [heatPoints, setHeatPoints] = useState([]);
  const [showFireMarkers, setShowFireMarkers] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [mapError, setMapError] = useState("");

  // Keep the selected marker synchronized with city searches.
  useEffect(() => {
    if (Array.isArray(focusLocation)) {
      setMarker(focusLocation);
    }
  }, [focusLocation]);

  // Load satellite observations through the Flask backend.
  useEffect(() => {
    let cancelled = false;

    async function loadFires() {
      try {
        const response = await axios.get(
          "http://127.0.0.1:5000/fires",
          { timeout: 25000 }
        );

        // Validate the response before using it.
        if (!Array.isArray(response.data?.fires)) {
          throw new Error(
            "The satellite API returned an invalid response."
          );
        }

        const firePoints = response.data.fires.filter(
          (point) =>
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon) &&
            point.lat > 6 &&
            point.lat < 38 &&
            point.lon > 68 &&
            point.lon < 98
        );

        if (cancelled) return;

        setFires(firePoints);

        setHeatPoints(
          firePoints.map((point) => [
            point.lat,
            point.lon,
            1,
          ])
        );

        setMapError("");

        // Update the Satellite Data card in App.js.
        if (onSatelliteDataChange) {
          onSatelliteDataChange({
            status: "Connected",
            count: firePoints.length,
            stale: response.data.stale === true,
          });
        }

        console.log(
          `Loaded ${firePoints.length} NASA FIRMS detections`
        );
      } catch (error) {
        if (cancelled) return;

        console.error("Satellite data request failed:", error);

        setMapError(
          "Unable to load NASA fire observations. Check that the Flask backend is running."
        );

        setFires([]);
        setHeatPoints([]);

        // Tell App.js that the feed could not be retrieved.
        if (onSatelliteDataChange) {
          onSatelliteDataChange({
            status: "Unavailable",
            count: null,
            stale: false,
          });
        }
      }
    }

    // Show the loading state while the first request is in progress.
    if (onSatelliteDataChange) {
      onSatelliteDataChange({
        status: "Loading",
        count: null,
        stale: false,
      });
    }

    loadFires();

    return () => {
      cancelled = true;
    };
  }, [onSatelliteDataChange]);

  return (
    <div className="map-wrapper">
      <div className="map-toolbar">
        <div>
          <h2>Regional monitoring map</h2>
          <p>
            Select a location to view its geographic details and
            experimental model output.
          </p>
        </div>

        <div className="map-controls">
          <label>
            <input
              type="checkbox"
              checked={showFireMarkers}
              onChange={(event) =>
                setShowFireMarkers(event.target.checked)
              }
            />
            Fire markers
          </label>

          <label>
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(event) =>
                setShowHeatmap(event.target.checked)
              }
            />
            Heatmap
          </label>
        </div>
      </div>

      {mapError && (
        <div className="map-error" role="status">
          {mapError}
        </div>
      )}

      <MapContainer
        center={[22.97, 78.65]}
        zoom={5}
        scrollWheelZoom
        style={{
          height: "440px",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <MapFocus focusLocation={focusLocation} />

        <MapClickHandler
          setMarker={setMarker}
          requestPrediction={
            requestPrediction ||
            (async (lat, lon) => {
              try {
                const result = await predictFire(lat, lon);
                setPrediction(result);
              } catch (error) {
                console.error("Prediction request failed:", error);

                setMapError(
                  "Prediction failed. Check that the Flask backend is running."
                );
              }
            })
          }
          setSelectedLocation={setSelectedLocation || (() => {})}
          setMapError={setMapError}
        />

        {showHeatmap && <HeatmapLayer points={heatPoints} />}

        {showFireMarkers &&
          fires.map((fire, index) => (
            <Marker
              key={`${fire.lat}-${fire.lon}-${index}`}
              position={[fire.lat, fire.lon]}
              icon={fireIcon}
            />
          ))}

        {showFireMarkers && <FireAnimation fires={fires} />}

        {marker && (
          <>
            <Marker position={marker} icon={fireIcon} />

            <Circle
              center={marker}
              radius={500}
              pathOptions={{
                color: "#16805D",
                fillColor: "#16805D",
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
          </>
        )}
      </MapContainer>

      <div className="map-legend">
        <span>
          <i className="legend-dot selected-dot" />
          Selected location
        </span>

        <span>
          <i className="legend-dot fire-dot" />
          Satellite observations
        </span>

        <span>
          <i className="legend-dot heat-dot" />
          Observation heatmap
        </span>
      </div>

      <p className="map-disclaimer">
        Satellite markers are shown only when the external feed is
        successfully retrieved. They are observations, not predictions.
      </p>
    </div>
  );
}

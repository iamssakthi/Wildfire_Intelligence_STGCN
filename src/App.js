
import { useState } from "react";
import MapView from "./components/MapView";
import PredictionCard from "./components/PredictionCard";
import { predictFire } from "./services/api";
import "./App.css";

// Convert a country code into a broad world region.
function getGlobalRegion(countryCode) {
  const code = (countryCode || "").toUpperCase();

  const regions = {
    IN: "South Asia",
    PK: "South Asia",
    BD: "South Asia",
    LK: "South Asia",
    NP: "South Asia",
    AF: "South Asia",

    CN: "East Asia",
    JP: "East Asia",
    KR: "East Asia",
    KP: "East Asia",
    MN: "East Asia",
    TW: "East Asia",

    TH: "Southeast Asia",
    VN: "Southeast Asia",
    SG: "Southeast Asia",
    MY: "Southeast Asia",
    ID: "Southeast Asia",
    PH: "Southeast Asia",
    KH: "Southeast Asia",
    MM: "Southeast Asia",
    LA: "Southeast Asia",
    BN: "Southeast Asia",
    TL: "Southeast Asia",

    AU: "Oceania",
    NZ: "Oceania",
    FJ: "Oceania",
    PG: "Oceania",

    GB: "Europe",
    IE: "Europe",
    FR: "Europe",
    DE: "Europe",
    IT: "Europe",
    ES: "Europe",
    PT: "Europe",
    NL: "Europe",
    BE: "Europe",
    CH: "Europe",
    AT: "Europe",
    SE: "Europe",
    NO: "Europe",
    FI: "Europe",
    DK: "Europe",
    PL: "Europe",
    UA: "Europe",
    GR: "Europe",
    IS: "Europe",
    CZ: "Europe",
    RO: "Europe",
    HU: "Europe",

    US: "North America",
    CA: "North America",
    MX: "North America",
    GT: "Central America",
    CR: "Central America",
    PA: "Central America",
    CU: "Caribbean",
    JM: "Caribbean",
    DO: "Caribbean",
    HT: "Caribbean",

    BR: "South America",
    AR: "South America",
    CL: "South America",
    CO: "South America",
    PE: "South America",
    EC: "South America",
    UY: "South America",
    PY: "South America",
    BO: "South America",
    VE: "South America",

    EG: "North Africa",
    MA: "North Africa",
    DZ: "North Africa",
    TN: "North Africa",
    LY: "North Africa",
    SD: "North Africa",

    ZA: "Southern Africa",
    NG: "West Africa",
    GH: "West Africa",
    SN: "West Africa",
    KE: "East Africa",
    ET: "East Africa",
    TZ: "East Africa",
    UG: "East Africa",
    RW: "East Africa",

    SA: "Western Asia",
    AE: "Western Asia",
    QA: "Western Asia",
    BH: "Western Asia",
    KW: "Western Asia",
    OM: "Western Asia",
    YE: "Western Asia",
    TR: "Western Asia",
    IL: "Western Asia",
    JO: "Western Asia",
    LB: "Western Asia",
    IQ: "Western Asia",
    IR: "Western Asia",

    KZ: "Central Asia",
    UZ: "Central Asia",
    TM: "Central Asia",
    KG: "Central Asia",
    TJ: "Central Asia",
  };

  return regions[code] || "Region not classified";
}

// Convert Nominatim's address response into a consistent object.
function buildLocationDetails(place, query) {
  const address = place.address || {};

  const lat = Number(place.lat);
  const lon = Number(place.lon);

  const name =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.county ||
    place.name ||
    query;

  return {
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
    displayName: place.display_name || name,
    placeType: place.type || place.class || "Location",
  };
}

function App() {
  const [prediction, setPrediction] = useState(null);
  const [city, setCity] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusLocation, setFocusLocation] = useState(null);

  // Satellite-data status supplied by MapView.
  const [satelliteData, setSatelliteData] = useState({
    status: "Loading",
    count: null,
    stale: false,
  });

  // Search for a city or location.
  async function searchCity(event) {
    event?.preventDefault();

    const query = city.trim();

    if (!query) {
      setError("Please enter a city or location.");
      return;
    }

    setLoading(true);
    setError("");
    setPrediction(null);
    setSelectedLocation(null);

    try {
      const url = new URL(
        "https://nominatim.openstreetmap.org/search"
      );

      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "1");
      url.searchParams.set("q", query);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(
          "Location search is temporarily unavailable. Please try again."
        );
      }

      const locations = await response.json();

      if (!locations.length) {
        throw new Error(
          "No matching location found. Try a city and country, such as Coimbatore, India."
        );
      }

      const place = locations[0];
      const lat = Number(place.lat);
      const lon = Number(place.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("The location returned invalid coordinates.");
      }

      const locationDetails = buildLocationDetails(place, query);

      setSelectedLocation(locationDetails);
      setFocusLocation([lat, lon]);

      // Request the existing Flask model prediction.
      const result = await predictFire(lat, lon);
      setPrediction(result);
    } catch (err) {
      setError(err.message || "Unable to retrieve location details.");
    } finally {
      setLoading(false);
    }
  }

  // Handle predictions requested by the existing map component.
  async function requestPrediction(lat, lon) {
    setLoading(true);
    setError("");
    setPrediction(null);

    try {
      const result = await predictFire(lat, lon);
      setPrediction(result);
    } catch (err) {
      setError(err.message || "Unable to retrieve a prediction.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <span aria-hidden="true">🔥</span>
        <span>Wildfire Intelligence</span>
        <span className="header-status">EXPERIMENTAL MODEL</span>
      </header>

      <main className="main-content">
        <section className="welcome-section">
          <div>
            <div className="section-eyebrow">
              WILDFIRE RESEARCH PLATFORM
            </div>

            <h1>
              Understand the landscape. Explore wildfire risk.
            </h1>

            <p>
              Explore geographic locations, inspect environmental
              conditions, and examine output from a graph-based
              spatiotemporal model.
            </p>
          </div>

          <div className="demo-notice">
            <span className="notice-dot" />
            <div>
              <strong>Experimental demonstration</strong>
              <span>
                Synthetic model data · Not for real-world safety decisions
              </span>
            </div>
          </div>
        </section>

        <section
          className="overview-grid"
          aria-label="Project overview"
        >
          {/* Graph network card */}
          <article className="overview-card">
            <div className="overview-card-top">
              <span className="overview-icon green-icon">⌘</span>
              <span className="overview-label">GRAPH NETWORK</span>
            </div>

            <div className="overview-value">30</div>
            <h2>Demo locations</h2>
            <p>Nodes in the synthetic demonstration graph.</p>
            <span className="overview-footnote">Demo dataset</span>
          </article>

          {/* NASA FIRMS satellite data card */}
          <article className="overview-card">
            <div className="overview-card-top">
              <span className="overview-icon amber-icon">◉</span>
              <span className="overview-label">SATELLITE DATA</span>
            </div>

            <div className="overview-value status-value">
              {satelliteData.status === "Loading"
                ? "Loading..."
                : satelliteData.status === "Connected"
                  ? satelliteData.count
                  : "Unavailable"}
            </div>

            <h2>Observation feed</h2>

            <p>
              {satelliteData.status === "Connected"
                ? `${satelliteData.count} satellite detections received from NASA FIRMS.`
                : satelliteData.status === "Loading"
                  ? "Connecting to the NASA FIRMS observation feed."
                  : "Satellite observations are temporarily unavailable."}
            </p>

            <span className="overview-footnote warning-footnote">
              {satelliteData.status === "Connected"
                ? satelliteData.stale
                  ? "Cached observations"
                  : "Feed connected"
                : satelliteData.status === "Loading"
                  ? "Connecting..."
                  : "Check connection"}
            </span>
          </article>

          {/* AI architecture card */}
          <article className="overview-card">
            <div className="overview-card-top">
              <span className="overview-icon green-icon">⌁</span>
              <span className="overview-label">AI ARCHITECTURE</span>
            </div>

            <div className="overview-value">ST-GCN</div>
            <h2>Graph-based model</h2>
            <p>
              Combines graph structure with a temporal input window.
            </p>
            <span className="overview-footnote">
              Experimental checkpoint
            </span>
          </article>

          {/* User workflow card */}
          <article className="overview-card">
            <div className="overview-card-top">
              <span className="overview-icon green-icon">◎</span>
              <span className="overview-label">USER WORKFLOW</span>
            </div>

            <div className="overview-value">3 steps</div>
            <h2>Explore and interpret</h2>
            <p>
              Choose a location, inspect inputs, and review the model output.
            </p>
            <span className="overview-footnote">
              Interactive exploration
            </span>
          </article>
        </section>

        <section className="how-it-works">
          <div className="how-heading">
            <div>
              <div className="section-eyebrow">GETTING STARTED</div>
              <h2>Your guide to the dashboard</h2>
            </div>

            <span className="guide-label">
              New here? Start with step 1.
            </span>
          </div>

          <div className="guide-grid">
            <article className="guide-step">
              <span className="step-number">01</span>
              <div>
                <h3>Choose a location</h3>
                <p>
                  Search for a city or select a point directly on the map.
                </p>
              </div>
            </article>

            <article className="guide-step">
              <span className="step-number">02</span>
              <div>
                <h3>Inspect conditions</h3>
                <p>
                  Review the coordinates and weather returned by the server.
                </p>
              </div>
            </article>

            <article className="guide-step">
              <span className="step-number">03</span>
              <div>
                <h3>Understand the output</h3>
                <p>
                  Review the experimental score and its limitations.
                </p>
              </div>
            </article>
          </div>
        </section>
      </main>

      <form className="search-bar" onSubmit={searchCity}>
        <label className="search-label" htmlFor="city-search">
          Search location
        </label>

        <input
          id="city-search"
          type="text"
          placeholder="Enter a city, e.g. Coimbatore, India"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          disabled={loading}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Analyzing..." : "Predict Fire Risk"}
        </button>
      </form>

      <div className="status-area" aria-live="polite">
        {loading && (
          <p className="status-message">
            Retrieving location and generating the demonstration result...
          </p>
        )}

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="dashboard">
        <section
          className="map-section"
          aria-label="Interactive wildfire map"
        >
          <MapView
            setPrediction={setPrediction}
            requestPrediction={requestPrediction}
            focusLocation={focusLocation}
            setSelectedLocation={setSelectedLocation}
            onSatelliteDataChange={setSatelliteData}
          />
        </section>

        <aside className="panel-section">
          <PredictionCard
            prediction={prediction}
            location={selectedLocation}
          />
        </aside>
      </div>

      <footer className="app-footer">
        Experimental demonstration only. Do not use these predictions
        for emergency decisions.
      </footer>
    </div>
  );
}

export default App;

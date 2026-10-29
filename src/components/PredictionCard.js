
export default function PredictionCard({ prediction, location }) {
  if (!prediction && !location) {
    return (
      <div className="prediction-card">
        <div className="section-eyebrow">LOCATION INTELLIGENCE</div>
        <h2>🔥 Explore a location</h2>

        <p className="insight-muted">
          Search for a city or click on the map to begin exploring
          geographic and environmental information.
        </p>

        <div className="empty-analysis">
          <span className="empty-icon">⌖</span>
          <h3>Waiting for a location</h3>
          <p>Your location details will appear here.</p>
        </div>

        <div className="explanation-block">
          <h3>What you can explore</h3>
          <ul>
            <li>Place name, state, and country</li>
            <li>Geographic coordinates and world region</li>
            <li>Weather values returned by the backend</li>
            <li>Experimental graph-model output</li>
          </ul>
        </div>
      </div>
    );
  }

  const probability = Number(prediction?.fire_probability);

  const validProbability =
    Number.isFinite(probability) &&
    probability >= 0 &&
    probability <= 1;

  const risk = ["Low", "Moderate", "High"].includes(prediction?.risk)
    ? prediction.risk
    : "Unknown";

  const riskClass = risk.toLowerCase();

  const formatNumber = (value, digits = 4) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : "Unavailable";
  };

  return (
    <div className="prediction-card">
      <div className="section-eyebrow">LOCATION INTELLIGENCE</div>
      <h2>🔥 Location Analysis</h2>

      {location && (
        <section className="location-intelligence">
          <div className="location-title-row">
            <span className="location-pin">⌖</span>

            <div>
              <div className="section-eyebrow">PLACE IDENTIFICATION</div>
              <h3>{location.name}</h3>
              <p className="location-full-name">
                {location.displayName}
              </p>
            </div>
          </div>

          <div className="location-detail-row">
            <span>State / Province</span>
            <strong>{location.state}</strong>
          </div>

          <div className="location-detail-row">
            <span>Country</span>
            <strong>{location.country}</strong>
          </div>

          <div className="location-detail-row">
            <span>Part of the world</span>
            <strong>{location.globalRegion}</strong>
          </div>

          <div className="location-detail-row">
            <span>Location type</span>
            <strong>{location.placeType}</strong>
          </div>

          <div className="location-detail-row">
            <span>Country code</span>
            <strong>{location.countryCode || "Unavailable"}</strong>
          </div>
        </section>
      )}

      {prediction && (
        <>
          <div className="insight-divider" />

          <h3>Geographic coordinates</h3>

          <div className="location-coordinates">
            <div>
              <span>Latitude</span>
              <strong>
                {formatNumber(
                  location?.latitude ?? prediction.latitude
                )}
              </strong>
            </div>

            <div>
              <span>Longitude</span>
              <strong>
                {formatNumber(
                  location?.longitude ?? prediction.longitude
                )}
              </strong>
            </div>

            {prediction.nearest_node !== undefined && (
              <div>
                <span>Nearest graph node</span>
                <strong>{prediction.nearest_node}</strong>
              </div>
            )}
          </div>

          <div className="insight-divider" />

          <h3>Environmental conditions</h3>

          <div className="weather-grid">
            <div className="weather-tile">
              <span>🌡️</span>
              <small>Temperature</small>
              <strong>
                {formatNumber(prediction.temperature, 1)}°C
              </strong>
            </div>

            <div className="weather-tile">
              <span>💨</span>
              <small>Wind speed</small>
              <strong>
                {formatNumber(prediction.wind_speed, 1)} km/h
              </strong>
            </div>

            <div className="weather-tile">
              <span>💧</span>
              <small>Humidity</small>
              <strong>
                {formatNumber(prediction.humidity, 0)}%
              </strong>
            </div>
          </div>

          <div className="insight-divider" />

          <div className="model-heading">
            <div>
              <div className="section-eyebrow">MODEL OUTPUT</div>
              <h3>ST-GCN demonstration result</h3>
            </div>

            <span className={`risk-badge ${riskClass}`}>
              {risk}
            </span>
          </div>

          {validProbability ? (
            <>
              <div className="probability-row">
                <span>Experimental output score</span>
                <strong>
                  {(probability * 100).toFixed(1)}%
                </strong>
              </div>

              <div
                className="probability-track"
                role="img"
                aria-label={`Experimental model output score: ${
                  (probability * 100).toFixed(1)
                } percent`}
              >
                <div
                  className={`probability-fill ${riskClass}`}
                  style={{
                    width: `${probability * 100}%`
                  }}
                />
              </div>
            </>
          ) : (
            <p className="insight-muted">
              A valid model output score is unavailable.
            </p>
          )}

          <div className="model-disclaimer">
            <strong>Important interpretation note</strong>
            <p>
              This application currently uses synthetic demonstration
              data. The model output has not been validated against
              real wildfire events. It is not a verified probability
              of fire and must not be used for safety or emergency
              decisions.
            </p>
          </div>
        </>
      )}

      {location && !prediction && (
        <p className="insight-muted">
          Location identified. Environmental analysis is not available yet.
        </p>
      )}
    </div>
  );
}

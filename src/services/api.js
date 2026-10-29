
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000";

export async function predictFire(lat, lon) {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lat, lon }),
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      result.error || `Prediction request failed (${response.status}).`
    );
  }

  if (
    typeof result.fire_probability !== "number" ||
    !Number.isFinite(result.fire_probability) ||
    typeof result.risk !== "string"
  ) {
    throw new Error("The server response is missing prediction fields.");
  }

  return result;
}

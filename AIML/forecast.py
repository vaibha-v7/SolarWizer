import requests
from datetime import datetime, timedelta

# 🔹 Get weather forecast (Open-Meteo - FREE, no API key)
def fetch_weather_forecast(lat, lon):
    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "cloudcover_mean,temperature_2m_max",
        "timezone": "auto"
    }

    try:
        response = requests.get(url, params=params, timeout=10)

        # ✅ Check status
        if response.status_code != 200:
            print("Weather API failed:", response.status_code)
            return []

        # ✅ Check empty response
        if not response.text.strip():
            print("Empty response from weather API")
            return []

        data = response.json()

        if "daily" not in data:
            print("Invalid weather data:", data)
            return []

        days = data["daily"]["time"]
        clouds = data["daily"]["cloudcover_mean"]
        temps = data["daily"]["temperature_2m_max"]

        forecast = []

        for i in range(min(7, len(days))):
            forecast.append({
                "date": days[i],
                "cloud": clouds[i],
                "temp": temps[i]
            })

        return forecast

    except Exception as e:
        print("Weather API error:", str(e))
        return []


# 🔹 Convert monthly → daily base
def get_daily_base(monthly_energy):
    today = datetime.today()
    days_in_month = (datetime(today.year, today.month % 12 + 1, 1) - timedelta(days=1)).day
    return monthly_energy / days_in_month


# 🔹 Weather correction logic
def apply_weather_factor(base_energy, cloud):
    if cloud > 70:
        return base_energy * 0.6
    elif cloud > 40:
        return base_energy * 0.8
    else:
        return base_energy * 1.0


# 🔹 MAIN forecast function
def generate_7day_forecast(lat, lon, monthly_energy):
    weather = fetch_weather_forecast(lat, lon)

    # 🔥 fallback if API fails
    if not weather:
        return []

    base_daily = get_daily_base(monthly_energy)

    result = []

    for day in weather:
        predicted = apply_weather_factor(base_daily, day["cloud"])

        result.append({
            "date": day["date"],
            "predicted_kwh": round(predicted, 2),
            "cloud_cover": day["cloud"],
            "temperature": day["temp"]
        })

    return result
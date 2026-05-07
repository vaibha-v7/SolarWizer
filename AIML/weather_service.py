# weather_service.py
# Fetch today's hourly weather + irradiance from Open-Meteo

import requests
import pandas as pd


def get_today_weather(lat: float, lon: float):

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "cloud_cover",
            "wind_speed_10m",
            "shortwave_radiation",
            "direct_radiation",
            "diffuse_radiation"
        ],
        "timezone": "auto",
        "forecast_days": 1
    }

    response = requests.get(url, params=params)

    data = response.json()

    hourly = data["hourly"]

    df = pd.DataFrame({
        "time": hourly["time"],
        "temperature": hourly["temperature_2m"],
        "humidity": hourly["relative_humidity_2m"],
        "cloud_cover": hourly["cloud_cover"],
        "wind_speed": hourly["wind_speed_10m"],
        "ghi": hourly["shortwave_radiation"],      # Global Horizontal Irradiance
        "dni": hourly["direct_radiation"],         # Direct Normal Irradiance
        "dhi": hourly["diffuse_radiation"]         # Diffuse Horizontal Irradiance
    })

    return df
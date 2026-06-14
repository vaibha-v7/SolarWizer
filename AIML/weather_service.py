# weather_service.py
# Fetch today's hourly weather + irradiance from Open-Meteo

import requests
import pandas as pd


def get_today_weather(lat: float, lon: float, tilt: float, azimuth: float):

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lon,
        "tilt": tilt,
        "azimuth": azimuth,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "cloud_cover",
            "wind_speed_10m",
            "shortwave_radiation",
            "global_tilted_irradiance",
            "direct_normal_irradiance_instant",
            "sunshine_duration"
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
        "ghi": hourly["shortwave_radiation"],
        "gti": hourly["global_tilted_irradiance"],
        "dni_inst": hourly["direct_normal_irradiance_instant"],
        "sunshine_duration": hourly["sunshine_duration"]
    })

    return df

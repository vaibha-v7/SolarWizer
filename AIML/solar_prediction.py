# solar_prediction.py
# Predict today's solar generation using pvlib

import pandas as pd
import pvlib

from weather_service import get_today_weather


def predict_daily_generation_gti(
    lat,
    lon,
    capacity_kw,
    tilt,
    azimuth
):

    df = get_today_weather(
        lat=lat,
        lon=lon,
        tilt=tilt,
        azimuth=azimuth
    )

    # remove night hours
    df = df[df["gti"] > 0].copy()

    times = pd.DatetimeIndex(pd.to_datetime(df["time"]))
    df.index = times

    # Cell temperature
    temperature_model_parameters = {
        "a": -3.47,
        "b": -0.0594,
        "deltaT": 3
    }

    temp_cell = pvlib.temperature.sapm_cell(
        poa_global=df["gti"].values,
        temp_air=df["temperature"].values,
        wind_speed=df["wind_speed"].values,
        a=temperature_model_parameters["a"],
        b=temperature_model_parameters["b"],
        deltaT=temperature_model_parameters["deltaT"]
    )

    pdc0 = capacity_kw * 1000

    # Try 0.0030 as experiment
    gamma_pdc = -0.0025

    dc_power = pvlib.pvsystem.pvwatts_dc(
        g_poa_effective=df["gti"].values,
        temp_cell=temp_cell,
        pdc0=pdc0,
        gamma_pdc=gamma_pdc
    )

    ac_power = pvlib.inverter.pvwatts(
        pdc=dc_power,
        pdc0=pdc0
    )
    import numpy as np

    ac_power = np.clip(ac_power, 0, None)
    ac_power = ac_power / 1000

    daily_energy_kwh = ac_power.sum()

    return {
        "daily_energy_kwh": round(float(daily_energy_kwh), 2),
        "peak_power_kw": round(float(ac_power.max()), 2),
        "avg_temperature": round(float(df["temperature"].max()), 2),
        "avg_cloud_cover": round(float(df["cloud_cover"].mean()), 2),
    }

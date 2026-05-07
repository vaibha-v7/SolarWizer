# solar_prediction.py
# Predict today's solar generation using pvlib

from os import times
import pandas as pd
import pvlib
from weather_service import get_today_weather
import numpy as np


def predict_daily_generation(
    lat,
    lon,
    capacity_kw,
    tilt,
    azimuth
):

    # -----------------------------------
    # STEP 1: FETCH WEATHER
    # -----------------------------------

    df = get_today_weather(lat, lon)
    df = df[df["ghi"] > 20].copy()  # filter out very low irradiance hours (e.g. night time)

    # -----------------------------------
    # STEP 2: CREATE TIME INDEX
    # -----------------------------------

    times = pd.DatetimeIndex(pd.to_datetime(df["time"]))
    df.index = times
    

    # -----------------------------------
    # STEP 3: SOLAR POSITION
    # -----------------------------------

    solar_position = pvlib.solarposition.get_solarposition(
        time=times,
        latitude=lat,
        longitude=lon
    )

    # -----------------------------------
    # STEP 4: POA IRRADIANCE
    # -----------------------------------

    # Derive DNI using DISC model

    dni_data = pvlib.irradiance.disc(
    ghi=df["ghi"].values,
    solar_zenith=solar_position["apparent_zenith"].values,
    datetime_or_doy=times.dayofyear
)

    dni = dni_data["dni"]

    # Derive DHI
    dhi = df["ghi"].values - (
        dni * np.cos(np.radians(solar_position["apparent_zenith"].values))
    )

    dhi = np.clip(dhi, 0, None)

    # Calculate POA irradiance
    poa = pvlib.irradiance.get_total_irradiance(
        surface_tilt=tilt,
        surface_azimuth=azimuth,
        dni=dni,
        ghi=df["ghi"].values,
        dhi=dhi,
        solar_zenith=solar_position["apparent_zenith"],
        solar_azimuth=solar_position["azimuth"]
    )

    # -----------------------------------
    # STEP 5: CELL TEMPERATURE
    # -----------------------------------

    temperature_model_parameters = {
    "a": -3.47,
    "b": -0.0594,
    "deltaT": 3
    }

    temp_cell = pvlib.temperature.sapm_cell(
        poa_global=poa["poa_global"],
        temp_air=df["temperature"].values,
        wind_speed=df["wind_speed"].values,
        a=temperature_model_parameters["a"],
        b=temperature_model_parameters["b"],
        deltaT=temperature_model_parameters["deltaT"]
    )

    # -----------------------------------
    # STEP 6: PVWATTS DC MODEL
    # -----------------------------------

    pdc0 = capacity_kw * 1000  # system size in watts

    gamma_pdc = -0.0035  # temperature coefficient

    dc_power = pvlib.pvsystem.pvwatts_dc(
        g_poa_effective=poa["poa_global"],
        temp_cell=temp_cell,
        pdc0=pdc0,
        gamma_pdc=gamma_pdc
    )

    # -----------------------------------
    # STEP 7: PVWATTS INVERTER MODEL
    # -----------------------------------

    ac_power = pvlib.inverter.pvwatts(
        pdc=dc_power,
        pdc0=pdc0
    )
    ac_power = ac_power.clip(lower=0)
    # convert W → kW
    ac_power = ac_power / 1000

    # -----------------------------------
    # STEP 9: DAILY ENERGY
    # -----------------------------------

    # Hourly power → daily energy
     # Convert power to energy correctly
# hourly timestep assumed

    daily_energy_kwh = (
            ac_power.clip(lower=0) * 1.0
        ).sum()

    return {
        "daily_energy_kwh": round(float(daily_energy_kwh), 2),
        "peak_power_kw": round(float(ac_power.max()), 2),
        "avg_temperature": round(float(df["temperature"].mean()), 2),
        "avg_cloud_cover": round(float(df["cloud_cover"].mean()), 2)
    }
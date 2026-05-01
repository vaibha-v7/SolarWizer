import time
import pandas as pd
import pvlib
from pvlib.location import Location
from pvlib.modelchain import ModelChain
from pvlib.pvsystem import PVSystem
import requests

# 🌍 Cache
nasa_cache = {}
CACHE_EXPIRY = 86400  # 24 hours


def calculate_pr(losses):
    pr = 1
    for l in losses:
        pr *= (1 - l / 100)
    return pr


# ✅ NASA FUNCTION (OUTSIDE)
def fetch_nasa_data(lat, lon, start=2023, end=2023):
    key = (round(lat, 2), round(lon, 2), start, end)

    # Cache check
    if key in nasa_cache:
        cached = nasa_cache[key]
        if time.time() - cached["time"] < CACHE_EXPIRY:
            return cached["data"]

    url = "https://power.larc.nasa.gov/api/temporal/monthly/point"

    params = {
        "parameters": "ALLSKY_SFC_SW_DWN,T2M",
        "community": "RE",
        "longitude": lon,
        "latitude": lat,
        "start": start,
        "end": end,
        "format": "JSON"
    }

    response = requests.get(url, params=params, timeout=10)

    if response.status_code != 200:
        raise Exception("NASA API failed")

    data = response.json()

    if "properties" not in data:
        raise Exception(f"Invalid NASA response: {data}")

    solar = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
    temp = data["properties"]["parameter"]["T2M"]

    monthly_irr = {}
    monthly_temp = {}

    for key2 in solar:
        month = int(key2[4:])
        monthly_irr[month] = solar[key2]
        monthly_temp[month] = temp[key2]

    nasa_cache[key] = {
        "data": (monthly_irr, monthly_temp),
        "time": time.time()
    }

    return monthly_irr, monthly_temp


# ✅ MAIN FUNCTION
def run_simulation(
    lat,
    lon,
    system_size_kw=4,
    tilt=25,
    azimuth=180,
    losses=[2, 3, 2, 1],
    shading_factor=0.95
):
    location = Location(lat, lon, tz='Asia/Kolkata')

    times = pd.date_range(
        start='2023-01-01',
        end='2023-12-31 23:00:00',
        freq='1h',
        tz='Asia/Kolkata'
    )

    # 🌞 Fetch NASA monthly data
    try:
        monthly_irr, monthly_temp = fetch_nasa_data(lat, lon)

        weather = pd.DataFrame(index=times)

        # 🌞 Get clear-sky pattern (this is the key fix)
        clearsky = location.get_clearsky(times)

        for month in range(1, 13):
            mask = weather.index.month == month

            # NASA monthly avg (kWh/m²/day → Wh/m²/day)
            daily_irr_wh = monthly_irr[month] * 1000

            # Clear-sky daily total (Wh/m²/day)
            clearsky_daily = clearsky.loc[mask]['ghi'].resample('D').sum().mean()

            # Scaling factor
            scale = daily_irr_wh / clearsky_daily if clearsky_daily > 0 else 1

            # Apply realistic shape
            weather.loc[mask, 'ghi'] = clearsky.loc[mask]['ghi'] * scale

            weather.loc[mask, 'temp_air'] = monthly_temp[month]
            weather.loc[mask, 'wind_speed'] = 1  # Default wind speed

            weather = weather.ffill().bfill()

    except Exception as e:
        print("⚠️ NASA failed, fallback to clear-sky:", e)

        weather = location.get_clearsky(times)
        weather['temp_air'] = 25
        weather['wind_speed'] = 1

    # 🌞 Solar position
    solar_position = location.get_solarposition(times)

    # 🌞 DNI/DHI calculation
    dni = pvlib.irradiance.disc(
        weather['ghi'],
        solar_position['zenith'],
        times
    )['dni']

    dhi = weather['ghi'] - dni * pvlib.tools.cosd(solar_position['zenith'])

    weather['dni'] = dni.clip(lower=0)
    weather['dhi'] = dhi.clip(lower=0)

    # ⚡ PV SYSTEM
    system = PVSystem(
        surface_tilt=tilt,
        surface_azimuth=azimuth,
        module_parameters={
            'pdc0': system_size_kw * 1000,
            'gamma_pdc': -0.004
        },
        inverter_parameters={
            # 🔥 FIX 2: remove undersizing loss
            'pdc0': system_size_kw * 1000
        },
        racking_model='open_rack',
        module_type='glass_polymer'
    )

    # 🔥 FIX 3: better temperature model
    mc = ModelChain(
        system,
        location,
        aoi_model="physical",
        spectral_model="no_loss",
        temperature_model="sapm"
    )

    mc.run_model(weather)

    df = mc.results.ac.to_frame(name="ac_power")

    # 🔥 FIX 4: Remove double loss stacking
    # Only apply ONE combined loss factor

    PR = calculate_pr(losses)  # ~0.9 typical
    df["ac_power"] *= PR

    # Optional shading (keep if needed)
    df["ac_power"] *= shading_factor

    # 📊 Results
    annual_energy = df["ac_power"].sum() / 1000
    monthly_energy = df["ac_power"].resample('ME').sum() / 1000

    monthly_dict = {
        m.strftime('%b'): round(v, 2)
        for m, v in monthly_energy.items()
    }

    return {
        "annual_energy_kwh": round(annual_energy, 2),
        "monthly_energy_kwh": monthly_dict,
        "performance_ratio": round(PR, 3)
    }

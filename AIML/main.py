from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List
from solar_engine import run_simulation
from forecast import generate_7day_forecast
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
import requests
from dotenv import load_dotenv
import os
from solar_prediction import predict_daily_generation
from foxes_service import (
    get_generation_data
)
from solaredge_daily import get_today_energy

load_dotenv()

PVWATTS_API_KEY = os.getenv("PVWATTS_API_KEY")

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

app = FastAPI()

# Add CORS middleware for frontend-backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SolarInput(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude (-90 to 90)")
    lon: float = Field(..., ge=-180, le=180, description="Longitude (-180 to 180)")
    
    system_size_kw: float = Field(4, gt=0, description="System size in kW")
    tilt: float = Field(25, ge=0, le=90, description="Tilt angle")
    azimuth: float = Field(180, ge=0, le=360, description="Azimuth angle")

    shading_factor: float = Field(0.95, ge=0, le=1, description="0 to 1")

    losses: List[float] = Field(
        default=[2, 3, 2, 1],
        description="List of loss percentages"
    )
    dc_ac_ratio: float = Field(
        default=1.2,
        ge=0.8,
        le=2.0
    )

    inv_efficiency: float = Field(
        default=98.0,
        ge=98.0,
        le=99.9
    )

    bifaciality: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0
    )


def _extract_numeric_value(value, default=0.0):
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, dict):
        for key in ("E_m", "E_y", "value", "energy", "kwh", "ac_monthly", "month_energy"):
            if key in value:
                return _extract_numeric_value(value[key], default)

        if len(value) == 1:
            return _extract_numeric_value(next(iter(value.values())), default)

    return float(default)


def _normalize_monthly_energy(monthly_energy):
    normalized = {month: 0.0 for month in MONTHS}

    if isinstance(monthly_energy, dict):
        for month in MONTHS:
            value = monthly_energy.get(month)
            if value is None:
                value = monthly_energy.get(month.lower())
            normalized[month] = _extract_numeric_value(value, 0.0)
        return normalized

    if isinstance(monthly_energy, list):
        for index, month in enumerate(MONTHS):
            if index < len(monthly_energy):
                normalized[month] = _extract_numeric_value(monthly_energy[index], 0.0)
        return normalized

    if monthly_energy is not None:
        scalar_value = _extract_numeric_value(monthly_energy, 0.0)
        return {month: scalar_value for month in MONTHS}

    return normalized


def call_pvgis(data: SolarInput):
    url = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"

    # realistic losses
    total_losses = max(sum(data.losses), 15)

    params = {
        "lat": data.lat,
        "lon": data.lon,
        "peakpower": data.system_size_kw,
        "loss": total_losses,
        "angle": data.tilt,
        "aspect": data.azimuth - 180,
        "outputformat": "json"
    }

    response = requests.get(url, params=params)
    result = response.json()

    annual_energy = result["outputs"]["totals"]["fixed"]["E_y"]
    monthly_energy = result["outputs"]["monthly"]["fixed"]

    # 🔥 APPLY EXTRA FACTORS MANUALLY

    # inverter efficiency correction
    annual_energy *= (data.inv_efficiency / 100)

    # bifacial gain approximation
    annual_energy *= (1 + (data.bifaciality * 0.10))

    monthly_energy = _normalize_monthly_energy(monthly_energy)
    monthly_energy = {
        month: value * (data.inv_efficiency / 100) * (1 + (data.bifaciality * 0.10))
        for month, value in monthly_energy.items()
    }

    return {
        "source": "PVGIS",
        "mode": "realistic",

        "dc_ac_ratio": data.dc_ac_ratio,
        "inv_efficiency": data.inv_efficiency,
        "bifaciality": data.bifaciality,

        "annual_energy_kwh": annual_energy,
        "monthly_energy_kwh": monthly_energy
    }



def call_pvwatts(data: SolarInput):
    url = "https://developer.nrel.gov/api/pvwatts/v8.json"

    # realistic losses
    total_losses = max(sum(data.losses), 15)

    params = {
        "api_key": PVWATTS_API_KEY,
        "lat": data.lat,
        "lon": data.lon,
        "system_capacity": data.system_size_kw,
        "tilt": data.tilt,
        "azimuth": data.azimuth,

        # calibration
        "losses": total_losses,
        "array_type": 0,
        "module_type": 0,

        # 🔥 NEW
        "dc_ac_ratio": data.dc_ac_ratio,
        "inv_eff": data.inv_efficiency
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        result = response.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PVWatts request failed: {exc}")

    if isinstance(result, dict) and result.get("errors"):
        raise HTTPException(status_code=502, detail=f"PVWatts error: {result.get('errors')}")

    outputs = result.get("outputs", {}) if isinstance(result, dict) else {}
    annual_energy = _extract_numeric_value(outputs.get("ac_annual"), 0.0)
    monthly_energy = outputs.get("ac_monthly", [])

    # inverter efficiency correction
    annual_energy *= (data.inv_efficiency / 100)

    # bifacial gain correction
    annual_energy *= (1 + (data.bifaciality * 0.10))

    monthly_energy = _normalize_monthly_energy(monthly_energy)
    monthly_energy = {
        month: value * (data.inv_efficiency / 100) * (1 + (data.bifaciality * 0.10))
        for month, value in monthly_energy.items()
    }

    return {
        "source": "PVWatts",
        "mode": "realistic",

        "dc_ac_ratio": data.dc_ac_ratio,
        "inv_efficiency": data.inv_efficiency,
        "bifaciality": data.bifaciality,

        "annual_energy_kwh": annual_energy,
        "monthly_energy_kwh": monthly_energy
    }

class SavingsInput(BaseModel):
    connected_load_kw: float   # sanctioned load (max installable)
    monthly_units: float       # avg kWh per month
    monthly_bill: float        # ₹
    installation_cost: float   # ₹ total OR
    cost_per_kw: float         # ₹/kW



@app.post("/predict")
def predict(data: SolarInput):
    result = run_simulation(
        lat=data.lat,
        lon=data.lon,
        system_size_kw=data.system_size_kw,
        tilt=data.tilt,
        azimuth=data.azimuth,
        losses=data.losses,
        shading_factor=data.shading_factor
    )
    # NEW: Add 7-day forecast
    # 🔹 Month mapping
    month_map = {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr",
        5: "May", 6: "Jun", 7: "Jul", 8: "Aug",
        9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
    }

    current_month = datetime.now().month
    month_name = month_map[current_month]

    monthly_energy = result["monthly_energy_kwh"][month_name]

    # ⚠️ Handle zero case (important)
    if monthly_energy == 0:
        forecast = []
    else:
        forecast = generate_7day_forecast(
            data.lat,
            data.lon,
            monthly_energy
        )

    result["forecast_7_days"] = forecast

    # NEW END
    return result

@app.post("/predict1")
def predict_pvgis(data: SolarInput):
    return call_pvgis(data)


@app.post("/predict2")
def predict_pvwatts(data: SolarInput):
    return call_pvwatts(data)

@app.get("/predict-today")
def predict_today(
    lat: float,
    lon: float,
    capacity_kw: float,
    tilt: float,
    azimuth: float
):

    result = predict_daily_generation(
        lat=lat,
        lon=lon,
        capacity_kw=capacity_kw,
        tilt=tilt,
        azimuth=azimuth
    )

    return result

@app.get(
    "/gen/{serial_no}"
)
def get_generation(
    serial_no: str
):

    try:

        return get_generation_data(
            serial_no
        )

    except Exception as e:

        raise HTTPException(
            status_code=404,
            detail=str(e)
        )

@app.get("/solaredge/{site_id}")
def get_site_energy(site_id: str):

    try:

        energy = get_today_energy(site_id)

        return {
            "site_id": site_id,
            "today_energy_kwh": energy,
            "unit": "kWh"
        }

    except Exception as e:

        raise HTTPException(
            status_code=404,
            detail=str(e)
        )


@app.post("/savings")
def calculate_savings(data: SavingsInput):

    unit_rate = data.monthly_bill / data.monthly_units

    system_size_kw = data.connected_load_kw
    annual_units = data.monthly_units * 12

    generation_per_kw = 1500
    annual_generation = system_size_kw * generation_per_kw

    usable_energy = min(annual_units, annual_generation)

    annual_savings = usable_energy * unit_rate

    system_cost = (
        data.installation_cost
        if data.installation_cost > 0
        else system_size_kw * data.cost_per_kw
    )

    payback = system_cost / annual_savings if annual_savings > 0 else 0

    roi = (annual_savings / system_cost) * 100 if system_cost > 0 else 0

    co2_saved = annual_generation * 0.82
    trees = co2_saved / 21

    return {
        "solar_system_capacity_kw": system_size_kw,
        "annual_generation_kwh": annual_generation,
        "annual_savings_rs": annual_savings,
        "system_cost_rs": system_cost,
        "payback_years": payback,
        "roi_percent": roi,
        "co2_saved_kg": co2_saved,
        "trees_equivalent": trees
    }

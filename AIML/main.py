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

load_dotenv()

PVWATTS_API_KEY = os.getenv("PVWATTS_API_KEY")

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


def call_pvgis(data: SolarInput):
    url = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"

    # 🔥 Increase realistic losses
    total_losses = max(sum(data.losses), 15)

    params = {
        "lat": data.lat,
        "lon": data.lon,
        "peakpower": data.system_size_kw,
        "loss": total_losses,   # 🔥 key change
        "angle": data.tilt,
        "aspect": data.azimuth - 180,
        "outputformat": "json"
    }

    response = requests.get(url, params=params)
    result = response.json()

    return {
        "source": "PVGIS",
        "mode": "realistic",
        "annual_energy_kwh": result["outputs"]["totals"]["fixed"]["E_y"],
        "monthly_energy_kwh": result["outputs"]["monthly"]["fixed"]
    }




def call_pvwatts(data: SolarInput):
    url = "https://developer.nrel.gov/api/pvwatts/v8.json"

    # 🔥 Use realistic default if user gives low loss
    total_losses = max(sum(data.losses), 15)

    params = {
        "api_key": PVWATTS_API_KEY,
        "lat": data.lat,
        "lon": data.lon,
        "system_capacity": data.system_size_kw,
        "tilt": data.tilt,
        "azimuth": data.azimuth,

        # 🔥 CALIBRATION PARAMETERS
        "losses": total_losses,
        "array_type": 0,      # rooftop (realistic)
        "module_type": 0,     # standard module
        "dc_ac_ratio": 1.1    # slightly conservative
    }

    response = requests.get(url, params=params)
    result = response.json()

    return {
        "source": "PVWatts",
        "mode": "realistic",
        "annual_energy_kwh": result["outputs"]["ac_annual"],
        "monthly_energy_kwh": result["outputs"]["ac_monthly"]
    }




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
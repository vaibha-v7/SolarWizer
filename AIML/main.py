from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List
from solar_engine import run_simulation
# NEW 
from forecast import generate_7day_forecast
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now
    allow_credentials=True,
    allow_methods=["*"],  # VERY IMPORTANT
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


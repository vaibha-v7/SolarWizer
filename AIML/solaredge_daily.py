import requests
import os
import dotenv
from datetime import datetime

dotenv.load_dotenv()

API_KEY = os.getenv("SOLAREDGE_KEY")


def get_today_energy(site_id: str):

    today = datetime.now().strftime("%Y-%m-%d")

    url = f"https://monitoringapi.solaredge.com/site/{site_id}/energy"

    params = {
        "startDate": today,
        "endDate": today,
        "timeUnit": "DAY",
        "api_key": API_KEY
    }

    response = requests.get(url, params=params)

    response.raise_for_status()

    data = response.json()

    energy_wh = data["energy"]["values"][0]["value"]

    if energy_wh is None:
        return 0

    energy_kwh = round(energy_wh / 1000, 2)

    return energy_kwh
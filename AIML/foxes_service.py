import hashlib
import time
import requests
import os
import dotenv

dotenv.load_dotenv()

API_KEY = os.getenv("FOX_TOKEN")

DOMAIN = "https://www.foxesscloud.com"


def build_headers(path: str):

    timestamp = int(
        time.time() * 1000
    )

    raw = fr"{path}\r\n{API_KEY}\r\n{timestamp}"

    signature = hashlib.md5(
        raw.encode("UTF-8")
    ).hexdigest()

    return {
        "token": API_KEY,

        "timestamp":
            str(timestamp),

        "signature":
            signature,

        "lang":
            "en",

        "Content-Type":
            "application/json",

        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }


def api_get(
    path: str,
    params=None
):

    url = f"{DOMAIN}{path}"

    response = requests.get(
        url,
        headers=build_headers(path),
        params=params,
        timeout=20
    )

    response.raise_for_status()

    return response.json()


def get_generation_data(
    serial_no: str
):

    result = api_get(
        "/op/v0/device/generation",
        {
            "sn":
                serial_no
        }
    )

    if result.get(
        "errno"
    ) != 0:

        raise Exception(
            result
        )

    r = result.get(
        "result",
        {}
    )

    return {

        "success": True,

        "device_sn":
            serial_no,

        "generation": {

            "today_kwh":
                r.get(
                    "today",
                    0
                ),

            "month_kwh":
                r.get(
                    "month",
                    0
                ),

            "cumulative_kwh":
                r.get(
                    "cumulative",
                    0
                )

        }

    }
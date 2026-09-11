from datetime import datetime, timedelta
from statistics import median


DEFAULT_BASELINE_WINDOW_DAYS = 14
MIN_BASELINE_SAMPLES = 7
MOVED_VARIABILITY_MULTIPLIER = 3.0
MIN_RELATIVE_CHANGE_FOR_MOVE = 0.10

def calculate_baseline(
    rows,
    person_id,
    signal_type,
    today_date,
    device_key=None,
    window_days=DEFAULT_BASELINE_WINDOW_DAYS,
):
    today = datetime.strptime(today_date, "%Y-%m-%d").date()
    window_start = today - timedelta(days=window_days)

    values = []

    for row in rows:
        if row.get("person_id") != person_id:
            continue

        if row.get("signal_type") != signal_type:
            continue

        # Baselines are device-specific when a device is supplied.
        if device_key is not None and row.get("device_key") != device_key:
            continue

        if row.get("value") is None:
            continue

        if row.get("coverage_status") in {"missing", "not_expected"}:
            continue

        if row.get("freshness_status") == "stale":
            continue

        row_date = datetime.strptime(
            row["local_date"],
            "%Y-%m-%d",
        ).date()

        # Only historical data is used.
        # Today's reading must never be included in its own baseline.
        if not window_start <= row_date < today:
            continue

        values.append(float(row["value"]))

    sample_count = len(values)

    if sample_count < MIN_BASELINE_SAMPLES:
        return {
            "baseline_value": None,
            "variability": None,
            "sample_count": sample_count,
            "window_days": window_days,
            "status": "insufficient_data",
        }

    baseline_value = median(values)

    # Median absolute deviation (MAD):
    # robust measure of the person's normal day-to-day variation.
    absolute_deviations = [
        abs(value - baseline_value)
        for value in values
    ]

    variability = median(absolute_deviations)

    return {
        "baseline_value": baseline_value,
        "variability": variability,
        "sample_count": sample_count,
        "window_days": window_days,
        "status": "available",
    }
def evaluate_deviation(
    today_value,
    baseline_result,
    variability_multiplier=MOVED_VARIABILITY_MULTIPLIER,
    minimum_relative_change=MIN_RELATIVE_CHANGE_FOR_MOVE,
):
    if baseline_result["status"] != "available":
        return {
            "today_value": float(today_value),
            "baseline_value": None,
            "deviation": None,
            "deviation_percent": None,
            "movement_threshold": None,
            "status": "insufficient_data",
        }

    baseline_value = float(baseline_result["baseline_value"])
    variability = float(baseline_result["variability"])
    today_value = float(today_value)

    deviation = today_value - baseline_value

    if baseline_value != 0:
        deviation_percent = (deviation / baseline_value) * 100
        relative_threshold = abs(baseline_value) * minimum_relative_change
    else:
        deviation_percent = None
        relative_threshold = 0

    variability_threshold = variability * variability_multiplier

    movement_threshold = max(
        variability_threshold,
        relative_threshold,
    )

    if deviation >= movement_threshold:
        status = "moved_up"
    elif deviation <= -movement_threshold:
        status = "moved_down"
    else:
        status = "wobbled"

    return {
        "today_value": today_value,
        "baseline_value": baseline_value,
        "deviation": deviation,
        "deviation_percent": deviation_percent,
        "movement_threshold": movement_threshold,
        "status": status,
    }


def calculate_confidence(baseline_result):
    sample_count = baseline_result.get("sample_count", 0)
    status = baseline_result.get("status")

    if status != "available":
        return {
            "confidence": "low",
            "reason": "Insufficient baseline data",
        }

    if sample_count >= 12:
        return {
            "confidence": "high",
            "reason": "Baseline is supported by at least 12 valid historical samples",
        }

    if sample_count >= 7:
        return {
            "confidence": "medium",
            "reason": "Baseline is available but historical coverage is limited",
        }

    return {
        "confidence": "low",
        "reason": "Too few valid historical samples",
    }

def assess_readiness(rows, today_row):
    person_id = today_row["person_id"]
    signal_type = today_row["signal_type"]
    today_date = today_row["local_date"]
    today_value = today_row.get("value")
    device_key = today_row.get("device_key")

    if today_value is None:
        return {
            "person_id": person_id,
            "signal_type": signal_type,
            "today_date": today_date,
            "today_value": None,
            "baseline_value": None,
            "deviation": None,
            "deviation_percent": None,
            "movement_status": "insufficient_data",
            "confidence": "low",
            "confidence_reason": "Today's reading is missing",
        }

    baseline_result = calculate_baseline(
        rows=rows,
        person_id=person_id,
        signal_type=signal_type,
        today_date=today_date,
        device_key=device_key,
    )

    deviation_result = evaluate_deviation(
        today_value=today_value,
        baseline_result=baseline_result,
    )

    confidence_result = calculate_confidence(
        baseline_result
    )

    # A stale current reading should never receive
    # medium or high confidence.
    if today_row.get("freshness_status") == "stale":
        confidence_result = {
            "confidence": "low",
            "reason": "Today's reading is stale",
        }

    return {
        "person_id": person_id,
        "signal_type": signal_type,
        "today_date": today_date,
        "today_value": float(today_value),

        "baseline_value": baseline_result["baseline_value"],
        "baseline_variability": baseline_result["variability"],
        "baseline_sample_count": baseline_result["sample_count"],
        "baseline_window_days": baseline_result["window_days"],

        "deviation": deviation_result["deviation"],
        "deviation_percent": deviation_result["deviation_percent"],
        "movement_threshold": deviation_result["movement_threshold"],
        "movement_status": deviation_result["status"],

        "confidence": confidence_result["confidence"],
        "confidence_reason": confidence_result["reason"],

        "device_key": device_key,
    }

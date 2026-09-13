import csv
from datetime import datetime, timezone

from parser import parse_healthkit_datetime


CSV_SIGNAL_MAP = {
    "resting_heart_rate": {
        "unit": "bpm",
    },
    "hrv_sdnn": {
        "unit": "ms",
    },
    "calories": {
        "unit": "kcal",
    },
    "protein": {
        "unit": "g",
    },
}


def build_csv_row(csv_row, simulated=False):
    signal_type = csv_row["signal_type"]
    mapping = CSV_SIGNAL_MAP.get(signal_type)

    if mapping is None:
        return None

    source_value = csv_row["value"]
    source_unit = csv_row["unit"]

    normalized_value = float(source_value)
    normalized_unit = mapping["unit"]

    captured_at_utc, captured_timezone_offset = parse_healthkit_datetime(
        csv_row["captured_at"]
    )

    return {
        "person_id": csv_row["person_id"],
        "source_signal_type": signal_type,
        "signal_type": signal_type,

        "source_value": source_value,
        "source_unit": source_unit,

        "normalized_value": normalized_value,
        "normalized_unit": normalized_unit,

        "source_name": "simulated" if simulated else csv_row["source_name"],
        "source_version": None,

        "is_simulated": simulated,
        "source_label": "Simulated" if simulated else csv_row["source_name"],

        "start_time_utc": captured_at_utc,
        "end_time_utc": captured_at_utc,
        "source_recorded_at_utc": captured_at_utc,

        "start_timezone_offset": captured_timezone_offset,
        "end_timezone_offset": captured_timezone_offset,
        "recorded_timezone_offset": captured_timezone_offset,

        "device": None,

        "metadata": {
            "ingestion_source": "csv"
        },
    }

def build_daily_signal_row(csv_row, simulated=False):
    raw_row = build_csv_row(csv_row, simulated=simulated)

    if raw_row is None:
        return None

    captured_at = datetime.strptime(
        csv_row["captured_at"],
        "%Y-%m-%d %H:%M:%S %z",
    )

    return {
        "person_id": raw_row["person_id"],
        "local_date": captured_at.date().isoformat(),
        "signal_type": raw_row["signal_type"],

        "value": raw_row["normalized_value"],
        "unit": raw_row["normalized_unit"],

        "source_name": raw_row["source_name"],
        "ingestion_source": "csv",

        "capture_time_utc": raw_row["source_recorded_at_utc"],
        "capture_timezone": None,
        "capture_timezone_offset": raw_row["recorded_timezone_offset"],

        "device_key": None,

        "source_selection_method": "single_source",
        "aggregation_method": "none",
        "raw_record_count": 1,

        "coverage": 1.0,
        "coverage_status": "complete",
        "freshness_status": "unknown",
        "confidence_status": "unknown",
        "quality_reason": None,

        "is_simulated": raw_row["is_simulated"],
        "source_label": raw_row["source_label"],

        "processing_version": "csv-import-v1",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
def parse_csv(csv_path, simulated=False):
    with open(csv_path, newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)

        for csv_row in reader:
            row = build_csv_row(csv_row, simulated=simulated)

            if row is not None:
                yield row
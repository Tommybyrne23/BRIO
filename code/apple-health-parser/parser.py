import xml.etree.ElementTree as ET
import json
from datetime import datetime, timezone

from mappings import (
    SIGNAL_MAP,
    SLEEP_VALUE_MAP,
    WORKOUT_SIGNAL_TYPE,
    WORKOUT_DURATION_UNIT,
)

def parse_healthkit_datetime(value):
    if value is None:
        return None, None

    dt = datetime.strptime(
        value,
        "%Y-%m-%d %H:%M:%S %z"
    )

    offset = dt.strftime("%z")
    utc_time = dt.astimezone(timezone.utc).isoformat()

    return utc_time, offset
def extract_record_metadata(elem):
    metadata_entries = {}
    hrv_metadata = []

    for child in elem:
        if child.tag == "MetadataEntry":
            key = child.attrib.get("key")
            value = child.attrib.get("value")

            if key is not None:
                metadata_entries[key] = value

        elif child.tag == "HeartRateVariabilityMetadataList":
            for beat in child:
                if beat.tag == "InstantaneousBeatsPerMinute":
                    hrv_metadata.append(dict(beat.attrib))

    metadata = {}

    if metadata_entries:
        metadata["metadata_entries"] = metadata_entries

    if hrv_metadata:
        metadata["heart_rate_variability_metadata"] = hrv_metadata

    return metadata
def build_record_row(elem, person_id):
    record_type = elem.attrib.get("type")
    mapping = SIGNAL_MAP.get(record_type)

    # Ignore Record types that are not currently supported
    if mapping is None:
        return None

    source_value = elem.attrib.get("value")
    start_time_utc, start_timezone_offset = parse_healthkit_datetime(
        elem.attrib.get("startDate")
    )

    end_time_utc, end_timezone_offset = parse_healthkit_datetime(
        elem.attrib.get("endDate")
    )

    recorded_time_utc, recorded_timezone_offset = parse_healthkit_datetime(
        elem.attrib.get("creationDate")
    )

    # Sleep values are categories rather than numbers
    if record_type == "HKCategoryTypeIdentifierSleepAnalysis":
        normalized_value = SLEEP_VALUE_MAP.get(
            source_value,
            source_value
        )

    # Numeric signals such as RHR and HRV
    elif mapping["unit"] is not None and source_value is not None:
        normalized_value = float(source_value)

    else:
        normalized_value = None

    return {
        "person_id": person_id,
        "source_signal_type": record_type,
        "signal_type": mapping["signal_type"],

        "source_value": source_value,
        "source_unit": elem.attrib.get("unit"),

        "normalized_value": normalized_value,
        "normalized_unit": mapping["unit"],

        "source_name": elem.attrib.get("sourceName"),
        "source_version": elem.attrib.get("sourceVersion"),

        "start_time_utc": start_time_utc,
        "end_time_utc": end_time_utc,
        "source_recorded_at_utc": recorded_time_utc,

        "start_timezone_offset": start_timezone_offset,
        "end_timezone_offset": end_timezone_offset,
        "recorded_timezone_offset": recorded_timezone_offset,

        "device": elem.attrib.get("device"),
        "metadata": extract_record_metadata(elem),
    }

def extract_workout_metadata(elem):
    metadata_entries = {}
    workout_statistics = []

    for child in elem:
        if child.tag == "MetadataEntry":
            key = child.attrib.get("key")
            value = child.attrib.get("value")

            if key is not None:
                metadata_entries[key] = value

        elif child.tag == "WorkoutStatistics":
            workout_statistics.append(dict(child.attrib))

    return {
        "metadata_entries": metadata_entries,
        "workout_statistics": workout_statistics,
    }

def normalize_workout_duration(value, unit):
    if value is None or unit is None:
        return None

    duration = float(value)
    unit = unit.lower()

    if unit in {"min", "minute", "minutes"}:
        return duration

    if unit in {"sec", "second", "seconds"}:
        return duration / 60

    if unit in {"hr", "hour", "hours"}:
        return duration * 60

    return None
def build_workout_row(elem, person_id):
    duration = elem.attrib.get("duration")
    duration_unit = elem.attrib.get("durationUnit")

    normalized_duration = normalize_workout_duration(
        duration,
        duration_unit
    )

    start_time_utc, start_timezone_offset = parse_healthkit_datetime(
        elem.attrib.get("startDate")
    )

    end_time_utc, end_timezone_offset = parse_healthkit_datetime(
        elem.attrib.get("endDate")
    )

    recorded_time_utc, recorded_timezone_offset = parse_healthkit_datetime(
        elem.attrib.get("creationDate")
    )

    return {
        "person_id": person_id,

        "source_signal_type": elem.attrib.get(
            "workoutActivityType"
        ),
        "signal_type": WORKOUT_SIGNAL_TYPE,

        "source_value": duration,
        "source_unit": duration_unit,

        "normalized_value": normalized_duration,
        "normalized_unit": WORKOUT_DURATION_UNIT,

        "source_name": elem.attrib.get("sourceName"),
        "source_version": elem.attrib.get("sourceVersion"),

        "start_time_utc": start_time_utc,
        "end_time_utc": end_time_utc,
        "source_recorded_at_utc": recorded_time_utc,

        "start_timezone_offset": start_timezone_offset,
        "end_timezone_offset": end_timezone_offset,
        "recorded_timezone_offset": recorded_timezone_offset,

        "device": elem.attrib.get("device"),
        "metadata": extract_workout_metadata(elem),
    }

WORKOUT_DEDUPE_WINDOW_MINUTES = 5
WORKOUT_OVERLAP_THRESHOLD = 0.5

WORKOUT_DEDUPE_WINDOW_MINUTES = 5
WORKOUT_OVERLAP_THRESHOLD = 0.5

WORKOUT_SOURCE_PRIORITY = {
    "whoop": 1,
    "apple watch": 2,
}


def is_duplicate_workout(workout_a, workout_b):
    # Must be the same workout type
    if workout_a["source_signal_type"] != workout_b["source_signal_type"]:
        return False

    start_a = datetime.fromisoformat(workout_a["start_time_utc"])
    end_a = datetime.fromisoformat(workout_a["end_time_utc"])

    start_b = datetime.fromisoformat(workout_b["start_time_utc"])
    end_b = datetime.fromisoformat(workout_b["end_time_utc"])

    # Start times must be within the configured dedupe window
    start_difference = abs(
        (start_a - start_b).total_seconds()
    ) / 60

    if start_difference > WORKOUT_DEDUPE_WINDOW_MINUTES:
        return False

    # Calculate overlap
    overlap_start = max(start_a, start_b)
    overlap_end = min(end_a, end_b)

    overlap_seconds = max(
        0,
        (overlap_end - overlap_start).total_seconds()
    )

    duration_a = (end_a - start_a).total_seconds()
    duration_b = (end_b - start_b).total_seconds()

    shorter_duration = min(duration_a, duration_b)

    if shorter_duration <= 0:
        return False

    overlap_ratio = overlap_seconds / shorter_duration

    return overlap_ratio >= WORKOUT_OVERLAP_THRESHOLD


def normalize_source_name(source_name):
    if source_name is None:
        return ""

    return " ".join(
        source_name.replace("\xa0", " ").split()
    ).lower()


def choose_preferred_workout(workout_a, workout_b):
    source_a = normalize_source_name(workout_a["source_name"])
    source_b = normalize_source_name(workout_b["source_name"])

    rank_a = WORKOUT_SOURCE_PRIORITY.get(source_a, 999)
    rank_b = WORKOUT_SOURCE_PRIORITY.get(source_b, 999)

    if rank_a <= rank_b:
        return workout_a

    return workout_b

def deduplicate_workouts(workouts):
    selected = []

    for workout in workouts:
        duplicate_index = None

        for index, existing in enumerate(selected):
            if is_duplicate_workout(workout, existing):
                duplicate_index = index
                break

        if duplicate_index is None:
            selected.append(workout)
        else:
            selected[duplicate_index] = choose_preferred_workout(
                selected[duplicate_index],
                workout
            )

    return selected

def parse_apple_health(xml_path, person_id):
    record_count = 0

    context = ET.iterparse(
        xml_path,
        events=("start", "end")
    )

    _, root = next(context)

    for event, elem in context:
        if event != "end":
            continue

        row = None

        if elem.tag == "Record":
            record_count += 1
            row = build_record_row(elem, person_id)

            if record_count % 10000 == 0:
                print(f"Processed {record_count} records...")

        elif elem.tag == "Workout":
            row = build_workout_row(elem, person_id)

        if row is not None:
            yield row

        if elem.tag in {"Record", "Workout"}:
            elem.clear()
            root.clear()

def write_rows_jsonl(xml_path, person_id, output_path):
    row_count = 0

    with open(output_path, "w", encoding="utf-8") as output_file:
        for row in parse_apple_health(xml_path, person_id):
            output_file.write(
                json.dumps(row, ensure_ascii=False) + "\n"
            )
            row_count += 1

    print(f"Wrote {row_count} rows to {output_path}")
def scan_apple_health(xml_path, person_id):
    record_count = 0
    workout_count = 0

    supported_counts = {
        "resting_heart_rate": 0,
        "hrv_sdnn": 0,
        "sleep": 0,
        "workout": 0,
    }

    sample_printed = 0
    max_samples = 5

    # Stream the XML instead of loading the whole file into memory
    context = ET.iterparse(
        xml_path,
        events=("start", "end")
    )

    _, root = next(context)

    for event, elem in context:

        if event != "end":
            continue

        # Handle Apple Health <Record> elements
        if elem.tag == "Record":
            record_count += 1

            row = build_record_row(
                elem,
                person_id
            )

            if row:
                signal_type = row["signal_type"]
                supported_counts[signal_type] += 1

                # Only print a few example rows
                if sample_printed < max_samples:
                    print(row)
                    sample_printed += 1

            # Report progress for large exports
            if record_count % 10000 == 0:
                print(
                    f"Processed {record_count} records..."
                )

        # Handle Apple Health <Workout> elements
        elif elem.tag == "Workout":
            workout_count += 1

            row = build_workout_row(
                elem,
                person_id
            )

            supported_counts["workout"] += 1

            if sample_printed < max_samples:
                print(row)
                sample_printed += 1

        # Clear processed elements to keep memory usage low
        if elem.tag in {"Record", "Workout"}:
            elem.clear()
            root.clear()

    print("\n--- Parse Summary ---")
    print(f"Total Records: {record_count}")
    print(f"Total Workouts: {workout_count}")
    print(
        f"Resting Heart Rate: "
        f"{supported_counts['resting_heart_rate']}"
    )
    print(
        f"HRV SDNN: "
        f"{supported_counts['hrv_sdnn']}"
    )
    print(
        f"Sleep: "
        f"{supported_counts['sleep']}"
    )
    print(
        f"Workout: "
        f"{supported_counts['workout']}"
    )

    return {
        "total_records": record_count,
        "total_workouts": workout_count,
        "supported_counts": supported_counts,
    }

    


if __name__ == "__main__":
    write_rows_jsonl(
        "tests/fixtures/sample_export.xml",
        "P001",
        "tests/fixtures/parsed_rows.jsonl"
    )
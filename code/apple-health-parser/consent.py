from datetime import datetime, timezone


CONSENT_GRANTED = "granted"
CONSENT_REVOKED = "revoked"


def create_consent_record(
    person_id,
    signal_type,
    source_name,
    status,
    recorded_at_utc=None,
):
    if status not in {CONSENT_GRANTED, CONSENT_REVOKED}:
        raise ValueError(
            "Consent status must be 'granted' or 'revoked'"
        )

    if recorded_at_utc is None:
        recorded_at_utc = datetime.now(timezone.utc).isoformat()

    return {
        "person_id": person_id,
        "signal_type": signal_type,
        "source_name": source_name,
        "status": status,
        "recorded_at_utc": recorded_at_utc,
    }


def get_latest_consent_status(
    consent_records,
    person_id,
    signal_type,
    source_name,
):
    matching_records = [
        record
        for record in consent_records
        if record["person_id"] == person_id
        and record["signal_type"] == signal_type
        and record["source_name"] == source_name
    ]

    if not matching_records:
        return None

    latest_record = max(
        matching_records,
        key=lambda record: record["recorded_at_utc"],
    )

    return latest_record["status"]


def is_source_allowed(
    consent_records,
    person_id,
    signal_type,
    source_name,
):
    status = get_latest_consent_status(
        consent_records=consent_records,
        person_id=person_id,
        signal_type=signal_type,
        source_name=source_name,
    )

    return status == CONSENT_GRANTED


def filter_rows_by_consent(rows, consent_records):
    allowed_rows = []

    for row in rows:
        person_id = row.get("person_id")
        signal_type = row.get("signal_type")
        source_name = row.get("source_name")

        if not person_id or not signal_type or not source_name:
            continue

        if is_source_allowed(
            consent_records=consent_records,
            person_id=person_id,
            signal_type=signal_type,
            source_name=source_name,
        ):
            allowed_rows.append(row)

    return allowed_rows
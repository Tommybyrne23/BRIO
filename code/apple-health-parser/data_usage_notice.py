from datetime import datetime, timezone


NOTICE_VERSION = "1.0"

NOTICE_TEXT = (
    "BRIO uses your current check-in data to create "
    "a non-clinical daily suggestion."
)


def get_data_usage_notice():
    return {
        "notice_version": NOTICE_VERSION,
        "text": NOTICE_TEXT,
        "purpose": "non_clinical_daily_suggestion",
    }


def record_acknowledgement(
    person_id,
    affirmative,
    notice_version=NOTICE_VERSION,
    acknowledged_at_utc=None,
):
    if affirmative is not True:
        raise ValueError(
            "Affirmative acknowledgement is required to continue"
        )

    if acknowledged_at_utc is None:
        acknowledged_at_utc = datetime.now(
            timezone.utc
        ).isoformat()

    return {
        "person_id": person_id,
        "affirmative": True,
        "notice_version": notice_version,
        "acknowledged_at_utc": acknowledged_at_utc,
    }


def can_continue_onboarding(
    acknowledgement,
    current_notice_version=NOTICE_VERSION,
):
    if acknowledgement is None:
        return False

    return (
        acknowledgement.get("affirmative") is True
        and acknowledgement.get("notice_version")
        == current_notice_version
        and acknowledgement.get("acknowledged_at_utc") is not None
    )


def exit_onboarding(person_id):
    return {
        "person_id": person_id,
        "status": "exited",
        "acknowledgement": None,
        "submitted_inputs": [],
    }
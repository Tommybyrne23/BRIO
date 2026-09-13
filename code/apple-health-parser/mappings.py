SIGNAL_MAP = {
    "HKQuantityTypeIdentifierRestingHeartRate": {
        "signal_type": "resting_heart_rate",
        "unit": "bpm",
    },
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": {
        "signal_type": "hrv_sdnn",
        "unit": "ms",
    },
    "HKCategoryTypeIdentifierSleepAnalysis": {
        "signal_type": "sleep",
        "unit": None,
    },
}

WORKOUT_SIGNAL_TYPE = "workout"
WORKOUT_DURATION_UNIT = "min"

SLEEP_VALUE_MAP = {
    "HKCategoryValueSleepAnalysisAsleepUnspecified": "asleep",
    "HKCategoryValueSleepAnalysisAwake": "awake",
}
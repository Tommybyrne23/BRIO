import unittest

from readiness import (
    calculate_baseline,
    evaluate_deviation,
    calculate_confidence,
    assess_readiness,
)

class TestReadinessBaseline(unittest.TestCase):

    def test_calculates_personal_baseline(self):
        rows = [
            {
                "person_id": "P001",
                "local_date": "2026-09-03",
                "signal_type": "hrv_sdnn",
                "value": 60,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-04",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-05",
                "signal_type": "hrv_sdnn",
                "value": 62,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-06",
                "signal_type": "hrv_sdnn",
                "value": 60,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-07",
                "signal_type": "hrv_sdnn",
                "value": 63,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-08",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-09",
                "signal_type": "hrv_sdnn",
                "value": 62,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
        ]

        result = calculate_baseline(
            rows=rows,
            person_id="P001",
            signal_type="hrv_sdnn",
            today_date="2026-09-10",
            device_key="apple_watch",
        )

        self.assertEqual(result["status"], "available")
        self.assertEqual(result["sample_count"], 7)
        self.assertEqual(result["baseline_value"], 61)
        self.assertEqual(result["variability"], 1)
    def test_returns_insufficient_data_when_history_is_too_thin(self):
        rows = [
            {
                "person_id": "P001",
                "local_date": "2026-09-06",
                "signal_type": "hrv_sdnn",
                "value": 60,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-07",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-08",
                "signal_type": "hrv_sdnn",
                "value": 62,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-09",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
        ]

        result = calculate_baseline(
            rows=rows,
            person_id="P001",
            signal_type="hrv_sdnn",
            today_date="2026-09-10",
            device_key="apple_watch",
        )

        self.assertEqual(result["status"], "insufficient_data")
        self.assertEqual(result["sample_count"], 4)
        self.assertIsNone(result["baseline_value"])
        self.assertIsNone(result["variability"])   

    def test_small_change_is_wobbled(self):
        baseline_result = {
            "baseline_value": 61,
            "variability": 1,
            "sample_count": 7,
            "window_days": 14,
            "status": "available",
        }

        result = evaluate_deviation(
            today_value=62,
            baseline_result=baseline_result,
        )

        self.assertEqual(result["status"], "wobbled")

    def test_large_drop_is_moved_down(self):
        baseline_result = {
            "baseline_value": 61,
            "variability": 1,
            "sample_count": 7,
            "window_days": 14,
            "status": "available",
        }

        result = evaluate_deviation(
            today_value=50,
            baseline_result=baseline_result,
        )

        self.assertEqual(result["status"], "moved_down")

    def test_confidence_is_high_with_many_samples(self):
        baseline_result = {
            "baseline_value": 61,
            "variability": 1,
            "sample_count": 12,
            "window_days": 14,
            "status": "available",
        }

        result = calculate_confidence(baseline_result)

        self.assertEqual(result["confidence"], "high")

    def test_confidence_is_medium_with_limited_samples(self):
        baseline_result = {
            "baseline_value": 61,
            "variability": 1,
            "sample_count": 8,
            "window_days": 14,
            "status": "available",
        }

        result = calculate_confidence(baseline_result)

        self.assertEqual(result["confidence"], "medium")

    def test_confidence_is_low_when_data_is_insufficient(self):
        baseline_result = {
            "baseline_value": None,
            "variability": None,
            "sample_count": 4,
            "window_days": 14,
            "status": "insufficient_data",
        }

        result = calculate_confidence(baseline_result)

        self.assertEqual(result["confidence"], "low")

    def test_end_to_end_readiness_detects_moved_down(self):
        history_rows = [
            {
                "person_id": "P001",
                "local_date": "2026-09-03",
                "signal_type": "hrv_sdnn",
                "value": 60,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-04",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-05",
                "signal_type": "hrv_sdnn",
                "value": 62,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-06",
                "signal_type": "hrv_sdnn",
                "value": 60,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-07",
                "signal_type": "hrv_sdnn",
                "value": 63,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-08",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-09",
                "signal_type": "hrv_sdnn",
                "value": 62,
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
        ]

        today_row = {
            "person_id": "P001",
            "local_date": "2026-09-10",
            "signal_type": "hrv_sdnn",
            "value": 50,
            "device_key": "apple_watch",
            "coverage_status": "complete",
            "freshness_status": "fresh",
        }

        result = assess_readiness(
            rows=history_rows,
            today_row=today_row,
        )

        self.assertEqual(result["baseline_value"], 61)
        self.assertEqual(result["baseline_sample_count"], 7)
        self.assertEqual(result["movement_status"], "moved_down")
        self.assertEqual(result["confidence"], "medium")
        self.assertEqual(result["today_value"], 50.0)
    
    def test_stale_today_reading_has_low_confidence(self):
        history_rows = [
            {
                "person_id": "P001",
                "local_date": f"2026-08-{day:02d}",
                "signal_type": "hrv_sdnn",
                "value": 60 + (day % 3),
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            }
            for day in range(29, 32)
        ] + [
            {
                "person_id": "P001",
                "local_date": f"2026-09-{day:02d}",
                "signal_type": "hrv_sdnn",
                "value": 60 + (day % 3),
                "device_key": "apple_watch",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            }
            for day in range(1, 10)
        ]

        today_row = {
            "person_id": "P001",
            "local_date": "2026-09-10",
            "signal_type": "hrv_sdnn",
            "value": 61,
            "device_key": "apple_watch",
            "coverage_status": "complete",
            "freshness_status": "stale",
        }

        result = assess_readiness(
            rows=history_rows,
            today_row=today_row,
        )

        self.assertEqual(result["baseline_sample_count"], 12)
        self.assertEqual(result["confidence"], "low")
        self.assertEqual(
            result["confidence_reason"],
            "Today's reading is stale",
        )

    def test_large_increase_is_moved_up(self):
        baseline_result = {
            "baseline_value": 61,
            "variability": 1,
            "sample_count": 7,
            "window_days": 14,
            "status": "available",
        }

        result = evaluate_deviation(
            today_value=72,
            baseline_result=baseline_result,
        )

        self.assertEqual(result["status"], "moved_up")


if __name__ == "__main__":
    unittest.main()
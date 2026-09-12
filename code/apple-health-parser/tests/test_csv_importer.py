import unittest

from csv_importer import build_csv_row, build_daily_signal_row, parse_csv

class TestCSVImporter(unittest.TestCase):

    def test_signal_csv_parses_rows(self):
        rows = list(parse_csv("tests/fixtures/sample_signal.csv"))

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["signal_type"], "resting_heart_rate")
        self.assertEqual(rows[0]["source_value"], "55")
        self.assertEqual(rows[0]["source_unit"], "bpm")
        self.assertEqual(rows[0]["normalized_value"], 55.0)
        self.assertEqual(rows[0]["normalized_unit"], "bpm")

    def test_nutrition_csv_parses_rows(self):
        rows = list(parse_csv("tests/fixtures/sample_nutrition.csv"))

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["signal_type"], "calories")
        self.assertEqual(rows[0]["normalized_value"], 2100.0)
        self.assertEqual(rows[1]["signal_type"], "protein")
        self.assertEqual(rows[1]["normalized_value"], 110.0)

    def test_simulated_source_is_forced(self):
        csv_row = {
            "person_id": "P001",
            "signal_type": "resting_heart_rate",
            "value": "50",
            "unit": "bpm",
            "captured_at": "2026-09-10 09:00:00 +0100",
            "source_name": "whoop",
        }

        row = build_csv_row(csv_row, simulated=True)

        self.assertEqual(row["source_name"], "simulated")
        self.assertEqual(row["source_label"], "Simulated")
        self.assertTrue(row["is_simulated"])

    def test_normal_source_is_preserved(self):
        csv_row = {
            "person_id": "P001",
            "signal_type": "resting_heart_rate",
            "value": "50",
            "unit": "bpm",
            "captured_at": "2026-09-10 09:00:00 +0100",
            "source_name": "manual",
        }

        row = build_csv_row(csv_row)

        self.assertEqual(row["source_name"], "manual")
        self.assertEqual(row["source_label"], "manual")
        self.assertFalse(row["is_simulated"])

    def test_builds_canonical_daily_signal_row(self):
        csv_row = {
            "person_id": "P001",
            "signal_type": "resting_heart_rate",
            "value": "55",
            "unit": "bpm",
            "captured_at": "2026-09-10 08:00:00 +0100",
            "source_name": "manual",
        }

        row = build_daily_signal_row(csv_row)

        self.assertEqual(row["person_id"], "P001")
        self.assertEqual(row["local_date"], "2026-09-10")
        self.assertEqual(row["signal_type"], "resting_heart_rate")
        self.assertEqual(row["value"], 55.0)
        self.assertEqual(row["unit"], "bpm")
        self.assertEqual(row["source_name"], "manual")
        self.assertEqual(row["ingestion_source"], "csv")
        self.assertEqual(row["coverage_status"], "complete")
        self.assertEqual(row["raw_record_count"], 1)
        self.assertEqual(
            row["capture_time_utc"],
            "2026-09-10T07:00:00+00:00",
        )


if __name__ == "__main__":
    unittest.main()
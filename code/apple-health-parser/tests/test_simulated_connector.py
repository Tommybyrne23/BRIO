import unittest

from simulated_connector import (
    build_simulated_daily_signal,
    parse_simulated_csv,
)


class TestSimulatedConnector(unittest.TestCase):

    def test_simulated_csv_is_forced_to_simulated_source(self):
        rows = list(
            parse_simulated_csv("tests/fixtures/sample_signal.csv")
        )

        self.assertEqual(len(rows), 2)

        for row in rows:
            self.assertEqual(row["source_name"], "simulated")
            self.assertEqual(row["source_label"], "Simulated")
            self.assertTrue(row["is_simulated"])

    def test_input_source_cannot_override_simulated_label(self):
        csv_row = {
            "person_id": "P001",
            "signal_type": "resting_heart_rate",
            "value": "50",
            "unit": "bpm",
            "captured_at": "2026-09-10 09:00:00 +0100",
            "source_name": "whoop",
        }

        row = build_simulated_daily_signal(csv_row)

        self.assertEqual(row["source_name"], "simulated")
        self.assertEqual(row["source_label"], "Simulated")
        self.assertTrue(row["is_simulated"])


if __name__ == "__main__":
    unittest.main()
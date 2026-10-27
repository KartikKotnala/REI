import unittest
from backend.evaluation.model_selector import (
    ModelSelectionEngine,
    SELECTION_PROFILES
)

class DummySimulator:
    def run_static_rag(self, req, enable_live_llm=False):
        class DummyResult:
            predicted_impacts = []
        return DummyResult()

class TestModelSelector(unittest.TestCase):
    def test_selection_profiles_weights_sum_to_one(self):
        for key, profile in SELECTION_PROFILES.items():
            weights = profile["weights"]
            total = sum(weights.values())
            self.assertAlmostEqual(total, 1.0, places=4, msg=f"Profile {key} weights do not sum to 1")

    def test_candidate_models_discovery(self):
        parser_data = {"entities": [{"id": "pkg.foo", "name": "foo"}]}
        engine = ModelSelectionEngine(simulator=DummySimulator(), parser_data=parser_data)
        candidates = engine.get_candidate_models()
        self.assertGreater(len(candidates), 0)
        c_ids = [c["id"] for c in candidates]
        self.assertTrue(any("qwen" in cid or "coder" in cid for cid in c_ids))

    def test_evaluate_and_rank_models(self):
        parser_data = {"entities": [{"id": "pkg.foo", "name": "foo"}, {"id": "pkg.bar", "name": "bar"}]}
        engine = ModelSelectionEngine(simulator=DummySimulator(), parser_data=parser_data)

        scenarios = [
            {
                "scenario_id": "TEST_1",
                "title": "Test Scenario",
                "target_symbol": "pkg.foo",
                "file_path": "pkg/foo.py",
                "diff_snippet": "+ def foo(): pass",
                "ground_truth_impacted_entities": ["pkg.bar"]
            }
        ]

        result = engine.evaluate_and_rank_models(scenarios, profile_key="BALANCED")
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["scenarios_evaluated"], 1)
        self.assertIsNotNone(result["recommended_model"])
        self.assertIn("composite_utility_score", result["recommended_model"])
        self.assertGreater(len(result["ranked_scorecards"]), 0)

        # Check ranking descending order
        scores = [s["composite_utility_score"] for s in result["ranked_scorecards"]]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_apply_model(self):
        engine = ModelSelectionEngine(simulator=DummySimulator(), parser_data={})
        res = engine.apply_model("qwen2.5-coder:1.5b")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["active_model"], "qwen2.5-coder:1.5b")

if __name__ == '__main__':
    unittest.main()

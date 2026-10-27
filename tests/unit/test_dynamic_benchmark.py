import unittest
import networkx as nx
from backend.evaluation.dynamic_benchmark import DynamicBenchmarkGenerator

class TestDynamicBenchmark(unittest.TestCase):
    def test_generate_from_graph_hubs(self):
        # Construct a sample dependency graph
        # Node A -> Node B -> Node C
        # Node D -> Node B
        g = nx.DiGraph()
        g.add_node("mod.A", type="class", file_path="mod/a.py", name="A")
        g.add_node("mod.B", type="function", file_path="mod/b.py", name="B")
        g.add_node("mod.C", type="function", file_path="mod/c.py", name="C")
        g.add_node("mod.D", type="function", file_path="mod/d.py", name="D")

        g.add_edge("mod.A", "mod.B", relation="CALLS")
        g.add_edge("mod.D", "mod.B", relation="CALLS")
        g.add_edge("mod.B", "mod.C", relation="CALLS")

        parser_data = {
            "repo_root": "/fake/nonexistent/repo",
            "repo_name": "sample_repo",
            "entities": [
                {"id": "mod.A", "name": "A", "type": "class", "file_path": "mod/a.py"},
                {"id": "mod.B", "name": "B", "type": "function", "file_path": "mod/b.py"},
                {"id": "mod.C", "name": "C", "type": "function", "file_path": "mod/c.py"},
                {"id": "mod.D", "name": "D", "type": "function", "file_path": "mod/d.py"},
            ]
        }

        generator = DynamicBenchmarkGenerator(parser_data=parser_data, nx_graph=g)
        scenarios = generator.generate_scenarios(max_scenarios=2)

        self.assertGreater(len(scenarios), 0)
        sc = scenarios[0]
        self.assertIn("scenario_id", sc)
        self.assertIn("title", sc)
        self.assertIn("target_symbol", sc)
        self.assertIn("diff_snippet", sc)
        self.assertIn("ground_truth_impacted_entities", sc)
        self.assertEqual(sc["source"], "ARCHITECTURAL_HUB")
        self.assertIsInstance(sc["ground_truth_impacted_entities"], list)
        self.assertGreater(len(sc["ground_truth_impacted_entities"]), 0)

if __name__ == '__main__':
    unittest.main()

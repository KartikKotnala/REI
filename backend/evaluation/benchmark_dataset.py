"""
Controlled Synthetic Change Scenarios for SmartFix Repository Evaluation.
Defines 5 ground-truth benchmark change scenarios for impact analysis evaluation.
"""

from typing import List, Dict, Any

SMARTFIX_BENCHMARK_SCENARIOS: List[Dict[str, Any]] = [
    {
        "scenario_id": "SCENARIO_1",
        "title": "RAG Service Retrieve Signature Change",
        "description": "Modifying RAGService.retrieve(query: str, top_k: int = 5) to include re-ranking flag.",
        "target_symbol": "services.rag.rag_engine.RAGService.retrieve",
        "file_path": "services/rag/rag_engine.py",
        "diff_snippet": "- def retrieve(self, query: str, top_k: int = 5):\n+ def retrieve(self, query: str, top_k: int = 5, enable_rerank: bool = True):",
        "ground_truth_impacted_entities": [
            "services.orchestrator.main.ask_question",
            "backend.main.query_rag",
            "services.rag.main.retrieve_documents",
            "services.rag.rag_engine.RAGService",
        ],
    },
    {
        "scenario_id": "SCENARIO_2",
        "title": "Safety Engine Deterministic Rule Update",
        "description": "Modifying SafetyEngine.evaluate logic to block unverified high-voltage operations.",
        "target_symbol": "services.safety.main.SafetyEngine.evaluate",
        "file_path": "services/safety/main.py",
        "diff_snippet": "- if voltage > 480:\n-     return 'WARNING'\n+ if voltage > 480:\n+     return 'BLOCKED'",
        "ground_truth_impacted_entities": [
            "services.orchestrator.main.ask_question",
            "services.safety.main.evaluate_safety",
            "backend.main.run_troubleshoot",
        ],
    },
    {
        "scenario_id": "SCENARIO_3",
        "title": "Equipment Schema Field Modification",
        "description": "Renaming 'serial_number' to 'equipment_uuid' in Equipment data model.",
        "target_symbol": "services.equipment.main.Equipment",
        "file_path": "services/equipment/main.py",
        "diff_snippet": "- serial_number: str\n+ equipment_uuid: str",
        "ground_truth_impacted_entities": [
            "services.equipment.main.get_equipment_details",
            "services.spare_parts.main.check_parts_availability",
            "services.history.main.get_maintenance_history",
        ],
    },
    {
        "scenario_id": "SCENARIO_4",
        "title": "LLM Gateway Generation Parameter Tuning",
        "description": "Adjusting temperature and max_tokens in LLM service call.",
        "target_symbol": "services.llm.main.generate_llm_response",
        "file_path": "services/llm/main.py",
        "diff_snippet": "- payload = {'model': 'codellama', 'temperature': 0.7}\n+ payload = {'model': 'codellama', 'temperature': 0.2, 'top_p': 0.9}",
        "ground_truth_impacted_entities": [
            "services.orchestrator.main.ask_question",
            "services.llm.main.generate_diagnosis",
        ],
    },
    {
        "scenario_id": "SCENARIO_5",
        "title": "Ticket Dispatch Service Payload Mutation",
        "description": "Adding required priority level field to create_ticket API payload.",
        "target_symbol": "services.tickets.main.create_ticket",
        "file_path": "services/tickets/main.py",
        "diff_snippet": "- def create_ticket(equipment_id: str, issue_desc: str):\n+ def create_ticket(equipment_id: str, issue_desc: str, priority_level: str = 'P2'):",
        "ground_truth_impacted_entities": [
            "services.tickets.main.TicketRequest",
            "services.orchestrator.main.create_field_ticket",
        ],
    },
]


def get_benchmark_scenarios() -> List[Dict[str, Any]]:
    return SMARTFIX_BENCHMARK_SCENARIOS

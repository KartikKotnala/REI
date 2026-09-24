"""
Dependency Knowledge Graph Generator for SmartFix Repository.
Constructs multi-relational NetworkX graph mapping functions, variables, attributes, classes, and REST endpoints.
"""

import networkx as nx
from typing import Dict, Any, List, Optional
from backend.parser.repo_parser import parse_smartfix_repository


class DependencyGraphBuilder:
    def __init__(self, parser_data: Dict[str, Any]):
        self.entities = {e["id"]: e for e in parser_data["entities"]}
        self.imports = parser_data["imports"]
        self.name_to_entities: Dict[str, List[str]] = {}

        for eid, entity in self.entities.items():
            name = entity["name"]
            if name not in self.name_to_entities:
                self.name_to_entities[name] = []
            self.name_to_entities[name].append(eid)

        self.graph = nx.DiGraph()

    def build_graph(self) -> nx.DiGraph:
        # Add nodes
        for eid, entity in self.entities.items():
            self.graph.add_node(
                eid,
                name=entity["name"],
                type=entity["type"],
                file_path=entity["file_path"],
                full_name=entity["full_name"],
                signature=entity.get("signature", ""),
            )

        # Build relationships
        for eid, entity in self.entities.items():
            etype = entity["type"]

            # DEFINES relationships
            if etype in ["function", "class", "variable", "endpoint"]:
                file_path = entity["file_path"]
                module_id = file_path.replace("/", ".").rstrip(".py")
                if module_id in self.entities and module_id != eid:
                    self.graph.add_edge(module_id, eid, relation="DEFINES")

                if entity.get("parent_class"):
                    class_id = f"{module_id}.{entity['parent_class']}"
                    if class_id in self.entities and class_id != eid:
                        self.graph.add_edge(class_id, eid, relation="DEFINES")

            # INHERITS_FROM relationships
            if etype == "class" and entity.get("bases"):
                for base in entity["bases"]:
                    for candidate_id in self.entities:
                        if candidate_id.endswith(f".{base}") or candidate_id == base:
                            self.graph.add_edge(eid, candidate_id, relation="INHERITS_FROM")

            # CALLS relationships
            if etype in ["function", "endpoint"] and entity.get("calls"):
                for called_name in entity["calls"]:
                    if called_name in self.name_to_entities:
                        for target_id in self.name_to_entities[called_name]:
                            if target_id != eid:
                                self.graph.add_edge(eid, target_id, relation="CALLS")

            # USES_VARIABLE & ATTRIBUTE_ACCESS
            if etype in ["function", "endpoint"]:
                for var_name in entity.get("variables_used", []):
                    if var_name in self.name_to_entities:
                        for target_id in self.name_to_entities[var_name]:
                            if self.entities[target_id]["type"] == "variable" and target_id != eid:
                                self.graph.add_edge(eid, target_id, relation="USES_VARIABLE")

                for attr_name in entity.get("attributes_used", []):
                    if attr_name in self.name_to_entities:
                        for target_id in self.name_to_entities[attr_name]:
                            if self.entities[target_id]["type"] == "attribute" and target_id != eid:
                                self.graph.add_edge(eid, target_id, relation="ATTRIBUTE_ACCESS")

        # HTTP_CALLS cross-service connections for SmartFix Microservices
        self._add_smartfix_http_edges()
        return self.graph

    def _add_smartfix_http_edges(self):
        """Adds HTTP call edges between SmartFix orchestrator and sub-services."""
        service_endpoints = {
            "RAG_SERVICE": [e for e in self.entities if "services.rag" in e and self.entities[e]["type"] == "endpoint"],
            "SAFETY_SERVICE": [e for e in self.entities if "services.safety" in e and self.entities[e]["type"] == "endpoint"],
            "EQUIPMENT_SERVICE": [e for e in self.entities if "services.equipment" in e and self.entities[e]["type"] == "endpoint"],
            "TICKET_SERVICE": [e for e in self.entities if "services.tickets" in e and self.entities[e]["type"] == "endpoint"],
        }

        orchestrator_funcs = [e for e in self.entities if "services.orchestrator" in e and self.entities[e]["type"] in ["function", "endpoint"]]

        for orch_id in orchestrator_funcs:
            orch_entity = self.entities[orch_id]
            snippet = orch_entity.get("snippet", "")
            if "8001" in snippet or "/rag" in snippet:
                for target in service_endpoints["RAG_SERVICE"]:
                    self.graph.add_edge(orch_id, target, relation="HTTP_CALLS")
            if "8003" in snippet or "/safety" in snippet:
                for target in service_endpoints["SAFETY_SERVICE"]:
                    self.graph.add_edge(orch_id, target, relation="HTTP_CALLS")
            if "8002" in snippet or "/equipment" in snippet:
                for target in service_endpoints["EQUIPMENT_SERVICE"]:
                    self.graph.add_edge(orch_id, target, relation="HTTP_CALLS")

    def to_json(self) -> Dict[str, Any]:
        nodes = []
        for n, d in self.graph.nodes(data=True):
            nodes.append({"id": n, **d})

        links = []
        for u, v, d in self.graph.edges(data=True):
            links.append({"source": u, "target": v, "relation": d.get("relation", "DEPENDS_ON")})

        return {
            "nodes": nodes,
            "links": links,
            "total_nodes": len(nodes),
            "total_edges": len(links),
        }


def build_smartfix_dependency_graph(parser_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if parser_data is None:
        parser_data = parse_smartfix_repository()
    builder = DependencyGraphBuilder(parser_data)
    builder.build_graph()
    return builder.to_json()


build_dependency_graph = build_smartfix_dependency_graph


if __name__ == "__main__":
    graph_json = build_smartfix_dependency_graph()
    print(f"Dependency Knowledge Graph constructed with {graph_json['total_nodes']} nodes and {graph_json['total_edges']} edges!")

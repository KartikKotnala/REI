import React, { useState, useEffect } from 'react';
import {
  GitGraph,
  Search,
  Filter,
  Code,
  Box,
  Link as LinkIcon,
  Tag,
  Network,
  ListFilter,
  ArrowRight,
  Route,
  Layers,
  Compass,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import DependencyCanvas from './DependencyCanvas';

export default function DependencyGraphView() {
  const [graphData, setGraphData] = useState(null);
  const [hubsData, setHubsData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedRelation, setSelectedRelation] = useState('ALL');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [viewMode, setViewMode] = useState('GRAPH'); // 'GRAPH' | 'LIST'
  const [layoutMode, setLayoutMode] = useState('FORCE'); // 'FORCE' | 'HIERARCHICAL' | 'CONCENTRIC'

  // Transitive Impact Path Tracer State
  const [pathSource, setPathSource] = useState('');
  const [pathTarget, setPathTarget] = useState('');
  const [pathTraceResult, setPathTraceResult] = useState(null);
  const [isTracingPath, setIsTracingPath] = useState(false);
  const [pathError, setPathError] = useState(null);
  const [showPathTracer, setShowPathTracer] = useState(false);

  useEffect(() => {
    // 1. Fetch entire dependency graph data
    fetch('/api/graph/dependency')
      .then(res => res.json())
      .then(d => {
        setGraphData(d);
        if (d.nodes && d.nodes.length > 0) {
          setSelectedEntity(prev => prev || d.nodes[0]);
        }
      })
      .catch(err => console.error('Error fetching graph:', err));

    // 2. Fetch top architectural hubs for default overview
    fetch('/api/graph/hubs?top_k=25')
      .then(res => res.json())
      .then(data => {
        if (data && data.hubs && data.hubs.length > 0) {
          setHubsData(data.hubs);
          // Auto-select #1 architectural hub so graph is never empty
          setSelectedEntity(prev => {
            if (!prev || !prev.id) return data.hubs[0];
            return prev;
          });
        }
      })
      .catch(err => console.error('Error fetching hubs:', err));
  }, []);

  if (!graphData) {
    return (
      <div className="p-12 text-slate-400 flex items-center justify-center gap-3 font-mono">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
        Loading Multi-Relational Dependency Knowledge Graph...
      </div>
    );
  }

  const filteredNodes = graphData.nodes.filter(n => {
    const matchesSearch =
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'ALL' || n.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getEntityConnections = (nodeId) => {
    if (!nodeId) return { incoming: [], outgoing: [] };
    const incoming = graphData.links.filter(l => l.target === nodeId);
    const outgoing = graphData.links.filter(l => l.source === nodeId);
    return { incoming, outgoing };
  };

  const connections = selectedEntity ? getEntityConnections(selectedEntity.id) : { incoming: [], outgoing: [] };

  // Handle path tracing request
  const handleTracePath = async (e) => {
    if (e) e.preventDefault();
    if (!pathSource.trim() || !pathTarget.trim()) return;

    setIsTracingPath(true);
    setPathError(null);

    try {
      const res = await fetch(
        `/api/graph/path-trace?source=${encodeURIComponent(pathSource.trim())}&target=${encodeURIComponent(pathTarget.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Path tracing failed');
      }

      setPathTraceResult(data);
      if (!data.connected) {
        setPathError(data.message || 'No dependency path connects these two components.');
      }
    } catch (err) {
      setPathError(err.message || 'Error tracing path');
      setPathTraceResult(null);
    } finally {
      setIsTracingPath(false);
    }
  };

  const clearPathTrace = () => {
    setPathSource('');
    setPathTarget('');
    setPathTraceResult(null);
    setPathError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitGraph className="text-indigo-400" /> Dependency Knowledge Graph
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Structured exploration: Hierarchical DAG, Concentric Horizon, and Force layouts with Transitive Impact Path Tracing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg font-mono text-xs text-indigo-300">
            <span>{graphData.total_nodes?.toLocaleString()} Nodes</span>
            <span className="text-slate-600">|</span>
            <span>{graphData.total_edges?.toLocaleString()} Edges</span>
          </div>

          <button
            onClick={() => setShowPathTracer(!showPathTracer)}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition ${
              showPathTracer || pathTraceResult
                ? 'bg-amber-600 text-white shadow shadow-amber-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Route className="w-3.5 h-3.5 text-amber-300" />
            Transitive Impact Path Tracer
          </button>
        </div>
      </div>

      {/* Transitive Impact Path Tracer Panel */}
      {showPathTracer && (
        <div className="bg-slate-900 border border-amber-900/60 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-300 font-mono">
              <Route className="w-4 h-4 text-amber-400" />
              Transitive Change-Impact Propagation Tracer
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Finds shortest caller/callee path between any two components
            </span>
          </div>

          <form onSubmit={handleTracePath} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <div className="md:col-span-2">
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Source Entity (Origin of Change):</label>
              <input
                type="text"
                value={pathSource}
                onChange={(e) => setPathSource(e.target.value)}
                placeholder="e.g. Scaffold.route or AppContext..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Target Entity (Suspected Breakage):</label>
              <input
                type="text"
                value={pathTarget}
                onChange={(e) => setPathTarget(e.target.value)}
                placeholder="e.g. request or push..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
            <div className="flex items-end gap-2 pt-4 md:pt-0">
              <button
                type="submit"
                disabled={isTracingPath || !pathSource.trim() || !pathTarget.trim()}
                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-semibold bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition flex items-center justify-center gap-1 shadow"
              >
                {isTracingPath ? 'Tracing...' : 'Trace Path'}
              </button>
              {pathTraceResult && (
                <button
                  type="button"
                  onClick={clearPathTrace}
                  className="py-1.5 px-2.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Clear traced path"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* Path Trace Result Banner */}
          {pathTraceResult?.connected && (
            <div className="bg-slate-950/80 border border-amber-600/60 rounded-lg p-3 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Path Discovered: {pathTraceResult.hop_distance} Transitive Hops ({pathTraceResult.path_type})
                </span>
                <span className="text-slate-400 text-[11px]">
                  Highlighted on Canvas with Golden Particle Flow
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-slate-300">
                {pathTraceResult.path_nodes.map((node, i) => (
                  <React.Fragment key={node.id}>
                    <span
                      onClick={() => setSelectedEntity(node)}
                      className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700/80 text-amber-200 hover:border-amber-400 cursor-pointer transition font-semibold"
                    >
                      {node.name}
                    </span>
                    {i < pathTraceResult.path_nodes.length - 1 && (
                      <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                        &rarr; <span className="text-slate-400 text-[10px]">[{pathTraceResult.path_edges[i]?.relation || 'CALLS'}]</span> &rarr;
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {pathError && (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-lg p-2.5 text-xs font-mono text-rose-300 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{pathError}</span>
            </div>
          )}
        </div>
      )}

      {/* Exploration Controls: Search, Type, Relation, View Mode */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
        {/* Search Input */}
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search function, class, variable, or endpoint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {/* Entity Type Filter */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="ALL">All Entity Types</option>
            <option value="function">Function</option>
            <option value="class">Class</option>
            <option value="variable">Variable</option>
            <option value="attribute">Attribute</option>
            <option value="endpoint">REST Endpoint</option>
            <option value="module">Module</option>
          </select>
        </div>

        {/* Relation Filter */}
        <div>
          <select
            value={selectedRelation}
            onChange={(e) => setSelectedRelation(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="ALL">All Relations (Edges)</option>
            <option value="CALLS">CALLS</option>
            <option value="INHERITS_FROM">INHERITS_FROM</option>
            <option value="DEFINES">DEFINES</option>
            <option value="USES_VARIABLE">USES_VARIABLE</option>
            <option value="ATTRIBUTE_ACCESS">ATTRIBUTE_ACCESS</option>
            <option value="HTTP_CALLS">HTTP_CALLS</option>
          </select>
        </div>

        {/* Graph vs List Inspector Mode */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('GRAPH')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded flex items-center justify-center gap-1 transition ${
              viewMode === 'GRAPH'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" /> Graph Canvas
          </button>
          <button
            onClick={() => setViewMode('LIST')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded flex items-center justify-center gap-1 transition ${
              viewMode === 'LIST'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" /> List Inspector
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'GRAPH' ? (
        <div className="space-y-6">
          {/* HTML5 Canvas + Physics / Concentric / Hierarchical Layout */}
          <DependencyCanvas
            nodes={graphData.nodes}
            links={graphData.links}
            hubs={hubsData}
            selectedEntity={selectedEntity}
            onSelectEntity={(node) => setSelectedEntity(node)}
            searchTerm={searchTerm}
            selectedType={selectedType}
            selectedRelation={selectedRelation}
            layoutMode={layoutMode}
            onChangeLayoutMode={(mode) => setLayoutMode(mode)}
            pathTraceResult={pathTraceResult}
            pathSource={pathSource}
            pathTarget={pathTarget}
            onSetPathSource={(id) => {
              setPathSource(prev => prev === id ? '' : id);
              setShowPathTracer(true);
            }}
            onSetPathTarget={(id) => {
              setPathTarget(prev => prev === id ? '' : id);
              setShowPathTracer(true);
            }}
            onTracePath={handleTracePath}
            onClearPathTrace={clearPathTrace}
            isTracingPath={isTracingPath}
          />

          {/* Selected Entity Details Panel */}
          {selectedEntity ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white font-mono">{selectedEntity.name}</h3>
                    <span className="text-xs px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full font-mono uppercase">
                      {selectedEntity.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">{selectedEntity.id}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">File: {selectedEntity.file_path}</div>
                </div>

                {/* Path Quick Set Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setPathSource(prev => prev === selectedEntity.id ? '' : selectedEntity.id);
                      setShowPathTracer(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                      pathSource === selectedEntity.id
                        ? 'bg-amber-600 text-white shadow shadow-amber-600/40 ring-1 ring-amber-400'
                        : 'bg-slate-800 hover:bg-amber-600/80 text-slate-200 hover:text-white'
                    }`}
                  >
                    {pathSource === selectedEntity.id ? '✓ Path Source (Selected)' : 'Set as Path Source'}
                  </button>
                  <button
                    onClick={() => {
                      setPathTarget(prev => prev === selectedEntity.id ? '' : selectedEntity.id);
                      setShowPathTracer(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                      pathTarget === selectedEntity.id
                        ? 'bg-amber-600 text-white shadow shadow-amber-600/40 ring-1 ring-amber-400'
                        : 'bg-slate-800 hover:bg-amber-600/80 text-slate-200 hover:text-white'
                    }`}
                  >
                    {pathTarget === selectedEntity.id ? '✓ Path Target (Selected)' : 'Set as Path Target'}
                  </button>

                  {pathSource && pathTarget && (
                    <button
                      onClick={handleTracePath}
                      disabled={isTracingPath}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-lg text-xs font-mono transition shadow-lg shadow-amber-600/30 flex items-center gap-1.5 animate-pulse"
                    >
                      <Route className="w-3.5 h-3.5" />
                      {isTracingPath ? 'Tracing...' : 'Trace Path Now'}
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedEntity(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-mono transition ml-auto"
                  >
                    Show Hubs Overview
                  </button>
                </div>
              </div>

              {/* Signature */}
              {selectedEntity.signature && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300">
                  {selectedEntity.signature}
                </div>
              )}

              {/* Graph Edges Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Incoming Edges (Callers) */}
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-400" /> Incoming Dependencies ({connections.incoming.length})
                  </h4>
                  {connections.incoming.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">No incoming dependency edges</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {connections.incoming.map((link, idx) => {
                        const sid = typeof link.source === 'object' ? link.source.id : link.source;
                        const sourceNode = graphData.nodes.find(n => n.id === sid);
                        return (
                          <div
                            key={idx}
                            onClick={() => sourceNode && setSelectedEntity(sourceNode)}
                            className="text-xs font-mono bg-slate-900 p-2 rounded border border-slate-800 hover:border-blue-500/50 cursor-pointer transition flex items-center justify-between group"
                            title="Click to hop to this entity"
                          >
                            <div className="truncate mr-2">
                              <span className="text-blue-400">{link.relation}</span> from{' '}
                              <span className="text-slate-200 group-hover:text-blue-300 font-semibold">
                                {sid.split('.').pop()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  setPathSource(prev => prev === sid ? '' : sid);
                                  setShowPathTracer(true);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                                  pathSource === sid
                                    ? 'bg-amber-600 text-white font-bold'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                                title="Set as Source"
                              >
                                {pathSource === sid ? '✓ Src' : 'Src'}
                              </button>
                              <button
                                onClick={() => {
                                  setPathTarget(prev => prev === sid ? '' : sid);
                                  setShowPathTracer(true);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                                  pathTarget === sid
                                    ? 'bg-amber-600 text-white font-bold'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                                title="Set as Target"
                              >
                                {pathTarget === sid ? '✓ Tgt' : 'Tgt'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Outgoing Edges (Callees) */}
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-purple-400" /> Outgoing Dependencies ({connections.outgoing.length})
                  </h4>
                  {connections.outgoing.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">No outgoing dependency edges</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {connections.outgoing.map((link, idx) => {
                        const tid = typeof link.target === 'object' ? link.target.id : link.target;
                        const targetNode = graphData.nodes.find(n => n.id === tid);
                        return (
                          <div
                            key={idx}
                            onClick={() => targetNode && setSelectedEntity(targetNode)}
                            className="text-xs font-mono bg-slate-900 p-2 rounded border border-slate-800 hover:border-purple-500/50 cursor-pointer transition flex items-center justify-between group"
                            title="Click to hop to this entity"
                          >
                            <div className="truncate mr-2">
                              <span className="text-purple-400">{link.relation}</span> &rarr;{' '}
                              <span className="text-slate-200 group-hover:text-purple-300 font-semibold">
                                {tid.split('.').pop()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  setPathSource(prev => prev === tid ? '' : tid);
                                  setShowPathTracer(true);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                                  pathSource === tid
                                    ? 'bg-amber-600 text-white font-bold'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                                title="Set as Source"
                              >
                                {pathSource === tid ? '✓ Src' : 'Src'}
                              </button>
                              <button
                                onClick={() => {
                                  setPathTarget(prev => prev === tid ? '' : tid);
                                  setShowPathTracer(true);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                                  pathTarget === tid
                                    ? 'bg-amber-600 text-white font-bold'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                                title="Set as Target"
                              >
                                {pathTarget === tid ? '✓ Tgt' : 'Tgt'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Hubs Overview Panel when no entity is selected */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Top Architectural Hubs in Active Repository
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  Select any component below or on the canvas to inspect its multi-hop neighborhood
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2">
                {hubsData.slice(0, 15).map((hub, idx) => (
                  <div
                    key={hub.id}
                    onClick={() => {
                      const fullNode = graphData.nodes.find(n => n.id === hub.id) || hub;
                      setSelectedEntity(fullNode);
                    }}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/80 cursor-pointer transition flex flex-col justify-between group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono text-slate-500 font-bold">#{idx + 1}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
                        {hub.type}
                      </span>
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                      {hub.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center justify-between">
                      <span>{hub.degree} connections</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setPathSource(prev => prev === hub.id ? '' : hub.id);
                            setShowPathTracer(true);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition ${
                            pathSource === hub.id
                              ? 'bg-amber-600 text-white font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                          }`}
                          title="Set as Source"
                        >
                          {pathSource === hub.id ? '✓Src' : 'Src'}
                        </button>
                        <button
                          onClick={() => {
                            setPathTarget(prev => prev === hub.id ? '' : hub.id);
                            setShowPathTracer(true);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition ${
                            pathTarget === hub.id
                              ? 'bg-amber-600 text-white font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                          }`}
                          title="Set as Target"
                        >
                          {pathTarget === hub.id ? '✓Tgt' : 'Tgt'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List Inspector View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:col-span-1 space-y-3 max-h-[600px] overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Filtered Entities ({filteredNodes.length})
            </h3>
            <div className="space-y-2">
              {filteredNodes.slice(0, 80).map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedEntity(node)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedEntity && selectedEntity.id === node.id
                      ? 'bg-indigo-950/60 border-indigo-500 text-white'
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm font-mono truncate">{node.name}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/30">
                      {node.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1 truncate">{node.file_path}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            {selectedEntity ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-white font-mono">{selectedEntity.name}</h3>
                      <span className="text-xs px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full font-mono uppercase">
                        {selectedEntity.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">{selectedEntity.id}</div>
                  </div>

                  {/* Path Quick Set Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setPathSource(selectedEntity.id);
                        setShowPathTracer(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                        pathSource === selectedEntity.id
                          ? 'bg-amber-600 text-white shadow shadow-amber-600/40 ring-1 ring-amber-400'
                          : 'bg-slate-800 hover:bg-amber-600/80 text-slate-200 hover:text-white'
                      }`}
                    >
                      {pathSource === selectedEntity.id ? '✓ Path Source (Selected)' : 'Set as Path Source'}
                    </button>
                    <button
                      onClick={() => {
                        setPathTarget(selectedEntity.id);
                        setShowPathTracer(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                        pathTarget === selectedEntity.id
                          ? 'bg-amber-600 text-white shadow shadow-amber-600/40 ring-1 ring-amber-400'
                          : 'bg-slate-800 hover:bg-amber-600/80 text-slate-200 hover:text-white'
                      }`}
                    >
                      {pathTarget === selectedEntity.id ? '✓ Path Target (Selected)' : 'Set as Path Target'}
                    </button>

                    {pathSource && pathTarget && (
                      <button
                        onClick={handleTracePath}
                        disabled={isTracingPath}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-lg text-xs font-mono transition shadow-lg shadow-amber-600/30 flex items-center gap-1.5 animate-pulse"
                      >
                        <Route className="w-3.5 h-3.5" />
                        {isTracingPath ? 'Tracing...' : 'Trace Path Now'}
                      </button>
                    )}
                  </div>
                </div>

                {selectedEntity.signature && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300">
                    {selectedEntity.signature}
                  </div>
                )}
                {selectedEntity.snippet && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto whitespace-pre">
                    {selectedEntity.snippet}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 font-mono text-xs">
                Select an entity from the list to view its source signature, attributes, and relationships.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

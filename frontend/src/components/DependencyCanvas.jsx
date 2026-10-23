import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide
} from 'd3-force';
import { ZoomIn, ZoomOut, RotateCcw, Network, Sparkles } from 'lucide-react';

const TYPE_COLORS = {
  function: { fill: '#38bdf8', stroke: '#0284c7', label: 'Function' },
  class: { fill: '#c084fc', stroke: '#9333ea', label: 'Class' },
  endpoint: { fill: '#34d399', stroke: '#059669', label: 'REST Endpoint' },
  variable: { fill: '#fbbf24', stroke: '#d97706', label: 'Variable' },
  attribute: { fill: '#f87171', stroke: '#dc2626', label: 'Attribute' },
  module: { fill: '#94a3b8', stroke: '#64748b', label: 'Module' },
  default: { fill: '#a1a1aa', stroke: '#71717a', label: 'Entity' }
};

export default function DependencyCanvas({
  nodes = [],
  links = [],
  selectedEntity = null,
  onSelectEntity = () => {},
  searchTerm = '',
  selectedType = 'ALL'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Hop Horizon Mode: 'HOP_1' | 'HOP_2' | 'HOP_3' (Strictly localized subgraphs; no whole graph)
  const [focusMode, setFocusMode] = useState('HOP_1');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Camera transform: pan (x, y) and zoom (k)
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const dragTargetRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Compute node degrees (number of links per node across entire graph)
  const degreeMap = useMemo(() => {
    const deg = new Map();
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      deg.set(s, (deg.get(s) || 0) + 1);
      deg.set(t, (deg.get(t) || 0) + 1);
    });
    return deg;
  }, [links]);

  // Filter nodes & links: Localized hop subgraphs only (1-Hop, 2-Hop, 3-Hop) - No whole graph!
  const { displayNodes, displayLinks } = useMemo(() => {
    if (!selectedEntity || nodes.length === 0) {
      return { displayNodes: [], displayLinks: [] };
    }

    const maxHops = focusMode === 'HOP_3' ? 3 : focusMode === 'HOP_2' ? 2 : 1;

    // Fast Adjacency Map (bidirectional traversal for caller/callee neighborhood)
    const adj = new Map();
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (!adj.has(s)) adj.set(s, []);
      if (!adj.has(t)) adj.set(t, []);
      adj.get(s).push(t);
      adj.get(t).push(s);
    });

    // BFS to find all nodes within maxHops of selectedEntity.id
    const visitedHop = new Map(); // id -> hop distance (0 for root)
    visitedHop.set(selectedEntity.id, 0);
    const queue = [selectedEntity.id];

    while (queue.length > 0) {
      const currId = queue.shift();
      const currHop = visitedHop.get(currId);
      if (currHop >= maxHops) continue;

      const neighbors = adj.get(currId) || [];
      for (const nbrId of neighbors) {
        if (!visitedHop.has(nbrId)) {
          visitedHop.set(nbrId, currHop + 1);
          queue.push(nbrId);
        }
      }
    }

    const nodeLookup = new Map(nodes.map(n => [n.id, n]));
    const targetNodeIds = new Set(visitedHop.keys());

    const filteredNodes = [];
    targetNodeIds.forEach(id => {
      const node = nodeLookup.get(id);
      if (node) {
        const hop = visitedHop.get(id);
        const deg = degreeMap.get(id) || 1;
        // Root node is prominent and larger; neighbors sized by connectivity
        const radius = hop === 0 ? 15 : Math.max(6, Math.min(13, 6 + Math.sqrt(deg) * 1.5));
        filteredNodes.push({
          ...node,
          radius,
          hopDistance: hop
        });
      }
    });

    const activeNodeIdSet = new Set(filteredNodes.map(n => n.id));

    const filteredLinks = links
      .filter(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return activeNodeIdSet.has(s) && activeNodeIdSet.has(t);
      })
      .map(l => ({
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
        relation: l.relation || 'DEPENDS_ON'
      }));

    return { displayNodes: filteredNodes, displayLinks: filteredLinks };
  }, [nodes, links, selectedEntity, focusMode, degreeMap]);

  // Keep simulation and active nodes in refs to drive requestAnimationFrame
  const simulationRef = useRef(null);
  const simNodesRef = useRef([]);
  const simLinksRef = useRef([]);

  // Recenter camera when selected entity or hop horizon changes
  useEffect(() => {
    transformRef.current = { x: 0, y: 0, k: 1 };
    if (simulationRef.current) {
      simulationRef.current.alpha(0.5).restart();
    }
  }, [selectedEntity?.id, focusMode]);

  // Setup / restart d3-force simulation
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 550;

    // Preserve existing positions if available so nodes do not violently jump
    const existingPos = new Map(simNodesRef.current.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));

    const simNodes = displayNodes.map(n => {
      const prev = existingPos.get(n.id);
      return {
        ...n,
        x: prev ? prev.x : width / 2 + (Math.random() - 0.5) * 160,
        y: prev ? prev.y : height / 2 + (Math.random() - 0.5) * 160,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0
      };
    });

    const simLinks = displayLinks.map(l => ({ ...l }));

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks)
          .id(d => d.id)
          .distance(focusMode === 'HOP_1' ? 95 : focusMode === 'HOP_2' ? 75 : 60)
          .strength(0.4)
      )
      .force(
        'charge',
        forceManyBody()
          .strength(focusMode === 'HOP_1' ? -240 : focusMode === 'HOP_2' ? -170 : -110)
          .distanceMax(600)
      )
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide().radius(d => d.radius + 8).iterations(2))
      .alpha(0.6)
      .alphaDecay(0.028);

    simulationRef.current = sim;
    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    return () => {
      sim.stop();
    };
  }, [displayNodes, displayLinks, focusMode]);

  // Canvas render loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Dark slate Obsidian canvas background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle background grid dots
      ctx.save();
      const dotSpacing = 30 * transformRef.current.k;
      if (dotSpacing > 12) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        const offsetX = (transformRef.current.x % dotSpacing + dotSpacing) % dotSpacing;
        const offsetY = (transformRef.current.y % dotSpacing + dotSpacing) % dotSpacing;
        for (let x = offsetX; x < width; x += dotSpacing) {
          for (let y = offsetY; y < height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();

      // Empty State messaging if no nodes
      if (simNodesRef.current.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Select an entity from the list to explore its 1-Hop, 2-Hop, or 3-Hop dependency graph.', width / 2, height / 2);
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      // Apply Pan & Zoom Transform
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      const currentHover = hoveredNode;
      const currentSelected = selectedEntity;
      const activeHighlightId = currentHover?.id || currentSelected?.id || null;

      // Identify direct neighbors of active highlighted node
      const neighborIds = new Set();
      if (activeHighlightId) {
        neighborIds.add(activeHighlightId);
        simLinksRef.current.forEach(l => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          if (sid === activeHighlightId) neighborIds.add(tid);
          if (tid === activeHighlightId) neighborIds.add(sid);
        });
      }

      // Draw Links
      simLinksRef.current.forEach(l => {
        const s = l.source;
        const t = l.target;
        if (!s || !t || s.x === undefined || t.x === undefined) return;

        const isConnected =
          activeHighlightId &&
          (s.id === activeHighlightId || t.id === activeHighlightId);
        const isDimmed = activeHighlightId && !isConnected;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isConnected) {
          ctx.strokeStyle = s.id === activeHighlightId ? '#38bdf8' : '#34d399';
          ctx.lineWidth = 2.2 / transformRef.current.k;
          ctx.globalAlpha = 0.95;
        } else if (isDimmed) {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 0.8 / transformRef.current.k;
          ctx.globalAlpha = 0.12;
        } else {
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.0 / transformRef.current.k;
          ctx.globalAlpha = 0.35;
        }

        ctx.stroke();

        // Directional arrow head on connected links
        if (isConnected) {
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist > (t.radius || 8) + 12) {
            const arrowPos = 0.65;
            const ax = s.x + dx * arrowPos;
            const ay = s.y + dy * arrowPos;
            const angle = Math.atan2(dy, dx);
            const arrowSize = 6 / transformRef.current.k;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-arrowSize, -arrowSize * 0.5);
            ctx.lineTo(-arrowSize, arrowSize * 0.5);
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
            ctx.restore();
          }
        }
      });

      ctx.globalAlpha = 1.0;

      // Draw Nodes
      simNodesRef.current.forEach(n => {
        if (n.x === undefined || n.y === undefined) return;

        const isHovered = currentHover && currentHover.id === n.id;
        const isSelected = currentSelected && currentSelected.id === n.id;
        const isRootCenter = n.hopDistance === 0;
        const isNeighbor = neighborIds.has(n.id);
        const isDimmed = activeHighlightId && !isNeighbor && !isRootCenter;

        const colorCfg = TYPE_COLORS[n.type] || TYPE_COLORS.default;
        const r = n.radius || 6;

        ctx.save();
        if (isDimmed) {
          ctx.globalAlpha = 0.18;
        }

        // Distinct dashed halo around the Root Focus Entity
        if (isRootCenter) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#818cf8';
          ctx.lineWidth = 2.2 / transformRef.current.k;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.restore();
        }

        // Outer glow on hover or select
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 7, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.35)' : 'rgba(56, 189, 248, 0.35)';
          ctx.fill();
        }

        // Main node body
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = colorCfg.fill;
        ctx.fill();
        ctx.lineWidth = (isSelected || isRootCenter ? 2.5 : 1.5) / transformRef.current.k;
        ctx.strokeStyle = isSelected || isRootCenter ? '#ffffff' : colorCfg.stroke;
        ctx.stroke();

        // Node labels
        const shouldShowLabel =
          isRootCenter ||
          isHovered ||
          isSelected ||
          (isNeighbor && transformRef.current.k > 0.6) ||
          r > 9 ||
          transformRef.current.k > 1.25;

        if (shouldShowLabel && !isDimmed) {
          const fontSize = Math.max(9, Math.min(13, (isRootCenter ? 12 : 11) / transformRef.current.k));
          ctx.font = `${isRootCenter ? '700' : '600'} ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const textY = n.y + r + 4;
          const text = n.name || n.id.split('.').pop();

          // Subtle text shadow backing for readability
          ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
          const textWidth = ctx.measureText(text).width;
          ctx.fillRect(n.x - textWidth / 2 - 2, textY - 1, textWidth + 4, fontSize + 2);

          ctx.fillStyle = isRootCenter ? '#a5b4fc' : isSelected ? '#ffffff' : isHovered ? '#38bdf8' : '#e2e8f0';
          ctx.fillText(text, n.x, textY);
        }

        ctx.restore();
      });

      ctx.restore(); // Restore pan & zoom
      ctx.restore(); // Restore dpr scale

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [hoveredNode, selectedEntity]);

  // Convert canvas mouse coordinates to world coordinates
  const screenToWorld = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    return {
      x: (mx - transformRef.current.x) / transformRef.current.k,
      y: (my - transformRef.current.y) / transformRef.current.k,
      screenX: mx,
      screenY: my
    };
  }, []);

  // Find node under cursor
  const findNodeAt = useCallback(
    (worldX, worldY) => {
      for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
        const n = simNodesRef.current[i];
        if (n.x === undefined) continue;
        const dist = Math.hypot(n.x - worldX, n.y - worldY);
        if (dist <= (n.radius || 6) + 5 / transformRef.current.k) {
          return n;
        }
      }
      return null;
    },
    []
  );

  // Mouse event handlers
  const handleMouseDown = (e) => {
    const { x, y, screenX, screenY } = screenToWorld(e.clientX, e.clientY);
    const hitNode = findNodeAt(x, y);

    if (hitNode) {
      isDraggingRef.current = true;
      dragTargetRef.current = hitNode;
      hitNode.fx = hitNode.x;
      hitNode.fy = hitNode.y;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
    } else {
      isPanningRef.current = true;
      panStartRef.current = {
        x: screenX - transformRef.current.x,
        y: screenY - transformRef.current.y
      };
    }
  };

  const handleMouseMove = (e) => {
    const { x, y, screenX, screenY } = screenToWorld(e.clientX, e.clientY);
    mousePosRef.current = { x: screenX, y: screenY };

    if (isDraggingRef.current && dragTargetRef.current) {
      dragTargetRef.current.fx = x;
      dragTargetRef.current.fy = y;
    } else if (isPanningRef.current) {
      transformRef.current.x = screenX - panStartRef.current.x;
      transformRef.current.y = screenY - panStartRef.current.y;
    } else {
      const hit = findNodeAt(x, y);
      if (hit !== hoveredNode) {
        setHoveredNode(hit);
        if (hit) {
          setTooltipPos({ x: screenX, y: screenY });
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && dragTargetRef.current) {
      dragTargetRef.current.fx = null;
      dragTargetRef.current.fy = null;
      dragTargetRef.current = null;
      isDraggingRef.current = false;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
    }
    isPanningRef.current = false;
  };

  const handleClick = (e) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const hit = findNodeAt(x, y);
    if (hit) {
      onSelectEntity(hit);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const currentK = transformRef.current.k;
    const newK = Math.max(0.12, Math.min(4.5, currentK * zoomFactor));

    transformRef.current.x = mx - (mx - transformRef.current.x) * (newK / currentK);
    transformRef.current.y = my - (my - transformRef.current.y) * (newK / currentK);
    transformRef.current.k = newK;
  };

  // Zoom control buttons
  const handleZoom = (factor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const currentK = transformRef.current.k;
    const newK = Math.max(0.12, Math.min(4.5, currentK * factor));

    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / currentK);
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / currentK);
    transformRef.current.k = newK;
  };

  const handleReset = () => {
    transformRef.current = { x: 0, y: 0, k: 1 };
    if (simulationRef.current) {
      simulationRef.current.alpha(0.4).restart();
    }
  };

  return (
    <div className="relative w-full h-[600px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden select-none" ref={containerRef}>
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Hop-Level Horizon Switcher (1-Hop, 2-Hop, 3-Hop only; No whole graph) */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-auto">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Network className="w-3.5 h-3.5 text-indigo-400" /> Hop Horizon:
          </span>
          <button
            onClick={() => setFocusMode('HOP_1')}
            disabled={!selectedEntity}
            className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1.5 ${
              focusMode === 'HOP_1'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            1-Hop Graph
          </button>
          <button
            onClick={() => setFocusMode('HOP_2')}
            disabled={!selectedEntity}
            className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1.5 ${
              focusMode === 'HOP_2'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            2-Hop Graph
          </button>
          <button
            onClick={() => setFocusMode('HOP_3')}
            disabled={!selectedEntity}
            className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1.5 ${
              focusMode === 'HOP_3'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            3-Hop Graph
          </button>

          {selectedEntity && (
            <span className="ml-2 pl-2 border-l border-slate-700 text-[11px] font-mono text-indigo-300 hidden md:inline">
              Focused on <span className="font-bold text-white">{selectedEntity.name}</span> ({displayNodes.length} nodes)
            </span>
          )}
        </div>

        {/* Right: Camera Zoom Tools */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg shadow-lg pointer-events-auto">
          <button
            onClick={() => handleZoom(1.25)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Hover Tooltip (Obsidian-Style) */}
      {hoveredNode && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3 py-2 rounded-lg shadow-2xl text-xs max-w-xs transition-opacity duration-150"
          style={{
            left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth || 600) - 240),
            top: Math.min(tooltipPos.y + 14, (containerRef.current?.clientHeight || 500) - 100)
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-white font-mono truncate">{hoveredNode.name}</span>
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border"
              style={{
                color: (TYPE_COLORS[hoveredNode.type] || TYPE_COLORS.default).fill,
                borderColor: (TYPE_COLORS[hoveredNode.type] || TYPE_COLORS.default).stroke,
                backgroundColor: 'rgba(15, 23, 42, 0.6)'
              }}
            >
              {hoveredNode.type}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate">{hoveredNode.file_path}</div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-semibold border border-indigo-500/30">
              {hoveredNode.hopDistance === 0 ? 'Root Center' : `${hoveredNode.hopDistance}-Hop Distance`}
            </span>
            <span className="text-slate-400">Edges: {degreeMap.get(hoveredNode.id) || 0}</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Legend & Hint */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg shadow-lg pointer-events-auto text-[11px] font-mono">
          {Object.entries(TYPE_COLORS)
            .filter(([k]) => k !== 'default')
            .map(([typeKey, cfg]) => (
              <div key={typeKey} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.fill }}></span>
                <span className="text-slate-300 capitalize">{cfg.label}</span>
              </div>
            ))}
        </div>

        {/* Interaction Hint */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 backdrop-blur border border-slate-800 px-2.5 py-1 rounded text-[11px] font-mono text-slate-400 pointer-events-auto">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Click any node to re-center hop subgraph • Drag to pan/rearrange • Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide
} from 'd3-force';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Network,
  Sparkles,
  GitCommit,
  Radio,
  Layers,
  Compass,
  ArrowRight,
  Route
} from 'lucide-react';

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
  hubs = [],
  selectedEntity = null,
  onSelectEntity = () => {},
  searchTerm = '',
  selectedType = 'ALL',
  selectedRelation = 'ALL',
  layoutMode = 'FORCE', // 'FORCE' | 'CONCENTRIC' | 'HIERARCHICAL'
  onChangeLayoutMode = () => {},
  pathTraceResult = null,
  pathSource = '',
  pathTarget = '',
  onSetPathSource = () => {},
  onSetPathTarget = () => {},
  onTracePath = () => {},
  onClearPathTrace = () => {},
  isTracingPath = false
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Hop Horizon Mode: 'HOP_1' | 'HOP_2' | 'HOP_3'
  const [focusMode, setFocusMode] = useState('HOP_1');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Tooltip hover delay to prevent vanishing on mouse move
  const isMouseOverTooltipRef = useRef(false);
  const hoverTimeoutRef = useRef(null);

  // Camera transform: pan (x, y) and zoom (k)
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const dragTargetRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const animTimeRef = useRef(0);

  // Set of path node IDs for fast lookup
  const pathNodeIds = useMemo(() => {
    if (!pathTraceResult?.path_nodes) return new Set();
    return new Set(pathTraceResult.path_nodes.map(n => n.id));
  }, [pathTraceResult]);

  // Set of path edge keys (u->v or v->u)
  const pathEdgeKeys = useMemo(() => {
    if (!pathTraceResult?.path_edges) return new Set();
    const set = new Set();
    pathTraceResult.path_edges.forEach(e => {
      set.add(`${e.source}->${e.target}`);
      set.add(`${e.target}->${e.source}`);
    });
    return set;
  }, [pathTraceResult]);

  // Compute node degrees across the entire graph
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

  // Node lookup map
  const nodeLookup = useMemo(() => {
    return new Map(nodes.map(n => [n.id, n]));
  }, [nodes]);

  // Filter nodes & links:
  // If selectedEntity is present -> 1/2/3 Hop BFS subgraph
  // If selectedEntity is null -> Render Top Architectural Hubs overview (never a blank canvas!)
  const { displayNodes, displayLinks, isOverviewMode } = useMemo(() => {
    if (nodes.length === 0) {
      return { displayNodes: [], displayLinks: [], isOverviewMode: false };
    }

    // Default Overview Mode if no entity selected
    if (!selectedEntity) {
      const hubList = hubs.length > 0 ? hubs : nodes.slice(0, 20);
      const hubIdSet = new Set(hubList.map(h => h.id));

      const filteredNodes = hubList.map((h, idx) => {
        const fullNode = nodeLookup.get(h.id) || h;
        const deg = degreeMap.get(h.id) || h.degree || 1;
        const radius = Math.max(9, Math.min(18, 8 + Math.sqrt(deg) * 1.4));
        return {
          ...fullNode,
          radius,
          hopDistance: 0,
          isHub: true,
          hubRank: idx + 1
        };
      });

      const filteredLinks = links
        .filter(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          const matchRelation = selectedRelation === 'ALL' || l.relation === selectedRelation;
          return hubIdSet.has(s) && hubIdSet.has(t) && matchRelation;
        })
        .map(l => ({
          source: typeof l.source === 'object' ? l.source.id : l.source,
          target: typeof l.target === 'object' ? l.target.id : l.target,
          relation: l.relation || 'DEPENDS_ON'
        }));

      return { displayNodes: filteredNodes, displayLinks: filteredLinks, isOverviewMode: true };
    }

    // Localized Hop Subgraph Mode
    const maxHops = focusMode === 'HOP_3' ? 3 : focusMode === 'HOP_2' ? 2 : 1;

    // Fast Adjacency Map
    const adj = new Map();
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (!adj.has(s)) adj.set(s, []);
      if (!adj.has(t)) adj.set(t, []);
      adj.get(s).push(t);
      adj.get(t).push(s);
    });

    // BFS to find nodes within maxHops of selectedEntity.id
    const visitedHop = new Map();
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

    // Also include any nodes that are part of the active path trace so the path is never truncated
    if (pathTraceResult?.path_nodes) {
      pathTraceResult.path_nodes.forEach(pn => {
        if (!visitedHop.has(pn.id)) {
          visitedHop.set(pn.id, 1);
        }
      });
    }

    const targetNodeIds = new Set(visitedHop.keys());
    const filteredNodes = [];

    targetNodeIds.forEach(id => {
      const node = nodeLookup.get(id);
      if (node) {
        const hop = visitedHop.get(id) || 1;
        const deg = degreeMap.get(id) || 1;
        const radius = hop === 0 ? 16 : Math.max(6, Math.min(13, 6 + Math.sqrt(deg) * 1.4));
        filteredNodes.push({
          ...node,
          radius,
          hopDistance: hop,
          isRoot: hop === 0
        });
      }
    });

    const activeNodeIdSet = new Set(filteredNodes.map(n => n.id));

    const filteredLinks = links
      .filter(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        const matchRelation = selectedRelation === 'ALL' || l.relation === selectedRelation;
        return activeNodeIdSet.has(s) && activeNodeIdSet.has(t) && matchRelation;
      })
      .map(l => ({
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
        relation: l.relation || 'DEPENDS_ON'
      }));

    return { displayNodes: filteredNodes, displayLinks: filteredLinks, isOverviewMode: false };
  }, [nodes, links, hubs, selectedEntity, focusMode, degreeMap, nodeLookup, selectedRelation, pathTraceResult]);

  // Keep simulation and active nodes in refs
  const simulationRef = useRef(null);
  const simNodesRef = useRef([]);
  const simLinksRef = useRef([]);

  // Recenter camera when selected entity or layout changes
  useEffect(() => {
    transformRef.current = { x: 0, y: 0, k: 1 };
  }, [selectedEntity?.id, focusMode, layoutMode]);

  // Layout calculation and d3-force management
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 550;
    const cx = width / 2;
    const cy = height / 2;

    const existingPos = new Map(simNodesRef.current.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));

    if (isOverviewMode) {
      // Clean, stable radial constellation for Top Architectural Hubs overview (prevents nodes from exploding)
      if (simulationRef.current) simulationRef.current.stop();

      const count = displayNodes.length;
      const radius = Math.min(width, height) * 0.35;
      const positioned = displayNodes.map((n, idx) => {
        const angle = (2 * Math.PI * idx) / Math.max(1, count) - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return {
          ...n,
          x,
          y,
          vx: 0,
          vy: 0,
          fx: x,
          fy: y
        };
      });

      simNodesRef.current = positioned;
      simLinksRef.current = [];
      return;
    }

    if (layoutMode === 'CONCENTRIC') {
      // Concentric Layout: root at center, hop rings around it
      if (simulationRef.current) simulationRef.current.stop();

      const hopGroups = { 0: [], 1: [], 2: [], 3: [] };
      displayNodes.forEach(n => {
        const h = Math.min(3, n.hopDistance || (n.isRoot ? 0 : 1));
        hopGroups[h].push(n);
      });

      const radii = { 0: 0, 1: 135, 2: 245, 3: 350 };
      const positioned = [];

      Object.entries(hopGroups).forEach(([hopStr, group]) => {
        const hop = parseInt(hopStr, 10);
        const r = radii[hop] || 150;
        const count = group.length;

        group.forEach((node, idx) => {
          if (hop === 0) {
            positioned.push({ ...node, x: cx, y: cy, vx: 0, vy: 0, fx: cx, fy: cy });
          } else {
            const angle = (2 * Math.PI * idx) / Math.max(1, count) - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            positioned.push({ ...node, x, y, vx: 0, vy: 0, fx: x, fy: y });
          }
        });
      });

      simNodesRef.current = positioned;
      simLinksRef.current = displayLinks.map(l => ({ ...l }));
      return;
    }

    if (layoutMode === 'HIERARCHICAL') {
      // Hierarchical Top-Down DAG Layout
      if (simulationRef.current) simulationRef.current.stop();

      // Tier by hop distance or entity type
      const tiers = { 0: [], 1: [], 2: [], 3: [] };
      displayNodes.forEach(n => {
        let tier = n.hopDistance || 0;
        if (n.type === 'endpoint') tier = 0;
        else if (n.type === 'class') tier = 1;
        else if (n.type === 'function') tier = Math.max(1, tier);
        else tier = Math.min(3, tier + 1);
        tiers[Math.min(3, tier)].push(n);
      });

      const tierY = { 0: cy - 180, 1: cy - 60, 2: cy + 60, 3: cy + 180 };
      const positioned = [];

      Object.entries(tiers).forEach(([tierStr, group]) => {
        const tier = parseInt(tierStr, 10);
        const y = tierY[tier];
        const count = group.length;
        const spacing = Math.min(120, (width - 120) / Math.max(1, count));
        const startX = cx - ((count - 1) * spacing) / 2;

        group.forEach((node, idx) => {
          const x = count === 1 ? cx : startX + idx * spacing;
          positioned.push({ ...node, x, y, vx: 0, vy: 0, fx: x, fy: y });
        });
      });

      simNodesRef.current = positioned;
      simLinksRef.current = displayLinks.map(l => ({ ...l }));
      return;
    }

    // Force-Directed Layout Mode
    const simNodes = displayNodes.map(n => {
      const prev = existingPos.get(n.id);
      return {
        ...n,
        fx: undefined,
        fy: undefined,
        x: prev ? prev.x : cx + (Math.random() - 0.5) * 180,
        y: prev ? prev.y : cy + (Math.random() - 0.5) * 180,
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
          .strength(focusMode === 'HOP_1' ? -260 : focusMode === 'HOP_2' ? -180 : -120)
          .distanceMax(600)
      )
      .force('center', forceCenter(cx, cy))
      .force('collide', forceCollide().radius(d => d.radius + 8).iterations(2))
      .alpha(0.6)
      .alphaDecay(0.028);

    simulationRef.current = sim;
    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    return () => {
      sim.stop();
    };
  }, [displayNodes, displayLinks, focusMode, layoutMode]);

  // Main Canvas Render Loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = (time) => {
      animTimeRef.current = time * 0.002;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }

      // Reset transform cleanly to exact DPI scale on each frame (idempotent, prevents exponential compounding)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;

      // Dark canvas background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid dots
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

      // World Camera Transform
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      const cx = width / 2;
      const cy = height / 2;

      // Draw Concentric Horizon Guide Rings in CONCENTRIC mode
      if (layoutMode === 'CONCENTRIC' && selectedEntity) {
        ctx.save();
        const rings = [
          { r: 135, label: '1-Hop Immediate Callers / Dependents' },
          { r: 245, label: '2-Hop Transitive Propagation' },
          { r: 350, label: '3-Hop Architectural Boundary' }
        ];

        rings.forEach(ring => {
          ctx.beginPath();
          ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.18)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.stroke();

          ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
          ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(ring.label, cx + ring.r - 8, cy - 6);
        });
        ctx.restore();
      }

      // Draw Edges / Links
      const linksToDraw = simLinksRef.current;
      linksToDraw.forEach(link => {
        const s = typeof link.source === 'object' ? link.source : simNodesRef.current.find(n => n.id === link.source);
        const t = typeof link.target === 'object' ? link.target : simNodesRef.current.find(n => n.id === link.target);
        if (!s || !t) return;

        const edgeKey = `${s.id}->${t.id}`;
        const isPathEdge = pathEdgeKeys.has(edgeKey);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isPathEdge) {
          // Highlighted Path Trace Edge (Glowing Amber / Gold)
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.8;
          ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
          ctx.lineWidth = 1.2;
        }
        ctx.stroke();

        // Directional Arrow Head
        const angle = Math.atan2(t.y - s.y, t.x - s.x);
        const arrowDist = t.radius + 6;
        const arrowX = t.x - arrowDist * Math.cos(angle);
        const arrowY = t.y - arrowDist * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - 7 * Math.cos(angle - Math.PI / 7),
          arrowY - 7 * Math.sin(angle - Math.PI / 7)
        );
        ctx.lineTo(
          arrowX - 7 * Math.cos(angle + Math.PI / 7),
          arrowY - 7 * Math.sin(angle + Math.PI / 7)
        );
        ctx.closePath();
        ctx.fillStyle = isPathEdge ? '#fbbf24' : 'rgba(148, 163, 184, 0.45)';
        ctx.fill();

        // Animated Flow Particle along Path Edges
        if (isPathEdge) {
          const tProgress = (animTimeRef.current % 1);
          const px = s.x + (t.x - s.x) * tProgress;
          const py = s.y + (t.y - s.y) * tProgress;
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = '#fef08a';
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 6;
          ctx.fill();
        }

        ctx.restore();
      });

      // Draw Nodes
      simNodesRef.current.forEach(node => {
        const isSelected = selectedEntity && selectedEntity.id === node.id;
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const isPathNode = pathNodeIds.has(node.id);
        const typeCfg = TYPE_COLORS[node.type] || TYPE_COLORS.default;

        ctx.save();

        // Path node halo or selection glow
        if (isPathNode) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 7, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
          ctx.fill();
          ctx.strokeStyle = '#818cf8';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Node Circle Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#ffffff' : typeCfg.fill;
        ctx.fill();
        ctx.strokeStyle = isSelected || isPathNode ? '#ffffff' : typeCfg.stroke;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // Node Label
        const showLabel = isSelected || isHovered || isPathNode || node.isRoot || node.isHub || isOverviewMode || (node.radius > 11 && transformRef.current.k > 0.7);
        if (showLabel) {
          const fontSize = isSelected || isPathNode ? 12 : 11;
          ctx.font = `${isSelected || isPathNode ? 'bold ' : ''}${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          // Background pill for label legibility
          const text = node.name || node.id.split('.').pop();
          const metrics = ctx.measureText(text);
          const bgW = metrics.width + 8;
          const bgH = 16;
          const bgX = node.x - bgW / 2;
          const bgY = node.y + node.radius + 4;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(bgX, bgY, bgW, bgH);

          ctx.fillStyle = isSelected ? '#a5b4fc' : isPathNode ? '#fde047' : '#e2e8f0';
          ctx.fillText(text, node.x, bgY + 2);
        }

        ctx.restore();
      });

      ctx.restore(); // Restore Camera Transform

      // Minimap in bottom-right corner
      if (simNodesRef.current.length > 0) {
        ctx.save();
        const mmW = 140;
        const mmH = 90;
        const mmX = width - mmW - 16;
        const mmY = height - mmH - 16;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
        ctx.lineWidth = 1;
        ctx.fillRect(mmX, mmY, mmW, mmH);
        ctx.strokeRect(mmX, mmY, mmW, mmH);

        // Compute bounding box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        simNodesRef.current.forEach(n => {
          if (n.x < minX) minX = n.x;
          if (n.x > maxX) maxX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.y > maxY) maxY = n.y;
        });

        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const scaleX = (mmW - 16) / spanX;
        const scaleY = (mmH - 16) / spanY;
        const mmScale = Math.min(scaleX, scaleY);

        simNodesRef.current.forEach(n => {
          const mx = mmX + 8 + (n.x - minX) * mmScale;
          const my = mmY + 8 + (n.y - minY) * mmScale;
          ctx.beginPath();
          ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = selectedEntity?.id === n.id ? '#818cf8' : pathNodeIds.has(n.id) ? '#f59e0b' : 'rgba(148, 163, 184, 0.7)';
          ctx.fill();
        });

        ctx.fillStyle = '#64748b';
        ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Minimap', mmX + 6, mmY + 12);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [selectedEntity, hoveredNode, pathNodeIds, pathEdgeKeys, layoutMode]);

  // Convert mouse screen coordinates to canvas world coordinates
  const screenToWorld = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (screenX - rect.left - transformRef.current.x) / transformRef.current.k;
    const y = (screenY - rect.top - transformRef.current.y) / transformRef.current.k;
    return { x, y };
  }, []);

  // Find node under mouse
  const getNodeAtPosition = useCallback((worldX, worldY) => {
    for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
      const node = simNodesRef.current[i];
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4)) {
        return node;
      }
    }
    return null;
  }, []);

  // Mouse event handlers
  const handleMouseDown = (e) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = getNodeAtPosition(x, y);

    if (node) {
      isDraggingRef.current = true;
      dragTargetRef.current = node;
      node.fx = node.x;
      node.fy = node.y;
      if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
    } else {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX - transformRef.current.x,
        y: e.clientY - transformRef.current.y
      };
    }
  };

  const handleMouseMove = (e) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current && dragTargetRef.current) {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      dragTargetRef.current.fx = x;
      dragTargetRef.current.fy = y;
      return;
    }

    if (isPanningRef.current) {
      transformRef.current.x = e.clientX - panStartRef.current.x;
      transformRef.current.y = e.clientY - panStartRef.current.y;
      return;
    }

    // Hover detection with glide debounce (allows moving into tooltip without it closing)
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = getNodeAtPosition(x, y);

    if (node) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setHoveredNode(node);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    } else {
      if (!isMouseOverTooltipRef.current && hoveredNode && !hoverTimeoutRef.current) {
        hoverTimeoutRef.current = setTimeout(() => {
          if (!isMouseOverTooltipRef.current) {
            setHoveredNode(null);
          }
          hoverTimeoutRef.current = null;
        }, 280);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && dragTargetRef.current) {
      if (layoutMode === 'FORCE') {
        dragTargetRef.current.fx = null;
        dragTargetRef.current.fy = null;
        if (simulationRef.current) simulationRef.current.alphaTarget(0);
      }
      isDraggingRef.current = false;
      dragTargetRef.current = null;
    }
    isPanningRef.current = false;
  };

  const handleClick = (e) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = getNodeAtPosition(x, y);
    if (node) {
      onSelectEntity(node);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newK = Math.max(0.2, Math.min(3.5, transformRef.current.k * zoomFactor));
    const kRatio = newK / transformRef.current.k;

    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * kRatio;
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * kRatio;
    transformRef.current.k = newK;
  };

  const zoomIn = () => {
    transformRef.current.k = Math.min(3.5, transformRef.current.k * 1.25);
  };

  const zoomOut = () => {
    transformRef.current.k = Math.max(0.2, transformRef.current.k * 0.8);
  };

  const resetView = () => {
    transformRef.current = { x: 0, y: 0, k: 1 };
    if (simulationRef.current) simulationRef.current.alpha(0.4).restart();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[580px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Top Left Toolbar: Layout Selector & Hop Horizon */}
      <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-10 pointer-events-auto">
        {/* Layout Modes */}
        <div className="flex bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 shadow-lg text-xs font-mono">
          <button
            onClick={() => onChangeLayoutMode('FORCE')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
              layoutMode === 'FORCE'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Force-Directed Physics Layout"
          >
            <Network className="w-3.5 h-3.5" /> Force
          </button>
          <button
            onClick={() => onChangeLayoutMode('HIERARCHICAL')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
              layoutMode === 'HIERARCHICAL'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Top-Down Layered Architectural DAG"
          >
            <Layers className="w-3.5 h-3.5" /> Hierarchical
          </button>
          <button
            onClick={() => onChangeLayoutMode('CONCENTRIC')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
              layoutMode === 'CONCENTRIC'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Concentric Radial Horizon Rings"
          >
            <Compass className="w-3.5 h-3.5" /> Concentric
          </button>
        </div>

        {/* Hop Distance Horizon */}
        {!isOverviewMode && (
          <div className="flex bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 shadow-lg text-xs font-mono">
            <button
              onClick={() => setFocusMode('HOP_1')}
              className={`px-2.5 py-1 rounded transition ${
                focusMode === 'HOP_1' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              1-Hop
            </button>
            <button
              onClick={() => setFocusMode('HOP_2')}
              className={`px-2.5 py-1 rounded transition ${
                focusMode === 'HOP_2' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              2-Hops
            </button>
            <button
              onClick={() => setFocusMode('HOP_3')}
              className={`px-2.5 py-1 rounded transition ${
                focusMode === 'HOP_3' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              3-Hops
            </button>
          </div>
        )}

        {/* Mode Indicator Badge */}
        {isOverviewMode && (
          <div className="bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 text-xs font-mono px-3 py-1 rounded-lg flex items-center gap-1.5 shadow">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Architectural Hubs Overview (Top {displayNodes.length})
          </div>
        )}

        {pathTraceResult?.connected && (
          <div className="bg-amber-950/80 border border-amber-600 text-amber-300 text-xs font-mono px-3 py-1 rounded-lg flex items-center gap-1.5 shadow animate-pulse">
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            Path Active: {pathTraceResult.hop_distance} Hops Traced
          </div>
        )}
      </div>

      {/* Top Center Interactive Path Tracer Canvas HUD */}
      {(pathSource || pathTarget || pathTraceResult?.connected) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/95 backdrop-blur border border-amber-800/80 rounded-xl px-4 py-2 shadow-2xl text-xs font-mono z-20 pointer-events-auto">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Route className="w-4 h-4 text-amber-400" />
            <span>Path:</span>
          </div>

          <div
            className={`px-2 py-1 rounded border text-[11px] truncate max-w-[130px] font-semibold transition ${
              pathSource
                ? 'bg-amber-950/60 border-amber-600/80 text-amber-200'
                : 'bg-slate-950 border-dashed border-slate-700 text-slate-500'
            }`}
            title={pathSource ? `Source: ${pathSource}` : 'Select a Source Entity'}
          >
            {pathSource ? pathSource.split('.').pop() : '1. Set Source'}
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />

          <div
            className={`px-2 py-1 rounded border text-[11px] truncate max-w-[130px] font-semibold transition ${
              pathTarget
                ? 'bg-amber-950/60 border-amber-600/80 text-amber-200'
                : 'bg-slate-950 border-dashed border-slate-700 text-slate-500'
            }`}
            title={pathTarget ? `Target: ${pathTarget}` : 'Select a Target Entity'}
          >
            {pathTarget ? pathTarget.split('.').pop() : '2. Set Target'}
          </div>

          {pathSource && pathTarget && (
            <button
              onClick={onTracePath}
              disabled={isTracingPath}
              className="ml-1 px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-lg text-[11px] font-mono transition shadow flex items-center gap-1"
            >
              {isTracingPath ? 'Tracing...' : 'Trace Path'}
            </button>
          )}

          <button
            onClick={onClearPathTrace}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 hover:bg-slate-800 rounded transition"
            title="Clear Path Selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Right Zoom Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 shadow-lg z-10 pointer-events-auto">
        <button
          onClick={zoomIn}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          title="Reset Camera View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Tooltip / Mini-Card on Node Hover */}
      {hoveredNode && (
        <div
          onMouseEnter={() => {
            isMouseOverTooltipRef.current = true;
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            isMouseOverTooltipRef.current = false;
            setHoveredNode(null);
          }}
          className="absolute z-20 pointer-events-auto bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-2xl text-xs max-w-xs transition ring-1 ring-white/10"
          style={{
            left: Math.min(tooltipPos.x + 12, (containerRef.current?.clientWidth || 800) - 240),
            top: Math.min(tooltipPos.y + 12, (containerRef.current?.clientHeight || 550) - 150)
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-bold text-white font-mono truncate">{hoveredNode.name}</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold"
              style={{
                backgroundColor: `${(TYPE_COLORS[hoveredNode.type] || TYPE_COLORS.default).fill}20`,
                color: (TYPE_COLORS[hoveredNode.type] || TYPE_COLORS.default).fill
              }}
            >
              {hoveredNode.type}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate mb-1">
            {hoveredNode.file_path || hoveredNode.id}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mb-2">
            Degree: <span className="text-indigo-300 font-semibold">{degreeMap.get(hoveredNode.id) || 1}</span> connections
          </div>
          <div className="flex items-center gap-1 pt-1 border-t border-slate-800/80">
            <button
              onClick={() => onSetPathSource(hoveredNode.id)}
              className={`flex-1 py-1 px-1.5 rounded text-[10px] font-mono transition text-center font-semibold ${
                pathSource === hoveredNode.id
                  ? 'bg-amber-600 text-white shadow shadow-amber-600/40'
                  : 'bg-slate-800 hover:bg-amber-600/80 text-slate-200 hover:text-white'
              }`}
            >
              {pathSource === hoveredNode.id ? '✓ Source' : 'Set Source'}
            </button>
            <button
              onClick={() => onSetPathTarget(hoveredNode.id)}
              className={`flex-1 py-1 px-1.5 rounded text-[10px] font-mono transition text-center font-semibold ${
                pathTarget === hoveredNode.id
                  ? 'bg-amber-600 text-white shadow shadow-amber-600/40'
                  : 'bg-slate-800 hover:bg-amber-600/80 text-slate-200 hover:text-white'
              }`}
            >
              {pathTarget === hoveredNode.id ? '✓ Target' : 'Set Target'}
            </button>
          </div>
        </div>
      )}

      {/* Legend at Bottom Left */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-2 flex flex-wrap items-center gap-3 text-xs z-10 pointer-events-auto shadow-lg">
        {Object.entries(TYPE_COLORS)
          .filter(([k]) => k !== 'default')
          .map(([typeKey, cfg]) => (
            <div key={typeKey} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.fill }}></span>
              <span className="text-slate-400 text-[11px] font-mono capitalize">{cfg.label}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

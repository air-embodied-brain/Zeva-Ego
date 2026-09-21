(() => {
  const canvas = document.querySelector(".causal-field");
  const hero = document.querySelector(".hero-head");
  if (!canvas || !hero) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };

  const EDGE_RADIUS = 132;
  const EDGE_ALPHA = 0.105 * 1.3;
  const EDGE_BUCKETS = 8;
  const HALO_RADIUS = 15;
  const NODE_COLORS = ["15,159,145", "35,104,216", "118,80,206"];

  let width = 1;
  let height = 1;
  let dpr = 1;
  let nodes = [];
  let streams = [];
  let frame = 0;
  let previous = 0;
  let running = true;

  let grid = [];
  let gridCols = 0;
  let gridRows = 0;
  const edgeBuckets = Array.from({ length: EDGE_BUCKETS }, () => []);
  const haloSprites = new Map();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;

  const cubicPoint = (curve, t) => {
    const u = 1 - t;
    return {
      x: u ** 3 * curve.x0 + 3 * u ** 2 * t * curve.x1 + 3 * u * t ** 2 * curve.x2 + t ** 3 * curve.x3,
      y: u ** 3 * curve.y0 + 3 * u ** 2 * t * curve.y1 + 3 * u * t ** 2 * curve.y2 + t ** 3 * curve.y3,
    };
  };

  const haloSprite = (color) => {
    const cached = haloSprites.get(color);
    if (cached) return cached;

    const span = HALO_RADIUS * 2;
    const sprite = document.createElement("canvas");
    sprite.width = Math.ceil(span * dpr);
    sprite.height = Math.ceil(span * dpr);

    const sctx = sprite.getContext("2d");
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const halo = sctx.createRadialGradient(HALO_RADIUS, HALO_RADIUS, 0, HALO_RADIUS, HALO_RADIUS, HALO_RADIUS);
    halo.addColorStop(0, `rgba(${color},0.7)`);
    halo.addColorStop(0.16, `rgba(${color},0.22)`);
    halo.addColorStop(1, `rgba(${color},0)`);
    sctx.fillStyle = halo;
    sctx.beginPath();
    sctx.arc(HALO_RADIUS, HALO_RADIUS, HALO_RADIUS, 0, Math.PI * 2);
    sctx.fill();

    haloSprites.set(color, sprite);
    return sprite;
  };

  const resize = () => {
    const rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    haloSprites.clear();

    pointer.x = pointer.tx = width / 2;
    pointer.y = pointer.ty = height / 2;

    const nodeCount = clamp(Math.round((width * height) / 12500), 54, 118);
    nodes = Array.from({ length: nodeCount }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.085,
      vy: (Math.random() - 0.5) * 0.065,
      radius: 0.65 + Math.random() * 1.25,
      phase: Math.random() * Math.PI * 2,
      family: index % 3,
      px: 0,
      py: 0,
      influence: 0,
      pulse: 0,
    }));

    gridCols = Math.max(1, Math.ceil((width + 60) / EDGE_RADIUS));
    gridRows = Math.max(1, Math.ceil((height + 60) / EDGE_RADIUS));
    grid = Array.from({ length: gridCols * gridRows }, () => []);

    const streamCount = width < 720 ? 4 : 7;
    streams = Array.from({ length: streamCount }, (_, index) => {
      const band = (index + 1) / (streamCount + 1);
      const direction = index % 2 === 0 ? 1 : -1;
      return {
        x0: direction > 0 ? -width * 0.12 : width * 1.12,
        y0: height * (band + (Math.random() - 0.5) * 0.12),
        x1: width * (direction > 0 ? 0.24 : 0.76),
        y1: height * (band - 0.2 + Math.random() * 0.16),
        x2: width * (direction > 0 ? 0.72 : 0.28),
        y2: height * (band + 0.05 + Math.random() * 0.2),
        x3: direction > 0 ? width * 1.12 : -width * 0.12,
        y3: height * (band + (Math.random() - 0.5) * 0.18),
        phase: Math.random(),
        speed: (0.018 + Math.random() * 0.018) * direction,
        hue: index % 2,
      };
    });
  };

  const drawStream = (stream, time) => {
    const sway = Math.sin(time * 0.00018 + stream.phase * 8) * height * 0.018;
    const curve = { ...stream, y1: stream.y1 + sway, y2: stream.y2 - sway };
    const color = stream.hue === 0 ? "15,159,145" : "118,80,206";
    const sprite = haloSprite(color);

    ctx.beginPath();
    ctx.moveTo(curve.x0, curve.y0);
    ctx.bezierCurveTo(curve.x1, curve.y1, curve.x2, curve.y2, curve.x3, curve.y3);
    ctx.strokeStyle = `rgba(${color},0.13)`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = `rgba(${color},0.95)`;
    for (let pulse = 0; pulse < 3; pulse += 1) {
      const t = ((time * stream.speed * 0.001 + stream.phase + pulse / 3) % 1 + 1) % 1;
      const point = cubicPoint(curve, t);
      ctx.drawImage(sprite, point.x - HALO_RADIUS, point.y - HALO_RADIUS, HALO_RADIUS * 2, HALO_RADIUS * 2);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.45, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const cellIndex = (node) => {
    const col = clamp(Math.floor((node.x + 30) / EDGE_RADIUS), 0, gridCols - 1);
    const row = clamp(Math.floor((node.y + 30) / EDGE_RADIUS), 0, gridRows - 1);
    return row * gridCols + col;
  };

  const collectEdges = () => {
    for (let i = 0; i < grid.length; i += 1) grid[i].length = 0;
    for (let i = 0; i < EDGE_BUCKETS; i += 1) edgeBuckets[i].length = 0;

    for (let i = 0; i < nodes.length; i += 1) grid[cellIndex(nodes[i])].push(i);

    for (let row = 0; row < gridRows; row += 1) {
      for (let col = 0; col < gridCols; col += 1) {
        const cell = grid[row * gridCols + col];
        if (!cell.length) continue;

        for (let dRow = 0; dRow <= 1; dRow += 1) {
          for (let dCol = dRow === 0 ? 0 : -1; dCol <= 1; dCol += 1) {
            const nRow = row + dRow;
            const nCol = col + dCol;
            if (nRow >= gridRows || nCol < 0 || nCol >= gridCols) continue;
            const other = grid[nRow * gridCols + nCol];
            if (!other.length) continue;
            const sameCell = dRow === 0 && dCol === 0;

            for (let a = 0; a < cell.length; a += 1) {
              const node = nodes[cell[a]];
              for (let b = sameCell ? a + 1 : 0; b < other.length; b += 1) {
                const peer = nodes[other[b]];
                const dx = node.x - peer.x;
                const dy = node.y - peer.y;
                const edgeDistance = Math.hypot(dx, dy);
                if (edgeDistance > EDGE_RADIUS) continue;
                const strength = 1 - edgeDistance / EDGE_RADIUS;
                const bucket = clamp(Math.floor(strength * EDGE_BUCKETS), 0, EDGE_BUCKETS - 1);
                edgeBuckets[bucket].push(node.px, node.py, peer.x, peer.y);
              }
            }
          }
        }
      }
    }
  };

  const draw = (time = 0) => {
    const dt = Math.min(32, time - previous || 16.7);
    previous = time;
    pointer.x = mix(pointer.x, pointer.tx, 0.065);
    pointer.y = mix(pointer.y, pointer.ty, 0.065);
    ctx.clearRect(0, 0, width, height);

    streams.forEach((stream) => drawStream(stream, time));

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      if (node.x < -30) node.x = width + 30;
      if (node.x > width + 30) node.x = -30;
      if (node.y < -30) node.y = height + 30;
      if (node.y > height + 30) node.y = -30;

      const dx = pointer.x - node.x;
      const dy = pointer.y - node.y;
      const distance = Math.hypot(dx, dy);
      node.influence = pointer.active ? clamp(1 - distance / 230, 0, 1) : 0;
      node.px = node.x - dx * node.influence * 0.035;
      node.py = node.y - dy * node.influence * 0.035;
      node.pulse = 0.72 + Math.sin(time * 0.0014 + node.phase) * 0.28;
    }

    collectEdges();

    ctx.lineWidth = 0.55;
    for (let bucket = 0; bucket < EDGE_BUCKETS; bucket += 1) {
      const segments = edgeBuckets[bucket];
      if (!segments.length) continue;
      ctx.strokeStyle = `rgba(54,104,184,${(((bucket + 0.5) / EDGE_BUCKETS) * EDGE_ALPHA).toFixed(4)})`;
      ctx.beginPath();
      for (let k = 0; k < segments.length; k += 4) {
        ctx.moveTo(segments[k], segments[k + 1]);
        ctx.lineTo(segments[k + 2], segments[k + 3]);
      }
      ctx.stroke();
    }

    if (pointer.active) {
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (node.influence <= 0.05) continue;
        ctx.strokeStyle = `rgba(${NODE_COLORS[node.family]},${node.influence * 0.32})`;
        ctx.beginPath();
        ctx.moveTo(node.px, node.py);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      ctx.fillStyle = `rgba(${NODE_COLORS[node.family]},${0.25 + node.pulse * 0.36})`;
      ctx.beginPath();
      ctx.arc(node.px, node.py, node.radius + node.influence * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (pointer.active) {
      const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 160);
      halo.addColorStop(0, "rgba(35,104,216,0.075)");
      halo.addColorStop(1, "rgba(35,104,216,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 160, 0, Math.PI * 2);
      ctx.fill();
    }

    frame = running && !reducedMotion ? requestAnimationFrame(draw) : 0;
  };

  const updatePointer = (event) => {
    const rect = hero.getBoundingClientRect();
    pointer.tx = event.clientX - rect.left;
    pointer.ty = event.clientY - rect.top;
    pointer.active = true;
  };

  resize();
  draw();

  hero.addEventListener("pointermove", updatePointer, { passive: true });
  hero.addEventListener("pointerleave", () => { pointer.active = false; });
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    resize();
    previous = 0;
    draw();
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      running = entries.some((entry) => entry.isIntersecting);
      cancelAnimationFrame(frame);
      if (running && !reducedMotion) {
        previous = 0;
        frame = requestAnimationFrame(draw);
      }
    });
    observer.observe(hero);
  }
})();

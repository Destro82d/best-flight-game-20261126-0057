// The look of the game: a golden-hour chase view over the Marrow Isles.
// Everything is drawn with the canvas 2D API from the world data — no images,
// no assets, no network. The camera sits behind the Kestrel and looks along
// her heading; the world is projected the way a camera sees it: far things
// small and near the horizon, near things large and low on the screen.
import { FIELD, PALETTE, FONT, FRONTS } from './config.js';
import { RING_RADIUS, groundHeightAt, onStrip, stripElevation } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_BRIEFING = 1;
export const SCREEN_PLAY = 2;
export const SCREEN_PAUSED = 3;
export const SCREEN_OVER = 4;
export const SCREEN_LEG = 5;

const DEG = Math.PI / 180;
const FOCAL = 640;

/** A deterministic wobble from an integer, for glitter and window lights. */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  /** Project a world point (x, z, height) to screen space, or null behind the camera. */
  function makeProjector(plane) {
    const heading = plane.heading;
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const camX = plane.x - sin * 30;
    const camZ = plane.z - cos * 30;
    const camAlt = plane.altitude + 7;
    const horizonY = 330 + plane.pitch * 460;
    return function project(x, z, h) {
      const dx = x - camX;
      const dz = z - camZ;
      const f = dx * sin + dz * cos;
      if (f < 8) return null;
      const r = dx * cos - dz * sin;
      const scale = FOCAL / f;
      return {
        x: FIELD.width / 2 + r * scale,
        y: horizonY - (h - camAlt) * scale,
        f,
        scale,
      };
    };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** The sky: dusk blue to gold, a low sun in the west, cloud banks, the storm wall. */
  function drawSky(plane, stormNear) {
    const sky = ctx.createLinearGradient(0, 0, 0, 380);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(0.85, PALETTE.skyLow);
    sky.addColorStop(1, PALETTE.horizonGlow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, 400);

    // The sun sits low in the west; its screen place follows the heading.
    const sunBearing = Math.atan2(-0.98, 0.2);
    const rel = wrapAngle(sunBearing - plane.heading);
    if (Math.abs(rel) < 1.15) {
      const sunX = FIELD.width / 2 + Math.tan(rel) * FOCAL;
      const sunY = 318 + plane.pitch * 460;
      const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
      glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 179, 71, 0.55)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
      ctx.fillStyle = PALETTE.sunCore;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // The Grey Wall darkens the western sky as it closes in.
    if (stormNear > 0.02) {
      const west = wrapAngle(Math.atan2(-1, 0) - plane.heading);
      if (Math.abs(west) < 1.3) {
        const wallX = FIELD.width / 2 + Math.tan(west) * FOCAL;
        const dark = ctx.createLinearGradient(wallX - 420, 0, wallX + 120, 0);
        dark.addColorStop(0, `rgba(24, 26, 40, ${0.55 * stormNear})`);
        dark.addColorStop(1, 'rgba(24, 26, 40, 0)');
        ctx.fillStyle = dark;
        ctx.fillRect(wallX - 420, 0, 540, 400);
      }
    }
  }

  /** The sea below the horizon, with a glitter path under the sun. */
  function drawSea(plane) {
    const horizonY = 330 + plane.pitch * 460;
    const sea = ctx.createLinearGradient(0, horizonY, 0, FIELD.height);
    sea.addColorStop(0, PALETTE.seaNear);
    sea.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizonY, FIELD.width, FIELD.height - horizonY);

    const sunBearing = Math.atan2(-0.98, 0.2);
    const rel = wrapAngle(sunBearing - plane.heading);
    if (Math.abs(rel) < 1.0) {
      const glitterX = FIELD.width / 2 + Math.tan(rel) * FOCAL;
      ctx.fillStyle = 'rgba(255, 217, 138, 0.5)';
      for (let i = 0; i < 42; i += 1) {
        const y = horizonY + 8 + hash(i * 3) * (FIELD.height - horizonY - 20);
        const w = 14 + hash(i * 7) * 60;
        const x = glitterX + (hash(i * 11) - 0.5) * 130 * (1 + (y - horizonY) / 220);
        ctx.globalAlpha = 0.12 + hash(i * 5) * 0.3;
        ctx.fillRect(x - w / 2, y, w, 2);
      }
      ctx.globalAlpha = 1;
    }
    // Wave strokes, longer near the bottom of the frame.
    ctx.strokeStyle = 'rgba(190, 220, 230, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i += 1) {
      const y = horizonY + 14 + hash(i * 13) * (FIELD.height - horizonY - 30);
      const x = hash(i * 17) * FIELD.width;
      const w = 30 + hash(i * 19) * 90;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    }
  }

  function drawClouds(world, project, plane, wallX) {
    // Golden banks first, the storm wall's dark masses after them.
    for (const cloud of world.clouds) {
      const p = project(cloud.x, cloud.z, cloud.alt);
      if (!p || p.y > 400 || p.f < 450) continue; // too close to read: you are in it
      const w = Math.min(380, cloud.size * p.scale);
      if (w < 4) continue;
      ctx.fillStyle = cloud.shade > 0.5 ? 'rgba(255, 224, 178, 0.75)' : 'rgba(240, 200, 160, 0.6)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w, w * 0.22, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - w * 0.5, p.y + w * 0.05, w * 0.6, w * 0.16, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + w * 0.5, p.y + w * 0.05, w * 0.6, w * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cloud of world.stormClouds) {
      const p = project(cloud.x, cloud.z, cloud.alt);
      if (!p || p.y > 420 || p.f < 450) continue;
      const w = Math.min(420, cloud.size * p.scale);
      if (w < 6) continue;
      ctx.fillStyle = 'rgba(44, 47, 61, 0.92)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w, w * 0.34, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - w * 0.55, p.y + w * 0.08, w * 0.6, w * 0.24, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + w * 0.55, p.y + w * 0.08, w * 0.6, w * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 179, 71, 0.5)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + w * 0.3, w * 0.9, w * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // The wall's leading edge throws towering anvils ahead of itself: dark
    // heads with lit rims, so the storm reads even when you fly away from it.
    for (let i = 0; i < 8; i += 1) {
      const ax = wallX + 350 + (i % 4) * 260;
      const az = 700 + i * 680;
      const p = project(ax, az, 300 + (i % 3) * 90);
      if (!p || p.y > 430 || p.f < 400) continue;
      const w = Math.min(420, (240 + (i % 3) * 90) * p.scale);
      if (w < 8) continue;
      ctx.fillStyle = 'rgba(38, 40, 54, 0.95)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w, w * 0.42, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - w * 0.5, p.y + w * 0.12, w * 0.55, w * 0.28, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + w * 0.5, p.y + w * 0.12, w * 0.55, w * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 179, 71, 0.55)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - w * 0.34, w * 0.8, w * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Project a world point, walking it toward the plane until it is in front
   * of the camera, so a runway or clearing never vanishes when its near end
   * passes under the camera. Returns null only when even the plane is behind. */
  function projectVisible(project, plane, x, z, h) {
    let p = project(x, z, h);
    if (p) return p;
    for (let t = 0.15; t < 1; t += 0.15) {
      p = project(x + (plane.x - x) * t, z + (plane.z - z) * t, h + (plane.altitude - h) * t);
      if (p) return p;
    }
    return null;
  }

  function drawStrip(island, project, plane) {
    const strip = island.strip;
    const sin = Math.sin(strip.heading);
    const cos = Math.cos(strip.heading);
    const halfL = strip.length / 2;
    const halfW = strip.width / 2;
    const corners = [];
    for (const [a, b] of [[-halfL, -halfW], [halfL, -halfW], [halfL, halfW], [-halfL, halfW]]) {
      const x = strip.x + sin * a + cos * b;
      const z = strip.z + cos * a - sin * b;
      corners.push(projectVisible(project, plane, x, z, groundHeightAt(x, z) + 1));
    }
    if (corners.some((c) => c === null)) return;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = PALETTE.runway;
    ctx.fill();
    // Centreline dashes and threshold bars, drawn as projected points.
    ctx.strokeStyle = PALETTE.runwayLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    const start = project(strip.x - sin * halfL, strip.z - cos * halfL, groundHeightAt(strip.x - sin * halfL, strip.z - cos * halfL) + 1.5);
    const end = project(strip.x + sin * halfL, strip.z + cos * halfL, groundHeightAt(strip.x + sin * halfL, strip.z + cos * halfL) + 1.5);
    if (start && end) {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // A windsock by the strip: an orange cone on a pole.
    const sockX = strip.x + cos * (halfW + 26);
    const sockZ = strip.z - sin * (halfW + 26);
    const base = project(sockX, sockZ, groundHeightAt(sockX, sockZ) + 1);
    const top = project(sockX, sockZ, groundHeightAt(sockX, sockZ) + 12);
    if (base && top) {
      ctx.strokeStyle = '#e8e2d2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = '#ff7a2f';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x + 12, top.y + 3);
      ctx.lineTo(top.x, top.y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawIsland(island, world, project, plane) {
    let centre = project(island.x, island.z, 0);
    if (!centre) {
      // The island is beneath the camera: its centre is behind us, so use the
      // ground just ahead instead — the island fills the lower frame, as it should.
      centre = projectVisible(project, plane, island.x, island.z, 0);
    }
    if (!centre) return;
    const rx = island.radius * centre.scale;
    if (rx < 2 || centre.x < -rx * 2 || centre.x > FIELD.width + rx * 2) return;
    const ry = Math.max(2, rx * 0.26);
    // Sand rim.
    ctx.fillStyle = PALETTE.sand;
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // The hill: a mound from the beach rim up to the projected peak.
    const peak = project(island.x, island.z, island.height);
    if (peak) {
      const hill = ctx.createLinearGradient(0, peak.y, 0, centre.y);
      hill.addColorStop(0, PALETTE.grassLight);
      hill.addColorStop(1, PALETTE.grass);
      ctx.fillStyle = hill;
      ctx.beginPath();
      ctx.moveTo(centre.x - rx * 0.92, centre.y);
      ctx.quadraticCurveTo(centre.x - rx * 0.55, peak.y + (centre.y - peak.y) * 0.35, peak.x, peak.y);
      ctx.quadraticCurveTo(centre.x + rx * 0.55, peak.y + (centre.y - peak.y) * 0.35, centre.x + rx * 0.92, centre.y);
      ctx.closePath();
      ctx.fill();
      // A rocky crown on the tall ones.
      if (island.height >= 150) {
        ctx.fillStyle = PALETTE.rock;
        ctx.beginPath();
        ctx.moveTo(peak.x - rx * 0.18, peak.y + (centre.y - peak.y) * 0.22);
        ctx.lineTo(peak.x, peak.y);
        ctx.lineTo(peak.x + rx * 0.18, peak.y + (centre.y - peak.y) * 0.22);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Dawn fog lying in the eastern valleys.
    if (island.x > 3000) {
      ctx.fillStyle = 'rgba(232, 226, 210, 0.28)';
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y - ry * 0.4, rx * 0.8, ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Trees on this island, each a small dark triangle.
    for (const tree of world.trees) {
      const dx = tree.x - island.x;
      const dz = tree.z - island.z;
      if (dx * dx + dz * dz > island.radius * island.radius) continue;
      const p = project(tree.x, tree.z, groundHeightAt(tree.x, tree.z));
      if (!p || p.y < 0 || p.y > FIELD.height) continue;
      const s = tree.size * p.scale * 0.9;
      if (s < 1.5) continue;
      ctx.fillStyle = tree.shade > 0.5 ? PALETTE.forest : '#3a6b33';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s);
      ctx.lineTo(p.x - s * 0.7, p.y);
      ctx.lineTo(p.x + s * 0.7, p.y);
      ctx.closePath();
      ctx.fill();
    }
    // The village: a cluster of small houses with lit windows by the strip.
    const strip = island.strip;
    for (let i = 0; i < 7; i += 1) {
      const ox = (hash(island.x + i * 31) - 0.5) * 260;
      const oz = (hash(island.z + i * 17) - 0.5) * 160 + 60;
      const hx = strip.x + Math.cos(strip.heading) * ox - Math.sin(strip.heading) * oz;
      const hz = strip.z - Math.sin(strip.heading) * ox - Math.cos(strip.heading) * oz;
      if (onStrip(hx, hz, island)) continue;
      const p = project(hx, hz, groundHeightAt(hx, hz) + 2);
      if (!p) continue;
      const w = 9 * p.scale * 0.8;
      if (w < 2) continue;
      ctx.fillStyle = i % 3 === 0 ? '#8a6f4d' : '#6e5a44';
      ctx.fillRect(p.x - w / 2, p.y - w * 0.8, w, w * 0.8);
      ctx.fillStyle = 'rgba(255, 214, 130, 0.95)';
      ctx.fillRect(p.x - w * 0.2, p.y - w * 0.55, w * 0.4, w * 0.3);
    }
    // The strip's shelf: a mown clearing, so the runway sits on flat ground
    // and reads as a clearing in the hill, not a slab painted on a slope.
    // Drawn as a perspective quad along the strip, in a muted mown green.
    {
      const strip = island.strip;
      const sin = Math.sin(strip.heading);
      const cos = Math.cos(strip.heading);
      const shelfPts = [];
      for (const [a, b] of [[-280, -170], [280, -170], [280, 170], [-280, 170]]) {
        const x = strip.x + sin * a + cos * b;
        const z = strip.z + cos * a - sin * b;
        shelfPts.push(projectVisible(project, plane, x, z, stripElevation(island)));
      }
      if (shelfPts.every((p) => p !== null)) {
        ctx.fillStyle = '#6a9a4e';
        ctx.beginPath();
        ctx.moveTo(shelfPts[0].x, shelfPts[0].y);
        for (let i = 1; i < 4; i += 1) ctx.lineTo(shelfPts[i].x, shelfPts[i].y);
        ctx.closePath();
        ctx.fill();
      }
    }
    drawStrip(island, project, plane);
  }

  function drawRings(leg, project) {
    for (const ring of leg.rings) {
      const p = project(ring.x, ring.z, ring.alt);
      if (!p) continue;
      const rx = RING_RADIUS * p.scale;
      if (rx < 3) continue;
      const ry = Math.max(2, rx * 0.34);
      // A buoy below the ring, so it reads as a place in the world.
      const sea = project(ring.x, ring.z, 0);
      if (sea) {
        ctx.strokeStyle = 'rgba(244, 241, 228, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + ry);
        ctx.lineTo(sea.x, sea.y);
        ctx.stroke();
        ctx.fillStyle = '#ff7a2f';
        ctx.beginPath();
        ctx.arc(sea.x, sea.y, Math.max(2, 4 * sea.scale * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = PALETTE.ringGlow;
      ctx.shadowBlur = ring.done ? 0 : 18;
      ctx.strokeStyle = ring.done ? 'rgba(127, 208, 138, 0.9)' : PALETTE.ring;
      ctx.lineWidth = Math.max(2, rx * 0.12);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 243, 196, 0.85)';
      ctx.lineWidth = Math.max(1, rx * 0.04);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** The Kestrel, seen from behind and above, low in the frame. */
  function drawPlane(plane) {
    const cx = FIELD.width / 2;
    const cy = 478;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.bank * 0.55);
    // Fuselage: a long shape tapering away from the tail toward the nose,
    // wide enough to read as a built airframe, with a dark outline so she
    // holds against bright sky and bright sea alike.
    const body = ctx.createLinearGradient(0, 60, 0, -110);
    body.addColorStop(0, '#c98f3d');
    body.addColorStop(0.5, '#e8b45c');
    body.addColorStop(1, '#f7d98a');
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(90, 52, 14, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-19, 62);
    ctx.quadraticCurveTo(-24, 10, -10, -78);
    ctx.quadraticCurveTo(0, -96, 10, -78);
    ctx.quadraticCurveTo(24, 10, 19, 62);
    ctx.quadraticCurveTo(0, 72, -19, 62);
    ctx.fill();
    ctx.stroke();
    // A dark stripe down the spine.
    ctx.fillStyle = '#7a4a1e';
    ctx.fillRect(-3.5, -92, 7, 150);
    // Main wings, golden on top, in shadow beneath, outlined so they read.
    ctx.fillStyle = '#e8b45c';
    ctx.strokeStyle = 'rgba(90, 52, 14, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-152, -14);
    ctx.quadraticCurveTo(-70, -34, -14, -20);
    ctx.lineTo(-14, 0);
    ctx.quadraticCurveTo(-70, -4, -152, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(152, -14);
    ctx.quadraticCurveTo(70, -34, 14, -20);
    ctx.lineTo(14, 0);
    ctx.quadraticCurveTo(70, -4, 152, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tailplane and fin.
    ctx.fillStyle = '#c98f3d';
    ctx.beginPath();
    ctx.moveTo(-62, 48);
    ctx.lineTo(-12, 40);
    ctx.lineTo(-12, 54);
    ctx.lineTo(-62, 60);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(62, 48);
    ctx.lineTo(12, 40);
    ctx.lineTo(12, 54);
    ctx.lineTo(62, 60);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 66);
    ctx.lineTo(0, 30);
    ctx.lineTo(11, 62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Propeller blur at the nose, seen edge-on from behind.
    ctx.fillStyle = 'rgba(240, 240, 235, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, -92, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3c3f45';
    ctx.beginPath();
    ctx.arc(0, -92, 4, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights: red port, green starboard.
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(-152, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dff88';
    ctx.beginPath();
    ctx.arc(152, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Her shadow, only when she is low over the ground.
    const ground = groundHeightAt(plane.x, plane.z);
    if (plane.altitude - ground < 70 && plane.airborne) {
      ctx.fillStyle = 'rgba(20, 24, 31, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, 636, 60, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCompass(heading) {
    const cx = FIELD.width / 2;
    const y = 30;
    ctx.fillStyle = 'rgba(20, 24, 31, 0.72)';
    roundRect(cx - 190, y - 16, 380, 32, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    roundRect(cx - 190, y - 16, 380, 32, 8);
    ctx.clip();
    for (let deg = -90; deg <= 90; deg += 5) {
      const hdg = Math.round(((heading / DEG + deg + 360) % 360) / 5) * 5;
      const off = (wrapAngle((hdg * DEG - heading)) / DEG) * 3.2;
      const x = cx + off;
      const major = hdg % 30 === 0;
      ctx.strokeStyle = major ? PALETTE.text : PALETTE.muted;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + (major ? -4 : 2));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = 'bold 12px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(String(hdg).padStart(3, '0'), x, y - 6);
      }
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.ring;
    ctx.beginPath();
    ctx.moveTo(cx, y + 14);
    ctx.lineTo(cx - 5, y + 6);
    ctx.lineTo(cx + 5, y + 6);
    ctx.closePath();
    ctx.fill();
  }

  function drawArtificialHorizon(x, y, r, bank, pitch) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-bank);
    ctx.translate(0, pitch * 120);
    ctx.fillStyle = '#3a6ea8';
    ctx.fillRect(-r, -r * 2, r * 2, r * 2);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, 0, r * 2, r * 2);
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(-r, -1.5, r * 2, 3);
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // The little wings that never move.
    ctx.fillStyle = PALETTE.ring;
    ctx.fillRect(x - r - 2, y - 2, 16, 4);
    ctx.fillRect(x + r - 14, y - 2, 16, 4);
  }

  function gauge(x, y, w, h, fraction, colour, label) {
    ctx.fillStyle = '#0b0e13';
    roundRect(x, y, w, h, 3);
    ctx.fill();
    ctx.fillStyle = colour;
    roundRect(x + 1, y + 1, Math.max(2, (w - 2) * Math.max(0, Math.min(1, fraction))), h - 2, 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 5);
  }

  /** The instruments: ALT, SPD and HDG big, then fuel, damage, throttle, target. */
  function drawHUD(flight, inputState) {
    const plane = flight.state.plane;
    const leg = flight.currentLeg();
    const speedKt = Math.round(plane.speed * 1.944);
    const altFt = Math.round(plane.altitude * 3.281);
    const headingDeg = Math.round(((plane.heading / DEG) % 360 + 360) % 360);

    ctx.textAlign = 'left';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`ALT ${String(altFt).padStart(4, '0')} ft`, 24, 40);
    ctx.textAlign = 'right';
    ctx.fillText(`SPD ${speedKt} kt`, FIELD.width - 24, 40);
    drawCompass(plane.heading);
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`HDG ${String(headingDeg).padStart(3, '0')}`, FIELD.width / 2, 62);

    // Storm clock and score, top corners under the readouts.
    const storm = flight.state.stormLeft;
    const stormText = `STORM ${Math.floor(storm / 60)}:${String(Math.floor(storm % 60)).padStart(2, '0')}`;
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = storm < 120 ? PALETTE.bad : PALETTE.warn;
    ctx.fillText(stormText, 24, 66);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE ${flight.state.score}`, FIELD.width - 24, 66);
    ctx.textAlign = 'left';
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`LEG ${flight.state.legIndex + 1}/6  ·  DELIVERED ${flight.state.delivered}/6`, 24, 86);

    // Target: distance and bearing to the next ring, else to the destination strip.
    const target = nextTarget(flight);
    if (target) {
      const dx = target.x - plane.x;
      const dz = target.z - plane.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const bearing = Math.round(((Math.atan2(dx, dz) / DEG) % 360 + 360) % 360);
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillStyle = target.kind === 'ring' ? PALETTE.ring : PALETTE.good;
      ctx.fillText(
        `${target.kind === 'ring' ? '◉ RING' : '▣ ' + target.label}  ${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'}  ·  ${String(bearing).padStart(3, '0')}°`,
        FIELD.width / 2,
        96,
      );
      // An edge arrow when the target is off the frame.
      const project = makeProjector(plane);
      const p = project(target.x, target.z, target.alt);
      if (!p || p.x < 40 || p.x > FIELD.width - 40 || p.y < 110 || p.y > 560) {
        const angle = Math.atan2(
          (p ? p.x : FIELD.width / 2 + Math.sin(wrapAngle(Math.atan2(dx, dz) - plane.heading)) * 300) - FIELD.width / 2,
          (p ? p.y : 300) - 300,
        );
        const ax = FIELD.width / 2 + Math.sin(angle) * 210;
        const ay = 300 + Math.cos(angle) * 150;
        ctx.save();
        ctx.translate(Math.max(50, Math.min(FIELD.width - 50, ax)), Math.max(120, Math.min(540, ay)));
        ctx.rotate(-angle);
        ctx.fillStyle = target.kind === 'ring' ? PALETTE.ring : PALETTE.good;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(9, 8);
        ctx.lineTo(-9, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Message banner.
    if (flight.state.messageTime > 0 && flight.state.message) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px ' + FONT;
      ctx.fillStyle = 'rgba(20, 24, 31, 0.72)';
      const w = ctx.measureText(flight.state.message).width + 36;
      roundRect(FIELD.width / 2 - w / 2, 118, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(flight.state.message, FIELD.width / 2, 139);
    }

    // The instrument panel along the bottom.
    ctx.fillStyle = 'rgba(20, 24, 31, 0.88)';
    ctx.fillRect(0, 600, FIELD.width, 120);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 600);
    ctx.lineTo(FIELD.width, 600);
    ctx.stroke();

    drawArtificialHorizon(78, 660, 42, plane.bank, plane.pitch);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', 78, 714);

    ctx.textAlign = 'left';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${altFt} ft`, 150, 646);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('ALTITUDE', 150, 664);
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${speedKt} kt`, 150, 696);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('AIRSPEED', 150, 712);

    ctx.font = 'bold 22px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${String(headingDeg).padStart(3, '0')}°`, 300, 646);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('HEADING', 300, 664);
    const vs = Math.round(plane.verticalSpeed * 196.85);
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillStyle = vs < -400 ? PALETTE.bad : PALETTE.text;
    ctx.fillText(`${vs >= 0 ? '+' : ''}${vs} fpm`, 300, 696);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('VERTICAL SPEED', 300, 712);

    // Throttle lever.
    ctx.fillStyle = '#0b0e13';
    roundRect(470, 622, 16, 84, 4);
    ctx.fill();
    const throttleH = 84 * plane.throttle;
    ctx.fillStyle = plane.throttle > 0.85 ? PALETTE.warn : PALETTE.good;
    roundRect(472, 622 + 84 - throttleH, 12, throttleH, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('THR', 478, 714);

    gauge(520, 636, 180, 12, plane.fuel / 100, plane.fuel < 25 ? PALETTE.bad : PALETTE.good, 'FUEL');
    gauge(520, 678, 180, 12, 1 - plane.damage / 100, plane.damage > 60 ? PALETTE.bad : PALETTE.good, 'AIRFRAME');
    ctx.textAlign = 'left';
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Fuel ${Math.round(plane.fuel)} · Damage ${Math.round(plane.damage)}%`, 520, 710);

    // The delivery card, right of the panel.
    const legNow = flight.currentLeg();
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${legNow.delivery.from} → ${legNow.delivery.to}`, 740, 640);
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Cargo: ${legNow.delivery.cargo}`, 740, 660);
    ctx.fillText(legNow.delivery.goal, 740, 678);
    const ringsLeft = legNow.rings.filter((r) => !r.done).length;
    ctx.fillStyle = PALETTE.ring;
    ctx.fillText(`Rings left: ${'◉'.repeat(ringsLeft)}${'○'.repeat(legNow.rings.length - ringsLeft)}`, 740, 698);

    ctx.textAlign = 'right';
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('W/S pitch · A/D bank · Shift/Ctrl throttle · M map · P pause', FIELD.width - 16, 712);
  }

  function nextTarget(flight) {
    const leg = flight.currentLeg();
    const ring = leg.rings.find((r) => !r.done);
    if (ring) return { kind: 'ring', x: ring.x, z: ring.z, alt: ring.alt, label: 'Ring' };
    return { kind: 'strip', x: leg.to.strip.x, z: leg.to.strip.z, alt: 0, label: leg.to.name };
  }

  /** The whole world from the cockpit's point of view, without HUD or panels.
   * `cameraPlane` overrides the plane the camera sits behind (the title and
   * run sheet use a high hero view instead of the parked Kestrel); `showPlane`
   * hides the chase-view airframe where it would sit on top of the text. */
  function drawWorld(flight, cameraPlane, showPlane = true) {
    const plane = cameraPlane ?? flight.state.plane;
    const world = flight.state.world;
    const stormLeft = flight.state.stormLeft;
    const wallX = -600 + (720 - stormLeft) * ((7300 - -600) / 720);
    const stormNear = Math.max(0, Math.min(1, 1 - (plane.x - wallX) / 3000));
    ctx.save();
    ctx.translate(FIELD.width / 2, 360);
    ctx.rotate(-plane.bank * 0.35);
    ctx.translate(-FIELD.width / 2, -360);
    drawSky(plane, stormNear);
    drawSea(plane);
    const project = makeProjector(plane);
    drawClouds(world, project, plane, wallX);
    const sorted = [...world.islands].sort((a, b) => {
      const pa = project(a.x, a.z, 0);
      const pb = project(b.x, b.z, 0);
      return (pb ? pb.f : 0) - (pa ? pa.f : 0);
    });
    for (const island of sorted) drawIsland(island, world, project, plane);
    drawRings(flight.currentLeg(), project);
    ctx.restore();
    // Rain streaks when the wall is close.
    if (stormNear > 0.65) {
      ctx.strokeStyle = `rgba(200, 210, 230, ${0.3 * ((stormNear - 0.65) / 0.35)})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i += 1) {
        const x = hash(i * 23) * FIELD.width;
        const y = hash(i * 29) * 500;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 8, y + 22);
        ctx.stroke();
      }
    }
    if (showPlane) drawPlane(plane);
  }

  /** The map: the whole archipelago from above, with the route and the storm wall. */
  function drawMap(flight) {
    const world = flight.state.world;
    const plane = flight.state.plane;
    const scaleX = FIELD.width / 8200;
    const scaleZ = 560 / 6200;
    const ox = 20;
    const oy = 90;
    const px = (x) => ox + x * scaleX;
    const pz = (z) => oy + z * scaleZ;
    ctx.fillStyle = '#0e1a26';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = '#17394f';
    ctx.fillRect(ox, oy, 8000 * scaleX, 6000 * scaleZ);
    ctx.strokeStyle = '#2c4a5e';
    ctx.strokeRect(ox, oy, 8000 * scaleX, 6000 * scaleZ);
    // The storm wall, marching in from the west.
    const wallX = -600 + (720 - flight.state.stormLeft) * ((7300 - -600) / 720);
    ctx.fillStyle = 'rgba(44, 47, 61, 0.85)';
    ctx.fillRect(ox, oy, Math.max(0, px(wallX) - ox), 6000 * scaleZ);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('THE GREY WALL', ox + 8, oy + 20);
    // The route, leg by leg.
    ctx.strokeStyle = 'rgba(255, 194, 61, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    for (let i = 0; i < world.legs.length; i += 1) {
      const leg = world.legs[i];
      if (i === 0) ctx.moveTo(px(leg.from.strip.x), pz(leg.from.strip.z));
      ctx.lineTo(px(leg.to.strip.x), pz(leg.to.strip.z));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const island of world.islands) {
      ctx.fillStyle = PALETTE.grass;
      ctx.beginPath();
      ctx.arc(px(island.x), pz(island.z), Math.max(6, island.radius * scaleX), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.sand;
      ctx.beginPath();
      ctx.arc(px(island.x), pz(island.z), Math.max(5, island.radius * scaleX * 0.92), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.grass;
      ctx.beginPath();
      ctx.arc(px(island.x), pz(island.z), Math.max(4, island.radius * scaleX * 0.8), 0, Math.PI * 2);
      ctx.fill();
      const strip = island.strip;
      ctx.strokeStyle = '#f4f1e4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px(strip.x - Math.sin(strip.heading) * strip.length / 2), pz(strip.z - Math.cos(strip.heading) * strip.length / 2));
      ctx.lineTo(px(strip.x + Math.sin(strip.heading) * strip.length / 2), pz(strip.z + Math.cos(strip.heading) * strip.length / 2));
      ctx.stroke();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(island.name, px(island.x), pz(island.z) - island.radius * scaleX - 6);
    }
    // Rings not yet flown.
    const leg = flight.currentLeg();
    for (const ring of leg.rings) {
      if (ring.done) continue;
      ctx.strokeStyle = PALETTE.ring;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(ring.x), pz(ring.z), 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The Kestrel.
    ctx.save();
    ctx.translate(px(plane.x), pz(plane.z));
    ctx.rotate(plane.heading);
    ctx.fillStyle = '#ffc23d';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('CHART OF THE MARROW ISLES', FIELD.width / 2, 48);
    ctx.font = '14px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('M — close the chart · the gold line is your route · the dark west is the storm', FIELD.width / 2, 72);
    ctx.textAlign = 'left';
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    const storm = flight.state.stormLeft;
    ctx.fillText(`Storm reaches Last Light in ${Math.floor(storm / 60)}:${String(Math.floor(storm % 60)).padStart(2, '0')}`, 24, 690);
  }

  function panel(title, lines, accent) {
    const w = 860;
    const h = 130 + lines.length * 26;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.fillStyle = 'rgba(14, 18, 24, 0.94)';
    roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = accent ?? PALETTE.ring;
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 12);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(title, FIELD.width / 2, y + 52);
    ctx.font = '16px ' + FONT;
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 && line.startsWith('—') ? PALETTE.muted : PALETTE.text;
      ctx.fillText(line, FIELD.width / 2, y + 92 + i * 26);
    });
  }

  /** A high hero view over Marrow for the title and run sheet backdrops. */
  function heroPlane(flight) {
    return { ...flight.state.plane, x: 1400, z: 4700, heading: 1.15, altitude: 300, pitch: 0, bank: 0 };
  }

  function drawTitle(flight, best) {
    drawWorld(flight, heroPlane(flight), false);
    ctx.fillStyle = 'rgba(14, 18, 24, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ring;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText('A BUSH PLANE · A MAIL RUN · A STORM COMING', FIELD.width / 2, 128);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 92px ' + FONT;
    ctx.fillText('LAST LIGHT', FIELD.width / 2, 226);
    ctx.font = 'bold 34px ' + FONT;
    ctx.fillStyle = PALETTE.horizonGlow;
    ctx.fillText('— The Marrow Run —', FIELD.width / 2, 272);
    ctx.font = '19px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('7 islands · 6 deliveries · 5 named regulars · 3 weather fronts', FIELD.width / 2, 322);
    ctx.fillText('One Kestrel, one tank a leg, and twelve minutes before the Grey Wall', FIELD.width / 2, 350);
    ctx.fillText('closes the last strip.', FIELD.width / 2, 376);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('W/S pitch · A/D bank · Shift / Ctrl throttle · Mouse steers too · M map · P pause', FIELD.width / 2, 428);
    ctx.fillText('Thread the rings. Land gentle. Hand the cargo to the regular waiting there.', FIELD.width / 2, 452);
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('Press ENTER to read the run sheet', FIELD.width / 2, 512);
    if (best > 0) {
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`Best run so far: ${best}`, FIELD.width / 2, 548);
    }
  }

  function drawBriefing(flight) {
    drawWorld(flight, heroPlane(flight), false);
    ctx.fillStyle = 'rgba(14, 18, 24, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 36px ' + FONT;
    ctx.fillText('THE RUN SHEET', FIELD.width / 2, 84);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Six legs, west to east, against the Grey Wall. Fuel is filled at every strip.', FIELD.width / 2, 112);
    let y = 150;
    ctx.textAlign = 'left';
    for (const leg of flight.state.world.legs) {
      const regular = leg.regular ? ` — ${leg.regular.name} is waiting` : ' — nobody waits; land and go';
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`Leg ${leg.index + 1}: ${leg.delivery.from} → ${leg.delivery.to} — ${leg.delivery.cargo}${regular}`, 150, y);
      ctx.font = '14px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`     ${leg.delivery.goal}  ·  ${leg.rings.length} rings on the way`, 150, y + 20);
      y += 46;
    }
    y += 8;
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('The regulars', 150, y);
    y += 22;
    ctx.font = '14px ' + FONT;
    for (const regular of flight.state.world.regulars) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`  ${regular.name} (${regular.island}) — ${regular.story}`, 150, y);
      y += 20;
    }
    y += 10;
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('The weather', 150, y);
    y += 22;
    ctx.font = '14px ' + FONT;
    for (const front of FRONTS) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`  ${front.name} — ${front.description}`, 150, y);
      y += 20;
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('Press ENTER to fly', FIELD.width / 2, 668);
  }

  function draw(screen, flight, best, inputState, showMap) {
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(flight, best);
      return;
    }
    if (screen === SCREEN_BRIEFING) {
      drawBriefing(flight);
      return;
    }
    if (screen === SCREEN_OVER) {
      drawWorld(flight, heroPlane(flight), false);
      const won = flight.state.delivered === 6;
      panel(
        won ? 'RUN COMPLETE' : 'THE RUN IS OVER',
        [
          flight.state.overReason,
          `Score ${flight.state.score}  ·  Delivered ${flight.state.delivered}/6  ·  Rings ${flight.state.ringsHit}  ·  Centred ${flight.state.ringsCentred}`,
          `Smooth landings ${flight.state.smoothLandings}  ·  Hard landings ${flight.state.hardLandings}`,
          ...(flight.state.feats.length > 0 ? [`Feats: ${flight.state.feats.join(' · ')}`] : []),
          'Press R to fly it again',
        ],
        won ? PALETTE.good : PALETTE.bad,
      );
      return;
    }
    if (screen === SCREEN_LEG) {
      drawWorld(flight);
      const leg = flight.currentLeg();
      const next = flight.state.legIndex + 1 < flight.state.world.legs.length
        ? flight.state.world.legs[flight.state.legIndex + 1]
        : null;
      panel(
        `DELIVERED AT ${leg.to.name.toUpperCase()}`,
        [
          `The ${leg.delivery.cargo} is handed over. Leg score +${flight.state.legScore}.`,
          leg.regular ? `${leg.regular.name}: “${leg.regular.story}”` : 'The strip is empty; the wind takes the quiet.',
          next ? `Next: ${next.delivery.cargo} to ${next.delivery.to} — ${next.delivery.goal}` : 'That was the last one.',
          'Tank filled. Press ENTER for the next leg.',
        ],
        PALETTE.good,
      );
      return;
    }
    if (screen === SCREEN_PAUSED) {
      drawWorld(flight);
      panel('PAUSED', ['The Kestrel holds her place in the sky.', 'P to carry on · R to start the run over'], PALETTE.muted);
      return;
    }
    // SCREEN_PLAY
    if (showMap) {
      drawMap(flight);
      return;
    }
    drawWorld(flight);
    drawHUD(flight, inputState);
  }

  return { draw, SCREEN_TITLE, SCREEN_BRIEFING, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_LEG };
}

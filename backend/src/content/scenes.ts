// Illustrated scenes for the memory game. Each one is drawn in code so its
// contents are known exactly — the questions are guaranteed to match what the
// player saw. Every scene has two questions; a game uses one per scene.

export interface SceneQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Scene {
  id: string;
  title: string;
  svg: string;
  questions: SceneQuestion[];
}

const W = 600;
const H = 400;
const FONT = "Arial, Helvetica, sans-serif";

const svg = (body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const circle = (cx: number, cy: number, r: number, fill: string, extra = "") =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = "") =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, width = 2, extra = "") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
const text = (x: number, y: number, s: string, size: number, fill: string, extra = "") =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="bold" fill="${fill}" text-anchor="middle" ${extra}>${s}</text>`;
const vgrad = (id: string, top: string, bottom: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}
const star = (cx: number, cy: number, outer: number, fill: string) =>
  `<polygon points="${starPoints(cx, cy, outer, outer * 0.45)}" fill="${fill}"/>`;

const tree = (x: number, ground: number, scale = 1) =>
  rect(x - 10 * scale, ground - 70 * scale, 20 * scale, 70 * scale, "#8b5a2b") +
  circle(x, ground - 95 * scale, 42 * scale, "#2e8b3a") +
  circle(x - 28 * scale, ground - 75 * scale, 28 * scale, "#34a045") +
  circle(x + 28 * scale, ground - 75 * scale, 28 * scale, "#34a045");

const balloon = (x: number, y: number, fill: string, tieX: number, tieY: number) =>
  `<path d="M${x},${y + 38} Q${(x + tieX) / 2 - 15},${(y + tieY) / 2} ${tieX},${tieY}" stroke="#555" stroke-width="1.5" fill="none"/>` +
  ellipse(x, y, 26, 32, fill) +
  ellipse(x - 9, y - 12, 6, 10, "#ffffff", 'opacity="0.35"') +
  path(`M${x - 5},${y + 31} L${x + 5},${y + 31} L${x},${y + 39} Z`, fill);

const banana = (x: number, y: number) =>
  path(`M${x},${y} Q${x + 45},${y - 62} ${x + 100},${y - 34} Q${x + 48},${y - 16} ${x + 8},${y + 8} Z`, "#ffd83d", 'stroke="#c9a400" stroke-width="2"') +
  rect(x + 94, y - 40, 8, 8, "#6b4423", 'rx="2"');

const wheel = (x: number, y: number, r = 16) => circle(x, y, r, "#222") + circle(x, y, r * 0.45, "#bbb");

const sheep = (x: number, y: number) =>
  line(x - 18, y + 18, x - 18, y + 42, "#222", 5) +
  line(x + 16, y + 18, x + 16, y + 42, "#222", 5) +
  circle(x - 20, y, 18, "#fff") + circle(x, y - 8, 20, "#fff") + circle(x + 20, y, 18, "#fff") +
  circle(x, y + 10, 20, "#fff") + circle(x - 10, y + 12, 16, "#fff") + circle(x + 12, y + 12, 16, "#fff") +
  ellipse(x + 40, y + 2, 13, 11, "#2b2b2b") + circle(x + 44, y - 1, 2.5, "#fff");

const fish = (x: number, y: number, fill: string, facingRight: boolean, stripe = "") => {
  const d = facingRight ? 1 : -1;
  return (
    path(`M${x - 34 * d},${y} L${x - 56 * d},${y - 18} L${x - 56 * d},${y + 18} Z`, fill) +
    ellipse(x, y, 36, 22, fill) +
    (stripe ? rect(x - 6, y - 21, 10, 42, stripe, 'opacity="0.9"') : "") +
    circle(x + 20 * d, y - 6, 5, "#fff") + circle(x + 21 * d, y - 6, 2.5, "#111")
  );
};

const book = (x: number, h: number, color: string, shelfY: number) =>
  rect(x, shelfY - h, 26, h, color, 'rx="3"') + rect(x + 4, shelfY - h + 12, 18, 4, "#ffffff", 'opacity="0.6"');

const gift = (x: number, y: number, w: number, h: number, box: string, ribbon: string) =>
  rect(x, y, w, h, box, 'rx="4"') + rect(x + w / 2 - 6, y, 12, h, ribbon) + rect(x, y + h / 2 - 6, w, 12, ribbon) +
  ellipse(x + w / 2 - 12, y - 8, 12, 8, ribbon) + ellipse(x + w / 2 + 12, y - 8, 12, 8, ribbon);

function shape(kind: "circle" | "triangle" | "square" | "star", cx: number, cy: number, fill: string) {
  switch (kind) {
    case "circle":
      return circle(cx, cy, 34, fill);
    case "square":
      return rect(cx - 32, cy - 32, 64, 64, fill, 'rx="4"');
    case "triangle":
      return path(`M${cx},${cy - 36} L${cx + 38},${cy + 30} L${cx - 38},${cy + 30} Z`, fill);
    case "star":
      return star(cx, cy + 3, 40, fill);
  }
}

export const scenes: Scene[] = [
  {
    id: "park-balloons",
    title: "Balloons in the park",
    svg: svg(
      rect(0, 0, W, H, "url(#sky)") +
        circle(525, 72, 38, "#ffd23f") +
        rect(0, 300, W, 100, "#69bf45") +
        tree(95, 305) +
        tree(215, 305, 0.85) +
        rect(360, 318, 130, 12, "#8b5a2b", 'rx="3"') + rect(370, 330, 10, 30, "#6b4423") + rect(470, 330, 10, 30, "#6b4423") +
        rect(360, 292, 130, 10, "#8b5a2b", 'rx="3"') +
        balloon(310, 120, "#e63946", 420, 290) +
        balloon(372, 82, "#f4a100", 420, 290) +
        balloon(438, 118, "#1d6fe0", 420, 290) +
        balloon(500, 170, "#2a9d4b", 420, 290),
      vgrad("sky", "#6ec6ff", "#c9ecff")
    ),
    questions: [
      { question: "How many balloons were floating in the sky?", options: ["3", "4", "5", "6"], correctIndex: 1 },
      { question: "How many trees were in the park?", options: ["1", "2", "3", "4"], correctIndex: 1 }
    ]
  },
  {
    id: "fruit-table",
    title: "Fruit on the table",
    svg: svg(
      rect(0, 0, W, H, "#fbe7cf") +
        rect(0, 0, W, 230, "#f3d6b3") +
        rect(40, 40, 150, 110, "#bfe3ff", 'stroke="#8b5a2b" stroke-width="8"') +
        rect(0, 250, W, 150, "#a0522d") +
        rect(0, 250, W, 14, "#8a4523") +
        [95, 165, 235].map((x) => circle(x, 222, 32, "#6cc93a") + rect(x - 2, 182, 5, 14, "#6b4423") + ellipse(x + 10, 186, 10, 5, "#3f8f2a")).join("") +
        banana(285, 246) +
        banana(405, 246) +
        [0, 1, 2, 3, 4, 5].map((i) => circle(538 + (i % 3) * 18 - (i > 2 ? 9 : 0), 190 + Math.floor(i / 3) * 18, 11, "#7b3fa0")).join("") +
        circle(547, 226, 11, "#7b3fa0") + rect(544, 168, 4, 12, "#6b4423")
    ),
    questions: [
      { question: "What color were the apples?", options: ["Red", "Green", "Yellow", "Purple"], correctIndex: 1 },
      { question: "How many bananas were on the table?", options: ["1", "2", "3", "4"], correctIndex: 1 }
    ]
  },
  {
    id: "city-street",
    title: "City street",
    svg: svg(
      rect(0, 0, W, H, "#bfe4ff") +
        rect(20, 60, 110, 220, "#8d99ae") + rect(150, 20, 90, 260, "#6c7a91") + rect(420, 50, 160, 230, "#8d99ae") +
        [0, 1, 2, 3, 4, 5].map((r) => [0, 1].map((c) => rect(38 + c * 44, 80 + r * 32, 28, 18, "#fff7c2")).join("")).join("") +
        [0, 1, 2, 3, 4].map((r) => rect(172, 40 + r * 44, 46, 22, "#fff7c2")).join("") +
        rect(0, 280, W, 120, "#454b54") +
        [0, 1, 2, 3, 4, 5].map((i) => rect(20 + i * 100, 336, 60, 8, "#ffffff")).join("") +
        rect(40, 220, 230, 90, "#d62828", 'rx="10"') +
        [0, 1, 2, 3].map((i) => rect(58 + i * 52, 236, 40, 30, "#cdeeff", 'rx="4"')).join("") +
        wheel(90, 312) + wheel(225, 312) +
        rect(320, 262, 130, 42, "#ffc300", 'rx="10"') + rect(345, 238, 80, 32, "#ffc300", 'rx="8"') +
        rect(355, 244, 28, 20, "#cdeeff") + rect(390, 244, 28, 20, "#cdeeff") + rect(372, 228, 26, 10, "#222") +
        wheel(350, 306, 14) + wheel(420, 306, 14) +
        rect(515, 150, 10, 150, "#333") + rect(496, 60, 48, 110, "#222", 'rx="8"') +
        circle(520, 80, 13, "#5a1a1a") + circle(520, 115, 13, "#5a4a10") + circle(520, 150, 13, "#2bff5e") +
        circle(520, 150, 20, "#2bff5e", 'opacity="0.25"')
    ),
    questions: [
      { question: "Which traffic light was lit?", options: ["Red", "Yellow", "Green", "None of them"], correctIndex: 2 },
      { question: "What color was the bus?", options: ["Red", "Blue", "Green", "White"], correctIndex: 0 }
    ]
  },
  {
    id: "night-owl",
    title: "Owl at night",
    svg: svg(
      rect(0, 0, W, H, "url(#night)") +
        circle(480, 90, 46, "#fff3b0") + circle(502, 76, 42, "#16213e") +
        star(80, 70, 14, "#fff6c8") + star(190, 40, 11, "#fff6c8") + star(300, 95, 13, "#fff6c8") +
        star(390, 45, 10, "#fff6c8") + star(560, 180, 12, "#fff6c8") + star(110, 175, 11, "#fff6c8") +
        path("M0,340 Q150,300 300,335 T600,320 L600,400 L0,400 Z", "#0d1b2a") +
        path("M0,250 L330,232 L330,246 L0,266 Z", "#5c3d2e") +
        ellipse(215, 195, 40, 52, "#8b5e3c") +
        path("M180,160 L190,138 L200,158 Z", "#8b5e3c") + path("M230,158 L240,138 L250,160 Z", "#8b5e3c") +
        circle(200, 180, 15, "#fff") + circle(230, 180, 15, "#fff") + circle(200, 181, 7, "#111") + circle(230, 181, 7, "#111") +
        path("M210,192 L220,192 L215,203 Z", "#f4a100") +
        ellipse(215, 222, 22, 20, "#c89f7a") +
        path("M200,244 L205,236 L210,244 M220,244 L225,236 L230,244", "none", 'stroke="#f4a100" stroke-width="4"'),
      vgrad("night", "#0b132b", "#1c2541")
    ),
    questions: [
      { question: "How many stars were in the sky?", options: ["4", "5", "6", "7"], correctIndex: 2 },
      { question: "Which animal was sitting on the branch?", options: ["Cat", "Owl", "Crow", "Bat"], correctIndex: 1 }
    ]
  },
  {
    id: "beach-sailboat",
    title: "Day at the beach",
    svg: svg(
      rect(0, 0, W, H, "#9bdcff") +
        circle(90, 70, 34, "#ffdd57") +
        rect(0, 170, W, 110, "#1e88c7") +
        path("M0,190 Q30,182 60,190 T120,190 T180,190 T240,190 T300,190 T360,190 T420,190 T480,190 T540,190 T600,190", "none", 'stroke="#bfe8ff" stroke-width="3"') +
        path("M0,270 Q300,245 600,270 L600,400 L0,400 Z", "#f2d49b") +
        path("M330,210 L470,210 L445,238 L355,238 Z", "#8b5a2b") +
        rect(398, 60, 6, 152, "#5c3d2e") +
        path("M404,66 L404,200 L480,200 Z", "#ffffff", 'stroke="#ddd" stroke-width="2"') +
        text(432, 186, "7", 52, "#1d3557") +
        path("M395,80 L395,200 L338,200 Z", "#f1f1f1") +
        line(150, 380, 185, 250, "#6b4423", 5) +
        path("M100,262 Q185,195 270,262 Z", "#e63946") +
        path("M142,262 Q185,195 185,262 Z", "#ffffff") + path("M185,262 Q185,195 228,262 Z", "#ffffff", 'opacity="0"') +
        path("M185,195 Q214,210 228,262 L200,262 Q196,215 185,195 Z", "#ffffff") +
        ellipse(470, 335, 30, 18, "#e63946") +
        line(446, 330, 428, 312, "#e63946", 5) + line(494, 330, 512, 312, "#e63946", 5) +
        circle(424, 308, 9, "#e63946") + circle(516, 308, 9, "#e63946") +
        [0, 1, 2].map((i) => line(450 + i * 10, 348, 440 + i * 10, 362, "#c1121f", 3) + line(480 + i * 10, 348, 490 + i * 10, 362, "#c1121f", 3)).join("") +
        circle(462, 326, 4, "#111") + circle(478, 326, 4, "#111")
    ),
    questions: [
      { question: "What number was on the boat's sail?", options: ["3", "7", "9", "11"], correctIndex: 1 },
      { question: "Which animal was on the sand?", options: ["Crab", "Turtle", "Starfish", "Seagull"], correctIndex: 0 }
    ]
  },
  {
    id: "living-room",
    title: "Living room",
    svg: svg(
      rect(0, 0, W, H, "#e8e3f5") +
        rect(0, 300, W, 100, "#b08968") +
        circle(470, 100, 58, "#ffffff", 'stroke="#333" stroke-width="7"') +
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
          const a = (i * Math.PI) / 6;
          return line(470 + 46 * Math.sin(a), 100 - 46 * Math.cos(a), 470 + 52 * Math.sin(a), 100 - 52 * Math.cos(a), "#333", 3);
        }).join("") +
        line(470, 100, 470, 56, "#333", 4) + line(470, 100, 502, 100, "#111", 7) + circle(470, 100, 5, "#111") +
        rect(40, 190, 300, 14, "#6b4423") +
        book(58, 90, "#e63946", 190) + book(92, 110, "#1d6fe0", 190) + book(126, 80, "#2a9d4b", 190) +
        book(160, 100, "#f4a100", 190) + book(194, 95, "#7b3fa0", 190) +
        path("M250,190 L270,150 L290,190 Z", "#8d99ae") +
        ellipse(160, 350, 150, 30, "#c9184a", 'opacity="0.85"') +
        ellipse(420, 340, 42, 30, "#f28c28") + circle(448, 300, 24, "#f28c28") +
        path("M432,284 L436,262 L448,280 Z", "#f28c28") + path("M452,280 L462,262 L466,286 Z", "#f28c28") +
        circle(441, 298, 3.5, "#111") + circle(456, 298, 3.5, "#111") +
        path("M380,350 Q350,330 362,300", "none", 'stroke="#f28c28" stroke-width="9" stroke-linecap="round"')
    ),
    questions: [
      { question: "What time did the clock show?", options: ["12:00", "3:00", "6:00", "9:00"], correctIndex: 1 },
      { question: "How many books were on the shelf?", options: ["3", "4", "5", "6"], correctIndex: 2 }
    ]
  },
  {
    id: "farm-barn",
    title: "On the farm",
    svg: svg(
      rect(0, 0, W, H, "#aee0ff") +
        path("M0,230 Q150,200 300,225 T600,215 L600,400 L0,400 Z", "#7cc242") +
        rect(40, 120, 170, 140, "#2f6fd6") +
        path("M25,125 L125,55 L225,125 Z", "#1f4fa3") +
        rect(95, 180, 60, 80, "#ffffff") +
        line(95, 180, 155, 260, "#2f6fd6", 6) + line(155, 180, 95, 260, "#2f6fd6", 6) +
        rect(105, 135, 40, 30, "#ffffff") +
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => rect(250 + i * 45, 250, 8, 50, "#f1e3c8")).join("") +
        rect(245, 262, 330, 7, "#f1e3c8") + rect(245, 284, 330, 7, "#f1e3c8") +
        sheep(300, 325) + sheep(420, 345) + sheep(510, 300)
    ),
    questions: [
      { question: "How many sheep were in the field?", options: ["2", "3", "4", "5"], correctIndex: 1 },
      { question: "What color was the barn?", options: ["Red", "Blue", "Yellow", "Green"], correctIndex: 1 }
    ]
  },
  {
    id: "shape-grid",
    title: "Shape grid",
    svg: svg(
      rect(0, 0, W, H, "#f7f7fb") +
        rect(150, 50, 300, 300, "#ffffff", 'stroke="#d0d0e0" stroke-width="3" rx="12"') +
        line(250, 55, 250, 345, "#e0e0ea", 3) + line(350, 55, 350, 345, "#e0e0ea", 3) +
        line(155, 150, 445, 150, "#e0e0ea", 3) + line(155, 250, 445, 250, "#e0e0ea", 3) +
        shape("circle", 200, 100, "#e63946") + shape("triangle", 300, 100, "#1d6fe0") + shape("square", 400, 100, "#2a9d4b") +
        shape("triangle", 200, 200, "#f28c28") + shape("star", 300, 200, "#7b3fa0") + shape("circle", 400, 200, "#1d6fe0") +
        shape("square", 200, 300, "#f4c20d") + shape("circle", 300, 300, "#2a9d4b") + shape("triangle", 400, 300, "#e63946")
    ),
    questions: [
      { question: "Which shape was in the center of the grid?", options: ["Circle", "Triangle", "Star", "Square"], correctIndex: 2 },
      { question: "How many triangles were in the grid?", options: ["2", "3", "4", "5"], correctIndex: 1 }
    ]
  },
  {
    id: "mountain-kite",
    title: "Kite over the mountains",
    svg: svg(
      rect(0, 0, W, H, "url(#dusk)") +
        path("M-20,330 L130,150 L280,330 Z", "#6c757d") +
        path("M180,330 L350,90 L520,330 Z", "#495057") +
        path("M308,150 L350,90 L392,150 L372,140 L350,158 L330,140 Z", "#ffffff") +
        path("M420,330 L540,190 L660,330 Z", "#6c757d") +
        rect(0, 320, W, 80, "#52b788") +
        path("M150,110 L185,70 L220,110 L185,160 Z", "#8e44ad") +
        line(150, 110, 220, 110, "#5b2c6f", 2) + line(185, 70, 185, 160, "#5b2c6f", 2) +
        path("M185,160 Q170,200 195,230 Q215,260 190,300", "none", 'stroke="#333" stroke-width="2"') +
        path("M176,196 l10,-6 l2,12 z M196,236 l10,-6 l2,12 z M186,272 l10,-6 l2,12 z", "#8e44ad") +
        [[330, 50], [370, 70], [420, 40], [470, 75], [520, 55]]
          .map(([x, y]) => `<path d="M${x - 14},${y - 6} Q${x - 7},${y - 12} ${x},${y} Q${x + 7},${y - 12} ${x + 14},${y - 6}" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>`)
          .join(""),
      vgrad("dusk", "#ffd6a5", "#fdffb6")
    ),
    questions: [
      { question: "What color was the kite?", options: ["Orange", "Purple", "Blue", "Pink"], correctIndex: 1 },
      { question: "How many birds were flying?", options: ["3", "4", "5", "6"], correctIndex: 2 }
    ]
  },
  {
    id: "aquarium",
    title: "Aquarium",
    svg: svg(
      rect(0, 0, W, H, "url(#water)") +
        path("M0,340 Q150,320 300,338 T600,330 L600,400 L0,400 Z", "#e9c46a") +
        path("M70,340 Q55,290 75,250 Q95,210 80,170", "none", 'stroke="#2d6a4f" stroke-width="10" stroke-linecap="round"') +
        path("M530,340 Q545,300 528,260 Q512,225 530,195", "none", 'stroke="#40916c" stroke-width="10" stroke-linecap="round"') +
        rect(250, 290, 110, 60, "#8b5a2b", 'rx="6"') + path("M250,300 Q305,250 360,300 Z", "#a0692f") +
        rect(250, 296, 110, 8, "#f4c20d") + rect(296, 306, 18, 20, "#f4c20d", 'rx="3"') +
        circle(275, 292, 7, "#ffd700") + circle(292, 286, 7, "#ffd700") + circle(330, 288, 7, "#ffd700") +
        fish(160, 110, "#f28c28", true, "#ffffff") +
        fish(420, 90, "#f4d35e", false) +
        fish(440, 220, "#3a86ff", true) +
        fish(170, 240, "#ff70a6", false) +
        [[300, 180, 6], [310, 150, 4], [296, 120, 5], [520, 150, 5], [515, 120, 3]]
          .map(([x, y, r]) => circle(x, y, r, "none", 'stroke="#ffffff" stroke-width="2" opacity="0.8"'))
          .join(""),
      vgrad("water", "#48cae4", "#0077b6")
    ),
    questions: [
      { question: "How many fish were in the tank?", options: ["3", "4", "5", "6"], correctIndex: 1 },
      { question: "What was at the bottom of the tank?", options: ["Treasure chest", "Anchor", "Shipwreck", "Diver"], correctIndex: 0 }
    ]
  },
  {
    id: "house-mailbox",
    title: "A house on the street",
    svg: svg(
      rect(0, 0, W, H, "#cdeffd") +
        rect(0, 320, W, 80, "#80b918") +
        rect(360, 60, 34, 70, "#8d5b4c") +
        circle(385, 45, 14, "#dddddd") + circle(398, 28, 17, "#e8e8e8") + circle(415, 10, 19, "#f2f2f2") +
        rect(150, 170, 300, 160, "#f1faee") +
        path("M130,175 L300,70 L470,175 Z", "#bc4749") +
        rect(275, 240, 52, 90, "#ffd000", 'rx="4"') + circle(316, 290, 4, "#7a5c00") +
        [[180, 195], [370, 195], [180, 265], [370, 265]]
          .map(([x, y]) => rect(x, y, 50, 42, "#a2d2ff", 'stroke="#ffffff" stroke-width="4"') + line(x + 25, y, x + 25, y + 42, "#ffffff", 3))
          .join("") +
        rect(513, 270, 8, 60, "#6b4423") +
        rect(488, 232, 58, 42, "#264653", 'rx="10"') +
        text(517, 263, "25", 24, "#ffffff")
    ),
    questions: [
      { question: "What color was the front door?", options: ["Yellow", "Red", "Green", "Blue"], correctIndex: 0 },
      { question: "What number was on the mailbox?", options: ["15", "25", "52", "35"], correctIndex: 1 }
    ]
  },
  {
    id: "birthday-cake",
    title: "Birthday party",
    svg: svg(
      rect(0, 0, W, H, "#ffe5ec") +
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => path(`M${i * 80},0 L${i * 80 + 80},0 L${i * 80 + 40},40 Z`, i % 2 ? "#ffafcc" : "#a2d2ff")).join("") +
        rect(0, 300, W, 100, "#cdb4db") +
        ellipse(300, 300, 150, 18, "#ffffff") +
        rect(190, 200, 220, 95, "#9c6644", 'rx="12"') +
        rect(190, 200, 220, 28, "#ffffff", 'rx="12"') +
        path("M190,220 Q205,245 220,220 Q235,245 250,220 Q265,245 280,220 Q295,245 310,220 Q325,245 340,220 Q355,245 370,220 Q385,245 400,220 L410,210 L190,210 Z", "#ffffff") +
        [220, 260, 300, 340, 380].map((x) => rect(x - 5, 150, 10, 50, "#3a86ff", 'rx="3"') + ellipse(x, 138, 7, 12, "#ffb703") + ellipse(x, 141, 3, 6, "#fb8500")).join("") +
        gift(40, 230, 90, 70, "#e63946", "#ffd166") +
        gift(470, 250, 80, 50, "#2a9d8f", "#ffffff")
    ),
    questions: [
      { question: "How many candles were on the cake?", options: ["4", "5", "6", "7"], correctIndex: 1 },
      { question: "How many presents were next to the cake?", options: ["1", "2", "3", "4"], correctIndex: 1 }
    ]
  }
];

export function sceneDataUri(scene: Scene) {
  return `data:image/svg+xml;base64,${Buffer.from(scene.svg).toString("base64")}`;
}

/** Picks `count` distinct random scenes, one random question from each. */
export function pickRounds(count: number) {
  const pool = [...scenes];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map((scene) => {
    const q = scene.questions[Math.floor(Math.random() * scene.questions.length)];
    return { sceneId: scene.id, photo: sceneDataUri(scene), question: q.question, options: q.options, correctIndex: q.correctIndex };
  });
}

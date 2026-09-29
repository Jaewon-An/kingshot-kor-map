/**
 * KSMapper — Core Shared Module (Kingshot)
 * Loaded by index.html, mobile.html, admin.html
 * Contains all shared constants, drawing, building logic, cloud share, optimizer, etc.
 */

// ── Active game id (Kingshot only) ──
const _activeGame = 'kingshot';
function getActiveGame() { return _activeGame; }

// ── Global references (set by each HTML file's init) ──
var canvas, ctx, wrap;

// ── Post-draw hooks (each HTML can push callbacks) ──
let _postDrawHooks = [];
// ── Show resource nodes toggle (Map tab checkbox) ──
let _showResourceNodes = true;
// ── Allow placing buildings over terrain + canonical resource nodes ──
let _allowBuildOverTerrain = false;

// ─────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────
const GRID_SIZE = 1200;
const CELL = 32;

const BUILDING_DEFS = {
  city:     { label:'City',          size:2, territory:0,  defaultColor:'#4a9edd' },
  beartrap: { label:'Bear Trap',     size:3, territory:0,  defaultColor:'#c0392b' },
  banner:   { label:'Banner',        size:1, territory:7,  defaultColor:'#aaaaaa' },
  resource: { label:'Resource Node', size:2, territory:0,  defaultColor:'#27ae60' },
  bread:    { label:'Bread',         size:2, territory:0,  defaultColor:'#FFB300' },
  woodmill: { label:'Wood',          size:2, territory:0,  defaultColor:'#66BB6A' },
  quarry:   { label:'Stone',         size:2, territory:0,  defaultColor:'#B0BEC5' },
  ironmine: { label:'Iron',          size:2, territory:0,  defaultColor:'#42A5F5' },
  hq:       { label:'Alliance HQ',   size:3, territory:15, defaultColor:'#8e44ad' },
  obs1:     { label:'Obstacle',      size:1, territory:0,  defaultColor:'#222222' },
  obs2:     { label:'Obstacle',      size:2, territory:0,  defaultColor:'#222222' },
  obs3:     { label:'Obstacle',      size:3, territory:0,  defaultColor:'#222222' },
};
const RESOURCE_SUBTYPES = ['bread','woodmill','quarry','ironmine'];
const RES_SUBTYPE_LABELS_KINGSHOT = { bread:'Bread', woodmill:'Wood', quarry:'Stone', ironmine:'Iron' };
const RES_SUBTYPE_LABELS = RES_SUBTYPE_LABELS_KINGSHOT;

// ── Per-game display label overrides ──
// Optional. Keys are building type ids (matches BUILDING_DEFS keys); values are
// the display string to use for that game. Missing keys fall through to
// BUILDING_DEFS[type].label / RES_SUBTYPE_LABELS[type].
const BUILDING_LABEL_OVERRIDES_KINGSHOT = {};
const BUILDING_LABEL_OVERRIDES = BUILDING_LABEL_OVERRIDES_KINGSHOT;

// ── Per-game default color overrides ──
const BUILDING_COLOR_OVERRIDES_KINGSHOT = {};
const BUILDING_COLOR_OVERRIDES = BUILDING_COLOR_OVERRIDES_KINGSHOT;

function defaultColorOf(type) {
  return BUILDING_COLOR_OVERRIDES[type] || (BUILDING_DEFS[type] && BUILDING_DEFS[type].defaultColor) || '#4a9edd';
}

function labelOf(type) {
  if (!type) return '';
  if (BUILDING_LABEL_OVERRIDES[type]) return BUILDING_LABEL_OVERRIDES[type];
  if (RES_SUBTYPE_LABELS[type])      return RES_SUBTYPE_LABELS[type];
  return (BUILDING_DEFS[type] && BUILDING_DEFS[type].label) || type;
}

// ── Korean display names (display-only; stored data/keys stay English) ──
const KO_NAMES = {
  // building types / default labels
  'City':'도시', 'Bear Trap':'곰 함정', 'Banner':'깃발', 'Resource Node':'자원지',
  'Alliance HQ':'연맹 본부', 'HQ':'본부', 'Obstacle':'장애물', 'Building':'건물',
  'Bread':'빵', 'Wood':'목재', 'Stone':'석재', 'Iron':'철광',
  // permanent structure categories (filter keys)
  'Fortress':'요새', 'Sanctuary':'성소',
  'Construction Outpost':'건설 전초기지', 'Defense Outpost':'방어 전초기지',
  'Research Outpost':'연구 전초기지', 'Resource Production Outpost':'자원 생산 전초기지',
  'Gathering Outpost':'채집 전초기지', 'Attack Outpost':'공격 전초기지',
  'Training Outpost':'훈련 전초기지', 'Frontier Lodge':'개척자 오두막',
  // permanent structure label prefixes (Kingshot)
  "Builder's Guild":'건설', 'Armory':'방어', "Scholar's":'연구', 'Arsenal':'공격',
  'Forager':'채집', 'Harvest':'생산', 'Drill Camp':'훈련', 'Frontier':'개척',
  // castle
  "King's Castle":'왕성', 'S Turret':'남쪽 포탑', 'N Turret':'북쪽 포탑', 'W Turret':'서쪽 포탑', 'E Turret':'동쪽 포탑',
  // zones
  'Forbidden':'금지 구역', 'Ruins':'폐허', 'Fertile':'비옥한 땅', 'Plains':'평원', 'Badlands':'황무지',
  // facility bonus stats
  'Construction Speed':'건설 속도', 'Gathering Speed':'채집 속도', 'Resource Production':'자원 생산량',
  'Research Speed':'연구 속도', 'Troop Attack':'부대 공격력', 'Training Speed':'훈련 속도',
  'Troop Defense':'부대 방어력', 'March Speed':'행군 속도',
  // misc
  '(Unlabeled)':'(이름 없음)',
};
function koName(s) {
  if (s == null) return s;
  const str = String(s);
  if (KO_NAMES[str]) return KO_NAMES[str];
  const m = /^(.*\S)\s+(\d+)$/.exec(str);
  if (m && KO_NAMES[m[1]]) return KO_NAMES[m[1]] + ' ' + m[2];
  return str;
}

// ─────────────────────────────────────
// ZONES
// ─────────────────────────────────────
// Each zone is an axis-aligned rectangle in grid coords [x1,y1,x2,y2] (inclusive)
const ZONES_KINGSHOT = {
  forbidden: { x1:586, y1:586, x2:613, y2:613, fill:'rgba(74,0,16,0.88)',   stroke:'rgba(120,0,25,0.6)'  },
  ruins:     { x1:552, y1:552, x2:647, y2:647, fill:'rgba(90,50,20,0.82)',   stroke:'rgba(140,80,30,0.6)' },
  fertile:   { x1:450, y1:450, x2:749, y2:749, fill:'rgba(18,52,18,0.82)',   stroke:'rgba(30,80,25,0.5)'  },
  plains:    { x1:300, y1:300, x2:899, y2:899, fill:'rgba(32,72,26,0.75)',   stroke:'rgba(50,100,40,0.4)' },
  badlands:  { x1:0,   y1:0,   x2:1199,y2:1199,fill:'rgba(45,85,35,0.68)',   stroke:null                  },
};
const ZONES = ZONES_KINGSHOT;

function zoneCorners(x1, y1, x2, y2) {
  return [
    gridToIso(x1, y1),
    gridToIso(x2, y1),
    gridToIso(x2, y2),
    gridToIso(x1, y2),
  ].map(p => isoToScreen(p.ix, p.iy));
}

// King's exclusion zone — nothing can be built here, ever
const KING_ZONE = { x1: 594, y1: 594, x2: 606, y2: 606 };

// ─────────────────────────────────────
// PERMANENT MAP BUILDINGS
// ─────────────────────────────────────
// size:  building footprint
// fzone: concentric forbidden zone side length (banners/HQ can't place or own territory here)
// color: display color
const PERMANENT_BUILDINGS_KINGSHOT = [
  // ── Fortresses (6×6, 60×60 forbidden, cities allowed) ──
  { category:'Fortress', label:'Fortress 1',  gx:597, gy:800, size:6, fzone:60, color:'#922b21', cityExempt:true },
  { category:'Fortress', label:'Fortress 2',  gx:400, gy:597, size:6, fzone:60, color:'#922b21', cityExempt:true },
  { category:'Fortress', label:'Fortress 3',  gx:597, gy:400, size:6, fzone:60, color:'#922b21', cityExempt:true },
  { category:'Fortress', label:'Fortress 4',  gx:800, gy:597, size:6, fzone:60, color:'#922b21', cityExempt:true },
  // ── Sanctuaries (6×6, 60×60 forbidden, cities allowed) ─
  { category:'Sanctuary', label:'Sanctuary 1',  gx:237, gy:828, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 2',  gx:237, gy:606, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 3',  gx:237, gy:348, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 4',  gx:366, gy:237, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 5',  gx:588, gy:237, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 6',  gx:846, gy:237, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 7',  gx:957, gy:348, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 8',  gx:957, gy:606, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 9',  gx:957, gy:828, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 10', gx:846, gy:957, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 11', gx:606, gy:957, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  { category:'Sanctuary', label:'Sanctuary 12', gx:366, gy:957, size:6, fzone:60, color:'#6c3483', cityExempt:true },
  // ── Builder's Guild (3×3, 15×15 forbidden) ──────────
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:1068, gy:138,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:537,  gy:138,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:138,  gy:138,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:138,  gy:666,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:138,  gy:1038, size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:666,  gy:1068, size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:1068, gy:567,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 1", gx:1068, gy:1068, size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 3", gx:486,  gy:327,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 3", gx:768,  gy:867,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 3", gx:867,  gy:567,  size:3, fzone:15, color:'#a04000' },
  { category:'Construction Outpost', label:"Builder's Guild 3", gx:327,  gy:666,  size:3, fzone:15, color:'#a04000' },
  // ── Armory (3×3, 15×15 forbidden) ───────────────────
  { category:'Defense Outpost', label:'Armory 2', gx:666,  gy:138,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 2', gx:438,  gy:267,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 2', gx:138,  gy:537,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 2', gx:237,  gy:768,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 2', gx:537,  gy:1038, size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 2', gx:738,  gy:957,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 2', gx:1068, gy:666,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 2', gx:957,  gy:438,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 4', gx:816,  gy:717,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 4', gx:387,  gy:717,  size:3, fzone:15, color:'#9a7d0a' },
  { category:'Defense Outpost', label:'Armory 4', gx:588,  gy:327,  size:3, fzone:15, color:'#9a7d0a' },
  // ── Scholar's Tower (3×3, 15×15 forbidden) ──────────
  { category:'Research Outpost', label:"Scholar's 1", gx:957, gy:237,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 1", gx:666, gy:267,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 1", gx:237, gy:237,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 1", gx:267, gy:537,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 1", gx:237, gy:957,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 1", gx:537, gy:936,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 1", gx:936, gy:537,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 1", gx:957, gy:957,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 3", gx:867, gy:327,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 3", gx:327, gy:327,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 3", gx:327, gy:867,  size:3, fzone:15, color:'#1a5276' },
  { category:'Research Outpost', label:"Scholar's 3", gx:867, gy:867,  size:3, fzone:15, color:'#1a5276' },
  // ── Arsenal (3×3, 15×15 forbidden) ──────────────────
  { category:'Attack Outpost', label:'Arsenal 2', gx:867,  gy:138,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 2', gx:366,  gy:138,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 2', gx:138,  gy:438,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 2', gx:138,  gy:867,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 2', gx:438,  gy:1068, size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 2', gx:1068, gy:327,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 2', gx:1068, gy:867,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 2', gx:867,  gy:1068, size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 4', gx:816,  gy:486,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 4', gx:387,  gy:486,  size:3, fzone:15, color:'#880e4f' },
  { category:'Attack Outpost', label:'Arsenal 4', gx:588,  gy:867,  size:3, fzone:15, color:'#880e4f' },
  // ── Forager Grove (3×3, 15×15 forbidden) ────────────
  { category:'Gathering Outpost', label:'Forager 1', gx:957,  gy:138,  size:3, fzone:15, color:'#1e8449' },
  { category:'Gathering Outpost', label:'Forager 1', gx:537,  gy:87,   size:3, fzone:15, color:'#1e8449' },
  { category:'Gathering Outpost', label:'Forager 1', gx:138,  gy:237,  size:3, fzone:15, color:'#1e8449' },
  { category:'Gathering Outpost', label:'Forager 1', gx:87,   gy:666,  size:3, fzone:15, color:'#1e8449' },
  { category:'Gathering Outpost', label:'Forager 1', gx:267,  gy:1068, size:3, fzone:15, color:'#1e8449' },
  { category:'Gathering Outpost', label:'Forager 1', gx:636,  gy:1137, size:3, fzone:15, color:'#1e8449' },
  { category:'Gathering Outpost', label:'Forager 1', gx:1137, gy:567,  size:3, fzone:15, color:'#1e8449' },
  { category:'Gathering Outpost', label:'Forager 1', gx:1068, gy:936,  size:3, fzone:15, color:'#1e8449' },
  // ── Harvest Altar (3×3, 15×15 forbidden) ────────────
  { category:'Resource Production Outpost', label:'Harvest 1', gx:1068, gy:237,  size:3, fzone:15, color:'#117a65' },
  { category:'Resource Production Outpost', label:'Harvest 1', gx:768,  gy:138,  size:3, fzone:15, color:'#117a65' },
  { category:'Resource Production Outpost', label:'Harvest 1', gx:237,  gy:138,  size:3, fzone:15, color:'#117a65' },
  { category:'Resource Production Outpost', label:'Harvest 1', gx:138,  gy:327,  size:3, fzone:15, color:'#117a65' },
  { category:'Resource Production Outpost', label:'Harvest 1', gx:138,  gy:957,  size:3, fzone:15, color:'#117a65' },
  { category:'Resource Production Outpost', label:'Harvest 1', gx:327,  gy:1038, size:3, fzone:15, color:'#117a65' },
  { category:'Resource Production Outpost', label:'Harvest 1', gx:1068, gy:747,  size:3, fzone:15, color:'#117a65' },
  { category:'Resource Production Outpost', label:'Harvest 1', gx:957,  gy:1068, size:3, fzone:15, color:'#117a65' },
  // ── Drill Camp (3×3, 15×15 forbidden) ───────────────
  { category:'Training Outpost', label:'Drill Camp 2', gx:237,  gy:486,  size:3, fzone:15, color:'#5d6d7e' },
  { category:'Training Outpost', label:'Drill Camp 2', gx:138,  gy:747,  size:3, fzone:15, color:'#5d6d7e' },
  { category:'Training Outpost', label:'Drill Camp 2', gx:486,  gy:957,  size:3, fzone:15, color:'#5d6d7e' },
  { category:'Training Outpost', label:'Drill Camp 2', gx:768,  gy:1038, size:3, fzone:15, color:'#5d6d7e' },
  { category:'Training Outpost', label:'Drill Camp 2', gx:957,  gy:747,  size:3, fzone:15, color:'#5d6d7e' },
  { category:'Training Outpost', label:'Drill Camp 2', gx:1068, gy:486,  size:3, fzone:15, color:'#5d6d7e' },
  { category:'Training Outpost', label:'Drill Camp 2', gx:486,  gy:138,  size:3, fzone:15, color:'#5d6d7e' },
  { category:'Training Outpost', label:'Drill Camp 2', gx:768,  gy:237,  size:3, fzone:15, color:'#5d6d7e' },
  // ── Frontier Lodge (3×3, 15×15 forbidden) ───────────
  { category:'Frontier Lodge', label:'Frontier 3', gx:768, gy:327, size:3, fzone:15, color:'#6e2c0c' },
  { category:'Frontier Lodge', label:'Frontier 3', gx:327, gy:567, size:3, fzone:15, color:'#6e2c0c' },
  { category:'Frontier Lodge', label:'Frontier 3', gx:486, gy:867, size:3, fzone:15, color:'#6e2c0c' },
  { category:'Frontier Lodge', label:'Frontier 3', gx:867, gy:666, size:3, fzone:15, color:'#6e2c0c' },
];

const PERMANENT_BUILDINGS = PERMANENT_BUILDINGS_KINGSHOT;

// ─────────────────────────────────────
// TERRAIN: LAKES & MOUNTAINS (static)
// ─────────────────────────────────────
// Compressed 1200×1200 bitmap (2 bits/cell: 0=empty, 1=mountain, 2=lake).
// Game mask values 2+3 both = lake (inner/edge water cells).
const _TERRAIN_B64_KINGSHOT = 'eNrsvU2O7DyOqG0HoInH9h4SXoVRwxoJDakHvYK7jOgXqMkZf3fuPsAF3F7lF/7XD0mRspx5qroD6K73ZGbY0iOKIimKqqr//fxP/rxf/xr9GJvHXzFN/yqs5udZzf8irKa5eX44/pfV/0BWr/9lxfz0uYr3zVZ079/Nj3ezyFLcj6/HpeX986zGHxXtUaDovoVVR6qafxpW3/EZ7Po/Wj1qGU15GuAXj9XQFYYC06j0xsp08ArW/yQrrrrc+1DuA9M43mMfZfV+dkmPWE0/wGosxoo5meoyrOa/qVvTD2E1UKyqr/O/sJcPn1+YVBe5Slp3WdRiVv+Wo8HUKVIIq2rXV4q1BMDds6oQK2Njavz1yWFlMlhtT1m/ib29ZQ5djU/tJKuJuZ5erIxIXbclWG1d3L6p7micm6yaLFa6zmztbVa59mgBVlwP5LJrVlYmd3hl+mp/69ZFZPqdKnlICzxq7i3PNrdEFm9/YgxabBWrp79LWC3D/fni3kX4nWdTYluOvwwtb8D+ur0JDGR1Lc2AqK8zyKqpUQIxX76UmnoEq1MSA8vZIist1BWwMyKvAmJ1uV0D8OvF9Pn8/KsnnYe5KKtTyb57f1lN9n5y/5oaXd8oA9sKze2Jw8obsSpCdIfVgLOqZtc9uTQ8NO26IDJBs/J/CdrCrrDt/+14EhQr53tXQ8+vBqx0zMriwyZnBSwXG3HHPLjNyh2QvTOuVWsRSfSE35HNeUY8LhX2J54/V1NafETnGbQcAFtxm8lTT2o3EStgkopDWs5rjun77puE2tU2y7LzvOeBsqtjVoJFjjQ7lkHdWYkjFs5rjq68k00swQqapLmsBEaZo1AsGNW2IlbVN7MC1vhN6EYuK54Jt6q/ZWA2hQIvxJ+fhrayBYaE3TSOcZ6wAZLi/kAYbz5YbQoFZRWYPdffuYN6qqmHMkUErNryb39frHwGDc3qmEQdLL6ltl7H6g/6bJ26ZONgFZnIMCtsLpViNT0gMNzZGWlBt1OrVt9ZBRtMMCuFblo8yEqwKlhYVWIPGF8j6em8fzuslnmnwc7qUIKWf37+L2I1eKhvh0dmoKuK+x2YCr4Ej/1MW6SOieAuY7FgtNBbI1a6c1gNNxej96+eycqdL2fLtZSVb5KQrKZeNok+b41o7KvExirTinJYra1QaVbufFm+s7KjWXUYq9Zn5QyDs7p7QXseqwpj1dPN4k7BpRXBeICyesrAxwycD3YasX8wC2/83bsKcTccDbJZCcsbFYVsEVYNY7FkqPb5bx0unU4TT1barlbQ+m/yvcCqNK7+Rii4W3STXHUyE3i8hXa39RM7/GT6i7Y4K0dngKwSk2JftFIK0XTJsCLf8rbMZqETDUtAsXxWRjmsXgJWsdOcwYqdHJMO5aZYIVGg9cGf76LtgKII2q6qMh03wNMBbLyyJ/q4205p8UovdkOKlfeOxn3wRHGGNkWHKE5iyemQFsBlGaZZHV5NrLbCYd53/fJn6fTbd1DdB8//R8gqWmzQbrZcVglnwdQaZRWO9L6brAgmrcCPmVxT8mPxtEJWQrHfN3BS8SuNj7tVfFbbDLMdaxOKw6q5Hkynp7HCZTx7mJ0JE/dxZbVCiJM0NWoMBs1qK55P+H86mFX4j2jsd4NXodLCY7X8sbFMpbE9blAuqwVUW0FHMtisuIao/0Bvcfty3x6N/bbuQHa1s+yn37/8sc+KmCBxTsb1rpgV/HJTh6x2O0ULTQrfEPhqIpcAdW8ksYjwj1FWFmTljo9RsapNa2qHos1mFSqhLpPVoCSstIJZRRLm5NtFqmGPNwgTtZZXZLIKdv8d/jJWAm2tcAWOtB7zp19VJU5qWl9hmdY/18UFlPiqllUs7Z/XJ/InOtJ2SrFaBqKh9J+UFfvTZvtHTrPCN9KsEhpfJzqyCED/I6yyfUln+kQziWbFOdywKCKMqdr0aluA1VBsJ3PIZXXoK1jHc1idGm/T3oEyWQ1PcL18IAkz+TFJX5JidXQN1vELqzDr4ivgca4l2yMCvAur46VaueulfoBVaqNve33LdGktEB6A5+JiwS3iGppDn597PE5W238YnJXpXFZDXZ4VqNOsIC7GimJErLYdCIDV5+eGz+rtsLJdjissODwHGtfOO7mvT/xdxGrzx9sobrbEnncemzt5ziWU1TFMEas3LwJyj5UuzkrDrKpop2q8WAUt26AFD3Lz1D7msN+I8ZtZVfmsXO06wHMwTtRcrO4jr4qjnR1Wn5XPj3WyNnYkhzJtwjAz2ay8eaciudoYRWH+sWG63jrZptJzMGlOpZu0LZIxq8+c+EKH5mIVDj6XFcOA6oV9feBjoaVURyP6YRVtOq7it0zIL5RVPPthQzYdo+edoG0Zy/gNqatTKm88WDXQd1cTdGc0/2JkIXSZrOBHj2if2uKmGYPVKk+fSUKxErgOclarKCKsoB32TUPvHYvH5tB8pi7P6lDYX/NzrMh2r92FWR0rr7c0r6xOB8BGX+nZDrmllzyLNQdobjlW6a/AO+mHteIugO//IFmNfFYhnC3YTS3WOCudsfToTFYTycolMv7dViSrhsFqVXNhHEynbNTpt8vqzd8ruO2yeazeCKtXSOTAZ5EQxZkySLLSWLYZ6dNMfzXOsv3rdrWctYWdWBSjQVqhv/8KWb1nzLro9nVi5th029l1KavRi7yUqCxkatnEHbqkjX7N7Pc8U3aqowJIa8JYRL+ArGIbf+zdvc384kHLFrxcFMHeQPb9RPk/3KUFrx/hsjomOCiijmWe73uJWYl601d3WOkKUXOnCjTxAVEnB9JN3p6rb2RFWF3z6xlWoIR07vTTgAl9svKSt3uClWazovSV4zDiK9VnMTs1T2zwGJa+qrgOxNHaWNWTrBwVom1GsOD4O8sywChWsQK5ooHwUmU5WhZipZOszglgYNSxbDAT+pYFqGUZ9m4ORRdEzM4mngvTmbaBLOstvk7ksoqkw3Swe9rmsvKfpEhW556kDdaYU+5OMjPBahenMakXIRV5sGJYOrrDXPkSrKKRcH7wGbbjXxpgNfBZ7UnNiJlq6XpoEmtQMVmRwYKWy8q3FhFWq8ezu3wnK0JfrYsmatIvz0F1o7obO4wyp5NqnaoZRTwaYVX9/SoAYkK5AgYtZOW/ZNGLGKsjG7PcJ2kOo22Jv6kgKRssMKk2/trT90tam45Wg80Ym2bY4KFY4YXBvomVjWBggnkKgCW8Qddz3ZampdyVdWzJ7S0TYvSbHFZEmZX7rHrf/+w9MUIfoGB9h1r+9qj2qG2kmzFWSy8xJBireAHZRz2JLO2S2iN4emRXz8IHZLHqvb/9YrjG3Hjbzso1NywvmMmIdu6m9jLICCtJ5GLgsZpHmKu+XWF5Z+VM3SNzIzkMafdmD+fonVVQZGetqSdZm1vS+f08bjt3sZzT14/sF+azShshH1ZmZ7V0I6wq0ElrjpJ+wFpBttqD68/sRpuQlVZcVukcnLk59n1C73cXzCKsdtWqNsl7H5lh5T8ace91qihyM/7tYIWeGJj/Zp3UWqB0fIJVSp2BC9DcV8VtyToZWyG3PfrpZIWrzU30zgXcChUuqnYM8fWxL6+oFDBAHZ/VPJ+sTIJVy560jtjSZkKNi2VUY+39uwgrRS7LCVavNKsqOIjFzp2dSVYDxSqGd7ssj1WIy8VkNc0vnbYq95luIlaJ2ff9rNoEq2hH2tIxQF8vvBj91q54uawS3dxYOYUXQVbMJHjWDielH0yaFdc1HNKuYR22h8XqGmwoJYP94SRTkmmIQx2zOsdxTomSzIQ/5aASssJMOVkiFWcSJlOBh86t3HWt7u/5Q6Xjs5JYrV0cKuzErHT1CCu6f8Fj2osV4Cbk3w7nJtyznOIEK67jczyN0e7TPyJCAS/wp3Pj6q5dIU3ZdzZdc0ZblsUZqhgxK29t7jmgAFb+QeIRzDEJWWlLgOV7UjxWq0SE+UTmFiuujghZ+YbA+9cMzsy5B1iVuGspzQrspa6eZHWsceHEcfX9UCO5Sx9WwzOs0vrKFLn2zH1Ky2Y1AqyO+mPdG94/W6tfxXOwhFdqUz8qw0p3AmWHRditujpvLFHMu41GPmkyTAw0bcq9WFndz+dXCdPJ1YBYaNB4rJgv3npzKlzMt4jrjmUcn9RdJYuO6+S0594SAhoeUlZMxRkbFTgrvKSIEraMdFubO6z2NG6J7xm/pwArWnIkrKgElHc/YgVC+eVf5MpSpVsXm704K/MtrKZ5ouJ3LLOtvTXvkNZdl6Fe/5XJSiLxNKuZmrnbQldi3R3c/Ey4AhPimFynVHQRY5HpQMWY8Zpyqy7ahKtEKYjToLa1sG+MG0JjfQXcrCTkOexlta51I9GQlZUtMWrGOkpHJgdpVgODVdYpKdu54/DrW1hZn9Xxfr9GnIGDottwTkxjcX/GlKwAyRrcT9edcV3tZ02aG3dYmSM47rE6+uazAorPX57jLJvsd1h1KCvSAtsm7Q0fwR53sZyi7C5mXmAmvkKjutwhvqutw3vDpKwGx7Z20nM5K+XNSIB/b03nk/dOpFLX2MhZ9aE57+mrZDE0dS6BOsUKNxO+7rBas6cqESvjpgknLCV9uRHr8u5301ZAtEDFTvmRioOsGxErdFK+ezkrc51Kj25a9lpRDzErq8a1K9utQV3amRvsuR74f94CHvD2wmG/TsGcjXQDK4q0wIhJOUrvrNtyKTWoMwKX14SHKTZW05YfymC1EWgRVlC0YC96u4xS7daqlZTsQ1lNrwydhW0mBKpAQ6R3Vltkn8Xq8ouErM5d2kKs5v4OK2mEV6+35i45NEYRXxjqbaZgFQLxqCHIqpXlnqJmAsbKslhVfqFwjvluNlZWEZ3Xe3qnUSlzHjH4fValPv2c5BHtoDm/az3Th8NqqKfXyQrZwDf7FRjnMmlhtUzKb52xcZhm1btmrCvLu1UxhxZwjbjCvODu3OhENO1gdQTWo114xcJ1y+iGp+Z5k7SzJrqs3CuWAZ3tWJUDk5U/vXSNscKCglxXXZeUqmV0z50tN0QBs4LdCudrih2Xc35uoNxdD3tUyOUptyRlWb6De5BtuMBdGzAwK/JSCkwEnH2rjKI3Xe4cuuvdTR6rePGYEu4qaaIxusUpplT7dbu7zDl0m9X85bKKrbYvaXjN3essw0r7784K7FrBIoqN17kMbkqatHB5rLRMBK6e62S4AdZ8rBsK2KwMu54nyYq3w2NkInCp+SW6VEtZmY5nq7BZ8Wd4gZM9wh3ra8ou1WlVBiuWDRGMmi3AqoTVlot7qXqspGPIZeVnjBD+j8NKs/dU3Y8kdJNdXp1iVd1lRZshsHGx3SIp6s7QvZtvEcgaYbXIRIuvJLooq8A6HGSstH333zR/8VtN0I/KqVP2JKu5+slPSgOqUoNShlVT7ub6tjirjA/Lr972qmspq1/N9Ow8+2ZWPJHEfzvi6/X8C01WGkd0ZY6g15VYqK+V9Qlg2eYk6gW3HwcaTVbyNpsTGXkqjxWpjpOVXDpyytR5ntyEr3YTvotxsmqTs8U+wSp527GVseItkUJWXwErW7NY5c4lpA/JroUbcylW+i6rMf7lYXMdJ7yAKxnl/itxg3MhVr5fCJhmPFbk2QdHmW2q9mTVVxcr2r9JRx3mF25YHoeI7rFKusZlWW3+12Gfeqxueorv+YXnCu2zJ7qKW6avbPpQMUslzIRJ8Y5Zvdb2n5OTUTmlTrJqkrbUlDwSF4imkBXXaECKSYM3D66sbufpBvbz3KdZNSkLXPtF9doE2vy2AyIdGk0Oq9ujFMCe5oUVOVfTJ8oWVp9uPB6zW1kZeu9SX/rqNqv1ARebcV7LOXV5q/XFaqCrLBdkFWjpqOlqjf31N1id03p9wPWCTWiop0JntE0NsNKPsxqAUKBBL5VZWzlk6KwrNddntRm4NKsXardd2X35rKSDH155F33fSwfMqXZ30jE1MBg0K2CVV+sQ73XG13RCm1lrDpm5HZfVQLNKhLtB49J0lOBSqyvMSl+XZxh1J4SwPihq8mBR9zpsq4pNRj4rcHz977iS+ZUjCy4rqyTxArC1UZPx5HPUZuzSrExkoYMGUzBvncHowaBXQmfUEKv2W1il5rLPyuv3UX2qo1nhXl8vdyL9qZMb8umuPuaycnp1fWPG+n3m/oasQjh4wn24rLL67iiUTFfi6BzIauCxcr53/KepR6zfACvwomv086uJDoGw+t5CDvr7JWfVXmic8bUsf914rAZFtx5gRcxEaJXrTRYr0EF3l+uoxnxNTLM2/FGb8kHDTn5w69Su9aGvVDFW0R28/I9r4oeCHbaQWSSJthqta1acO/yYcsbceJiVBq6CNPElA7nRjPlveGE7q5JGKMKqJb2RA0B7scKY65RTk/Ce5ugvP3MqtuN5rsL8b90511KsAARIH2mD4Xru2jmjSlWrjiGMkMTalB2NrakfQIdMJlnBi2ss+Yn47/VbfRS/eYjV0jTF+LP02+3OyiJnLE2yXuEqarHks1mdg+60toE1j5DVQJz8unQAm9WyIHus0qoSHI4brM5Bv2bBtp+TV37CPT7RpR9zaoq1I/RtvcvfNh8g6O0tNWtN8xr0XhMVLLdLsSrc9nNul+ow6UvurhFdR4q+4fQsyKzutCdklc6tIsdgZLMydSlWlUXmwlCHrPQ9Vjpg9b5Vam9kz8Gwc23cNs1k1Tr/GqHck1NH5FZhO57ktXme3V0km8mKERyNBMEzVDR0olCjITaX1Sx2D7LlYnZcgciD1sljFPv+s5KxMqyNalLZnLecOREiOStRbHF23xVtD5q0nzwxL7Py2KxnbNNXpHVpHfi+x2qSsWoqnBXWH+dw+sTNanQjrzgrIzr6ZJVXmgnR5MRWk5DVS85qrRtgazr0hUjC+RWbXAFwVvqUVUY9LUqbTr9eElYO+MjRKs/K1uRXfK1WYypz1w0YK6162kc/NSxRyBmIgswUeIOzupZliS1z3HzFYgU1wbgS9/lrsHSJ6bw8RIPfPQxXAQK3LT9COFHmkVakXvcVEfSU0ACNb1RLsQp+sLM+7lKuwVyQD6s5wWqfFvAxB6yo2kixGjh3Ex4dh9RLHFOrqTgXIHH7EwblyWUHr/oKZKVLscpy57T/j830Bx4OiInUkN6fcFx+SMrloRfM//WWrODW1dpdxsA5SLG6ewPffgafw+rTUtmxMePddUkvJAcA/X9//fWKxc2Ff/CbUFaYri7CCnh4zEpLq27pk9WQPB9zrs2K2PDymwRWCCcdhnu5jMTFFVDXVlaaOxeHcyubGbaS+fARK4Wp6aFIpiBmpCD9WvWpNLCkd1Ya86x53elSoXY8lh9EY2Ej9jQcRiErpFVb+qQCukH1wbtMt2bTDg86p76Hi6bPCvEXzlVyIuMyDGUFsTqU65A8UXk19qhCKwhEXf1NHEa7WCl/FQpZ9dBIH6wOW8QyvQKElV4P9wSsetaGgxdPsCyj0FhINkyNKYiL1ed1k+8s+6y8yXRaK5031diF17FIglpyiY1yH/oZBsZGVstjpbskK4vuWlwq70Nt8qvLBnG/l/MVHbFqgBnt6NMob6O+PDg3erD4cPosDNzTrCCHz5AroocnuBTcnqOYDJ+trBpoqHZW/6auAThar0lW+srA8Vhdedk1FME7JsrG6qPxMH01NWw3FcKjoYIfByubYEUEfD5z8N+76306KJS3++QBq2PHwwasDsIDzMrXkcvqYImgkehDRUdblxXtBCyjT1Ssml/GYRWN9PgCFiyH1YrnKKhlMFbB3FmHbtlgaEux0qySWkuyEsbKgo55IO8eK96ujsNqFcA5xSr49KDlfwKd5vBX2Xs1/iANNcqKbPL1lKOHq4iwUnn3uXZO2JAVK7IQKYZT885zIFiiMKyHJ/ZNbcpuIA3s7IjDMTOnY53VHe3p0JZ/IVbedW4RK3g50TWTFeZFp0WsPefMy7clOCmM4+/qB1hhQSAWK8sPV+IScojIrdjFXgX442b0X01wG1ldsccTZkW72InzdFYlmsGvqvBuxvtXEVZXdek1gOO9HW0kVJgC/KK+c9zflGM1zmOJMM9whtX78O2a1UZLBO1usRrqgqwKmkPX1pY0YWLvChxToFkxYz1EGTtqIO6xOsMYL4IVI53WY0WqZ5oVa5tThTOel7zkE57yWc3oENuaEx22XBOJBs/p9RKlJYIbX7xIovyqAYKV/xIs1DhJzcm883JE9Cl0Qicmq9djrLDfzzLRKXH3G83qPWPxicT0MDVlzixeWYfY7u7UWp4hYSWdgKIrKRis+pzZX9FH2hdQimR1qUOsNAOHlRfuFKn7xVz03TRbA66guyLgrJIWOMXKGY4xdfkFwgrdmnVlxdnX4LByvjo2vW9yrUlCtBi+eyGrnTSbVXKZRW4+2lgNXXxG0Gazcv65BCMjVkml95Wl/wqyggdrk3cdl2QwICuPaJdmtejpmNXtj7/vvrMypB3Ji2EyWBkbcYdZwap2IFi93JNupS6T8b2DI7OlvmnOnEYf4mhOHFZIqAo7puv8YtnLuTq2Vtorwcoq2gZ57qMOVm4/vMWqFTk7g89qqF0/qshlMj4r/X2stqPYupMeJcc16YX2a86KIbBY6bqggcy59qpz1zZZSgnrgOvXI6zMrfujhy6rL/5ljMyYOid8Qi80t9dBVWUWKbFV9rH/bde33o1+YK+GWjDa6qc+Q53JarsmOp/VRyR3VobJipB+9jKnb89Hxmn+4qyunP4o+IRVDsB3mfhX6XRFlJZwimOsWPrqLLUIptMOCVaxgHHKEXTeM+4pLebSMbmsoF6lWF1H1DFWVYJV3GHOrVk2xYo3kYeaz+qsoL/KXkuZOQlfcXGg4ZhOCz7r7AvGqk3P++WrhquJmHqbwYphCk80q9mvtcNe7mNW26y0jJPsCv2zXDuMmEdovlAswuCBfycGkWQFN38C6imnr3owNhFzKGez4mG6w+iPXxXkssasXnH9Om+GwM0/K/VzOttF7ttPsrrOUEZ/+htSR/uOabfYDMDehn/tqoIEu4H7DP31YInBCtypwpcAV8DWjUVZwSFmfSxL72YpNEb2xFYCVtBfQ6aaPxqPWvoSVj25hP9dTQlWlML0/7LlRyW8GJCMlTS0MyFLLdDJd0OelNHdNLJYTZBgwwdtGaw08XsrNNrvGv0sKdlyoMfYFgVZuavl+ZWkZgvmGLRPIizZipuyzMtWFWUs10QYCnTOIOv5sCz832nOIgZe5YzqqyxWqmJvfgx1Diu4AhqiEk4rQSUssTjnrqVZVTdZqRX3u5FvFGnFZ1UJItbTywUC2q975IIybSfot62IVVxiYDur0ctZGVlFQ3ZCwuwJD76ZPspZyQMsoSx8/m+c5aykEQ/uquLd5zPirGYy44fDSmgU7Kym+fU4q0rGaht1QngSZ1uoK6Iyg1lbnsTHTORBduYwn5XMBPQzDT46GllPEhemTK/St3/s7Ee6zICGwj6+qWVpuysR58IrQnyI+KvCKS2JtKDxuSJuPcsCDS0bXTPWlEV2EzPcs+ht8Bv45Oo7ZhXeG/T4rTKkagpZnRA1zSoVAnH9bh/7R+L8PpuAlVvFXf1xrGzsHt5lNc2E2QOzOuywUys1Q/IunG9ltdXxq2WstruDWOEEkJVv9GLJNu/5gfidRPMrRxFoFffFKmZoyFb5rGj7/yhg+588VsNTPP3iAMA5VnP/zevy4Ov2WmLu76zsP2aWHf7YxDQpVnm74N63Vtz+pVqpmBTQ+cH+o5F36XFWFeNWI8Fj14mD21dMg3Kw/6//E1hNwVty0+YsaPEnlAzMyt5lZR/SV9PvpsRM3+buoltvswLUv/2vXtAlfqSArWU2xXr4rzf1+GZWrHmQHWTOogYHixVYfgTtkmaz4s9ZtRmKryJCao+ioB6ebeDwpbwty2rr0hOsIqP6RjjoYuX3u5ZP8Dusqhus0hOSy4o1m0yRoqBAV+Pou8F7yd9VPRvWslrJPfULBbRapi0oZKWlQLNNBe1aSumQnTNipBUNlsWt4YDZN5g9QxFW14W4ShQKVsAK7gg3XOp1gt+dFjf9Z7CqQlYs+3uwQEjIvSGz5rCilnKJ+vsJVmuTtmHtkosHyQp+gxsWJ5x8xZrSl17omfpqH8D7LrNftxFcHNpbrD5vcFmJWnyblXGz+cuFYozF3Ak3qGDruLNJ4XY3rUwpVlGw3fznC1R4W0zLyGgwqg1CrNz4GbiEJUXFNfpFrKis6ig51f6DKjcr3Pukm7mSTLHiKhomK75XCuZGBqyUK2nXUrW2f7jJaqhZbio7ho1KAXhFlUjIOFrO/mOG9eJ2iOEeK6gBtuL9DGwsxnTCLttlszJiVkZ8jzj5Qmjz7M4BNBYrb8IWZWX+4a0h8X3PEvWuGayqR1i9EFktymqo3bke7YvVMvWufojVF2ZQ65L6il709b2aDZpTNU4yx/nG3hE8kkVnCzo839VRfBIwXQRJoI1pljBWZoqVbIZxYw2ISfR1njpFLycZfPu/xPhibYRPoePvFIqcw6rN0LLTh9XvF+h7QHzKHPXAenjOkaBwR51SCWn/PmRFH8vDWc0v3/cwZIPuR6qOBQI/4RsU7qiYrFIrialxO91tDcrq8DkuVgEbkpVR2axMx2RVcVnxfVbgzqou+ZyPabNHXt7wWaPEvEury1B8TB3fsRYi4o5AWO6+42pGmhUinx/TfLcEz3plmMJUeayiizJUhbG68jVrabTlepVlLQs2nJdeM+NXLRWDP6yWBXBdFmhWsHghrCzKahlRg7AicbjPsbjlO1iyFrZBrhVMzN910u0TcH1mQw4GrLZMnVrLAVYamWgDc3FCT/d2QTMH7MbFeDLqFKvXHtD1p68RsPI+HZNVnlHWpZuiUqwGlFWVyvRshv8CWOkqj5Vbde5Ki9cdz7iSsep5S6OAVZWQq0b/3xf3GwnXrvVqHLpp8YW2FrTLCs9C8tWqqf025N4F+v5rbo6QxX1zfD0c5PyrRGaxr+ud3QM7MmuM6hBgto/2xQ7vULc/6qM+hcNKH7swt9xHfG2KWZFraBE3lsuKMg6N2ll54r/vwmQL12L14cYbcEile5oVd0OG6rM9WAVmYHWH1fibZtWIjGJdvvzFDVYrmlb0PZrV7LMKIkZCVsM3HFk535FmJf9dgpU/84NkzngnwP7ICR5Pdrn6qmAYYjdofBoBKyATUP0prMjaDlSNjLoAq/UCvrmiWf3452RF9XkopTe9BzV+K6Z5qKs/+qO/9cgj5r4urZhn3f3ZrIZvZbVX6HwBrN7z7585qir4tN+5Au+sepDV649n9dzMhLJMEVZ7dv0/Bav2CVZQJd1tQe3hBmj1z8AqOsRspe51JEGnmACrW1/9836i6ErMqhMag0uikMXWPmhP19T/pKyu1dENDwncmWFnZWpIC0EFVKz6J2Xl3F2vLkETstovZdhYeTMRKNkz/LOwom567bJZ7dKysXKTRM+M3kH9E7KqWKyE+uprY7WtbsaN1B++nu4eZjWVeQyxFrlq9rwbU7imf56x5KJee/LQLVcGKFXblGQ1F3kadV2hO8QHN8t1oY8jNltRW8Nlddin738uVuB0cKxV+nDn8eXtZrwT7yWTS7GfOMPgMCPGoqySR4dZl6yNQlbuYL04rEbsFsHt5qJAX52V/6aSdup7LqLQiO23ZImn/hYrZ0JeHuNRjfk9l2SVPt/M2oWkjpQntkTexVidm6efP95UC8IqU4ulSUw8VtmKAWqBc/71ZPW7SrKqYlZNQVYMDBxW49gXZOVEDA+9TRVjjYyPhdWe0vrKm0wFx503k9JGwWIRAEsVEJd4/2r47vC7OXRCL9YYgecq1P7ZEpMOeC/aiMdK6A6PdJ1b7gFq1keVYIUFJncBMXBqjKmxekUsVvvDp5t7XILiRl0JRfhhdaoSHQuIVWD3w5wQhFVPL5y5rpsWsdJVqcocy02gwE1dQ5JVlWT1/t0jE2H/qzG3zW5Rx3T9QLWzkvAC/eDPDw1wU9fFClQKy29bKMTj/nF4XtzJLbsXYLBuSZnkPsF6MVYn3OrDBDHBiqXCoekQXmZE3Tuax8pwWelOuPkiYXUICBK/MvdYsaNiCjQOvKsQGayadaKaEqx0BwSxaPMr+jGoZoM5eLHiZjEMcEZPcBAxYXCZJb1ZCVmhplSB8CTIKtiYl+9sn3SJPKyVlSINrk28RakTZfIskON8j+Qjclgta8whW8GIHYMjKm84FqkbuRcj6XCbZyrIaVBMVg7TgNWhyvqUxHv+gsRUxV26VeHhZt1XUXd3PbLUJdvEYTVLgIiiafiCnmAVXKWm781Kial9yR/E6v0Yq0HKykasNgl31q6czXhJWi0if8PFKmgB4ZhzI9pDl2a16itvR7T2oyjHsXTnOe4juwdYITaDY04EnSKEh33QxZKsNkxdFeyInqwm7zj69Zz9kVpVAk8jIwV5ApZIkFWJEP+2LV+jJ4rV8f/gI5IjzWoTyweT0+b5i6eESyxCZ0dS1hJ1nPQYNPMDrGaelJZIDteWGRgy1KWwe9TdLXRafwurN8xqcliZYi8buKxcgxQLeg914NWsrG4kQQf9BOKbcKB1MRCGOte9+PQBtn5aJivItQME2xeiDXA+q6BRv3rMP/ENdVfaMqojffpALzPJRyoWq8C1T19bTxkBYT+BtWxf7/3dh9EJDeksVnS4Lcd4BLZl7mdkE9WUIN3UAxbB06w0+c/vY0VVnpoIFe+qstGJMyS0JViZxMrCuCy70GfVFYkCDUTlKZqVq4/Ze2tQPwcrM4tZ/obHqtCZn7xKdUvihtu/kehZOmzQyg4ssFh5a3i+GWVkiww4ag13+yMYC+xK77o4qz7FijU+QfGrHFbvF3cDnMPql8zIP1pM6/gkK1ZdUluLVxVZZMmvxFZH+kqF2i9vT5+v5EB9lRJPXZcrJEA9xo0W1WMg+GHL33Oeoy2IKeWwMup7ii74rBpfMYUN+AZWbcbXrfqeQ7MOKx2lSy0XCChUDz/CKmMK3zlHoU5FpNjt2IZz6n3ndrmYoivA6tlDbFmslKsel+MtHZvVNtnm3l+HPuSKsOJ5REX0cc/zQnZIu5KxR9KPYrgy+9D0c7RmmwcP9z9RnQMrt9tF2gVgxVJ6O6uvi5V2X6KfmUMPVH3Bjj+Eh4R9VkYdwdeaP+X7IYyc6656rDzLI6wia7lxWIXXo+/q2ez6imd42MAWHLwCe/afhpX+79Ba3uJ4xvqr/lqV5uUoogFhRfl0UDT4qYOgxPKYm/Rr/gGz0nG64eRvuKsKDHEz1scnWNFFwv2s21xvKm6pZzN6rFiv4IQdycKcmfOjox1Bb3zOjoiCQMCoeoFhLzpVjJXIfOQFalIFB09tsXTonCAioyXFSnusXjmsgLHTmRJj77Na15c8VsAM8PJXvEFl7SJrVdjg9E6+32a1/m8mq/gzFq6yUo4VZaHoRHHGw15Zn/H+n8FK4zhYus7n/adVULvbHu/kO27l7wEQ9N27LAVM79grqnzxp3Jjt8yjhDkezFJnobmWrBvF2vzSwvSUaRMhG+mvSrsuA8rKibrmb315j4/ib2BgJkt44kVUBS7oDVZaCViZm6xsgpWu6RFh3MHeBJrWxcvf7loOnyr09WdZotiAuZasm6yGy/qAJWRTqbdY9eFhn+5SxaIDF8C77HEFyx4Noe+FupdtdTx8yRfrcLdRwirUoO8+vDurO1XxO5PV6SvZ4woWE7NqCi424b2qCneFfH3lBjTj90dc51fEajhZiQ027YW+7HEFi47VVklzUTOc/fNEaIX41UOa1dQE94x1l2E4iVltFx+5N005VqbL6usOK/DYRyowsv++RcM5KsHq3bwbX18NXeZ+7irD9mJl6sgid/4zr+DQPvYHK+ZlcpIQBWFfLGZzsICp3P1c5bOyKnjh+FvDYRP+6/aR3iPBw/1UQEUZrcHz3RzlYjbpeVdHsOQ6gTY3T1OQZGY8Vtn5DGePyayPOrDx58IVfjZMNYPVXKXiFHhS6XiTle5yZG5+rLw+FK50BmZKJ/wCAd+d1Tub1bgew+GYcnH7p6cqR0Hy7YaVxjQrYK/CF4hglX+/OKx6nNX714tiBSzdQ4ZTPfKWepgVpqJHoYLg1D2kWXmzzEYe81eRYA3vMJTPKv3nQgXBYTWtp02QABfsp1BB1pyAaUbFJQarv2RPPUPQredo+fOIyvqBd3mob+TsomeovZtHGA0u3AN1ORa1uQ0LMuDpqW9mNeHRHWKxV4RHcwi3Jlm9KFb4qLpa/FKwm8sjOo6Zt7sOaw3Lul4Wsl+nisGKFPUZ9MvnXYv32MItYjVmmWkGDTOhmwtX1aEkK1OIlVFb0k034qwkkiJcsY4MKJQVuryQrPwpgrCi+gXOjv2VtrtMmDhVW8Lqt4jV7gGHRNqTlU2yoq8y93y+gEeP7xiBI+6wOmvwdzfWqcBkmBKGbcRqe/mZm4iz4k0s6jjrwgqLI/fE8HzejM4eUVmC8B7FhGGrwxtM1h8cQd6atRRnJra9xayudRn1I7JKOIzbXJyvoo6GYHWZKcb6DhhDfDIDJO++z96JRFf7rPSJnbxTQttnZWpY2YSsOO3ODJD0VX6MEKuWMn7lk3cOWPusDhotGGqxojfdChcVYXXvBrh9tA9WXaCvPMlxDbgMd33OiHOwlD9fRy5TmUgzsak56Np0y/ANLFbpgNBAp3P8yI2gCys80BB4Fqv/NMasdl2n3aqLMasG0pSHhA0dvBwgU2ps/ilYubbVHr44Q7yRWNbROoD4PeF3KVbLTY4/wWqwmD2NsAIW0vPEM9a/Bl9VAFZDl2b1E3K1ns0JNa3FjkcvUw4QD6vo5WaXPvByDoDV+p8pVqEJYcrONgWuLm3EarCqgqNGCysg5nOlM5DrPchKI6wGWl9F5lbZk9BXKEiFTrBCWekm9AOBvfbz79vEatnE4zZ0kUxu2FraV579ocmrAYKuwicrV4wg99Bl9Y5ZvWTRuuoURdhijTmnPZJ2ZUXV3uHOtVR1ceOxaiijKqyJCG9JGB4rx/Q2XQEruwCrZHVx16mfaZc0ZAV7Gqn8iEN4Rx4rrpVN1SlifLuu8PgGwqqXsMqrJxlP9DIHrAFZ6mTT70IRsFbAlGmmXhKV8Fm9mY7GFUUdumx/EFjNgQOmlm09GO9mTtbaQDtWoTHlm4DcAq/jK1Lb2bn2hiwyuTyfqbn8bfvhvs0R+nA+WXkxlfs1+ujZayy71zGrm2lptCvhXq+RSiDZKH8DK+6KGJjm0RGj4f4xE/9e5hc3ItVPDcRKXleFfo/OzX1dWEUpx7c9pc5ROM5OfWJl222TyPNUWe+nZovUemhP3Ren/d9TrWdtDStlBY+m8ucDw7JSVdmyG5cYfhrjxNHt7SX7YLVJumPGJ1m9CFamk3nABUtJ+JtJU8zK65gs4u6x4k9vP4by0ZtD7XTadrEn+v2sPtLtWJtn8e0usEnY2vyYLhGri7ghwjKOCu6cBhGsQO3/DKtPR8M0tVbICpSYWBgVGUnyWX3eb9wcBIIViCWhrwS7Nr3v3Lzjy+u0hJXQJkJsQS8D42QV9t3yRChxvllgNfTUkG5XbHSCRbYMK29QQlYIJ5QVbWFL9rPpDWRgY4rFar7Nyila0MWigXwvQzVJWPXkpI2nXMtxBj7SqUnt7c0AcG11Cod0bMaBajKFWa3LMyotfLtWu3d5fhZ9o1j6AL1P0pl2is0qmG6immiccNGL1NiWM+cPy8K5N6mxHSt+cd4nOYpcuYFXRq9wUcEEq5Zru6+Hew8JmH71Hqs2rRTHXGeDem5hViPHEmAsbz6r19d2VLDeWCVky1aVdG+Yc8w0ySqrIOxQmNX7tbVjzYStWYdhH9hHT/Yqz6IPn9oF05Bk1R6z1EJrjEFZeQEDKpQvPKvM3hPBWPVMQ3+IrmBbqwKopO5QyHqs0XXZc54oVpSXAgwichgk1poYKy5rHeadJA0Q/A/O39hTP9gcVuTdub6zXh+sgJU7Ul/mJqutjkIZVmHrlivp68vC9FiNeaw0cHXByipeueN2erUqlJyVLckq+sOra3otRHVtk1Fnwfis1qas+irWsHE7B6QGioiVNyjJJdAGOgHbRfRYLZsoXFbE2g6xWlOIOKww5UkUNHm/mgvyzej00vTPuHYcVp/lYJx/38t7HYArfBBW9KBbJqtfTVWo6tw6duOMWDa2ds4hbvsV/VTyJmdnpKVV+ZhnSLc8BGNLsXrP/5F+1jY0Uz8XZSUgpPh2iWeQ/ACrwxRKpDkIa+rzd86zT0cUY7XpBIgVOOL6v37/6pmTKjuSklwURKkJc84Ep54HDBq4JWj+3/jqc9yQzU5LZREYHqsfre36VTFZWZUKxZCsUp2k4gwOK2Orn/y0XFbVHVaJ7Wsy1udEpsuwasvRQ1m54fRYk5sbrHRWctUdy7LUat4hmtv102MymBZFWHkWfmZy1Q0L4OanQ+yZdflZWumOqlVcI0A7/MEHdL5Z0D6tdQqwIsyYT08XEjQr+uFdoJauBgfvTVpT6BozfR8rIpJ/XOaDszKse7RBVsF7Ne8YKGT/cP3V+0ovzcpVZIG+4qUngKwMxqpFWL0oO/17lkafVZtYfnwOsFhHCn2ASpQCrBS1XD3BSupG+X/vX4WgEu4czCoOCHiXUcDL7nrXDqVW0HJm0+uJOZWexkL9x2W1rImpLbMjPVusguWsnJvnbsxZaUPB+fJhFYN5p05ltLmsRrE4LUpXSViBdlGRW8A+TYn3MXxWE2HFP+j77WFLq875fsNML9XQCWDlihoYux8ejybsxyuXq1ZF41LOdweMLIiVs5C95776iU/Eqk267YVZAfMW2Hd9e6xcC0B9H6v+UBK0JxrqsVxWmpNbvMuN8Vi5v3ePSX1fcGqv8vvpwtAl55zzJ7m+u2tpWoTVkVfuDp53knN2KhevQ/xNc7Ih3X2f1Vqa5+aM60J7HGDVRPY67u9+JyuuPBys7u7FXmGW6/ZgzFTlhKfWp8yvP4nVmV5z8yZde4VZjkuEazC6wGW1Xq87/1mCVUWsvrLkU53CgC0m0YXTjMX8m1gJbDjvSrg77dPb9T/EL1nhrSvi0nyfsAicv7MDd9oHiNR2DZH3S/4yktRX79e3s0KMwxKRH9Odu4LyHZMp2djmn5YVYnjtoYI7qwds/JRitY3x+GOs9kl9sSIHNs+nL9XY7W5l8cOW11MSwF4lr1POfZpV0rqDfa9iA9uGHlbNY0VPX/7+yH4OuJv6IXljd9K6Q/zUkuukm1GWGLtdmN4v2oGWsqoUEF2I9ilyWRX8eBEhwPF3dwYcYQob1ia1qSJiMlA9OzErrZ5n9XW9BmI1gyMXsnLUzQiaqpD5aSSsDuvO/gCk49OfAt9srHyb2VVnDiCiZCTsdkDK+1SPY5xaiokR4Cqab01IW982NdtA+8KFsIp64LD6xWXliGJccU0RrNRPs/qoGR2zmlg1iIiSkUxW3OVqYRW0Y7uvtf4GTu0BYbGa6ogVcZjGPURhqwQr2iQXuMBLgaouNkLNNyitVedurEDpJxL6C9YDv8/KfgOrzQ5QjrnNZvXuv4WVjXydUEGpQnu5cv+ZnxPef0egDVj4AL3ps5La6nTYjJXFQA7VRy1trB7e9QVYQW9cz6lnCvweEMImsmbcY7T/CllhPrNms6S0/W5WlaL/Unp/x35nWgexGl1Ticj6JHdbPpw2e8J8Pyt4rjmsXuVYvZwO/n9NgpXFWTk1HcWXGaRrUarIfQr7gbCivHe3nYd6Gris3pmsPj7c22UlVfOAgn7/hjxIPMh3uZF+EiQlVyMUKuh2ViY+GT01jr+Js9pVKHZPZL+H/bdOC3TE9lzAM/EtB9TSbyNWO9aTVUNZJ1hYJVAlFytocDAHiFUWArDDnOXKuq3Zr1SEWPXOOp3cRLx81f1PDwmktm5wVnB8xZvnqdOj4y6Cke3Ro2GwyBzZz7ntnTcMVkTh2fOxlxcp2P8ZeyarHnBOkqz+XqMPvsxWKMBHshr/o4tOAToPWYo/d9UDrCbGjHHn8UhPHj92dgihxyqq5QrtcNCs/t5FS5yjkx1DxGKPfZ+sBOYw92AJqPPiye3PjkNoLXB379UjCauV8PhSxw+u2T0DobLIvhosHiEs92HaQD6rCWClWawcl2C3PpxeL8nlbhpWh8l2PL+Ox07N9Byr8Q4rI2blXt8SWUoXq9XtxV2tg9U1z/bHmulJz515yfehhRqPlVehxYajL73oeWN7sTrna7TRcLCK3E5bPyhW0YZwS7LaZ+wiAGEHYikY/8phZQJWn1cC55fggMjgsXo/nN6Hyr1yXz9CttBtd3ljpU9ltrOaG3SjIb5srx7F6qVgmA9bCaINqNvnZscgAD3ksHLUwtj/LKseZ5XxslRocteoKKshmoOu+z0+HKJNsZpLskrts7R7oAffVwMKQ7gXjs0/o69iK/p+4J+Be1yDYoJX+axe5Dp2u/1cVpKPgg0VBqtZmonqRWSD1pa2J1rGUnVXWI/L+jisfgtPQXimTDAHp289IzBlLcOH6Xjmdx+nkdKRgKJ12PyBfnoHP2/GH0cibMAqIRWlWQUxIqnCNc9hdU+B7SHKi1VDuJ2etDlGirpngNxmxY+HiSV2I6OdtGsnINcQK6MXFLvsyeR1DipJ9btYiU2EPSqsINsNnYMxqwaJwzS4AYKaY/5r2al/u7NCsTJx2VM5KygaKGL1Qlh5T1j2FW0Hx49iVjskxsV4h5e1NGKiViLrX2hyn9Vlu301hPQibwpYebjXCulpVvuE5uf87TNhmbvjrIuy8qR6mwne19o7sz2In3tBPX9JwFlVQlb7Xy7jQjviwa5izXy0L9oZnhArf8lP1vWN2lQNRCmrde+ODrjKuxkXoj5F7ea5aIBVg7IairHat88bwApXEKtRyOrTkjYWktKpmz6r4OmKQ4Al4upkFcTWwvz0WupwHqyA+Qq7fvnSNj4bbvE/DSybcYxa0Kh1eE0XrANb0ndXZprDNsP3fxZWURxBPIA6ZGU6lJXtqn/STxlWA8gKNuT+DFY5TvGir6KgS3qT7x3U+ldBvPBadqI7dSSs2iJ/cs/R89fayIxAIqGO5fefCZrGSdkNEhEkt0ale5RbdyerXK+CTK4xYajafySCvOfyqjmXnOPX/SXXAVHys73Jii/ZbsXYFKtKCVihGcYgqy7BSrHeY+6x6hIi6rP6d7Yniublqd0K0AlWXr+GRLVazbvA6V4weUAvF9r9B58VU4jPqp+wTqNZQeWxfDjj3yzfmSl3sSN+wdfxG+em9vrvtqZ1TUoXsVhVSVavkqx0x1wv8EuroAMRx3uT728pVltkPdU2gtX0aoN3UE5y8mLHjrlebEQ0IA0UqxuXcK53fbGWL/xG5dU09H505xaOq6YGKxYBeWvgQZv7rDSXlcFT9VdWnhwM38FqQq1q+G6EkxUS7/dWGg2tuYp5IMUPBLY0K14ehKIGRd9gVRGhlcFiw+BJQyCux6wBMsvwkA00Jmumh/wwHjIb9uFFNzBO46XnsYpbjLDydyhgCxJgtVeoo/ymkNVQilUqcHd2aU7Zsy3S4hus0DBEpDY/Q2RhVm1GJibKinZzjy6lz2ftCftdGHx7gpWzSXrqW/8ZW5bFtN6V1ZZiBZ2QcaIwF6vXYbLQDofT4k01a46+qrnRAY/VR3Ps77MBqz0/ZOoD7ANLtWPbz1AigfOjs0tHCu0sYLU9R4nak7Lma4eVPgkFByCPY3DTK7zN5FYkcQQWZmej7WpBQ8f5dlbaY0WEG8gtv9SsuarSXawCRdVsPo62XBeH9YlZORGrsEvzjHXSRqbJey5X1dMipv0OKVT2c9+A0/luhDruD7H5PM98MS7ICvYrTUec3gchl2dFfOZeUDtAzkqLWOHD1iPT2Xxf3ftFAwhYyYt2Ln1pAYcDZjX86ftjaVbX2XvSKIPWbxufQl01DhLbUUWENhbiUqzwxV6lX4Xdae6wCqPom2F4K2ZpePEphilc6nOdSqsTkR18/UZZ3UqqOXKemayShoVOuHt8z4BitUzg4yVQkz6/g1kVWETLsbKMqmNtEVbHS7Am2dIKXOOsVEr4xaxMxZnw8YljkNUpN992qfLRMKCaGLy8qhuszo0G8iEcAVhujjme8m0r/ln6INpbypzfLisLG4LiS94Ix3FQ33kfkmczOHORYqUSHTMKmtg6jxWmS90Lv01dffsnZLX9c4SmZ7pSBcZKGGDEB+0z+wxZCOrbWKnzn0f8pPdY9VJWmXYszkrbn2QV6PgjuR9iNfa5k0foV3wfK+ERRpDVTuXts2qEDxMaHwxx1OfZdpSVKFFF6KJrqJl9EI5aXbmbJQpKVKvWZ9UqNEbCyKTfcHbH/DG5k6HzWHnYEVZf38hqOO9aRiPJm8CRmalGHVKxFhKgpnNa44K15LA08P4bWTF2obaek+fO1z/RByvSoLlUZ5tg5VsJiM3AzcM+9ZUtEywqwMr8dw+ziotjoQIGWwdwqR52lYXDM0l57Teitcsr9q+fu5GAQ3Sysv+vAVltwzq4F86tYghOfIEWT7Fqw8FKsbqxC7Bejrnr9lccf+sCfTXY//cCF29z7ucPnfsYcBgl5QASrKKWPMPq6+jQcUqqcYI5/jQatRrWkwQ7K0y1xml/t4260Yu+hBMekPBHWPWBDAGsjt9OQ63XZAUJq6EIK9Ck7TxWnRfgSemrDK/4/StkVRGszv+0//UilqG4Qu/nJ+hCLKiZEpz38Fhda8h2NWp5R22vagstVtewHawSt4V9VN0yRcPd1nbTV+hAz/dZLeNxtSzPxjIcVqtOb6kHHCQ/vYpYucL8+f06vvG+00fRodNQwMrUuN3p1L3v7s9vuKU9I6f6YnUK4LHOuQi2Sn8WsBCG+mAVWSK8MuAt4LLqkqw42yhuHT6DrbztpfZbf14OEStDxWaBScxiBUrlgJzbz7IzOaym18Vqz1FS2AM2z21rIsiqwllVSIHN6OAjn1XRiDiH1eieLAxz34IHbL7aXs4HYLWasYkIUrw4jNmsHgxHptxNIE8wYPWKWHl/wSm7+sey4llcCmcFPWDrbW62Rt73vmGzTueIoctK45LRVv/7SYasB/u/jNjLS1mJGtS/GL53891iLLxqtaj5kH9Qrq7k93B9N6uiSS35D1ut4Gl+DfUPs6IW9aIXswqvQXPiJHZn9VQ+0sBlRZlYP8lqbiJW7hOK3tvcMcMjJVix7DQZq3fMynvCw3cR+x47hxVX6Fk5vJEkkKGtMTxKNU0eq2crGw1yVix5aXPznUlX0bs6WsW077BKnz5HXH4y1KIYcrLcP21vjJ2zwDivc2v/QOvfVj5RfS+rfF19VUm5zcqq0HWhEnsWe2svc5fVcvr6CcUOjwim0MVK6J9tUztmxU16PadC5kQkwuvmmYRWh5XQP9M21FchK3pHwz7Hyj5j7h4Nlc+/fT0zOCu6yXdZ4duBRfRUK1wUOKx0+KyhSzQ5vKQ1swkPs+I+wwpY4X71QN/wyUOEe4/T/PUgK26wmfWuL+hG4hfnMYdA8moIdLjN0D+or7isyOx2asUO9hRoVrx4A+5TPXtn1X1WzkWmDFamvu9SEn+ce+8Sb6OF2UiNnkAzCVZ+Brb2zhrVUv80J67BoiBeSyZK/rAfJVhF08JRWeLVri0ftXmAFS5q1yiDOfwUK04L228wKPmsLo2Sxcq57fmVCMHksHLxPLdDzH3w2ZnFSxfcqhmpsAleml5sViax9jzHyuSwmhp2umMUA+OxqnB9BUyxh1jlrg7nntPKan7oYNu1rXl5QFol7d0Bvn7nx1ktbvpjrCCrgOMAPbNpn8/qdSrn5QLSkqyG9PU/hf3bb2PVLGnWJVnpTsCqsj9wXDo3urLkbPZFCyUZUbKz+UlWQhH5EjiwFSsLxVhUXwFgdF4kppBj/MjzR74T55y76W66FQ/XFVlYLevyxzIfCz722LXCp9WpAjV6FSXXVjIh9nfGVbsDT1muVy3Nr/n1vawYVSN4rK5djeNA2O9nWJn9+qB5LslqTLKqmKyWNGG6H0PMKqPCIjN9tjSr9trdJTTIlO7QB8KUrpt9sTqmc07sU8RqKhFb1Xv1uIOV34JOyKqqZKwumcX7ciudctzSwPoil66tx2c/U+fMGiBuO2CxGhn12GNWv15J7ZCnhn8VTFy1OysvoHCmulgPAjlRDlNpXQISrET26T1W8xOswjkuZXUourHvkyntoiMHt1ilFw3BuK2Ywp5Zj9X+tIlmdS5pr74qmtI+3pGMtKEjMJ9BR9F2rr7an8Zh9cE6VoVT28dbq/1am0WXYaUpVpV1DMyPwDQpVk+EydjeiUJZUVknXFejRrzXU9ha3BgPzZvtftWfPP8Bvns99k+xYkZgeD1DWIFLnf3jzsq8v5UVEq0zP8RKF2a1Tqz0Tu6tnoGsbmR5cZduacZbXzGiy+mgZcDK3meVH7tjj5uUFStzJM3KlwLXS2Ms+4XDdBJW5Sd6mtUQFFusi7irj7PS5SPD0oF3mkCbyrJz10wGSU13BKBs9RArSaaOy2qm/5D7yIZ/2DnFyimU9gCrZUQlRxWcXtEV3CCtDn7hPfM7lloVxmdZVdnHOnZWSsCqAf2LV7GOOdGGc7Lon2XVngKBTx8Wq6lf7ikqyKq5bZaWXti3nr33Yks146GbEXmltOkjKtGMa03RQqbF+1U9/JGyOny/k1X6+3uV0VCUp7lfWf0TfVQeq3HXoYxVbGf1CuzqhVX/zZ3VVSXeg8gPSvoZdx3HPPh8w9TOwnmx+nbBWFjNWUonz3wWm1IfVlbFrMYfYIUuyPhqUDBbNbV3tRmRC6smMCrfr59h5dXUjyrMA+VqVRGhqlJW9+ptf4zIZXuxqf6Mj9cQo4AGF2EFZStZjlf0eV/obbc/zKplsqqyK5jVsmXiYAX4cj+W+bjNwaPiW5oVaGyDfzUo+ZNiVmtJccUVba7Qs+KGUbemNaQ0RBUqiSG8bMieig95tqqY1YBWQSFYsU/xs+xoUATe/f7+KKET+vOrQSPJyu8hi1XL8TwJVmwHkXVKjmbF8iB1FiuWL4odQu08v81WP8tK4Ntd7znCdhxWHF7XiPnKYHnSIvLJK6PKsoI/vWQux6wM88rDVHzyYmWi6sLL/yWdQPaQs2O6JnywP16puJTDYMZWleXZ6xUb3m92FyV8/mkBY6yOKGwBh1kLl5jo/knfMMbvjYodJNJ/UVFR/g5crC5xIw5NLD+Z7hvwuGiD+0tDxMo/H4qyAjIxU75ezErXkR8IvBBk9S6Q74uvob7ADJ3DqnVZsdADJtIXCBtlZdYKTBCrLqnrdBFWhL3hT/CAlXRK4+ZknOAGs9p+ArCKbUgFacD7+ZlSVrn+lITVeZ0rwArQVwE+hbgvrr6SxtqTfZ+arBUV+DTUe4DJ0WIr5BK+ixZwnxXqqbgqRVjALe39TIUiP+OayY2m5kjWchNfTjME6h61KN2lykgvbxUFp3I++2zYSjGiZrfkkAVoBQ48VmLL+1K95vHa5UcfJjoqn7qsqHW0wDkrPSmlWIWqw9S8zn9G5VKXz7M6Wj1JCnxYwDDb++vOBG9Fagk44fTZw0fpDLDOecfzF7qfI5xmRVSNG047wek2PxhtLNec9AfKdA9fouFHsE5WXwysqLb5RlZeVdenWfmy6s0G+mS3gJUtymrAwq+frjwbmSfm9for1EaLWLl1MI+rKgd79Yfdj7BJgX3rqbOA1b3g1A1Wqz+L2innL1YeLXBH4vL9trqXDgZcd2owVhlpsm8Rq1huWi+igrLyTSRbB3OsdQ/D1bJllHazjKVjIc+xijz+wfJYecv+YIEr/nisyA2f45eue++zupdidjOY6NzQqCrurhLJamDtN5OsXJXFVEvtt7Ji+qDHIhf1mdcpFiu5LcBr983c+3DS8ZIJLOFc3mBV+ax0fjdSrPoc4t99YVZihm5+3s5KcJqJGcJpaCWfesofd7mYOe/W9Y8akbayMNyFTMbUFlfRDJ7cqqiuP/ohpCFWpD6ExJXQTkho/5nrZd6v6sbL4gyVl8dqN0d9VvSzrciaGmFWrOVJbLaMlBAnpSta5wJWIFKaVQuY3LOUVTjNO2L9KcTKJC9gDFm5mx+YRpdMkE19zTeMh/ELWYdE2VNtKAiFWWW4sgir6YaSGfsSrNa/RbKq9YOsBjkrkenpy3MRVltHsQx0xZot0etY5bgEa+yQwcofwHW7xkKrWDFWmZGlomXeNlYjQytZXF5WVgbqqZGy8nd+pnwJELLiGnDtolFTrAa/vnkNrswuq9a1GTj5u5t4+6wSjTIpa43Nir8YTi/GsNfI3HIsEJeV9/fs2eNJkklttqam+Juc0q548CssTGkh91kZePGZsTUpb0vS/vcsGD+QVfMYKyKwgbbLY/UqyWq4zYq2GcY8Vq90EOgHWZl8Vi8mSH6Yxmclq0LtQnF1sb0dJ/iw6mm1lGTVZ09Q5NMFrGSRVtfsZb094EaVF/vvhhYfk8nK1Fj8ZPrNsEWdbmTvUPMSM8OTH8Rf/ldPs9KcEApgoG09XFv7MZ/dwZuILkBX4MojrZ5UT6g9pQBWWOBxCWPoqhd6Sok/Hbx01HlXG26DJvrGSoOwisTrV1Jq1ijYjNlTx11TLFbuE/isgMXJtdG0t0fRrwGn+eU1aH5RitnAOfbREHF0Yb//H7juRfcnUazcDphbrGaMVQWwensCEZ0/RGzqiBW3Rvd8sAoXP5DVwGDFj64yWV3qZZpn71WeytXcM3VVzMoXzy/CANmKoHZwR1hV5pKxqjqxTl3NvtatY82+vjx9pqhbaMpjtbXhDABbgWM685zIxXXQ0D3TcFCtBZQ6pvG+MjzMYzpg8Huv0NR7jsYrKw1yxpUm6Gbl7fTsTQPB9kxPoHMsoIMV7cWcrProh0A30gp0DP7Zwwb5yYoxIONfv0OL9GiaqtDptLMaE6bB9iQZK2DYgC+KLdCVFSU7HFa/5lDPEE8MWf1GNbzzpENSMlgN5Vg10DsmbMlFej+HlgPJ6uW6GOOMWHwOK8O8B9Qb1zNNKyiocGl5lfbdYiphz96ymjyfJbsJWBHS+PaLV6FRT4cVWwJUlQ46nE0Dn0pNsUKs+oDVQLJ6+d8GWI2vY0brLtO3taldV0OzilX/CEmB8FzjcQeCaxepijUJMYdkUQ32fFIOK9To5Kq81Euba1hxUzsyIKdfe0TctwCwY5thriHGqiVFZFA/y+q0S3ZWsLsb6aIPqxmwSLkhDrAo5iv1JC3ekhUuDwlW54hPVGwkMiDHv8BagzfOeAQePuQKuTp2eOI0CZfVl4gVcmzuBiuGh++55U9kkSWmRVCtWMCqZ7CKpAN3Msb04mKcWz5kfthUhmXgSSP6SvF0Tjgwmn//IuNIre6uAZWxmpMseVdmvTzfdhv43FPlIdNQHolQEiPVfMhllThm+/n9m1Vpck2RcepOe66LdHcwnHMIK3AoGAOrLla6KKteUJUzzNXYWd2+ThVhpe/lhS/NGoqyalZWIyFNuLIQs9LwVERq3N1ktT5FCZT2e+aICvZXAZwwm3mQsjKK641GrIyclSYdAEwp48v49mtsDydwOsJ7Ds79uLyLZqyE1a15ns8q/ibG6k2zOlyXh1g5ZxTv6cT3t7Bq4tBDUg0VY3V6kcNynrUQK/+dSY04s4WUGpAcIzc40cAukbqxyr5m3pkPg2X4H3jkg++pwqyev3ts6ZKteW5kT/dYC1kJ8pIIM3nmuae6ECtTUxvD5gyL9XSPjYyVYzQxD4hDV2KeIpdY+U0JsVss8PQm+vqqnu5xYPYKtOA4P8rKVvI71nDhJAseb0l401eq7EQwC0SsWIspuF1/AMRZrT3AWbUZ0oU4LSerWZj4KNAQPMODJorrK+2zCruJjCmzPg2PVcmTxv196RtoVtdCH5UpUKDG1B3VT8RH3PXVO2A1lKyywzOS5lQIxJOFxmOFdnM/oBOxMh3Vz+0hPWi46YhVMFrfwSopfZss7GGpHrb7YFaxfuGwmmHlX7+Du7M3LaASga7vZbVn5yhSCqOicZWUlT74Y0rhw2rms7pXYyK3FsimwN2LubhNm1F9BbBaBqPdv9UhqtV7+0BeLH7rPrn3o6xgI2FG1wrgspTjV/P8N4v0IH77Q6xyL1kz7iED2UNmVItoNEzxmWr/4bDywvcj33P4GVZeo2QP6cXiu2Reb6x2GUp4pOhB0Fv3FN6s7q3Twe17haTO1f89a4eV+ZHaNqiHwIpN7AM4EssuV+ZSdxr0q9Y+UpDvsso6pjbdYsV4/iybztR8vNz326zyMqr3KRwXuYlZdVmsXryx9dcuBUzf9mKlVSFWdGnZQYH2ot9UDbkiWYbchIcBrgTEqAHbfOuZ8Y+MOMbx7lkSzoFZfZafhVXDcWLpcSFYWc+s8hrwH58fvZHc0UQIh6mvDlbB877yWDWhoSpXEp93feFz0Hrmuquv3gurUbxEn6HBtO+8UwjHI4iBcFnF2xQhK8OS9AldeXxW3lnSm6wgu72DzN8wShxs4oTm2HF8I2YVpojoTirx3pFB9KKqjZVrP05/W+5W+uim9GrSAayg0DOsbENjJ9zw4qxmtqrgS24dK2iQsSKi8BYsNPeRq/RqEhQUrlBWPGU7ZVvOwDcd8Yt9q55aRwhWoXoZf782vZvuoLbUXBQr26JFkCzBKg4ODzxWGrbJ5iqTVZUsLF2K1cTRnpAGePeRpKiUXQ6uWLud8ZXNimEqIX0XsqLYkjX8HVbsFO3rDz8GyjnnjwVYqq8Sn+KpBfRSTenzUc7KYf/hc64lp3/FuHydH3ApX6R4nAt8M81Kq5DVC3Bq0k5Ly5+PmYE+mytXxVjtJ9rPP1ws6LlsIfAyrCjT6Eb0rxcEWHbTy16xvMb3E3RdktXytPKsqMAdm9XAMVODI6m9P0oE7hjj+j6KlVH8ALLvnw9lr4vJSbhaWHkZvwsrPJ6FGcSuRUDpbsnZqUdZMWZcDfQuyI7u2b2Lf7VZmm2erRMZWZcqWCItZVmlE66ApqpEZmYGK6FdiGnEgFWRz6mUdlZEHG5pahSUoWuNGg6ro7tJDyYSjhZ/g6M2PVZNiam3syK2IayCCj/0SQNMJzAe/xWNA5rStdNddBsiuSPC6nJL3nJL4brbe3v/LGRFz8GhRoXrIoNvxnfI/sX+RG1RHebuprjLzdVcyczcF9/wXQQro/K2mWBNeFkkKKvl2o4OsoJsmlUDO9PXNGDXm2yRsPM1CIBxtfyoFCvLWQBcVm+gSOrSBc4CN0Ks2A7GkkxtYe07k+EPXYaVZ+8YDqsRYMX1ox1WjjnIdG3WGncWVqgTvSgp3pKdCG95rDShr0BWpzBxWV0S1H/lsDoOEWIFInjtyDwy4JdSJxJiTjleF7BQH7c8VwxW43MlZYVCSLPSVXbJBqbPoS45Xpd4cNHNreXAPcRlXWdC00s6KVO55S0SrJCBAll9a2pS7tEbKyzOZNieOiZ27x9nlXv0ZvmehHNClrQbxEJYzYd60v+ErAR5QSkdRe5aHovheSePkmiLn2HVBbbAUItYUSaG0wyM1eKsbmJku+pHPqIbYG5ENJaTl4pm9UW/5qy9+2OsqEhMwDGrTMUhTInjvEv3E9ugX9UfwApto41u9ZarB3MlVFGslmFh2NLb+28dbJpupVXj50siVnLv+XiGTpsYc/MNgvGe77ICA2shq48isdms0qacHycx9R/J6qOvkDsDVGhQ32KlJazsQ8bA+/dd6TWsGzDbDFaOMH1MDGp18Kr6DU+xurF5yrGyNNMjAnc6teJapNOreoTV13dapFxXBs7Qq9msmmdY9YVZkTi4E08zcq2ozIJG4D8K5lxffePnm1g9ZF9P8z8nq+pfntXH1GHZ6wMvmgqaTuNjrMZvZVVxd7uYB49CE7er5CmxSU/GMdu+mVVRbzV2neLMiHtmu3bZz+zDY8NdDTE+wsqZ1GvsYOLnI7GWdceu7Rctyardfbto9fwIK2dSM1iJam9+hsF2oQ/AwkAHpNO4N9VoSnoc6xaQiJVo+fwMQ8zKgHeiYKzAyZjGPYtVY8dRC27MuAP0lWW7RjArN365sPImBjbyJysjvRNlZ9WnfT6p5QBM6nAd9FrrROBHFqtgZbDB+zBlqNG7dgbF0UNBIFB4vga1y8KRC1l5s8BhxdgvPueKRlJM0r5m9AfrVTVdUl3dYkXJrWXboo6owqwakBU21TJYGWg31NRFWRFjkeUbIoblR1G0V/aDStkdyTdHWMB+xNlrUlbDk6y2VfkrXEbmxYY6X7zr9RthHZ3FKtRXg+jc1jOszijL0Zj33H/AnFptD+7cYBXfO6I4rMKM3TYJqWWsztnxmd61xQ4hH31Wh/0hfAHDreru+hZDl9f5LFaNy+qwh8bGYaUSWfd8hZ4yhzZBMBLLXlsZq2P8sosujy4rfQr1sJ/Re45VWOixDoY8bdkbIavbkfTxP5Rj9dRhf+rM+A7UrjVQaL2eKkSVaMWw7L+d1fvfO1zr5deog3Tr4uFdr1h6OliElZePn/TO77Ea+EXpzPex6t1XrJdOB88/f2s5rC6fIrFO0qwuZQCqSLcnISuXY349Pyi4sEznwauj67EyjoTYThz/YpRdUfEq3LjBI50y/LxiJHXhiJGvGl/7K87Xe6xcih9W9DjptK8VH+Cqo1X47bEyJKv2OMNan6vqY/v5m9fisXJ5rBKnHRFQojk+gG5nahVeUoyZrIZjLdqF60aePZcV+gqZRRn5MDEry2C1WEzXxAJZmX80vlpzAr7HCR25VteJ6FFzCQWwf81i9YWDsGFYAGFl3Z77EWRQX+l/zACrL1e6M7YWrs4eA6SxCQRVveCwmlhCs6VUBX+ivSEZIFagihzqra0+q/3WbhVKGnfpi1m5ZrhyFsMaqnqRdCE/j5h+8/54SaILVNp5qrR2xCvwSpATlC/PJ9NXJflDzRdg5U6rs9JkDzWS5aZ9HsHdywXquu1idrDazDFWpug+rhaNGN1ipdOsMhJuRKyqBKsKZqVxVq33/BdlnUj0VZrVmMuKeYdbj7Hy3aophGSAS3+Bd453K845OkTF+qqDR5Kz5b/vi6yseGEP4JwjqOG+QnUWrhmIZf6+mzGiqfYdrODLLhuOc6IvVuUTq3dIISv7bUeUtCM6lOOaqFpwNFidc1DWhUOfOPt20W55GVb6bkYtZThtrEYeq1PPCqP/h65c5HMK5lbnswoFVsjq89j+zg0CZMd2Vj2X1XiH1fKtueoiL4+Y1cJIwof43JxWqy3Lamsrllp5KHUleeTGFGH1nrc3nqd1LG/68llNjXQfgN0xu1rZM63UFTWtW0j/eKFvh9W43T3BZiV0iz25ytlcI5vTVkRmJcuPt1Clnc/oxmuwuVgZJiu+N3/M5LkZbrBiRGvSiiohtsFffmwLl95VvmnsNzo61FfZTe8j73EQ7gNk2BeqLCuouHj98a22nlzFylhtq/mO53TZ14+xggJtJp/VC+b88dmt2G8g2jFSjoQuJTMcVppTrtICvRkJVq28/bh8v4ufaQ04gLYMxGqoA+3bM0fjwwqWBeHVPe++iVZy/7l3WGkGB2CYxhe2leCywo/BBkvlWKjYxCY2HqtgNZjuiJDKY9XoW6xuW0YYq1eopIP9X5n7p9JTW6dYvf/qsT0ulxWSiIKL0O0in/EUu3O3ns9h4LCKZY84ZO7KPHBrlQZLH57R/Ya59qPrHM1K6CUbBqtKJVnNqPZrSVYGTGo+GhVk+eTsqYcL/3Dt7ostWSO/h3yoI9MGYRV0bh7BGB3ByoeVE7nDCvL0GR4SuhX+IaL5rRg5hk0fyyrNKjAVcxIt11YqmJV0A+fQRQqQCbpSQNByyOqyKhHNQUqHme5a8x3Nn8sKmGtZrPb5Gy/54cGdFCsrcwh3HYuU8nXkyj0FJ2altpSU4E7zQxOKN+cVOBVVEVZGoS4OvXarw8T1Wia2Tz8wAFbLv8YbOzkBq+UlCVaHE/tFsNIKVZ9sO8dNxqvlvTIRq9txqdDl61Z95T4UOeN57kBDrIYaZbUL3Je0ZdJe6Sr03yNW0s0IHbEKBR4ZjdMKRTSPxbxaro+hu2ISgLDSchUfZOw6/1zrEWKsXugEMUQ7joyFODEiWk9vONGaLKNkYVZprehbCP5L1gPsmFH3Ig0wtOAgygpeOyXCddGGZ5epffkKWHEmvRe5oFkZQK4QWUdCc4ehH7k9A5JhmRfaU1CTdTAXh3usqugCZv94X80IlpHrzfE1JiuJSoGfEDcmixVyMcKlgYzCKeSyeh1663tYQY05f9TyFxOs2P/5A6OybCN2ga/0t26z0hSrSswqPoCqkCWOyYrKHBJG8fxpcmlTw6UNNVnTTgPFKlr0UW+OqWmzD/rhTkIoZWwT3Gtym98OrOsit948W82rBVlluis3nByQVSt06+03Fvm+ycpTaPg2a5MetIu9xK2/U39RLJKH0lD3WeHqhF9Xbb2II9mQLzYrXVIk9w7uEZdbrPBlSsaKcHn3f81sVmQNdrFItm7E5dZCgbOiUvj9U51w37sRY5W8Y6Qrr+r2iMtN1VeLLcB4wxQUtiAzlF/jamOlS7O6/cFjV9O9N2sbpKVNQlZGSefnU5Gt9GfKmCWDW00wm9WmWFIX5ZWSiRKfMYOVdivk3TzIUvjCh++8t4U1E9x9lG76o1gVEJ6ypVy9/k3TvfGo/zBW04OshPWH3/0fwgRb/+fXs3NTYNN8e/1leIK9fyGsHq95LPArpvmPmGBoBq2YVUeZn9enz/DtL1bTD7C6JlgpVgMzwJFgBRpJl08FK1H9JCoHBJm+PPGtPWYw6FwBkT8DjejLp4I1l3nSQnL8MdI0YCQPnpVHuaxepL6CcpkcPQFL+6P2ljPxjvPNoKUfsIIOt8T1VWhWV+JC7YdGWKzg45g3WCmBujpZgdtBM8DKn4jn167JQ7K6TvnoCDfGytmtIVllHNZKb48sue0G0zcpVtdE1HDfNKXZgFIcy5tPAU5dutXjdnxOJDi97bbW7yEzYra+hjUjjH+WavknkiuJattlPgXTfXkz9zwLZcE/xKpZHqwVLo1bX6PKzT6r9X5XpGSSwty3Jc3VZrOqCrFSElafPwrT9+O+hqxWafNZYUa5wv4xRaw+b755K5+Y1WUMdjzhCyKYLcDqRU6vPFYvl9WqtW2BGwxlXpPsNM2AXKipUeug8rWvrqnQiMFZeSK8smrpGwzTEZidla6eYYWZyLZOWcJD8i/C5SzOJQIs8oono2VCIkVYHXM+vVdM98CzGSKsraSXg1WL3GhGxhp/VnWx2hHbrAerZJxfsplOPIzRy4VVQ8tx7gnaexnq7LWk0MWPDJ3+edNiVVHvy6wCfrcPbNRlqg5w1j9bv+cvmlX1I6zKhf1ZyoAXJVscI6pf48+wKhc24wkea7do3Gtf6sJxKlv9CZ/3KzFoRxHB/+SyCk40j9W/zGfsE6yOIoKKN1P78MayibIFnlYv38zKIsnwI6WQLlaIniNzsq36U1kllAHGapeXjvoSHpuJI0T3ju6GD7snmcg2Z7LI6lFEMLpnCQh6AA4Am5Wj4u6zurkHgrFKWYcG9irfc3oubUy/foCV+wQj/zqiOHxTwLLdn5HNque5uLeOhFP2WI4tPnPeUbPJs1kx3Zo7x5wpVk9d18547q41P6x6Ql9luIBFEhyPWeIWdn6aFX451z4/PqxmnkXNPrRUwFCAynqHrMS59TUC5Dzl2qW05gfWi+dMli76RvhPUMZmIPks8bWRcABfc+6cSmmCqXDaF98e6KRrPfPbsCraOhx8bXDuu7FpVu+fYnW1LZKwZCZwm8vK4hXB/F+1UFAiL4VPsUIkuEOo3bbF/U6wwvZ5xKw8+82tATKAt1zk3KqwPyqwn2KHxFJLy9XsWPoTqbMfC4fSVwoyyfZLKclaOtc/PRvqnHqeEctd77dFySZK3BHevO3Ibc8x9fotwDERAxmy0ozbYlOsiLUmNCV6mtV1tZrisMI0BWuoNuFBkg6v+wMJh6UixSxgxYmweDPe+QrNynQ+K5NgZTLPISZZSe2WqyFDUq4iVtpndX5lC/EFqjtidcwBoO03w4AWWgKml5hVIGzOoNnUUkOzSq3k25viWprbPZEFrIw2+K9t8FToscqPRp1KowZtBnCPYuCwQj3i9Y3LIyBWQKkTcZdsFCNpnDZjyfAMEc460GgpeEeoq6MEeqGrY1a+N7/6luKrAaKlYvyrcYYTY8WIoqVYjbSU494zXYRxbXpcrcxnNS4Oe7qYYwuzUmdY4O2z6ouycuQRi7EQRY5fXFbxW3NYxTcrK+fHh/BeL8xnlbrcdmUFRNGTc5fuI6SFdKRrpp7Bapmkp1Y11XU1Zu0ZJsntkx9klbcX7WvYxQlNRlVWVk2k13dWsQGLXIzGsd5Qm377xdoKwCI1zxyJ0NKgy8bqiDAODFaRA95U5LqdGl2/0NrXEugLQoXmW47rchz2wZErRw0OHVNcbl5JYfwCftPCSnfg3NV3C5/eD4/bKxKZEW3PDcwdZ9yGOmTVA1WC85w0+fKTthk+DWwQr/4xVu5y6rB6//4s3qZ7pK+2yB7FLJhI4e5JAVbuqv7+l2I1iwKG6BxE3rh4VPo7WOUZGrITC+PvR3cOps/jER/2rr7yv5+5ukquIPoolOZRVq8KvVH1JivfrAFZ2bKs5odZscNgNz+GOAYhUNcJpfwoq2/7pFndT+Od/jVQkcdrSvkL8/yvwapS/8vqnllRllX/9a8jR3TswXTV/9CP3H/T/2NZCeIC1pFErf70jtnvY6VrUsP/8RPxiaxVjFXsOXl/Ka+9Mv8EK8uVL8Kgv0pBDUgJV/uvwOrz/1LytUc6cSX8FYYFYikqzUpSNCz7YlInEHawSunjI+sFE79xDlnZjmK17WcN9k5wQ8KKsSEC1512g4YhKzjTe0ixmuYwEglc5qjO5aRIUq8kUMyw6+F4mRu/0JXPCp5lHFZVitVuFCyiXIjV/DyrtaVumG/RV+TKfbBCbaApCiB5eznaWRgWVvO3s0rrK7j+5dpSN1VFB1bO+EW6b7C+ajBQgS4qxkpS3ZNx0nvksQpdM7nXHshVuOS5E3JhtcQ87wcUBdUP3rlyNRGsdHfATHy64JE9MGVh5bWwel2akek5iByMyEXgsOrRAUFYbfnQ4fRuUg7y2DRsVsepfivxHGQOxs3NlVDk985GOzmqiq5ohlJqAtR+nkrECtq057NSkeM01Gh8Z53fd+tmhFBaqM8wG5QVlvfJEQI2q3VUfVZ+Zw4p0ruO7hsGqzbdtIR8sC3k7Xvkt30DoyXMLYYv7rPyO3PM8I3ZsswwWFGvvcMKWE73UznUt9clNV0IlccqqAYJstr+d2EF6itTU2riQVZVmtXSdKfINda25IkxQFVRrOa9xgsd5yBZISY3J+C7Gshf0Hx322whVtpy2pbQV12kd/3OHAJzsYJst4HPCrY7HD2C24arkwp6CY6OjfVOKVas+XEye89I0kjQgqSMUHYHHptal8GURxVHdbZEwixbMo/VMQlYrNLKX2U3IpXiA0fAhuLx/PQxgil3ESnF6kiHQisZOKz6XNeEZSeqXFbCD36bas1khZ/IsaAIttW3f5KsgkQRI9RXHwRbrWrcbuiJ+BbLC9XVH/IJ2odt0am7DkeC1TpFkeAu26F9uiabfyQe6zNqFyRZHZQTrNYpihzMZG/UlK/JZgm5Em+RJlkdjBKpB6YAq6E4qyE+PXWDVdKRjY9WEX8GZ9n9HCvPnhkUT1/le9/n3FPZrEz9R7DSXXi5TiYrjS29rp4iIuVFsoOogc6K0ms/xyRgVWB99iXVhUAAybviU/Ct5d3il/j7292I2ka5W/nBfqdKW/iqyqwWJjgqvrxb33IGTIfrZTKduaGCVo3MG8r3/XJYwTOnY0pmBqt3SVb5VfVyWIGWLWe4hkxWVFEnvNQH4g19Cyt9BHpOC8T1RVgPUjgrmgehr8h9beBt+ayEs3dwWDXeCs2GvjY1XlOpwJN78Cz85vT73xS+UA8lCp/kRiPag9VS7yOLlYbX85mUqx61BKbX2QrASGB5BmWdYBs/O2QlE9BY71LB3/FXT3zTdLgyZ7EqaoBDbwxZVTdZUcdZR/KbFCuOF5XlrOClkEBWvS/07U1WnK8pMStdPcMKdQowVvnFcuNo3sSSb+ibukMf+pwTjIaywWW28HHUUepcgn5N8lHQ3MkxIlBWoN5+M/ID2SsMr4QHzzQik6RLnT8y9v2r7Jl4tnTjQW5XELisXhnyIFYi4/xDrPA/dAWBNCMtwsr/kim2Ezg9wMrcY5XoXBfbNcGAa/sUq6o4K1sPXXJ+5bK6NOnFKohT+w9grZUsNTv1ZVl91NB62iE5v0wmKw2wChZokSRte/ss1VG6fsCwlgxEW3v9Ah9uWhAAVuEyKGK1jR6PVfnSMDxW0lj+8feOyGKsIiuB6qThsHo/VkCHxSrXxXAsP/Y+B6WUeazyZh9DWE2N+05i5+JYJk7KGbTTrMwTrDiBmBv7WqbG9NPJiuex+80kQmXbsCY0Qt4KGBjSpY+Yf+aCSbDKiSkRfcWtXVuWVfFMwg+rwKs5WMlmbzCk+yXuIqXi4s6rChMcqSjPakBY3RL/dyNPO7nPKsjpzunIJGIlFV2L+dzbg00eqwIWex4ralWKWAm3UvavD1ggXnCVgfOnYwFWOfrq/Ztw1z/r0VNXnh9VDARm4sUqZ9LRS3PsZ4HBJjq0wXBjbQ6rSsqKb/p0rGnWJu1sMSt9Q3bI3+nqocsVz9mVu9R97GH9kAtKdjhVJ+QBVroAK8RxmB9lpQsEqr6LlZNDDeesvufqGVamgBIyt1iBS51N+aKrvspgxasECLMqMb2ynrEhamH1TU0Ce+VQf/4TsjsJn33isdLimcmclJnPsD5mXQtZVestg9MvUZ3p0z4eVKmZyfBAbz1D7+Lk7GUbJWW12+ihJm9ZrDI2QIfM+XOTlYnv6mM/0l/85nn+q/FUHNmaM/aRU08QenKX0ufhAVoxK9vRrPiPnOd+2+g88NJpF+eGjIxVi5kD4LWgFCuTzcpZ7/bbdWuh+T/PjYRVf0iDwwpNfAg3KTS2mpPnbWyd59fAOseZWtJcnMWfWVPcmKy29XPwbmnFpOJSBESJhTSrux9AEjXEKhmrPFg59RwZF2Ydt7RCs9/9wz+CFRwsidud1irjoq+aBRRDxen6ZOVEdu+w2vVVXU5msowRrVga+N2/f6/ThaEJjLpYVQJWhKzyHDRsftxKwXV0x8LJsA8p1uyRWCagxY0QIBKSFzNKzI+hvnte0NlGs0xWq+YRsBrCur5BiZZyWqWj1rLtIFGh1O61KAvn9JJlT/ytaW0gDf42Jx4iZvTryx0GNzECWPftycoWYcXZsCfOidEmP3c2q8ArItzvqXG+b5Ks9sMx9+MXaMcsEtzJV7Ekq0Nt7fqAukHq8zsNsgL64iQ/fb7yUJGQG3uhQ53Bau/9/O8cVjPMihw3betHIs9xb95/L7s17USJVAarf3O+3yE6LxBvvRjS6ltY9a1o+eaYh8a98/Zg9W9pVh/L+G+0MHWABTHY6ttY5Yc7sNDa7sd3ztL/ocBgldoTNQGrY8fpKVYVwqrc+9YnWX/4x/mldlZNvncSsTqCuiw90uWN/LUmPsRqyUkNWO1j09zwTmJWf+sEzeJzgefj9Ayrj5bydHNQwJb/Mi8FYXvk9eDxsxawH5Fa8BPWo8uqYNG3xRP//J/77iOhUyVZad9c9Xq491pdrP4danWwhaAti1UiMvRhNfb6iYhHmF/19m8RJlgtwztDNmcV+yHjDBlh4bUMphSrd4Mb+OrOPKQREtkynXfUKZGGmmZlrhJdt1itTUb/5oGFmHGETsYKig74dUKvZP6UvkokYejqT2TlFspYYCT9UL8HjXv8Z7gWmRvG9nnrzDeyYlSt+AxvWFQkFYYLZte7pxzUrNj+Wby8zg/B2CyjLxUBegtZOVp7EcF3Q7BKWlkKmpPJ3ZN0WGHIK8+LDcIUGBgAK/AwicMqxioMq1wPcKdVgZ2mIYoqVE7ZZ3TCIblMDYOVc0TwGneSlYFZtciEOh9wmDVrLwpk0LlRzO6UqfMkhY1xUKzQPFVnsXP+5Br3XZDXEEeXmPBHo5agl+KwKnWcYmO1jrUTgcFZ7V4hItH40W4FsHLNWXvCM6kDbMctLMuhhm9ltSmD1ZxxWA0oq52GL9HnVOUc7YZZtecP0N0Y46eAoKx0eM9FMVZ6s/2CyF6KFaKZOceVpxfqfm8/UClWLc0qekDZI00rK+1E9tptTRt4rESH6Zx8cv8ul/qC525RtpjSt9zgZtmjctvcCcZjsZ1biFVkhItYYSVztlIKMcTzv/Mv6y26RwRcroTUghyhRoOssEUaYeXOJ9fou35eoGoN64RkRsI7UTezY7i/8d16+//2uayq+w4bSzQzakVB1XaGc3tHp2/iUrAh11S5rKrvYYUvUJhp3kGyeO1YLU7OyGB15kAk4xOgjoIc1vUCQ/UcK7yYqEaL9vbYgrcQW0jslw8ritVVnw1m1YgDUe9l5yd1nUN3i1UjYwX/eFfiamO1Bfo1ebeeoVlttSgjNJruykx0mrzDjrc8xKxMnc1q19xb8JIeK8fhAHViLw6zjfPH6wRsLVfVoUYM60XxiULXWdJMVto95PEWsQKXiWlPNmey6nYHPWLlJkzXlbhOzHtOnOg6AhZw4WpHDDBqI4cVXsplu5y1F7Da2rSwCh+rb7PqyUDn0cAWDhvYRDSwrsZtcaV1ABoBW7qz31XGYHXkT5+6V5GshGbrOLvG+BCX9kgEDVua1bF4JwPw1A1G475fk3brjvzpTZ/0scaoQR+Tzcqpd3yVjIEPS1ABVp8VQCbT1HFYMSJHNKucKlR+jLIBYoldYIOn7ZnhmZItq4Szz2Wf+dNr1woXqlvPypGsZNHAgqw6KO5Hx9eqUunKaJzFacngsxIF6nXZuJkzX5KVV8dDVRj1VTC2YklWx693JXXqdXHP77PSElZ/vbbR1apg4VFgtfJYtaC9IE8sx2KMvGKXzYixgksbjn81G6vhPwtW1Q57bUkVeLDKuFKjxbQjQ02/+yWqaiGPHv76x5SyYZLq/Y2+gNX6z0dYVTdYjctfefqqv1ZteDFvdjQrqy+x8+hYshGrgTe5zAOsSIFqnGiH9dlBrHQcHllYSRwiVwRDF24/kLyfak+wOmwrQPvkiPj06QbNqj/ExJvFF6uA9X6c2WW1OP/LH0lYHX8afkU7djlQOk32fJmYL0kxNKvD0g4U9HgR8m3xVUktffDDI0JWA8bK9WE+r1qrdqlMVoPYTU/sOB9MgtXSyX/wL3paWS0KYoofw6sJOApYacTb/uKwEqqxZRdjYmkzV0w+k/2zLsLrz8kKU4rJBo7rKqLcKR3G6HXnWucdZM0/wSrlAUOaf+3ITMTb41aMfTL24Y7fSVQrCMcWBtj1M8yqSUc/clmhyHpMMTaNxOw9Z+zAkqtgKYt8YRVNyHCEE6zWE9tCD3tndQbMWDtScjvpLWLlLdOHZsIrDXZV1PiIVfYNb10kN2eSKGtrKYNVXwn0VSSOtqNuduliCetD+/p0OYRNB9bKUcTq0+78auFJK9DxL/dzacsL9/GB/DTls1qnbXP6i5tAnqmhlhYdRsBBxurTGpN/HZdo6jaBLJNSaYLTVeuE31dSi7o7pJnlsOqyWFW5ucEqJWuhWrmm0p43sPxPS7MybuWEIzGVYKV5rE6kJyv9JCt0BK/kI+tPwsuqMxcrVLb0xaoJWA2ZrAYb/dkVBFIFWLkqafDu+qwTrNZ+Omk+Fyt9siJcJXU8Yw5ZHcIIrId0DNTy/ixbQ1vkjl0Rq/CAaH00PeVWanXquUUqkprVkfY+Doa1FSLyhT5FWKH5QQwX3M3WdyxGZICvFs6/GxrpeDPEuzam4bDCd7K9ZMkEK85Og5NH7FZEgiFfa8Xks/LZ2ur+pWXL6jOxWEWEgf4wWDE+cPn9pEAG7/T/vgW8Yy2Mn9mIlasisLWPMk7GSsoqimH1kDQKWQGTPWQlNTPXs6xNhYlJK2dViVlFpg6QC1CnWflHACBWfUpSMYf6DAK85dtaSVZvSXX26GkNxMpwWBGHQ2KzOv4LrF/6uMEquvQ9ffox7SDcYlVBrDg3yrkRIfKGhe1WITary5tw5vEKMG3+p/+ir0qzYq0K+BC1py5dlqz/7GN9ZUhWX9FEXwEysvNUKmh0S18BarXmrAmUVbCdQfRYBdppmec4qzmbFRGA2NbOSfBdIpR34NA8xvjO8qq+jkDfzmqItsGxUftQ3Z/8NcGsJP01KrDJJO65yhO5UArUwkpTrPpjcIAbHNZ5rpIK+BKsVSw32Xy/JKwud3xjVeg8nBGw+rzyYymug9bBrBwnZ5bqxJiVqydfs2Duhaz0k6ws+MuPwzpuDYEGKnByZqZOPKfqXFGs/tp+2qIeztAFZT1MfUrUk6wWCQDW6825X4vDIi931BnQY4McRtJdmtX+5Bj3eZ+LDcp6OBmThViB+motyRivCUlWY8Aq/D4yHzf1fRhB44SzAuxf69zz6oYNh7M6bzF9NSCsNhoK+Ntl0DBWzVi5cUh8PAlWesTDSHJWpxRLXFPM51cUK0YAkJzgCVYt9Gegq/XuPVYtzMqLOLusWploSXz+waameOLNLY/V4rBHJisYf383s/teRyqNQpRJcMGFFVzhkYwi9BLJgcMj57juDSNs7u2SQjdF7NAGyF5FT4c4ktPK1iyZWW3z1OPD+F+OOrRByUPC0N0uKVRO3DxxUqEpxIraNjoKjkhZCVLuj68OVon64rM6hNBwKltnX4tOsVr3ajqGvnrnX+s69tsGjpRVZSt2PW6B0JvN0E/6P6DsraxSKT43risc5823GeQnMRy1aIoWEkK3lAixPVmlInkeK16S6fHIad43FG4lf+tCt+sMNKuETku1YhU5jxWv3cdfTfNc/IAaNCZiVsJ0pUWnpTLRVrnz9BUVfdCRhple8/wkK5nEDU4xr4x0JUU7NhurhsnqasDJqsdZlbg7RqjJLlYlLs0KjHKgkGDHMWrPPvRTTzb80PaZJ46ErNa3jKVYmRQrzWLlJKA2CR9592nUd7DS1aGvHmAVkxlYrJy41YvDarcpRvE0gBFP5C0OL1SOZdIdDpRiRR8ynHCI1bvUOhAdPmCmT8ikWzMWR9SexIzajtJXDit320x4WMh/dcTKcD0rqWwRQRcVReMY1g4SmDBu8T17lY9hWwMWVazRiWFeQcgtUVTdmYdhr1lHTBxDAyt1FPzvoFxWwg3xgNWLwyoaw6KsNkrL/x9TOROO7mHG/3X3FrHSBCuWXMVjvpZOLc4q6bo4/WayMldZu+SFnVbIyvBY5en3Ckwh0fbYWUu7ede6PbBZTduatZan7lLTz+uq/+eR1EerjkVZ5Xg/UNTqWiFRVu/fsY3DZrU3di253AFd1e6YDZZpygCrzrb4enzbLHecE7WaXmjEKmbVSsS52kOie+fHxsMIzZ5Rng8OLOV+WZxayIpqAvrLE1FEM0Vs8Fm5qscGmxM+KyybydQCVn7ANjERbbCE06wazOnBWSUtjfOktvvIaaljG7Lypx/Gaiv0pMSsxpSCH8KdH27aabDKTTdOIkBjuh4qtuim19JIRFtsL9Sk0wCzeiVYxTs/TDUQWBjjbVY6ZnXgi2fVyqonXojYHjp6p61IVu4hmWKs+hQr/uUqay7SL8o6GXNZUVG5sYn1lXcwhLWjyGCFVz+CDrh+JdXC9NffFcUKsQTPeYazev/lJE537qLWx/bY5N/0lBXDkW+yePqNLIs1uDVwKFZfxCqNf9tLMg9YhUbWeabrfuDb5rLCTNqhu1hRswhR63PDiE26ouJNJqBRS5KX4Kp6mWXHZdUTf7SfQiA1ziFSBo31KZxVD6+9E8SqX9t0/wZzUR0QT19huzwb0G0Dk1fNoa78WZT+jNhfnazaSDF7Vfbrx1l5E3YiWem1gRyF6I83LwFjfPUJ/83vlsPKZBQKdljxl4SW4SqdE/XTwEDjtCVYkWHyCbYI1wV/e89mjdg8fZW7adUjfs7gsKpU2lUKWB1V/FBqaEhN49azdtK981lVxa7IOBm1WOAJeVFY5lJlsvJPuyqY5Z/BKq35kBcZklXDYWUj48GSbdDqYVZfPanss1npCmS1e6ccVsOVop++8fWe5cD7+tTTh3E4N9O6Ohwz+w9Wm03y7knDxX213c+j6DK37vQ3vjv1U7QUuXxk1bbwE9DGYQWeLGsRVqZO3HJYyRoY/oST73baU3M0DTBZSnPDWR124nq/nU3kgGnlN2PdJURf3gi8u4hVvCWp0HiHYyubFKv0VhkUjuwiFyjJaq/+5d1Xg7Ly00r26yvYgxn1KciJ8P3SV8QKLUSRXpNjVqAi+rBS3ODVPoFRVjPACo/OJ1htDpzzQ+S1SRQMVk1KGLfTVONMblGGrJY5GXZ/BIoNa3fxDHxE5OoLv3mfVq13nyVZJd2pLFsvYLVX2f0i19eosGhNxG8cVkZFrHTnr+2hwvLHTEes9lsO5N1GYPqOR+CJAqyWNc9llUhVtGSsa3SMngVRwMoEldV2Vh309PUUmO4AoShW3XwIj8l5xulgQTvrOp9UA9NRJWNxF6vm2oZY7VbfaTBgFTrnla37Ir0FBkKh4AXJOAlqfjNswKqCWV1nblRieYVn6xkRG1/XhgKgXGBW4Cv3E74qFQigpl1qXzLBqkVd4Tus3OPaDeKDurbkYN3WYKwqywjGUVo2VY4owSqhpnNZjXNWET3r1GgN0C4vAmJxizOKs3Jc1XVFSgSAfXP+IziGld94skpkOCG/HscbEYXtmdEFsah3hsdNnb6a7SI9GCTmnww1v8vrWsAQv2LrkHLCPSx3fK35Tv7WXb29Xf5U5hjWS9TJhAVf4Ck3GaxaGav0b4c9Qc1T7rkhRB3fB4R79CKzVxRmsZW0KzxWy+D+Y2nJdI/VVpcHuA8INtaX62QCVqTpkn1eIZ1cmT6AdibB2F2m5Ky8mbidH+0Sy/BpHE0eK5OakrhJk4ohDay7Cuggo3ZYrY65d0MHi5XXOcj/TLC6GpjIF6FY3S5NszoHbuQN573JVUOoFZ6bjbAKhvX8q6+qj2IsP8Wqx2I/kHxFrHireZLVR16CiWWI3MgPK3SM8H3a+yWPXD7pQr+ZJ708VnDeP2+tO6/pRUUL9ypus/JEllEllldPzgTlRc/8d4VbCTy7YDvsQLGSWvzs/niCMvzfUucDsaxZ0+Ha/GAVzOoZarWij3UjPyeS0hXHqHp7aZbTqyArQFAswUqDVYvCSa9j6ohD7KFpJTE3jgFq7PiDrOC5iC1rukvoND8akIiipLaIS7DS6mlWqK5W8cz0n+wmCyRvXMhgJdZ5HWHqAyC9u86ZctVz5fhBVvHSLU+Ew3bpYqsrBqdZsspiFaCQszrdH9gPmv7u9yfrwgl+rn12/sEoZ2XqOIbADn9A0MJdRG/8klk7+6NgVq2QKqT1zh9xLq8PE/zyFyUniaPC7U6PVdIj3h9lODl8SVamu2s3LgnRKhWfymcV5Br4doxV3GemRznNynZiZcuc5OJ0d5hVYLgE9+gWZ2WIg1HrnqfyZq+clWWxUgn7Y0DmoM/qrlxp1qIDzq01V6/zZu9DrOCp7f60hf6SZCW5/ir+ioVtRFQezxyhi/JQxnwJWWn/tlpqYFqn/eEFXrMsgtey2hpJWMzKLU16J1matcxcaRPuIUxciJH29PIIXpLVkGZ1Om9dE2zX3fwoyHwADqz2/U1WCes2zWpCWEVz92inUeuFznmrFztysPagdVu7HkbsKhmrdBDn2PanwmH+jIbqkKPGgVuz5T4r4hlrUZoOtCvZrI6hQIP7xjLCG55B4pS2rWE9V5RVQ7NyhN2ka/CRa9z+ePxmcmO5EyTOWsFG6Jorc3WX1Riy0t6qtw9gIOxkfg2qt/cmzqhUSlhx7NNg1F/HDAd1Dbg0W5TV4BaS3la9EWSVFwpGWVk3ZrPs5HUp/zQaLDYrdCRMegd2/PWChXn77mFCWmBiipeOrTURq6BF2yUNtLWazQqXWsZudTTzA1Y9PkSZn/jG++CobO3dpQGGb3pW7CGYt9XDrOC9zYwtBoW/MWiR9u8dQfaH67xAUg6r01qJtKR/oQW2+6nEbWSzCu5oAQMw1wWOYvO/lizffkndaHv+XA9UhUejB3mMq4YjWVD71/z4Gmf1gWtsKmgFNaISVw+lVeFQoxG6G6Ey9ws90CK8CwVZGZU3bXnSix+tvsHKk97jVnMlMG1zWXl3L6nSrPwvqXxWoft4WjP7PhjenoOqo+WW0xmqEk+oqypbJ9p/E/Z1DUY5jx/unnA9We07m0md4GlO7HCm4rHSNrFHZsVREJdVU5U6Aixl5cQ2PJXLNL2hUIVJsIINC2561eoWpppib7Ay6YvJG/5D8U+bz8oUZCUr7NT584aXo3uf1dLGX/+eKItbgNX/394ZJEmqAmEYK4KNa71Dhacw3gmICZ3FHGFOUUdxaXDKZ2GVpJCZJEi/jnlTLrstlQ9IfpIkMRVZZYtZycHxktTcenvSLy5H/dZRr7JKG7ckq0z9GkwE72mnCaxMdIh8/ONYtVxluU30jZ9Bok/nXrPrLC1jNTUV2l1gwogIzuCZOuH7e/x+skrkCPSCNXIRmEhKh69pZQES/gwXXcbKNLRg3wYhTHg6ndcTzeNxi7vHnLJ8UHlaNLO5ZXTqKg0GMuoaqyCNyxxsLqJY4XPTJ6sBNSX8iHpiFflg+hSr3PwxpayCNC5SVm/dExwXqpHIKjdAJPa9gq8sYGWvshob0VwhSE0yBawmjfs7DHo693a3xVmpu7SjEKxu9Pwnm1VUqNcIYhh5iLA6hwRwxyiCgsAEHHH7WfKKEp8c0yhsYcYbAcQU8o6NSFfyyuSomiCNi3QdfwSsRj7Pa+YOFnwQQHz9DfML13LkapJl5bs8lsZF1Oc9q3Oe1/jD1wqHIUZVAJwuAz5hz3CNClmVbtDuwDB6yl2qKrCaKVaL0EG1V6G4aKyvpFJSRJkvICsY2p1lOTchtZ0VWI26yEpfqrnya6z5MDPvpewxyQNY8S+dGoyV191VPznDmVcX/IvVqzDwaO4GWeXkJqJjNLp7u2zmr8kNkXYkdBc4E6xMxOpZUDKCJWFSptBnLmWVmxOr4DDKo0pxzn2C1TirmJUr6KD+W1a5za+A1WHtidjYtPEzc3hrVVZCN/4IjlcS+QWrs+LHzY7gWYHVlL9w30iGAX/LlL/P4wor6vkTxypB4T3fK2El6K6JW3j/hU8Er0tZdSEvV9A7YW1Tijq9vgD9buD8m8uskkdA8O1WKm7O74j8Jhc2fmGsWhBd2QMtco3V3oubMhWRocfgJ8wxv0lXhWXPOXaO+hAMA2OvLrAq1WMUq+N1cPpTsspMV9Pqz8hiptL3TCXpvlfAaiyuePNVrJgqDlnNKCCbqdj3s0BVcraRs9Ma5A89uhewa76MRazQTOyhl82zMvpEFbjFl1xWbJuaNf7zhK/hWOkazxsgIlZTw80BU+Myz+p87MVxJ1j7sNmsDPoHw7FKOEdX+wPmuo2bjN+DWNLzhawMzspeYRXZM1che62QrG7cnHC1Lp0zzUouEEzPsKLlynOtDuovyMr6Utic16IsXdn2Aob5JdXJWUdprNX+fKWEdqxg98odIaa+TP22pKHxK0tcXgmdzwr0+ZPsCN5iEFZjfCayys/FgUcVOMPM9towpN+35NaHDdjipQPAapO9OyvYjjXsgyyr5dkHn6ziJf6pAqtd0VEbBLhQdPdHv4YgWjpApamPfWsWe8PHpe7NquVZmRerlin7nG+voOyl/P7bG7Zvn7EO8WqQtyzr+fa9aeKzyNiOI/08/P8QdbVV7VFF8RL/1PNCcmZrFf7kQbM6J8P2FbmPm4824dY418I7JUhP2LOdVTyRxxeMBl/Ely1YXoopZmV4VvEfNfX6hTgEKckqtvt9PisVsIrtMMrqeWRWh1gAg8UmjLmsyNdT3nrjWE0MK5VgtRawiiedKCto54OGhMRx6HqsBsoWb7cZjBXhQYhYDYgeogellZigY/YYKrogXos9gCifVXCc50BJo+mUZD3pYAuHsaCGO4nYEUbCwkcH7WpIux8yJqdhFZFPDwxtp/IuPKpJyyY9CacCzarUfyO5hhpBKHiBBvVVF5xI10pSKWpYVYq0qO+67J/H6vY3sKpyrR9W8g/+vi+2fxiqxQ7f9u77h9X/9lps+4EgVmkfBJ8rff0L+VLBEw==';

// Pre-computed blob metadata: flat arrays, 7 values per blob
// [x1, y1, x2, y2, cx, cy, cellCount, ...]
const _LAKE_META_KINGSHOT =[845,1,854,10,849.4,4.7,49,448,2,458,9,452.5,5.1,49,678,7,686,13,681.5,9.2,36,169,8,179,16,173.7,12.1,46,457,11,466,20,461.1,15.2,50,904,13,911,24,906.4,18.0,47,754,21,764,29,758.6,24.6,49,1027,21,1034,29,1030.1,24.4,41,179,22,189,32,183.0,26.4,59,373,22,379,30,375.2,26.1,37,992,22,1000,31,995.2,25.8,52,686,29,694,38,690.0,32.3,45,1034,30,1041,39,1036.5,34.0,50,782,31,789,41,785.3,35.2,46,115,32,125,40,120.3,36.5,45,733,33,740,40,736.0,36.2,34,558,34,568,40,562.2,36.5,45,326,35,334,44,329.4,39.0,46,237,39,243,49,239.4,43.2,48,8,40,18,48,11.7,42.8,46,813,42,822,52,816.5,47.5,57,65,43,74,52,68.5,46.9,52,117,43,127,50,121.8,46.1,49,738,52,745,62,740.9,57.0,49,484,56,497,66,490.0,60.8,77,550,56,559,64,554.3,59.4,43,453,57,463,69,457.5,61.9,91,852,59,859,72,855.0,65.1,54,349,63,359,74,353.3,68.5,55,313,64,322,73,317.9,68.3,48,942,65,951,72,945.9,68.3,42,1146,66,1155,72,1149.9,68.5,39,1015,68,1027,76,1020.4,71.3,49,364,70,374,77,368.7,73.5,46,908,75,917,83,912.3,78.1,46,988,77,996,85,991.4,80.4,45,1123,79,1135,87,1128.2,81.9,50,601,85,610,92,605.3,88.3,43,662,85,669,93,665.1,88.7,39,1068,86,1079,94,1073.8,89.6,47,460,91,469,97,464.4,93.4,41,836,93,842,103,838.7,97.3,49,1143,93,1153,102,1147.6,96.8,45,318,98,331,106,323.6,101.7,72,409,98,417,108,412.9,102.2,50,230,99,240,107,234.2,102.6,57,109,100,118,106,112.8,102.6,39,539,106,548,113,542.9,109.0,38,1125,108,1136,117,1130.0,111.6,56,579,111,586,118,582.1,113.7,42,787,113,795,123,790.5,118.5,50,429,115,438,121,433.1,117.0,39,599,115,606,122,602.0,118.3,36,116,119,124,127,119.5,123.2,42,576,120,582,128,578.4,124.2,32,383,124,390,131,386.4,127.1,36,257,125,264,132,259.7,127.7,34,127,126,136,133,131.1,129.0,41,163,126,170,134,166.1,129.8,45,275,136,282,147,277.6,140.8,45,283,140,292,150,287.2,144.1,54,169,142,176,151,171.9,146.0,41,385,142,393,150,388.4,145.6,51,355,145,361,154,357.1,149.3,41,691,146,700,155,695.1,150.0,47,830,147,839,157,834.0,152.3,52,335,153,342,162,338.4,157.2,37,694,157,703,167,698.9,161.9,47,1003,161,1010,170,1005.8,164.9,36,386,168,392,177,388.7,172.0,38,127,170,142,182,132.8,174.8,109,898,172,909,182,902.5,176.1,60,1149,174,1157,186,1152.9,179.5,53,987,178,997,185,991.4,181.0,45,402,182,410,189,405.5,185.3,41,591,183,599,192,593.7,187.4,43,178,187,189,196,182.8,191.0,70,302,187,310,195,305.5,190.9,42,641,188,651,196,645.8,191.6,52,69,189,78,196,73.1,191.7,41,666,189,674,199,668.9,194.0,56,768,191,784,202,775.2,196.1,101,448,194,461,207,454.0,199.5,102,682,203,689,210,684.8,206.5,37,291,205,303,212,296.6,208.2,49,812,205,819,214,815.1,209.0,39,904,205,912,214,908.3,209.6,43,84,209,95,218,88.9,212.9,63,926,218,933,230,929.1,223.2,59,937,221,947,232,941.9,226.9,60,628,222,636,231,632.1,225.6,45,803,224,813,231,807.6,226.7,45,1144,225,1154,232,1148.6,227.9,43,1092,230,1098,239,1094.0,233.5,35,173,232,182,241,176.8,235.7,54,51,234,62,244,55.9,238.6,68,533,234,543,241,537.4,237.2,40,1146,234,1155,242,1150.8,237.1,50,1044,239,1052,248,1047.9,242.9,49,113,243,120,255,116.0,248.7,53,649,248,658,256,652.4,251.4,50,896,256,903,268,898.7,261.3,53,39,259,48,264,43.3,261.3,35,111,261,119,268,114.2,264.3,39,781,270,787,281,783.0,275.5,42,791,270,801,277,795.2,272.4,44,823,270,832,278,826.9,273.2,49,763,276,774,283,767.9,278.8,57,312,280,319,290,315.3,284.3,47,190,284,197,291,193.2,286.9,36,251,286,261,294,255.6,289.8,54,167,292,175,302,170.0,297.0,43,58,301,71,311,63.8,305.8,91,586,301,594,308,589.6,304.1,36,869,301,879,310,873.2,305.4,51,275,302,283,311,278.6,306.4,47,238,303,254,315,246.4,307.9,103,1104,303,1111,311,1107.3,306.4,37,721,304,727,313,723.7,308.1,38,365,307,372,312,368.0,309.4,25,119,313,129,320,123.4,316.0,49,663,317,669,325,665.3,320.9,32,844,320,851,326,847.3,322.6,34,53,321,64,328,57.7,323.9,48,734,321,743,329,738.4,324.8,42,83,324,93,330,87.1,326.7,43,568,326,580,334,574.1,329.0,50,658,329,669,337,663.5,332.3,52,496,330,503,336,498.7,332.3,26,50,331,57,340,52.6,334.9,44,599,331,610,339,604.0,334.5,52,911,338,920,345,915.2,340.7,41,780,340,788,348,783.6,343.8,39,359,345,366,351,361.9,347.6,25,428,348,435,357,431.6,352.4,46,529,349,538,355,533.4,351.4,39,135,350,142,357,138.5,352.9,34,87,358,96,363,91.2,360.2,33,778,360,786,367,781.2,363.1,29,891,360,897,366,893.6,362.7,25,55,364,65,378,60.1,370.6,79,301,366,306,372,302.9,368.0,23,772,366,779,374,775.2,369.5,34,6,368,15,375,10.3,370.9,44,197,370,206,376,201.1,372.5,44,533,371,543,378,538.1,373.3,46,389,372,394,380,391.0,375.5,26,648,372,657,384,651.9,377.1,72,1053,372,1062,383,1057.4,377.4,54,738,373,744,380,740.7,375.9,28,874,377,880,386,876.2,381.4,40,770,378,783,388,776.4,382.5,67,535,380,543,386,538.7,382.4,36,1112,381,1123,390,1116.0,384.9,61,311,383,318,388,314.0,385.0,24,1086,383,1094,390,1089.1,385.7,43,62,387,75,398,67.5,392.3,75,370,387,377,396,372.5,391.5,37,1017,388,1028,401,1022.0,393.3,69,1033,388,1042,395,1036.8,391.3,38,37,391,45,401,40.3,395.9,57,832,391,843,400,836.6,395.3,63,958,393,967,402,962.1,397.3,54,1076,398,1086,406,1080.8,401.4,45,48,402,58,411,52.6,405.7,58,717,405,724,411,719.9,407.9,25,656,409,661,417,657.8,412.6,26,997,411,1007,418,1001.0,414.0,42,1,415,7,425,3.4,420.2,45,301,419,309,426,304.5,421.9,45,560,419,564,426,561.6,421.9,25,1161,422,1176,431,1167.3,425.8,88,990,423,998,431,993.3,426.3,41,671,424,678,430,674.2,426.5,32,506,436,513,441,509.5,438.1,24,608,436,614,443,610.4,438.8,30,251,440,261,449,255.4,443.9,53,175,442,183,450,178.9,445.4,41,303,443,313,450,307.2,446.2,46,781,443,790,449,784.4,445.0,38,369,448,379,456,373.6,451.7,47,1011,451,1019,460,1013.9,454.9,46,503,454,510,460,505.8,456.4,30,807,456,817,463,811.4,459.0,45,1133,457,1143,466,1137.6,461.2,53,137,458,150,469,142.7,463.7,84,932,460,941,468,936.2,463.7,53,844,462,850,468,846.4,464.4,24,1042,465,1055,475,1047.9,469.4,58,455,469,461,477,457.1,472.5,33,1032,469,1039,477,1035.5,472.2,39,757,471,762,479,759.0,474.6,27,353,472,366,486,359.0,478.2,94,808,472,816,480,811.7,475.9,40,1089,472,1100,484,1093.8,478.0,78,565,473,572,480,567.8,475.8,31,166,474,175,481,169.7,476.9,47,725,474,732,484,728.2,478.2,37,937,476,943,485,939.4,480.1,39,81,478,90,487,85.6,482.6,48,909,482,917,493,912.4,487.7,46,171,484,179,492,174.3,487.5,45,402,484,413,492,406.7,487.9,48,160,489,168,498,163.5,492.9,43,467,489,475,500,470.5,494.4,55,1188,489,1199,498,1193.6,492.7,72,257,496,267,505,261.5,500.4,55,691,496,699,504,693.7,499.1,38,709,497,716,503,711.9,499.5,28,854,501,861,509,857.2,504.8,36,784,503,791,509,786.9,505.9,29,991,506,998,513,993.6,508.7,38,74,511,80,520,76.4,515.3,37,332,512,341,525,335.5,518.4,72,807,516,814,524,809.9,519.6,29,650,519,659,527,654.5,522.0,36,1015,520,1026,529,1019.8,524.3,69,304,521,314,528,307.9,524.1,47,728,521,735,526,731.2,523.0,29,836,521,845,528,840.2,524.0,42,503,537,509,548,505.3,541.9,40,590,537,595,546,592.1,540.7,34,534,538,539,545,536.2,541.1,26,232,540,240,551,235.1,544.2,54,77,542,86,551,81.8,545.6,44,679,542,685,549,681.6,545.2,28,11,548,19,557,14.9,552.0,47,188,548,194,558,190.5,552.6,36,531,550,537,558,533.9,553.3,35,316,551,321,558,318.3,553.7,27,165,562,173,569,168.4,565.3,45,97,565,106,572,101.2,568.0,43,464,569,475,580,468.3,574.1,66,1143,576,1151,585,1146.6,579.6,49,30,577,39,586,33.4,581.9,53,890,580,898,591,893.7,585.1,48,852,582,861,589,856.2,585.3,36,903,583,912,590,907.5,586.1,42,1049,591,1056,599,1052.2,594.6,40,732,592,749,598,740.1,594.6,69,1185,592,1199,603,1191.7,597.7,108,354,593,363,599,357.7,595.7,35,141,595,151,603,145.4,598.5,51,466,597,471,604,467.7,599.7,27,709,597,720,609,714.5,601.7,70,1102,608,1109,618,1105.1,612.7,45,490,611,497,617,492.8,613.1,29,182,612,193,619,187.0,615.4,51,99,613,106,624,102.3,617.9,54,169,615,179,622,173.4,617.9,59,648,618,654,626,650.6,621.5,34,665,625,671,634,667.9,629.0,33,890,625,896,634,892.8,628.7,39,135,628,143,639,139.0,633.2,51,509,632,515,639,511.5,635.2,31,921,633,930,640,925.0,635.9,39,797,636,806,643,800.9,638.7,35,526,645,531,653,528.3,648.2,29,562,651,569,658,564.8,654.3,33,111,654,121,670,114.8,661.6,98,455,654,462,663,458.2,658.0,34,996,654,1004,664,999.3,659.0,52,697,657,705,663,700.1,659.7,34,731,660,739,673,734.7,665.9,68,445,661,449,669,446.4,664.8,28,1053,661,1060,671,1055.6,665.4,54,227,664,234,673,230.3,668.1,41,309,669,317,678,312.9,672.6,53,245,670,257,677,250.7,673.2,52,752,670,758,678,754.5,673.4,27,594,671,602,678,597.6,673.6,36,125,672,134,680,128.7,675.5,54,657,674,663,683,659.1,677.7,34,1114,675,1125,684,1118.5,679.6,55,929,677,944,689,936.1,682.0,120,1174,677,1185,685,1179.5,680.3,47,743,679,749,687,745.7,682.1,30,58,682,66,692,61.7,686.4,47,710,683,717,691,713.0,686.4,31,425,688,433,697,429.0,691.7,42,553,689,560,695,555.7,691.4,29,562,689,571,693,566.2,690.7,32,732,689,740,697,735.4,692.5,35,579,692,586,698,581.9,694.8,33,674,692,682,700,677.0,695.9,34,270,693,277,702,273.0,696.8,42,501,694,509,701,504.2,696.4,37,783,697,790,703,786.0,699.8,27,177,699,193,712,185.0,705.6,111,546,700,553,708,549.2,703.0,35,698,700,705,708,701.6,703.5,34,1064,704,1072,712,1067.7,707.2,40,884,705,889,714,885.7,709.0,32,79,706,90,715,83.5,710.3,57,607,708,614,715,609.6,711.5,32,107,712,114,719,110.2,714.8,37,993,712,1002,720,996.7,715.6,53,709,713,715,719,711.3,715.7,30,26,716,35,726,29.7,720.2,54,426,716,433,722,429.1,718.6,25,718,717,727,723,722.6,720.1,36,1,718,10,728,6.0,723.3,52,488,718,495,726,491.3,721.8,36,910,722,916,731,912.6,726.1,38,678,724,685,731,681.3,727.0,36,1154,725,1163,733,1158.2,729.0,50,1167,725,1175,732,1170.4,727.9,44,1100,730,1107,737,1103.3,733.0,38,505,731,514,739,509.6,735.0,41,555,733,562,743,557.7,737.6,34,908,734,916,741,912.2,736.8,38,600,735,607,742,603.5,738.5,35,643,736,650,744,645.7,739.6,35,318,738,325,744,321.0,740.4,28,337,742,344,751,340.0,746.0,41,209,749,218,759,213.2,753.8,52,868,749,873,754,870.4,751.0,20,619,751,627,756,622.6,752.7,30,557,756,564,765,560.5,760.1,42,516,759,522,768,518.6,763.5,37,197,761,203,771,199.0,765.4,44,982,763,992,774,986.7,768.0,59,354,768,360,776,357.1,771.7,30,442,770,451,776,446.4,772.9,40,373,772,379,779,375.8,774.9,30,501,772,506,778,503.0,774.7,26,799,777,808,785,802.7,779.9,43,188,781,195,792,191.2,786.1,48,335,784,341,791,337.7,787.2,32,846,784,855,790,850.1,786.4,34,1069,784,1078,795,1073.1,789.3,55,30,785,39,792,33.4,787.7,43,414,785,422,792,417.6,788.1,35,820,786,827,792,822.7,788.4,34,903,791,912,799,907.0,795.1,40,520,793,526,801,522.3,796.7,35,129,794,136,804,132.2,798.7,49,30,796,38,805,33.7,800.3,47,450,798,459,806,454.0,801.1,45,1064,802,1073,810,1067.5,805.5,47,319,803,326,808,322.2,804.8,29,911,803,920,810,915.2,806.2,40,61,806,70,814,64.6,809.8,45,421,808,427,814,423.4,810.5,27,888,813,895,821,890.8,816.8,41,1141,814,1149,821,1144.0,817.7,39,1108,815,1116,823,1111.5,818.3,44,557,826,564,834,559.5,828.9,35,875,827,880,833,877.4,829.5,22,817,828,825,837,820.6,832.1,47,447,835,453,841,449.6,837.7,27,1003,836,1012,845,1007.4,839.9,52,347,837,354,845,350.7,840.0,32,303,838,313,849,307.2,843.0,50,793,839,803,851,797.7,844.4,72,1045,839,1052,848,1048.1,842.9,39,462,841,469,850,465.5,845.4,44,883,845,891,851,886.4,847.7,38,852,849,861,859,855.6,853.5,46,1132,849,1138,857,1134.5,852.4,33,1006,852,1015,861,1009.7,856.4,55,694,858,699,865,695.8,861.0,29,1079,858,1087,869,1082.3,863.1,47,915,860,929,874,922.1,866.9,92,602,862,608,866,604.8,863.3,21,314,867,321,875,317.5,870.2,40,887,872,893,879,889.7,874.8,36,470,874,478,882,474.0,877.8,39,1090,874,1097,882,1092.9,877.2,38,527,877,535,885,530.6,880.2,45,186,880,196,887,191.2,882.7,44,889,880,894,885,891.0,882.2,21,905,882,920,894,912.2,887.4,93,347,883,362,895,354.0,888.8,84,591,885,598,891,594.1,887.3,33,812,887,819,891,815.1,888.4,25,527,889,538,899,532.0,893.7,70,483,903,492,912,486.3,907.3,52,17,904,31,915,23.2,908.6,107,656,905,664,913,659.6,908.1,40,884,905,893,913,887.7,908.6,53,204,906,213,913,208.3,908.8,44,796,906,804,913,799.6,909.0,46,1016,909,1026,915,1020.5,911.5,42,1079,912,1088,921,1083.5,916.5,46,571,914,586,925,577.7,918.3,96,1095,918,1103,925,1098.7,921.4,42,68,923,78,931,72.7,926.6,46,709,924,715,933,711.3,927.5,44,1037,930,1046,939,1040.5,934.0,57,812,932,819,944,814.9,937.1,55,926,933,935,941,929.3,937.0,43,495,937,503,945,498.4,940.5,47,1107,943,1117,952,1111.9,947.2,48,321,945,329,952,324.1,947.8,42,37,952,47,959,41.6,954.7,37,296,952,304,962,299.5,956.9,50,779,958,789,968,782.8,962.0,60,888,966,895,973,891.0,969.1,36,699,967,713,977,705.2,971.4,92,715,970,722,977,717.6,973.1,40,67,980,77,987,71.4,983.1,43,1155,980,1163,988,1158.4,983.5,52,1118,982,1125,991,1121.2,985.7,46,705,983,711,992,708.1,987.2,39,261,986,269,992,264.4,988.6,38,98,990,105,999,100.9,994.0,41,348,990,360,997,353.4,992.6,53,59,997,69,1003,63.8,999.6,39,204,997,210,1008,206.4,1002.0,50,1141,998,1149,1005,1144.5,1001.0,44,972,999,980,1005,975.5,1001.4,39,1054,1002,1062,1009,1057.7,1004.8,38,848,1005,858,1012,852.4,1008.1,39,1186,1007,1195,1015,1190.6,1010.9,45,462,1008,477,1018,469.2,1012.2,85,250,1009,263,1031,255.6,1019.7,180,794,1012,809,1023,801.3,1016.5,98,382,1019,390,1028,385.5,1023.1,51,423,1019,431,1026,426.4,1022.3,40,36,1021,45,1029,39.6,1024.2,55,186,1021,197,1029,190.7,1024.2,54,291,1021,300,1028,295.1,1024.1,42,439,1023,448,1033,442.8,1027.6,57,156,1024,164,1031,159.4,1027.2,40,23,1025,31,1033,26.2,1028.7,45,614,1027,621,1034,616.7,1029.9,36,884,1027,894,1034,888.3,1030.1,48,54,1030,60,1038,56.6,1033.7,39,659,1031,666,1038,662.1,1034.0,35,619,1036,625,1043,621.4,1039.0,34,883,1036,893,1045,887.7,1039.5,46,642,1038,649,1049,644.9,1042.6,55,1104,1038,1114,1045,1108.5,1041.1,50,36,1039,44,1045,39.5,1042.0,36,307,1040,321,1056,313.4,1047.8,104,1116,1044,1125,1052,1120.3,1047.3,50,83,1046,89,1056,85.3,1050.7,42,38,1047,49,1056,43.8,1052.0,51,280,1047,285,1056,281.6,1050.9,35,398,1049,409,1060,403.4,1053.8,77,966,1057,972,1066,968.6,1060.9,39,1,1060,16,1070,7.8,1064.5,93,592,1061,599,1070,595.3,1065.1,41,185,1069,193,1077,188.9,1072.5,43,476,1069,483,1077,479.0,1072.0,42,1179,1072,1187,1080,1182.4,1075.5,40,1044,1073,1050,1080,1046.3,1075.8,32,927,1075,933,1083,929.5,1078.5,36,1145,1076,1152,1084,1148.1,1079.4,43,265,1078,274,1085,268.6,1081.3,50,405,1078,412,1086,408.3,1081.0,35,723,1080,731,1091,726.7,1085.3,51,386,1081,393,1088,389.1,1083.7,36,802,1082,814,1088,807.8,1085.0,49,128,1084,136,1092,130.9,1087.6,43,625,1084,635,1090,629.5,1086.7,45,475,1085,483,1092,477.9,1087.6,37,512,1091,520,1099,515.6,1094.5,40,536,1093,544,1102,540.1,1097.5,45,65,1094,76,1100,70.1,1096.5,49,379,1095,386,1101,381.8,1097.1,33,1023,1095,1032,1103,1026.7,1098.7,42,838,1097,850,1106,843.4,1101.0,55,801,1100,813,1108,806.5,1103.5,58,207,1105,217,1114,212.1,1108.5,51,840,1109,849,1118,844.5,1113.4,41,195,1111,202,1118,197.7,1113.9,38,653,1111,664,1115,658.2,1112.3,36,5,1112,15,1120,9.4,1115.3,50,56,1114,65,1122,60.5,1117.0,39,647,1118,655,1126,650.4,1121.5,45,1177,1123,1185,1131,1180.6,1126.4,44,37,1124,47,1134,41.3,1128.1,53,1030,1131,1039,1141,1034.2,1134.9,51,556,1132,561,1141,558.1,1135.8,35,348,1133,357,1141,352.1,1136.5,39,76,1135,87,1145,81.0,1139.0,79,822,1135,829,1143,824.5,1138.9,40,943,1135,953,1145,947.8,1139.5,57,294,1146,303,1153,297.7,1148.7,44,975,1146,981,1154,976.9,1149.6,35,590,1150,598,1158,593.7,1153.5,53,570,1152,578,1163,573.3,1157.3,53,756,1152,765,1160,759.3,1155.9,51,844,1153,850,1163,846.0,1158.1,48,956,1153,964,1161,959.1,1156.5,40,496,1154,503,1162,498.9,1157.7,38,868,1161,878,1171,872.8,1164.5,55,35,1171,41,1181,37.3,1175.8,41,183,1174,192,1183,187.4,1178.4,56,140,1175,150,1186,144.5,1179.5,54,713,1175,721,1185,716.9,1179.2,55,591,1176,599,1184,594.0,1180.0,47,1116,1180,1127,1192,1121.2,1186.5,81,462,1181,469,1188,465.0,1184.0,41,748,1181,756,1189,751.6,1185.0,40,640,1183,648,1191,644.0,1186.9,44,277,1184,284,1191,279.7,1187.3,38,688,1184,695,1196,690.9,1189.2,52,194,1191,205,1199,199.0,1194.9,49];
const _MT_META_KINGSHOT =[54,10,60,18,56.8,13.3,37,80,11,87,17,83.1,13.6,36,838,11,844,18,840.6,13.8,35,1161,11,1167,18,1163.6,13.8,35,617,14,624,20,619.9,16.8,32,909,14,915,22,911.8,17.3,37,1141,14,1147,21,1143.6,16.8,35,210,15,217,21,212.9,17.8,32,309,15,315,23,311.8,18.3,37,324,15,330,22,326.6,17.8,35,657,15,664,21,659.9,17.8,32,1118,15,1125,21,1120.9,17.8,32,676,18,682,26,678.8,21.3,37,70,19,76,27,72.8,22.3,37,1089,19,1095,26,1091.6,21.8,35,32,20,38,27,34.6,22.8,35,799,20,806,26,801.9,22.8,32,876,20,883,26,879.1,22.6,36,895,20,902,26,898.1,22.6,36,1105,20,1111,27,1107.6,22.8,35,141,21,148,27,143.9,23.8,32,419,21,426,27,421.9,23.8,32,234,22,241,28,237.1,24.6,36,592,22,599,28,595.1,24.6,36,536,23,542,30,538.6,25.8,35,273,24,280,30,275.9,26.8,32,350,24,356,32,352.8,27.3,37,725,24,731,31,727.6,26.8,35,948,24,954,32,950.8,27.3,37,1162,24,1169,30,1165.1,26.6,36,709,27,716,33,711.9,29.8,32,751,28,757,35,753.6,30.8,35,839,28,845,35,841.6,30.8,35,850,29,856,36,852.6,31.8,35,910,29,917,35,913.1,31.6,36,938,31,944,39,940.8,34.3,37,195,33,202,39,197.9,35.8,32,454,33,461,39,457.1,35.6,36,616,33,623,39,619.1,35.6,36,926,33,933,39,928.9,35.8,32,366,34,373,40,369.1,36.6,36,1005,34,1012,40,1007.9,36.8,32,1058,34,1065,40,1060.9,36.8,32,280,36,287,42,283.1,38.6,36,138,37,145,43,140.9,39.8,32,344,37,351,43,347.1,39.6,36,482,37,488,45,484.8,40.3,37,583,37,590,43,585.9,39.8,32,645,37,651,44,647.6,39.8,35,1086,37,1092,45,1088.8,40.3,37,318,38,324,45,320.6,40.8,35,126,39,132,46,128.6,41.8,35,663,39,669,46,665.6,41.8,35,508,40,515,46,510.9,42.8,32,950,40,957,46,953.1,42.6,36,106,41,113,47,109.1,43.6,36,794,41,800,48,796.6,43.8,35,782,42,789,48,785.1,44.6,36,386,43,393,49,389.1,45.6,36,886,43,892,50,888.6,45.8,35,972,43,979,49,974.9,45.8,32,772,44,778,51,774.6,46.8,35,990,44,997,50,993.1,46.6,36,537,45,544,51,539.9,47.8,32,702,45,709,51,705.1,47.6,36,1047,46,1054,52,1049.9,48.8,32,1074,46,1081,52,1076.9,48.8,32,10,47,16,54,12.6,49.8,35,169,47,176,53,171.9,49.8,32,260,47,267,53,263.1,49.6,36,339,47,346,53,342.1,49.6,36,519,47,526,53,522.1,49.6,36,595,47,601,54,597.6,49.8,35,725,47,731,55,727.8,50.3,37,634,49,641,55,637.1,51.6,36,1030,49,1037,55,1033.1,51.6,36,126,50,132,58,128.8,53.3,37,353,50,359,58,355.8,53.3,37,840,50,846,58,842.8,53.3,37,243,52,250,58,246.1,54.6,36,287,52,294,58,289.9,54.8,32,474,52,480,60,476.8,55.3,37,617,54,624,60,619.9,56.8,32,755,54,762,60,757.9,56.8,32,385,55,391,63,387.8,58.3,37,653,55,660,61,655.9,57.8,32,677,55,684,61,680.1,57.6,36,795,55,801,62,797.6,57.8,35,103,56,109,64,105.8,59.3,37,565,56,572,62,568.1,58.6,36,784,56,791,62,787.1,58.6,36,1175,56,1182,62,1177.9,58.8,32,58,58,65,64,61.1,60.6,36,263,58,269,65,265.6,60.8,35,1002,58,1008,65,1004.6,60.8,35,591,59,598,65,594.1,61.6,36,336,61,343,67,339.1,63.6,36,716,62,723,68,718.9,64.8,32,243,63,250,69,245.9,65.8,32,419,63,425,70,421.6,65.8,35,179,64,185,71,181.6,66.8,35,438,64,444,71,440.6,66.8,35,629,64,635,72,631.8,67.3,37,1026,64,1033,70,1029.1,66.6,36,1047,65,1054,71,1049.9,67.8,32,1077,65,1084,71,1079.9,67.8,32,833,66,839,74,835.8,69.3,37,1180,66,1186,73,1182.6,68.8,35,973,67,980,73,976.1,69.6,36,118,68,125,74,121.1,70.6,36,199,69,205,77,201.8,72.3,37,97,70,104,76,99.9,72.8,32,650,71,656,79,652.8,74.3,37,921,71,928,77,924.1,73.6,36,1114,71,1120,79,1116.8,74.3,37,1137,71,1143,79,1139.8,74.3,37,640,72,646,79,642.6,74.8,35,280,73,287,79,282.9,75.8,32,410,73,416,80,412.6,75.8,35,248,74,255,80,251.1,76.6,36,64,75,71,81,66.9,77.8,32,178,75,185,81,181.1,77.6,36,317,75,323,82,319.6,77.8,35,804,75,810,82,806.6,77.8,35,146,76,152,84,148.8,79.3,37,480,76,487,82,482.9,78.8,32,761,76,767,84,763.8,79.3,37,955,76,961,84,957.8,79.3,37,1027,76,1033,84,1029.8,79.3,37,398,77,405,83,400.9,79.8,32,817,78,823,86,819.8,81.3,37,850,78,856,86,852.8,81.3,37,931,78,938,84,934.1,80.6,36,693,79,699,86,695.6,81.8,35,1101,79,1108,85,1104.1,81.6,36,20,80,26,87,22.6,82.8,35,35,81,42,87,38.1,83.6,36,595,81,602,87,597.9,83.8,32,134,82,141,88,136.9,84.8,32,461,82,467,89,463.6,84.8,35,914,82,920,89,916.6,84.8,35,1165,82,1172,88,1168.1,84.6,36,1012,83,1018,91,1014.8,86.3,37,1050,83,1056,91,1052.8,86.3,37,231,84,237,92,233.8,87.3,37,646,84,653,90,649.1,86.6,36,721,84,727,91,723.6,86.8,35,1037,84,1043,91,1039.6,86.8,35,1090,84,1096,92,1092.8,87.3,37,301,85,308,91,303.9,87.8,32,329,86,336,92,331.9,88.8,32,630,86,636,94,632.8,89.3,37,256,87,262,94,258.6,89.8,35,737,87,744,93,740.1,89.6,36,471,89,477,96,473.6,91.8,35,611,89,617,97,613.8,92.3,37,344,91,350,98,346.6,93.8,35,505,91,511,99,507.8,94.3,37,862,91,868,98,864.6,93.8,35,989,91,996,97,991.9,93.8,32,204,92,210,99,206.6,94.8,35,667,92,673,99,669.6,94.8,35,959,92,965,100,961.8,95.3,37,286,93,292,101,288.8,96.3,37,222,94,229,100,224.9,96.8,32,713,94,720,100,715.9,96.8,32,639,95,645,103,641.8,98.3,37,91,96,98,102,93.9,98.8,32,899,96,905,104,901.8,99.3,37,334,99,340,107,336.8,102.3,37,682,99,688,107,684.8,102.3,37,758,99,764,107,760.8,102.3,37,1097,100,1103,107,1099.6,102.8,35,382,101,388,108,384.6,103.8,35,78,102,85,108,81.1,104.6,36,172,102,178,110,174.8,105.3,37,817,102,823,109,819.6,104.8,35,221,104,228,110,223.9,106.8,32,1143,104,1150,110,1145.9,106.8,32,194,105,200,112,196.6,107.8,35,615,106,621,113,617.6,108.8,35,837,106,844,112,839.9,108.8,32,28,107,34,114,30.6,109.8,35,444,107,451,113,447.1,109.6,36,1012,107,1019,113,1014.9,109.8,32,717,108,723,116,719.8,111.3,37,397,110,403,117,399.6,112.8,35,48,111,54,118,50.6,113.8,35,68,112,75,118,70.9,114.8,32,345,112,352,118,348.1,114.6,36,379,112,385,120,381.8,115.3,37,1072,112,1079,118,1075.1,114.6,36,862,113,868,121,864.8,116.3,37,1053,113,1060,119,1055.9,115.8,32,1085,113,1091,121,1087.8,116.3,37,335,115,341,122,337.6,117.8,35,483,115,489,123,485.8,118.3,37,494,115,500,122,496.6,117.8,35,766,115,772,122,768.6,117.8,35,1148,115,1155,121,1150.9,117.8,32,307,116,314,122,310.1,118.6,36,1026,116,1032,124,1028.8,119.3,37,555,117,561,124,557.6,119.8,35,366,118,372,126,368.8,121.3,37,809,118,815,126,811.8,121.3,37,911,118,918,124,913.9,120.8,32,1042,118,1049,124,1044.9,120.8,32,16,119,23,125,18.9,121.8,32,568,119,574,126,570.6,121.8,35,621,119,627,126,623.6,121.8,35,744,119,750,127,746.8,122.3,37,946,119,953,125,948.9,121.8,32,971,119,977,126,973.6,121.8,35,323,120,329,128,325.8,123.3,37,583,120,589,127,585.6,122.8,35,983,120,989,127,985.6,122.8,35,999,120,1005,128,1001.8,123.3,37,425,121,431,129,427.8,124.3,37,596,122,602,130,598.8,125.3,37,713,123,720,129,715.9,125.8,32,726,123,733,129,728.9,125.8,32,210,124,217,130,213.1,126.6,36,779,125,785,132,781.6,127.8,35,298,126,304,134,300.8,129.3,37,840,126,847,132,843.1,128.6,36,107,127,114,133,110.1,129.6,36,640,127,646,135,642.8,130.3,37,500,128,507,134,503.1,130.6,36,186,129,193,135,189.1,131.6,36,1052,129,1058,136,1054.6,131.8,35,794,130,800,138,796.8,133.3,37,453,131,460,137,455.9,133.8,32,16,132,23,138,18.9,134.8,32,680,132,687,138,682.9,134.8,32,893,132,899,139,895.6,134.8,35,905,132,911,140,907.8,135.3,37,691,133,698,139,694.1,135.6,36,1111,134,1117,141,1113.6,136.8,35,61,136,67,143,63.6,138.8,35,79,136,86,142,82.1,138.6,36,266,137,272,144,268.6,139.8,35,781,137,788,143,783.9,139.8,32,579,140,586,146,581.9,142.8,32,1142,141,1149,147,1144.9,143.8,32,437,142,444,148,439.9,144.8,32,556,142,562,150,558.8,145.3,37,803,142,809,149,805.6,144.8,35,895,143,901,151,897.8,146.3,37,1026,143,1032,151,1028.8,146.3,37,18,144,25,150,21.1,146.6,36,419,144,426,150,421.9,146.8,32,1084,145,1091,151,1086.9,147.8,32,329,147,335,154,331.6,149.8,35,701,147,708,153,704.1,149.6,36,186,149,193,155,188.9,151.8,32,372,149,379,155,374.9,151.8,32,970,149,976,156,972.6,151.8,35,265,150,271,158,267.8,153.3,37,632,150,639,156,634.9,152.8,32,983,150,990,156,985.9,152.8,32,716,151,723,157,719.1,153.6,36,994,151,1000,159,996.8,154.3,37,204,152,210,159,206.6,154.8,35,653,152,659,159,655.6,154.8,35,597,153,603,161,599.8,156.3,37,907,153,914,159,910.1,155.6,36,389,154,395,162,391.8,157.3,37,938,154,945,160,940.9,156.8,32,10,155,16,163,12.8,158.3,37,918,155,924,162,920.6,157.8,35,960,155,966,163,962.8,158.3,37,98,156,104,164,100.8,159.3,37,513,156,520,162,516.1,158.6,36,30,157,36,164,32.6,159.8,35,159,157,165,164,161.6,159.8,35,298,158,304,166,300.8,161.3,37,439,158,445,166,441.8,161.3,37,468,158,475,164,471.1,160.6,36,768,158,774,166,770.8,161.3,37,1182,159,1188,166,1184.6,161.8,35,253,160,260,166,256.1,162.6,36,537,160,544,166,540.1,162.6,36,705,160,711,168,707.8,163.3,37,328,161,334,168,330.6,163.8,35,58,162,64,169,60.6,164.8,35,309,162,315,170,311.8,165.3,37,1053,162,1060,168,1056.1,164.6,36,1116,162,1122,170,1118.8,165.3,37,780,163,787,169,782.9,165.8,32,346,164,352,171,348.6,166.8,35,624,164,631,170,627.1,166.6,36,1009,164,1016,170,1011.9,166.8,32,147,165,154,171,149.9,167.8,32,268,165,274,172,270.6,167.8,35,850,165,856,173,852.8,168.3,37,1020,165,1026,173,1022.8,168.3,37,73,167,79,174,75.6,169.8,35,693,167,699,174,695.6,169.8,35,986,167,993,173,989.1,169.6,36,45,168,52,174,48.1,170.6,36,409,168,415,175,411.6,170.8,35,669,168,676,174,671.9,170.8,32,811,168,818,174,813.9,170.8,32,867,169,874,175,870.1,171.6,36,551,171,558,177,554.1,173.6,36,949,171,956,177,951.9,173.8,32,615,172,622,178,617.9,174.8,32,182,173,189,179,185.1,175.6,36,752,173,759,179,754.9,175.8,32,248,174,254,182,250.8,177.3,37,358,174,365,180,361.1,176.6,36,599,174,605,182,601.8,177.3,37,395,175,401,183,397.8,178.3,37,887,175,894,181,890.1,177.6,36,343,176,349,183,345.6,178.8,35,703,176,710,182,706.1,178.6,36,1041,176,1047,184,1043.8,179.3,37,575,177,581,185,577.8,180.3,37,856,177,863,183,858.9,179.8,32,149,178,155,186,151.8,181.3,37,772,178,778,186,774.8,181.3,37,981,178,987,185,983.6,180.8,35,1122,178,1129,184,1124.9,180.8,32,56,179,63,185,59.1,181.6,36,428,179,435,185,431.1,181.6,36,831,179,837,187,833.8,182.3,37,36,180,42,187,38.6,182.8,35,507,180,514,186,510.1,182.6,36,801,181,807,189,803.8,184.3,37,950,181,957,187,952.9,183.8,32,1096,182,1102,189,1098.6,184.8,35,814,184,820,191,816.6,186.8,35,608,185,614,193,610.8,188.3,37,18,186,25,192,20.9,188.8,32,122,186,128,193,124.6,188.8,35,495,186,502,192,498.1,188.6,36,872,186,879,192,874.9,188.8,32,1082,186,1088,194,1084.8,189.3,37,269,187,275,194,271.6,189.8,35,678,187,684,195,680.8,190.3,37,853,187,860,193,855.9,189.8,32,1025,187,1032,193,1027.9,189.8,32,58,189,65,195,60.9,191.8,32,238,189,244,197,240.8,192.3,37,330,189,337,195,333.1,191.6,36,433,189,439,196,435.6,191.8,35,584,189,591,195,586.9,191.8,32,973,189,980,195,975.9,191.8,32,1111,189,1118,195,1114.1,191.6,36,1124,189,1130,196,1126.6,191.8,35,221,191,228,197,224.1,193.6,36,389,191,396,197,392.1,193.6,36,519,191,525,199,521.8,194.3,37,189,192,195,199,191.6,194.8,35,418,192,424,199,420.6,194.8,35,485,192,491,200,487.8,195.3,37,1138,192,1145,198,1141.1,194.6,36,34,195,41,201,37.1,197.6,36,732,195,738,202,734.6,197.8,35,839,195,845,202,841.6,197.8,35,1067,195,1074,201,1070.1,197.6,36,148,196,154,203,150.6,198.8,35,1016,196,1022,203,1018.6,198.8,35,24,198,30,206,26.8,201.3,37,283,198,290,204,285.9,200.8,32,179,199,185,206,181.6,201.8,35,756,199,763,205,759.1,201.6,36,787,199,794,205,790.1,201.6,36,939,199,946,205,941.9,201.8,32,1106,199,1112,206,1108.6,201.8,35,990,201,997,207,993.1,203.6,36,649,202,655,209,651.6,204.8,35,798,202,805,208,800.9,204.8,32,394,203,401,209,397.1,205.6,36,169,204,175,212,171.8,207.3,37,241,204,248,210,243.9,206.8,32,1094,206,1101,212,1096.9,208.8,32,516,207,522,214,518.6,209.8,35,526,207,532,214,528.6,209.8,35,637,207,644,213,639.9,209.8,32,775,207,781,214,777.6,209.8,35,1182,207,1188,214,1184.6,209.8,35,155,208,161,216,157.8,211.3,37,1054,208,1060,215,1056.6,210.8,35,100,209,106,216,102.6,211.8,35,1005,209,1012,215,1008.1,211.6,36,42,210,48,217,44.6,212.8,35,489,210,495,217,491.6,212.8,35,929,210,936,216,932.1,212.6,36,941,210,948,216,944.1,212.6,36,1142,211,1148,219,1144.8,214.3,37,432,212,438,220,434.8,215.3,37,139,213,146,219,142.1,215.6,36,918,214,925,220,920.9,216.8,32,956,214,962,221,958.6,216.8,35,452,216,458,224,454.8,219.3,37,758,216,764,224,760.8,219.3,37,901,216,908,222,904.1,218.6,36,1026,216,1032,224,1028.8,219.3,37,682,217,688,224,684.6,219.8,35,663,218,669,225,665.6,220.8,35,1116,218,1123,224,1118.9,220.8,32,24,220,30,227,26.6,222.8,35,188,220,195,226,191.1,222.6,36,519,220,526,226,521.9,222.8,32,1152,220,1159,226,1154.9,222.8,32,165,222,172,228,168.1,224.6,36,887,222,893,229,889.6,224.8,35,299,223,306,229,302.1,225.6,36,1063,223,1070,229,1065.9,225.8,32,47,224,54,230,49.9,226.8,32,203,224,209,232,205.8,227.3,37,727,225,734,231,730.1,227.6,36,696,226,702,234,698.8,229.3,37,1011,226,1017,234,1013.8,229.3,37,1179,226,1185,233,1181.6,228.8,35,126,227,132,235,128.8,230.3,37,914,227,920,234,916.6,229.8,35,254,228,260,236,256.8,231.3,37,929,229,935,237,931.8,232.3,37,31,230,38,236,33.9,232.8,32,440,230,447,236,442.9,232.8,32,810,230,817,236,813.1,232.6,36,315,231,321,238,317.6,233.8,35,543,232,549,239,545.6,234.8,35,1123,232,1130,238,1126.1,234.6,36,522,233,529,239,524.9,235.8,32,506,234,513,240,508.9,236.8,32,740,234,747,240,743.1,236.6,36,185,238,192,244,188.1,240.6,36,695,238,702,244,698.1,240.6,36,906,238,913,244,909.1,240.6,36,1161,238,1168,244,1163.9,240.8,32,656,239,663,245,658.9,241.8,32,794,239,801,245,797.1,241.6,36,919,239,926,245,921.9,241.8,32,17,240,24,246,20.1,242.6,36,756,240,762,248,758.8,243.3,37,1095,240,1101,247,1097.6,242.8,35,123,241,130,247,126.1,243.6,36,81,242,88,248,84.1,244.6,36,711,242,717,249,713.6,244.8,35,625,244,631,252,627.8,247.3,37,677,244,683,251,679.6,246.8,35,107,245,114,251,110.1,247.6,36,269,245,275,253,271.8,248.3,37,1024,245,1030,253,1026.8,248.3,37,1150,245,1156,252,1152.6,247.8,35,972,246,979,252,975.1,248.6,36,934,248,941,254,937.1,250.6,36,35,249,41,256,37.6,251.8,35,294,249,301,255,297.1,251.6,36,957,249,963,257,959.8,252.3,37,461,250,467,257,463.6,252.8,35,1049,251,1055,259,1051.8,254.3,37,808,252,815,258,810.9,254.8,32,512,253,519,259,515.1,255.6,36,183,254,189,262,185.8,257.3,37,233,254,239,261,235.6,256.8,35,495,254,502,260,497.9,256.8,32,887,254,894,260,889.9,256.8,32,693,255,700,261,696.1,257.6,36,682,256,689,262,684.9,258.8,32,765,256,771,263,767.6,258.8,35,1124,256,1131,262,1126.9,258.8,32,533,257,540,263,535.9,259.8,32,554,258,560,266,556.8,261.3,37,945,258,951,266,947.8,261.3,37,203,259,210,265,206.1,261.6,36,635,259,642,265,637.9,261.8,32,104,261,110,268,106.6,263.8,35,223,261,229,269,225.8,264.3,37,413,261,419,268,415.6,263.8,35,997,262,1003,269,999.6,264.8,35,1161,262,1167,270,1163.8,265.3,37,161,263,168,269,163.9,265.8,32,477,263,484,269,479.9,265.8,32,796,263,802,270,798.6,265.8,35,235,266,241,274,237.8,269.3,37,970,266,977,272,973.1,268.6,36,528,268,535,274,530.9,270.8,32,922,269,929,275,925.1,271.6,36,180,270,186,277,182.6,272.8,35,342,270,349,276,345.1,272.6,36,689,270,695,277,691.6,272.8,35,47,271,53,279,49.8,274.3,37,144,271,150,279,146.8,274.3,37,571,271,578,277,573.9,273.8,32,401,272,407,280,403.8,275.3,37,859,272,865,280,861.8,275.3,37,1036,272,1043,278,1038.9,274.8,32,72,273,79,279,75.1,275.6,36,641,273,647,280,643.6,275.8,35,1173,274,1179,281,1175.6,276.8,35,35,275,42,281,38.1,277.6,36,471,275,477,283,473.8,278.3,37,950,275,957,281,952.9,277.8,32,261,276,267,283,263.6,278.8,35,418,276,425,282,421.1,278.6,36,607,276,614,282,610.1,278.6,36,807,276,814,282,809.9,278.8,32,1127,276,1133,283,1129.6,278.8,35,306,277,313,283,309.1,279.6,36,539,277,546,283,542.1,279.6,36,1086,278,1092,286,1088.8,281.3,37,777,279,784,285,779.9,281.8,32,1139,279,1146,285,1141.9,281.8,32,1071,280,1078,286,1073.9,282.8,32,502,281,509,287,504.9,283.8,32,208,282,215,288,211.1,284.6,36,936,282,942,290,938.8,285.3,37,1048,282,1054,290,1050.8,285.3,37,1160,282,1166,289,1162.6,284.8,35,384,283,391,289,387.1,285.6,36,902,286,908,293,904.6,288.8,35,238,289,244,296,240.6,291.8,35,141,290,148,296,143.9,292.8,32,261,290,268,296,263.9,292.8,32,990,292,996,299,992.6,294.8,35,65,294,72,300,68.1,296.6,36,923,294,930,300,925.9,296.8,32,1076,295,1082,303,1078.8,298.3,37,51,296,57,304,53.8,299.3,37,93,296,100,302,95.9,298.8,32,1058,296,1064,304,1060.8,299.3,37,247,297,254,303,250.1,299.6,36,1028,297,1035,303,1030.9,299.8,32,80,298,86,305,82.6,300.8,35,117,299,124,305,119.9,301.8,32,158,300,165,306,161.1,302.6,36,201,300,207,308,203.8,303.3,37,979,301,986,307,982.1,303.6,36,24,303,30,310,26.6,305.8,35,169,304,176,310,171.9,306.8,32,1182,307,1188,315,1184.8,310.3,37,953,309,960,315,955.9,311.8,32,1087,309,1094,315,1090.1,311.6,36,67,310,74,316,70.1,312.6,36,507,310,513,318,509.9,313.4,36,673,311,679,319,675.9,314.4,36,1047,311,1054,317,1050.1,313.6,36,1076,311,1082,318,1078.6,313.8,35,1168,311,1174,318,1170.6,313.8,35,220,312,226,319,222.6,314.8,35,965,312,971,319,967.6,314.8,35,1000,312,1007,318,1002.9,314.8,32,472,313,479,319,474.9,315.8,32,656,313,663,319,658.9,315.8,32,182,314,189,320,184.9,316.8,32,526,314,532,321,528.7,316.7,34,689,314,696,320,692.3,316.8,33,869,314,875,321,871.7,316.7,34,39,315,45,322,41.6,317.8,35,382,317,389,323,384.9,319.8,32,416,317,423,323,418.9,319.8,32,575,318,581,326,577.9,321.4,36,542,319,549,325,544.9,321.8,32,1149,319,1155,327,1151.8,322.3,37,634,320,640,327,636.7,322.7,34,1129,320,1135,327,1131.6,322.8,35,364,321,371,327,367.3,323.8,33,1023,321,1030,327,1026.1,323.6,36,112,323,118,331,114.8,326.3,37,15,324,21,331,17.6,326.8,35,155,324,162,330,158.1,326.6,36,676,324,682,331,678.7,326.7,34,1006,324,1012,331,1008.6,326.8,35,1169,324,1175,332,1171.8,327.3,37,202,325,208,333,204.8,328.3,37,181,326,187,333,183.6,328.8,35,1039,326,1045,334,1041.8,329.3,37,706,329,713,335,709.3,331.8,33,125,330,132,336,128.1,332.6,36,434,330,441,336,437.3,332.8,33,910,330,916,337,912.6,332.8,35,920,330,926,338,922.8,333.3,37,387,332,393,340,389.9,335.4,36,1100,333,1107,339,1102.9,335.8,32,828,334,834,342,830.9,337.4,36,102,335,108,343,104.8,338.3,37,615,335,622,341,618.3,337.8,33,771,336,777,343,773.7,338.7,34,330,337,337,343,333.3,339.8,33,184,338,191,344,187.1,340.6,36,1132,338,1139,344,1134.9,340.8,32,728,339,734,346,730.7,341.7,34,846,339,853,345,848.9,341.8,32,311,340,318,346,314.3,342.8,33,857,342,863,349,859.7,344.7,34,546,343,553,349,548.9,345.8,32,572,343,578,350,574.7,345.7,34,585,343,591,351,587.9,346.4,36,755,343,762,349,757.9,345.8,32,790,343,796,350,792.7,345.7,34,518,344,525,350,520.9,346.8,32,24,345,31,351,26.9,347.8,32,453,345,460,351,455.9,347.8,32,606,345,613,351,608.9,347.8,32,823,346,829,354,825.9,349.4,36,875,346,882,352,878.3,348.8,33,480,347,486,355,482.9,350.4,36,355,349,362,355,358.3,351.8,33,681,349,688,355,683.9,351.8,32,1157,350,1163,358,1159.8,353.3,37,74,351,81,357,76.9,353.8,32,86,351,93,357,89.1,353.6,36,173,352,179,359,175.6,354.8,35,1005,352,1012,358,1007.9,354.8,32,118,353,125,359,120.9,355.8,32,749,353,755,360,751.7,355.7,34,1046,353,1053,359,1049.1,355.6,36,1060,356,1067,362,1062.9,358.8,32,45,357,52,363,47.9,359.8,32,1183,357,1189,365,1185.8,360.3,37,414,358,421,364,416.9,360.8,32,425,358,431,365,427.7,360.7,34,129,359,136,365,132.1,361.6,36,363,359,369,366,365.7,361.7,34,538,359,544,367,540.9,362.4,36,641,359,647,367,643.9,362.4,36,845,360,851,368,847.9,363.4,36,1148,360,1155,366,1151.1,362.6,36,383,361,389,368,385.7,363.7,34,511,361,518,367,514.3,363.8,33,788,361,794,369,790.9,364.4,36,1073,361,1079,368,1075.6,363.8,35,11,362,17,369,13.6,364.8,35,858,362,865,368,861.3,364.8,33,1166,362,1173,368,1169.1,364.6,36,714,363,720,370,716.7,365.7,34,1112,363,1118,370,1114.6,365.8,35,591,364,598,370,594.3,366.8,33,1092,364,1099,370,1095.1,366.6,36,1135,366,1142,372,1138.1,368.6,36,273,367,280,373,276.1,369.6,36,330,367,337,373,332.9,369.8,32,102,368,109,374,105.1,370.6,36,703,368,710,374,705.9,370.8,32,557,369,564,375,559.9,371.8,32,848,372,855,378,851.3,374.8,33,422,375,428,383,424.9,378.4,36,444,375,450,382,446.7,377.7,34,310,376,317,382,313.3,378.8,33,810,376,817,382,812.9,378.8,32,156,377,162,384,158.6,379.8,35,272,377,279,383,275.1,379.6,36,760,377,767,383,763.3,379.8,33,69,378,75,385,71.6,380.8,35,732,378,739,384,734.9,380.8,32,172,379,179,385,175.1,381.6,36,42,380,48,387,44.6,382.8,35,131,381,138,387,133.9,383.8,32,554,381,560,388,556.7,383.7,34,1157,381,1163,389,1159.8,384.3,37,109,382,116,388,112.1,384.6,36,11,385,18,391,14.1,387.6,36,838,386,844,393,840.7,388.7,34,1142,386,1148,394,1144.8,389.3,37,853,387,859,394,855.7,389.7,34,959,387,965,394,961.6,389.8,35,149,388,155,396,151.8,391.3,37,246,388,252,395,248.6,390.8,35,358,388,364,396,360.9,391.4,36,182,389,188,396,184.6,391.8,35,915,390,922,396,917.9,392.8,32,1108,390,1114,397,1110.6,392.8,35,226,391,232,398,228.6,393.8,35,434,392,441,398,437.3,394.8,33,749,392,755,399,751.7,394.7,34,784,393,791,399,787.3,395.8,33,109,394,115,401,111.6,396.8,35,387,394,393,401,389.7,396.7,34,652,394,659,400,655.3,396.8,33,633,397,640,403,635.9,399.8,32,461,398,468,404,464.3,400.8,33,691,398,697,405,693.7,400.7,34,77,399,84,405,80.1,401.6,36,341,399,347,406,343.7,401.7,34,474,399,481,405,477.3,401.8,33,704,401,710,409,706.9,404.4,36,1125,401,1131,409,1127.8,404.3,37,760,402,767,408,763.3,404.8,33,1029,402,1036,408,1031.9,404.8,32,140,403,146,410,142.6,405.8,35,1058,403,1065,409,1060.9,405.8,32,360,404,366,412,362.9,407.4,36,663,404,670,410,665.9,406.8,32,793,404,799,412,795.9,407.4,36,168,405,175,411,171.1,407.6,36,203,405,210,411,205.9,407.8,32,846,406,852,413,848.7,408.7,34,105,407,111,415,107.8,410.3,37,117,407,124,413,119.9,409.8,32,973,407,980,413,975.9,409.8,32,1163,407,1169,415,1165.8,410.3,37,276,408,282,415,278.6,410.8,35,778,408,784,416,780.9,411.4,36,483,409,490,415,485.9,411.8,32,65,410,72,416,68.1,412.6,36,187,411,193,418,189.6,413.8,35,678,412,684,420,680.9,415.4,36,1008,412,1015,418,1010.9,414.8,32,1043,412,1049,420,1045.8,415.3,37,1182,412,1188,419,1184.6,414.8,35,334,413,341,419,337.3,415.8,33,945,413,951,420,947.6,415.8,35,959,413,966,419,961.9,415.8,32,809,414,816,420,811.9,416.8,32,1059,415,1066,421,1061.9,417.8,32,1027,416,1034,422,1030.1,418.6,36,464,417,470,424,466.7,419.7,34,741,418,748,424,744.3,420.8,33,791,418,798,424,793.9,420.8,32,923,418,930,424,925.9,420.8,32,1149,418,1155,425,1151.6,420.8,35,112,419,119,425,114.9,421.8,32,720,419,727,425,723.3,421.8,33,222,420,229,426,225.1,422.6,36,395,420,402,426,397.9,422.8,32,1087,420,1094,426,1090.1,422.6,36,1098,420,1105,426,1101.1,422.6,36,280,421,286,429,282.8,424.3,37,321,421,328,427,323.9,423.8,32,1137,421,1144,427,1140.1,423.6,36,512,422,519,428,515.3,424.8,33,971,423,978,429,973.9,425.8,32,693,424,700,430,695.9,426.8,32,998,424,1004,432,1000.8,427.3,37,450,427,457,433,452.9,429.8,32,92,428,98,436,94.8,431.3,37,1073,428,1079,435,1075.6,430.8,35,1156,428,1162,436,1158.8,431.3,37,187,429,193,436,189.6,431.8,35,493,429,500,435,495.9,431.8,32,209,430,215,438,211.8,433.3,37,334,430,341,436,337.3,432.8,33,771,432,778,438,773.9,434.8,32,1173,432,1180,438,1176.1,434.6,36,20,433,26,441,22.8,436.3,37,279,434,286,440,282.1,436.6,36,1038,434,1044,442,1040.8,437.3,37,1145,434,1152,440,1147.9,436.8,32,235,435,241,442,237.6,437.8,35,317,435,324,441,320.3,437.8,33,378,435,384,443,380.9,438.4,36,79,437,86,443,82.1,439.6,36,164,438,171,444,167.1,440.6,36,415,438,422,444,417.9,440.8,32,846,438,852,446,848.9,441.4,36,1091,438,1098,444,1093.9,440.8,32,390,439,397,445,392.9,441.8,32,808,441,814,449,810.9,444.4,36,822,442,829,448,824.9,444.8,32,1005,442,1012,448,1007.9,444.8,32,100,445,106,452,102.6,447.8,35,941,445,948,451,944.1,447.6,36,354,446,361,452,356.9,448.8,32,28,447,35,453,31.1,449.6,36,203,447,209,455,205.8,450.3,37,962,447,968,454,964.6,449.8,35,74,448,81,454,77.1,450.6,36,976,448,983,454,978.9,450.8,32,54,450,61,456,57.1,452.6,36,170,451,177,457,172.9,453.8,32,790,452,796,459,792.7,454.7,34,129,454,135,461,131.6,456.8,35,146,454,153,460,149.1,456.6,36,413,456,420,462,415.9,458.8,32,100,457,106,464,102.6,459.8,35,280,457,287,463,282.9,459.8,32,1025,457,1032,463,1028.1,459.6,36,856,458,862,466,858.9,461.4,36,212,459,219,465,215.1,461.6,36,981,459,988,465,984.1,461.6,36,1087,460,1094,466,1089.9,462.8,32,22,461,29,467,24.9,463.8,32,825,461,831,468,827.7,463.7,34,311,462,317,469,313.7,464.7,34,385,462,391,469,387.7,464.7,34,876,462,882,469,878.7,464.7,34,325,464,331,472,327.9,467.4,36,403,465,410,471,406.3,467.8,33,806,465,812,473,808.9,468.4,36,251,468,257,475,253.6,470.8,35,646,469,653,475,649.1,471.3,31,680,469,686,475,682.6,471.6,33,769,469,776,475,771.9,471.8,32,914,469,921,475,916.9,471.8,32,1069,469,1076,475,1072.1,471.6,36,419,470,425,477,421.7,472.7,34,668,470,675,476,670.8,472.6,34,940,470,946,478,942.8,473.3,37,89,473,95,481,91.8,476.3,37,222,473,229,479,224.9,475.8,32,612,473,618,479,614.6,475.6,33,394,474,401,480,396.9,476.8,32,65,475,72,481,68.1,477.6,36,318,475,324,483,320.9,478.4,36,1170,475,1176,482,1172.6,477.8,35,11,476,17,483,13.6,478.8,35,35,476,41,483,37.6,478.8,35,209,476,216,482,211.9,478.8,32,968,476,974,483,970.6,478.8,35,1049,477,1056,483,1051.9,479.8,32,103,478,109,486,105.8,481.3,37,881,478,887,485,883.7,480.7,34,1018,478,1024,486,1020.8,481.3,37,250,479,257,485,253.1,481.6,36,127,480,134,486,130.1,482.6,36,146,481,152,489,148.8,484.3,37,282,482,288,489,284.6,484.8,35,346,482,353,488,349.3,484.8,33,181,483,187,490,183.6,485.8,35,786,483,792,491,788.9,486.4,36,952,483,959,489,955.1,485.6,36,357,486,364,492,359.9,488.8,32,20,487,27,493,22.9,489.8,32,1126,489,1133,495,1128.9,491.8,32,1154,491,1160,499,1156.8,494.3,37,525,492,530,498,527.2,494.4,25,92,493,99,499,95.1,495.6,36,716,493,721,499,718.2,495.4,25,1081,493,1088,499,1084.1,495.6,36,108,494,114,501,110.6,496.8,35,202,494,209,500,204.9,496.8,32,328,494,335,500,330.9,496.8,32,883,494,890,500,886.3,496.8,33,1104,494,1110,502,1106.8,497.3,37,369,495,375,503,371.9,498.4,36,828,496,834,503,830.7,498.7,34,312,497,319,503,315.3,499.8,33,497,497,503,503,499.6,499.6,33,665,497,672,503,668.1,499.3,31,1028,498,1035,504,1031.1,500.6,36,1049,499,1055,507,1051.8,502.3,37,1136,500,1143,506,1138.9,502.8,32,769,501,775,509,771.9,504.4,36,1059,501,1066,507,1061.9,503.8,32,24,503,31,509,26.9,505.8,32,1117,503,1123,510,1119.6,505.8,35,560,506,565,512,562.2,508.4,25,1154,506,1160,514,1156.8,509.3,37,1166,506,1173,512,1169.1,508.6,36,199,507,206,513,201.9,509.8,32,338,507,344,515,340.9,510.4,36,943,507,950,513,946.1,509.6,36,983,507,990,513,986.1,509.6,36,98,509,105,515,101.1,511.6,36,515,509,521,515,517.6,511.6,33,859,509,866,515,861.9,511.8,32,278,510,284,518,280.8,513.3,37,405,510,411,518,407.9,513.4,36,809,510,816,516,812.3,512.8,33,995,510,1001,518,997.8,513.3,37,61,511,67,518,63.6,513.8,35,224,511,230,518,226.6,513.8,35,913,511,920,517,916.1,513.6,36,1026,512,1033,518,1029.1,514.6,36,644,513,651,519,647.1,515.3,31,673,513,680,519,676.1,515.3,31,354,514,360,522,356.9,517.4,36,832,514,839,520,834.9,516.8,32,1037,516,1043,523,1039.6,518.8,35,1128,516,1134,524,1130.8,519.3,37,1180,516,1187,522,1182.9,518.8,32,42,517,48,525,44.8,520.3,37,554,517,561,523,556.8,519.6,34,148,518,155,524,150.9,520.8,32,252,518,259,524,255.1,520.6,36,772,518,778,525,774.7,520.7,34,965,518,971,525,967.6,520.8,35,172,519,179,525,174.9,521.8,32,939,519,946,525,941.9,521.8,32,240,520,247,526,243.1,522.6,36,342,520,348,528,344.9,523.4,36,212,521,219,527,215.1,523.6,36,201,522,207,530,203.8,525.3,37,400,522,407,528,403.3,524.8,33,845,524,852,530,847.9,526.8,32,115,525,121,532,117.6,527.8,35,16,527,23,533,18.9,529.8,32,31,528,38,534,33.9,530.8,32,94,528,101,534,96.9,530.8,32,978,528,985,534,980.9,530.8,32,1137,528,1143,536,1139.8,531.3,37,387,529,393,537,389.9,532.4,36,549,529,556,535,552.1,531.3,31,946,529,953,535,948.9,531.8,32,1089,529,1096,535,1091.9,531.8,32,358,530,365,536,361.3,532.8,33,680,531,687,537,682.8,533.6,34,700,531,706,537,702.6,533.6,33,1103,531,1110,537,1106.1,533.6,36,823,532,830,538,825.9,534.8,32,462,533,469,539,464.8,535.6,34,790,533,797,539,793.3,535.8,33,419,535,425,542,421.7,537.7,34,727,535,733,541,729.6,537.6,33,1010,535,1017,541,1013.1,537.6,36,1125,535,1131,543,1127.8,538.3,37,570,536,577,542,572.8,538.6,34,1152,536,1158,543,1154.6,538.8,35,478,537,485,543,481.1,539.3,31,1114,537,1120,544,1116.6,539.8,35,841,539,847,547,843.9,542.4,36,52,541,58,549,54.8,544.3,37,192,542,198,550,194.8,545.3,37,214,542,220,550,216.8,545.3,37,251,542,258,548,254.1,544.6,36,366,542,373,548,368.9,544.8,32,402,544,408,552,404.9,547.4,36,875,544,881,551,877.7,546.7,34,1000,544,1007,550,1002.9,546.8,32,227,545,234,551,230.1,547.6,36,325,545,331,553,327.9,548.4,36,38,546,44,553,40.6,548.8,35,117,546,124,552,120.1,548.6,36,348,546,354,554,350.9,549.4,36,420,546,426,554,422.9,549.4,36,803,546,810,552,805.9,548.8,32,158,547,164,555,160.8,550.3,37,202,548,208,555,204.6,550.8,35,704,548,709,554,706.2,550.4,25,761,548,767,556,763.9,551.4,36,817,549,824,555,820.3,551.8,33,856,549,863,555,859.3,551.8,33,431,550,438,556,433.9,552.8,32,337,551,344,557,340.3,553.8,33,1071,551,1077,559,1073.8,554.3,37,21,552,27,559,23.6,554.8,35,131,552,137,560,133.8,555.3,37,267,552,274,558,270.1,554.6,36,238,553,244,560,240.6,555.8,35,462,553,468,559,464.6,555.6,33,679,553,686,559,681.8,555.6,34,59,554,66,560,62.1,556.6,36,85,555,91,562,87.6,557.8,35,214,555,220,562,216.6,557.8,35,530,561,535,567,532.2,563.4,25,622,562,626,566,623.5,563.5,16,805,562,811,570,807.9,565.4,36,1113,562,1120,568,1115.9,564.8,32,144,563,150,571,146.8,566.3,37,177,564,184,570,179.9,566.8,32,692,564,698,570,694.6,566.6,33,224,566,231,572,227.1,568.6,36,603,566,609,572,605.7,568.7,31,966,566,972,573,968.6,568.8,35,633,567,635,569,633.5,567.5,4,1179,567,1185,575,1181.8,570.3,37,951,568,958,574,953.9,570.8,32,920,569,927,575,923.1,571.6,36,24,570,30,577,26.6,572.8,35,50,570,57,576,52.9,572.8,32,244,570,251,576,247.1,572.6,36,208,571,214,579,210.8,574.3,37,584,571,586,573,584.5,571.5,4,1153,571,1160,577,1156.1,573.6,36,571,572,577,578,573.7,574.7,31,87,573,93,581,89.8,576.3,37,843,574,850,580,845.9,576.8,32,181,575,188,581,184.1,577.6,36,1002,575,1009,581,1005.1,577.6,36,361,576,368,582,363.9,578.8,32,1105,577,1112,583,1108.1,579.6,36,692,579,698,585,694.6,581.6,33,1078,579,1085,585,1080.9,581.8,32,99,580,105,587,101.6,582.8,35,140,580,146,588,142.8,583.3,37,335,581,342,587,337.9,583.8,32,283,582,290,588,285.9,584.8,32,203,584,209,592,205.8,587.3,37,916,584,922,591,918.6,586.8,35,628,585,632,589,629.5,586.5,16,61,586,67,594,63.8,589.3,37,21,588,28,594,23.9,590.8,32,703,589,710,595,706.1,591.3,31,1081,590,1087,598,1083.8,593.3,37,127,591,134,597,130.1,593.6,36,321,591,328,597,323.9,593.8,32,717,592,723,598,719.6,594.6,33,283,593,289,601,285.8,596.3,37,563,593,567,597,564.5,594.5,16,162,595,168,602,164.6,597.8,35,1035,595,1042,601,1037.9,597.8,32,1016,596,1022,604,1018.8,599.3,37,1134,596,1140,604,1136.8,599.3,37,1100,598,1107,604,1103.1,600.6,36,109,599,116,605,111.9,601.8,32,844,600,850,607,846.7,602.7,34,1155,600,1162,606,1158.1,602.6,36,128,602,134,609,130.6,604.8,35,732,602,739,608,734.8,604.6,34,628,603,630,605,628.5,603.5,4,1000,603,1006,610,1002.6,605.8,35,45,604,52,610,48.1,606.6,36,524,606,531,612,526.8,608.6,34,865,606,871,613,867.7,608.7,34,360,607,366,614,362.7,609.7,34,1058,607,1065,613,1061.1,609.6,36,534,609,541,615,536.8,611.6,34,21,611,28,617,24.1,613.6,36,202,611,209,617,204.9,613.8,32,881,611,887,618,883.7,613.7,34,1126,613,1133,619,1128.9,615.8,32,570,614,572,616,570.5,614.5,4,1075,614,1082,620,1077.9,616.8,32,76,616,82,623,78.6,618.8,35,140,616,147,622,143.1,618.6,36,1138,616,1144,624,1140.8,619.3,37,634,618,636,620,634.5,618.5,4,839,618,846,624,841.9,620.8,32,88,619,94,626,90.6,621.8,35,767,620,773,628,769.9,623.4,36,58,621,65,627,61.1,623.6,36,701,621,706,627,703.2,623.4,25,1063,621,1069,628,1065.6,623.8,35,163,623,170,629,165.9,625.8,32,675,623,682,629,677.8,625.6,34,920,624,926,631,922.6,626.8,35,1009,624,1015,632,1011.8,627.3,37,105,625,111,632,107.6,627.8,35,270,625,277,631,272.9,627.8,32,433,625,440,631,435.9,627.8,32,581,625,585,629,582.5,626.5,16,849,625,856,631,852.3,627.8,33,11,627,18,633,13.9,629.8,32,1080,628,1087,634,1082.9,630.8,32,49,629,55,636,51.6,631.8,35,121,629,127,637,123.8,632.3,37,720,629,727,635,723.1,631.3,31,595,630,601,636,597.7,632.7,31,627,630,631,634,628.5,631.5,16,994,630,1000,637,996.6,632.8,35,1024,630,1030,637,1026.6,632.8,35,1106,630,1112,638,1108.8,633.3,37,1172,630,1178,638,1174.8,633.3,37,403,631,410,637,406.3,633.8,33,819,631,825,639,821.9,634.4,36,1096,632,1102,640,1098.8,635.3,37,567,633,571,637,568.5,634.5,16,617,633,619,635,617.5,633.5,4,1182,633,1188,641,1184.8,636.3,37,38,636,45,642,40.9,638.8,32,185,636,192,642,188.1,638.6,36,373,636,380,642,376.3,638.8,33,766,638,773,644,768.9,640.8,32,331,639,338,645,334.3,641.8,33,1047,639,1054,645,1049.9,641.8,32,1086,639,1092,646,1088.6,641.8,35,1131,639,1138,645,1134.1,641.6,36,97,640,104,646,100.1,642.6,36,160,640,166,647,162.6,642.8,35,321,640,327,647,323.7,642.7,34,974,640,981,646,977.1,642.6,36,1058,640,1064,647,1060.6,642.8,35,938,641,944,648,940.6,643.8,35,275,642,281,649,277.6,644.8,35,710,642,715,648,712.2,644.4,25,816,643,823,649,819.3,645.8,33,1106,643,1113,649,1109.1,645.6,36,221,644,228,650,224.1,646.6,36,838,644,844,651,840.7,646.7,34,1003,644,1010,650,1006.1,646.6,36,1073,644,1079,651,1075.6,646.8,35,991,645,998,651,993.9,647.8,32,143,646,149,653,145.6,648.8,35,778,646,784,654,780.9,649.4,36,26,647,33,653,29.1,649.6,36,172,648,178,656,174.8,651.3,37,374,649,380,657,376.9,652.4,36,200,651,207,657,202.9,653.8,32,653,651,660,657,656.1,653.3,31,160,652,167,658,163.1,654.6,36,257,653,263,661,259.8,656.3,37,1089,653,1095,660,1091.6,655.8,35,43,655,50,661,46.1,657.6,36,799,655,805,663,801.9,658.4,36,1113,655,1119,662,1115.6,657.8,35,434,656,440,663,436.7,658.7,34,715,656,720,662,717.2,658.4,25,975,657,982,663,977.9,659.8,32,639,659,646,665,642.1,661.3,31,587,661,593,667,589.6,663.6,33,276,662,283,668,279.1,664.6,36,779,662,786,668,781.9,664.8,32,833,662,840,668,835.9,664.8,32,1179,662,1185,670,1181.8,665.3,37,687,663,694,669,689.8,665.6,34,1047,663,1053,671,1049.8,666.3,37,478,664,485,670,480.8,666.6,34,1079,666,1085,674,1081.8,669.3,37,500,667,506,673,502.6,669.6,33,433,668,440,674,436.3,670.8,33,881,668,887,675,883.7,670.7,34,938,668,944,676,940.8,671.3,37,204,669,210,676,206.6,671.8,35,50,670,57,676,53.1,672.6,36,174,670,181,676,176.9,672.8,32,261,670,267,677,263.6,672.8,35,419,670,426,676,421.9,672.8,32,527,670,534,676,530.1,672.3,31,769,670,776,676,771.9,672.8,32,854,670,861,676,856.9,672.8,32,1033,670,1039,678,1035.8,673.3,37,361,673,367,681,363.9,676.4,36,789,673,795,680,791.7,675.7,34,1161,674,1168,680,1163.9,676.8,32,156,675,163,681,159.1,677.6,36,277,675,283,682,279.6,677.8,35,384,675,391,681,387.3,677.8,33,1005,675,1011,683,1007.8,678.3,37,74,677,80,685,76.8,680.3,37,101,677,107,684,103.6,679.8,35,460,677,466,683,462.6,679.6,33,677,677,683,683,679.6,679.6,33,962,677,968,685,964.8,680.3,37,116,680,122,687,118.6,682.8,35,327,680,334,686,330.3,682.8,33,424,680,431,686,427.3,682.8,33,545,680,551,686,547.6,682.6,33,584,682,590,688,586.6,684.6,33,771,683,777,691,773.9,686.4,36,861,683,868,689,863.9,685.8,32,1020,683,1026,691,1022.8,686.3,37,197,684,203,692,199.8,687.3,37,245,686,251,694,247.8,689.3,37,1085,687,1092,693,1087.9,689.8,32,1151,687,1158,693,1154.1,689.6,36,231,688,237,695,233.6,690.8,35,798,689,804,696,800.7,691.7,34,827,690,833,697,829.7,692.7,34,1178,690,1184,697,1180.6,692.8,35,992,692,999,698,994.9,694.8,32,1048,692,1055,698,1051.1,694.6,36,27,694,33,702,29.8,697.3,37,15,696,21,703,17.6,698.8,35,313,697,320,703,316.3,699.8,33,371,697,377,704,373.7,699.7,34,39,698,46,704,42.1,700.6,36,817,698,823,706,819.9,701.4,36,940,699,947,705,942.9,701.8,32,147,700,153,708,149.8,703.3,37,168,700,174,708,170.8,703.3,37,922,701,929,707,925.1,703.6,36,1043,702,1050,708,1045.9,704.8,32,58,703,64,710,60.6,705.8,35,982,703,988,710,984.6,705.8,35,1137,703,1143,711,1139.8,706.3,37,242,704,249,710,245.1,706.6,36,1171,704,1177,711,1173.6,706.8,35,832,705,839,711,835.3,707.8,33,260,706,266,713,262.6,708.8,35,856,706,862,714,858.9,709.4,36,362,707,369,713,364.9,709.8,32,44,708,51,714,46.9,710.8,32,90,709,96,717,92.8,712.3,37,137,711,144,717,139.9,713.8,32,1156,713,1162,721,1158.8,716.3,37,397,714,403,721,399.7,716.7,34,614,715,620,721,616.6,717.6,33,640,715,646,721,642.6,717.6,33,781,715,788,721,784.3,717.8,33,1100,715,1107,721,1103.1,717.6,36,10,716,17,722,12.9,718.8,32,550,716,555,722,552.2,718.4,25,696,716,703,722,698.8,718.6,34,1135,716,1141,724,1137.8,719.3,37,227,717,234,723,229.9,719.8,32,981,717,987,725,983.8,720.3,37,259,719,266,725,262.1,721.6,36,842,719,849,725,845.3,721.8,33,1028,719,1035,725,1031.1,721.6,36,337,720,344,726,340.3,722.8,33,38,721,44,729,40.8,724.3,37,174,721,180,729,176.8,724.3,37,795,721,802,727,798.3,723.8,33,952,724,958,731,954.6,726.8,35,1115,724,1122,730,1118.1,726.6,36,350,726,357,732,352.9,728.8,32,222,727,228,734,224.6,729.8,35,1089,727,1095,734,1091.6,729.8,35,567,728,573,734,569.6,730.6,33,20,730,26,738,22.8,733.3,37,331,730,338,736,334.3,732.8,33,128,731,134,739,130.8,734.3,37,201,731,208,737,203.9,733.8,32,880,731,887,737,882.9,733.8,32,1016,732,1022,739,1018.6,734.8,35,411,734,418,740,414.3,736.8,33,844,734,850,742,846.9,737.4,36,1033,734,1039,741,1035.6,736.8,35,168,735,174,743,170.8,738.3,37,398,735,404,743,400.9,738.4,36,40,736,47,742,42.9,738.8,32,269,736,275,744,271.8,739.3,37,367,736,374,742,370.3,738.8,33,281,737,287,744,283.6,739.8,35,818,737,824,744,820.7,739.7,34,803,738,810,744,805.9,740.8,32,941,738,948,744,943.9,740.8,32,119,739,125,746,121.6,741.8,35,1096,740,1102,748,1098.8,743.3,37,421,742,428,748,423.9,744.8,32,1080,742,1087,748,1082.9,744.8,32,856,743,863,749,858.9,745.8,32,242,744,249,750,245.1,746.6,36,71,745,77,753,73.8,748.3,37,196,746,203,752,198.9,748.8,32,353,746,360,752,355.9,748.8,32,376,746,383,752,378.9,748.8,32,1030,747,1036,755,1032.8,750.3,37,84,748,90,756,86.8,751.3,37,967,749,974,755,970.1,751.6,36,40,750,46,758,42.8,753.3,37,1040,750,1047,756,1043.1,752.6,36,880,752,887,758,883.3,754.8,33,263,753,270,759,266.1,755.6,36,95,755,101,762,97.6,757.8,35,996,755,1003,761,998.9,757.8,32,1158,755,1164,762,1160.6,757.8,35,1008,760,1015,766,1011.1,762.6,36,116,761,122,768,118.6,763.8,35,177,762,184,768,180.1,764.6,36,260,763,266,770,262.6,765.8,35,508,763,515,769,510.9,765.8,32,567,763,574,769,569.9,765.8,32,729,763,736,769,731.9,765.8,32,132,764,139,770,135.1,766.6,36,580,764,587,770,583.3,766.8,33,314,765,321,771,317.3,767.8,33,497,765,503,772,499.7,767.7,34,848,765,855,771,851.3,767.8,33,631,766,638,772,634.3,768.8,33,764,766,770,774,766.9,769.4,36,1182,766,1188,774,1184.8,769.3,37,1046,767,1052,774,1048.6,769.8,35,832,768,839,774,835.3,770.8,33,32,769,39,775,35.1,771.6,36,531,769,538,775,534.3,771.8,33,143,770,149,777,145.6,772.8,35,916,770,922,777,918.6,772.8,35,455,771,462,777,457.9,773.8,32,466,771,473,777,468.9,773.8,32,409,772,416,778,412.3,774.8,33,1155,773,1161,780,1157.6,775.8,35,720,774,726,781,722.7,776.7,34,857,774,864,780,860.3,776.8,33,1121,774,1128,780,1124.1,776.6,36,490,775,497,781,492.9,777.8,32,939,775,945,783,941.8,778.3,37,985,775,991,783,987.8,778.3,37,112,776,118,783,114.6,778.8,35,423,776,429,784,425.9,779.4,36,377,777,383,784,379.7,779.7,34,819,777,825,784,821.7,779.7,34,874,777,881,783,876.9,779.8,32,972,777,979,783,975.1,779.6,36,205,779,212,785,208.1,781.6,36,328,779,334,787,330.9,782.4,36,1175,779,1182,785,1177.9,781.8,32,245,780,251,788,247.8,783.3,37,440,780,446,788,442.9,783.4,36,836,780,842,787,838.7,782.7,34,923,780,929,788,925.8,783.3,37,162,781,168,789,164.8,784.3,37,1104,781,1111,787,1106.9,783.8,32,44,782,51,788,47.1,784.6,36,362,782,368,790,364.9,785.4,36,397,782,404,788,399.9,784.8,32,469,784,476,790,471.9,786.8,32,671,784,677,792,673.9,787.4,36,713,784,719,791,715.7,786.7,34,134,785,141,791,137.1,787.6,36,743,785,749,793,745.9,788.4,36,104,786,111,792,106.9,788.8,32,789,786,795,793,791.7,788.7,34,1057,786,1063,793,1059.6,788.8,35,256,789,263,795,258.9,791.8,32,228,790,235,796,230.9,792.8,32,320,790,326,798,322.9,793.4,36,882,790,888,798,884.9,793.4,36,1028,790,1034,798,1030.8,793.3,37,1099,791,1106,797,1102.1,793.6,36,767,792,774,798,769.9,794.8,32,85,793,91,800,87.6,795.8,35,116,793,122,801,118.8,796.3,37,160,793,166,801,162.8,796.3,37,508,793,515,799,510.9,795.8,32,194,794,200,802,196.8,797.3,37,530,794,536,801,532.7,796.7,34,138,795,144,803,140.8,798.3,37,563,795,569,802,565.7,797.7,34,1000,795,1006,803,1002.8,798.3,37,1147,796,1154,802,1149.9,798.8,32,1168,796,1174,804,1170.8,799.3,37,40,798,46,806,42.8,801.3,37,921,799,927,806,923.6,801.8,35,343,800,350,806,346.3,802.8,33,777,801,783,808,779.7,803.7,34,1018,801,1024,808,1020.6,803.8,35,836,802,842,809,838.7,804.7,34,394,803,401,809,396.9,805.8,32,691,803,698,809,694.3,805.8,33,633,805,639,813,635.9,808.4,36,1156,805,1163,811,1159.1,807.6,36,1140,806,1147,812,1143.1,808.6,36,29,807,35,814,31.6,809.8,35,120,807,126,815,122.8,810.3,37,441,807,448,813,444.3,809.8,33,1004,807,1010,815,1006.8,810.3,37,327,808,333,816,329.9,811.4,36,863,808,870,814,865.9,810.8,32,732,809,738,817,734.9,812.4,36,744,809,751,815,746.9,811.8,32,1114,809,1121,815,1116.9,811.8,32,346,810,353,816,348.9,812.8,32,661,810,667,818,663.9,813.4,36,924,810,930,817,926.6,812.8,35,77,811,83,818,79.6,813.8,35,317,812,323,820,319.9,815.4,36,403,812,409,820,405.9,815.4,36,721,812,727,820,723.9,815.4,36,1014,812,1020,819,1016.6,814.8,35,794,814,801,820,797.3,816.8,33,470,815,476,822,472.7,817.7,34,672,816,678,824,674.9,819.4,36,776,816,782,823,778.7,818.7,34,995,816,1001,824,997.8,819.3,37,11,817,18,823,14.1,819.6,36,435,817,441,824,437.7,819.7,34,529,817,535,824,531.7,819.7,34,98,818,104,826,100.8,821.3,37,275,818,282,824,278.1,820.6,36,842,818,849,824,845.3,820.8,33,358,819,365,825,361.3,821.8,33,646,820,652,827,648.7,822.7,34,740,820,746,828,742.9,823.4,36,154,823,160,830,156.6,825.8,35,191,823,197,831,193.8,826.3,37,407,824,414,830,409.9,826.8,32,919,824,926,830,922.1,826.6,36,727,825,734,831,729.9,827.8,32,454,826,461,832,456.9,828.8,32,1156,826,1162,833,1158.6,828.8,35,181,827,187,835,183.8,830.3,37,1044,827,1051,833,1046.9,829.8,32,668,829,675,835,671.3,831.8,33,809,829,816,835,812.3,831.8,33,1068,830,1075,836,1070.9,832.8,32,764,832,771,838,767.3,834.8,33,831,837,837,845,833.9,840.4,36,637,839,644,845,640.3,841.8,33,675,839,681,846,677.7,841.7,34,921,840,928,846,923.9,842.8,32,1132,840,1139,846,1134.9,842.8,32,524,841,530,849,526.9,844.4,36,601,842,608,848,604.3,844.8,33,382,843,388,850,384.7,845.7,34,870,843,876,851,872.9,846.4,36,166,844,173,850,168.9,846.8,32,544,844,550,852,546.9,847.4,36,1159,844,1165,851,1161.6,846.8,35,314,845,321,851,317.3,847.8,33,584,845,591,851,586.9,847.8,32,692,845,698,853,694.9,848.4,36,436,846,442,854,438.9,849.4,36,810,846,816,853,812.7,848.7,34,325,847,331,854,327.7,849.7,34,744,847,750,854,746.7,849.7,34,130,848,137,854,132.9,850.8,32,407,850,413,858,409.9,853.4,36,571,850,578,856,574.3,852.8,33,995,850,1002,856,998.1,852.6,36,1020,852,1026,860,1022.8,855.3,37,155,853,162,859,157.9,855.8,32,703,856,710,862,705.9,858.8,32,1036,857,1043,863,1039.1,859.6,36,824,858,831,864,826.9,860.8,32,852,858,858,865,854.7,860.7,34,1169,859,1176,865,1172.1,861.6,36,84,860,90,867,86.6,862.8,35,946,861,952,869,948.8,864.3,37,41,862,47,869,43.6,864.8,35,347,862,354,868,350.3,864.8,33,394,864,401,870,397.3,866.8,33,747,864,753,871,749.7,866.7,34,883,866,890,872,886.3,868.8,33,780,867,787,873,783.3,869.8,33,453,868,459,876,455.9,871.4,36,648,868,654,876,650.9,871.4,36,672,868,679,874,675.3,870.8,33,204,869,211,875,207.1,871.6,36,599,869,605,876,601.7,871.7,34,732,870,738,878,734.9,873.4,36,244,871,251,877,247.1,873.6,36,442,871,448,879,444.9,874.4,36,834,871,840,879,836.9,874.4,36,1134,871,1141,877,1136.9,873.8,32,1156,871,1163,877,1158.9,873.8,32,87,872,94,878,90.1,874.6,36,192,872,199,878,194.9,874.8,32,792,872,798,879,794.7,874.7,34,16,873,22,881,18.8,876.3,37,562,873,569,879,564.9,875.8,32,970,873,976,881,972.8,876.3,37,1038,874,1045,880,1041.1,876.6,36,53,875,59,882,55.6,877.8,35,115,876,121,884,117.8,879.3,37,38,878,45,884,40.9,880.8,32,131,878,137,886,133.8,881.3,37,403,878,410,884,405.9,880.8,32,490,878,497,884,492.9,880.8,32,761,878,767,885,763.7,880.7,34,1117,878,1124,884,1119.9,880.8,32,205,879,212,885,208.1,881.6,36,620,879,626,886,622.7,881.7,34,338,881,344,889,340.9,884.4,36,430,881,437,887,432.9,883.8,32,456,881,463,887,459.3,883.8,33,844,881,850,888,846.7,883.7,34,985,881,991,888,987.6,883.8,35,386,883,393,889,389.3,885.8,33,862,884,869,890,864.9,886.8,32,925,885,931,893,927.8,888.3,37,1016,886,1022,894,1018.8,889.3,37,72,887,78,894,74.6,889.8,35,129,891,135,898,131.6,893.8,35,211,893,217,900,213.6,895.8,35,265,895,271,902,267.6,897.8,35,66,899,73,905,68.9,901.8,32,234,901,241,907,237.1,903.6,36,284,901,291,907,287.1,903.6,36,931,901,937,908,933.6,903.8,35,160,902,166,910,162.8,905.3,37,951,903,957,910,953.6,905.8,35,962,903,969,909,965.1,905.6,36,1117,903,1124,909,1119.9,905.8,32,88,904,95,910,90.9,906.8,32,1087,904,1094,910,1090.1,906.6,36,997,906,1003,914,999.8,909.3,37,191,907,197,914,193.6,909.8,35,906,908,912,915,908.6,910.8,35,140,909,147,915,142.9,911.8,32,75,910,82,916,78.1,912.6,36,221,911,228,917,223.9,913.8,32,1158,911,1164,919,1160.8,914.3,37,251,912,257,919,253.6,914.8,35,406,912,413,918,409.1,914.6,36,588,912,594,920,590.8,915.3,37,841,913,848,919,843.9,915.8,32,934,913,940,920,936.6,915.8,35,386,914,393,920,388.9,916.8,32,461,914,468,920,463.9,916.8,32,516,914,523,920,518.9,916.8,32,1181,914,1188,920,1184.1,916.6,36,548,915,555,921,550.9,917.8,32,727,915,734,921,729.9,917.8,32,96,916,103,922,99.1,918.6,36,151,916,158,922,153.9,918.8,32,114,917,120,925,116.8,920.3,37,671,917,678,923,674.1,919.6,36,441,918,448,924,443.9,920.8,32,26,919,33,925,29.1,921.6,36,860,919,866,927,862.8,922.3,37,973,919,980,925,975.9,921.8,32,1125,922,1131,930,1127.8,925.3,37,961,923,968,929,963.9,925.8,32,767,924,773,932,769.8,927.3,37,991,924,997,931,993.6,926.8,35,160,925,167,931,162.9,927.8,32,49,926,55,934,51.8,929.3,37,323,926,330,932,326.1,928.6,36,1093,926,1099,933,1095.6,928.8,35,650,927,657,933,653.1,929.6,36,701,929,707,937,703.8,932.3,37,1141,930,1148,936,1143.9,932.8,32,437,931,444,937,439.9,933.8,32,266,932,272,939,268.6,934.8,35,454,932,460,939,456.6,934.8,35,719,932,725,939,721.6,934.8,35,34,933,41,939,36.9,935.8,32,472,934,479,940,474.9,936.8,32,558,934,564,942,560.8,937.3,37,1159,935,1165,942,1161.6,937.8,35,509,936,515,943,511.6,938.8,35,741,937,748,943,743.9,939.8,32,973,937,980,943,975.9,939.8,32,1045,937,1051,944,1047.6,939.8,35,1081,937,1088,943,1083.9,939.8,32,103,939,110,945,106.1,941.6,36,414,939,421,945,417.1,941.6,36,313,941,320,947,315.9,943.8,32,958,941,965,947,960.9,943.8,32,25,944,32,950,27.9,946.8,32,640,944,646,951,642.6,946.8,35,804,944,810,952,806.8,947.3,37,909,945,916,951,911.9,947.8,32,1071,946,1077,953,1073.6,948.8,35,1169,946,1176,952,1172.1,948.6,36,655,947,661,955,657.8,950.3,37,1030,947,1036,955,1032.8,950.3,37,665,948,672,954,668.1,950.6,36,765,948,772,954,767.9,950.8,32,172,949,178,956,174.6,951.8,35,149,950,155,958,151.8,953.3,37,997,951,1004,957,999.9,953.8,32,514,953,521,959,516.9,955.8,32,966,953,972,960,968.6,955.8,35,892,954,898,961,894.6,956.8,35,1182,954,1189,960,1185.1,956.6,36,570,955,576,963,572.8,958.3,37,903,955,909,963,905.8,958.3,37,251,956,257,963,253.6,958.8,35,59,957,65,964,61.6,959.8,35,1155,958,1161,965,1157.6,960.8,35,79,959,85,967,81.8,962.3,37,454,961,460,968,456.6,963.8,35,677,961,683,969,679.8,964.3,37,1043,961,1049,968,1045.6,963.8,35,418,962,424,970,420.8,965.3,37,688,963,695,969,690.9,965.8,32,644,965,651,971,647.1,967.6,36,1131,965,1137,973,1133.8,968.3,37,203,966,209,974,205.8,969.3,37,535,966,541,973,537.6,968.8,35,439,967,446,973,441.9,969.8,32,147,968,154,974,150.1,970.6,36,480,968,486,976,482.8,971.3,37,925,968,931,976,927.8,971.3,37,404,969,411,975,406.9,971.8,32,771,969,778,975,773.9,971.8,32,739,970,745,977,741.6,972.8,35,10,971,16,979,12.8,974.3,37,32,971,39,977,34.9,973.8,32,1107,971,1114,977,1109.9,973.8,32,504,972,510,979,506.6,974.8,35,914,972,920,980,916.8,975.3,37,968,972,974,980,970.8,975.3,37,1066,972,1073,978,1069.1,974.6,36,727,973,733,981,729.8,976.3,37,902,973,908,980,904.6,975.8,35,565,974,571,981,567.6,976.8,35,880,975,886,983,882.8,978.3,37,259,976,266,982,262.1,978.6,36,548,976,555,982,551.1,978.6,36,164,977,171,983,167.1,979.6,36,241,978,248,984,243.9,980.8,32,710,978,716,985,712.6,980.8,35,1023,978,1029,986,1025.8,981.3,37,121,979,128,985,124.1,981.6,36,1125,979,1131,987,1127.8,982.3,37,78,980,85,986,81.1,982.6,36,282,980,289,986,285.1,982.6,36,1094,980,1101,986,1096.9,982.8,32,647,981,653,988,649.6,983.8,35,295,982,302,988,297.9,984.8,32,1065,983,1071,990,1067.6,985.8,35,197,984,203,992,199.8,987.3,37,221,984,227,991,223.6,986.8,35,743,984,750,990,745.9,986.8,32,1039,984,1046,990,1042.1,986.6,36,1054,986,1061,992,1057.1,988.6,36,1179,986,1186,992,1182.1,988.6,36,442,987,448,995,444.8,990.3,37,695,987,701,994,697.6,989.8,35,269,988,276,994,272.1,990.6,36,568,988,575,994,570.9,990.8,32,145,989,152,995,148.1,991.6,36,413,989,420,995,416.1,991.6,36,1146,989,1153,995,1148.9,991.8,32,84,990,91,996,86.9,992.8,32,712,990,719,996,714.9,992.8,32,812,990,818,997,814.6,992.8,35,403,992,409,1000,405.8,995.3,37,680,993,687,999,682.9,995.8,32,161,994,167,1001,163.6,996.8,35,290,994,296,1002,292.8,997.3,37,466,995,472,1003,468.8,998.3,37,951,995,957,1002,953.6,997.8,35,1038,995,1044,1003,1040.8,998.3,37,1168,995,1175,1001,1170.9,997.8,32,333,996,339,1003,335.6,998.8,35,593,996,599,1003,595.6,998.8,35,631,996,638,1002,634.1,998.6,36,993,997,999,1004,995.6,999.8,35,1022,997,1029,1003,1024.9,999.8,32,1070,997,1076,1004,1072.6,999.8,35,247,998,254,1004,250.1,1000.6,36,495,998,502,1004,497.9,1000.8,32,507,998,514,1004,510.1,1000.6,36,662,998,668,1005,664.6,1000.8,35,315,999,322,1005,318.1,1001.6,36,433,1000,439,1007,435.6,1002.8,35,25,1001,32,1007,28.1,1003.6,36,299,1003,306,1009,302.1,1005.6,36,347,1003,353,1011,349.8,1006.3,37,395,1003,402,1009,397.9,1005.8,32,1157,1003,1163,1010,1159.6,1005.8,35,107,1005,114,1011,110.1,1007.6,36,701,1005,707,1012,703.6,1007.8,35,170,1006,177,1012,173.1,1008.6,36,1133,1006,1140,1012,1135.9,1008.8,32,1172,1006,1178,1014,1174.8,1009.3,37,954,1007,960,1014,956.6,1009.8,35,1046,1007,1052,1015,1048.8,1010.3,37,133,1008,139,1016,135.8,1011.3,37,481,1008,487,1015,483.6,1010.8,35,13,1009,19,1017,15.8,1012.3,37,605,1009,612,1015,608.1,1011.6,36,279,1010,286,1016,282.1,1012.6,36,583,1010,589,1017,585.6,1012.8,35,924,1010,930,1017,926.6,1012.8,35,542,1011,549,1017,545.1,1013.6,36,972,1011,979,1017,974.9,1013.8,32,233,1012,240,1018,235.9,1014.8,32,438,1012,444,1020,440.8,1015.3,37,1087,1012,1093,1019,1089.6,1014.8,35,850,1013,856,1021,852.8,1016.3,37,416,1014,422,1022,418.8,1017.3,37,880,1014,887,1020,883.1,1016.6,36,1142,1015,1148,1022,1144.6,1017.8,35,206,1018,212,1026,208.8,1021.3,37,392,1018,399,1024,394.9,1020.8,32,908,1018,914,1025,910.6,1020.8,35,727,1019,733,1026,729.6,1021.8,35,942,1019,949,1025,945.1,1021.6,36,787,1021,793,1028,789.6,1023.8,35,459,1022,466,1028,462.1,1024.6,36,664,1023,670,1031,666.8,1026.3,37,753,1023,759,1031,755.8,1026.3,37,348,1024,355,1030,350.9,1026.8,32,631,1024,638,1030,634.1,1026.6,36,776,1024,783,1030,778.9,1026.8,32,1016,1024,1022,1031,1018.6,1026.8,35,370,1025,377,1031,373.1,1027.6,36,1034,1025,1041,1031,1036.9,1027.8,32,805,1026,811,1034,807.8,1029.3,37,479,1027,485,1035,481.8,1030.3,37,236,1028,242,1035,238.6,1030.8,35,688,1028,695,1034,691.1,1030.6,36,89,1031,95,1038,91.6,1033.8,35,700,1031,706,1039,702.8,1034.3,37,845,1031,851,1038,847.6,1033.8,35,954,1031,960,1038,956.6,1033.8,35,1178,1031,1184,1039,1180.8,1034.3,37,986,1032,993,1038,988.9,1034.8,32,248,1033,255,1039,250.9,1035.8,32,727,1033,734,1039,729.9,1035.8,32,869,1033,876,1039,871.9,1035.8,32,914,1033,921,1039,917.1,1035.6,36,928,1033,934,1041,930.8,1036.3,37,1062,1033,1068,1041,1064.8,1036.3,37,18,1035,24,1043,20.8,1038.3,37,462,1035,469,1041,464.9,1037.8,32,560,1035,566,1042,562.6,1037.8,35,597,1035,604,1041,600.1,1037.6,36,743,1035,750,1041,745.9,1037.8,32,364,1037,370,1044,366.6,1039.8,35,414,1037,420,1044,416.6,1039.8,35,972,1039,978,1046,974.6,1041.8,35,292,1040,299,1046,295.1,1042.6,36,1163,1040,1170,1046,1166.1,1042.6,36,509,1041,515,1048,511.6,1043.8,35,100,1042,106,1050,102.8,1045.3,37,821,1042,827,1050,823.8,1045.3,37,959,1042,965,1049,961.6,1044.8,35,173,1044,179,1051,175.6,1046.8,35,269,1044,276,1050,271.9,1046.8,32,74,1045,81,1051,76.9,1047.8,32,353,1045,360,1051,355.9,1047.8,32,373,1045,380,1051,375.9,1047.8,32,23,1047,30,1053,25.9,1049.8,32,159,1047,165,1055,161.8,1050.3,37,622,1047,628,1055,624.8,1050.3,37,1045,1047,1051,1055,1047.8,1050.3,37,580,1048,587,1054,582.9,1050.8,32,929,1048,935,1056,931.8,1051.3,37,646,1049,652,1057,648.8,1052.3,37,1106,1049,1113,1055,1108.9,1051.8,32,1128,1049,1135,1055,1130.9,1051.8,32,1146,1050,1152,1058,1148.8,1053.3,37,548,1051,555,1057,550.9,1053.8,32,1014,1051,1021,1057,1017.1,1053.6,36,257,1052,264,1058,259.9,1054.8,32,427,1052,434,1058,429.9,1054.8,32,500,1052,507,1058,503.1,1054.6,36,533,1052,540,1058,536.1,1054.6,36,599,1052,606,1058,602.1,1054.6,36,1026,1052,1032,1060,1028.8,1055.3,37,207,1053,213,1060,209.6,1055.8,35,101,1054,108,1060,104.1,1056.6,36,312,1055,319,1061,314.9,1057.8,32,658,1055,665,1061,660.9,1057.8,32,836,1055,842,1063,838.8,1058.3,37,227,1056,234,1062,229.9,1058.8,32,455,1056,462,1062,457.9,1058.8,32,71,1057,78,1063,73.9,1059.8,32,238,1057,245,1063,241.1,1059.6,36,692,1057,699,1063,694.9,1059.8,32,35,1058,42,1064,38.1,1060.6,36,281,1058,288,1064,284.1,1060.6,36,817,1058,823,1066,819.8,1061.3,37,802,1059,809,1065,804.9,1061.8,32,571,1061,577,1069,573.8,1064.3,37,1017,1062,1023,1070,1019.8,1065.3,37,1169,1062,1176,1068,1171.9,1064.8,32,945,1063,951,1070,947.6,1065.8,35,385,1064,392,1070,387.9,1066.8,32,612,1064,619,1070,614.9,1066.8,32,1128,1064,1134,1072,1130.8,1067.3,37,885,1065,892,1071,888.1,1067.6,36,111,1066,117,1074,113.8,1069.3,37,143,1067,149,1074,145.6,1069.8,35,163,1067,170,1073,166.1,1069.6,36,699,1069,706,1075,702.1,1071.6,36,544,1070,550,1078,546.8,1073.3,37,901,1070,908,1076,904.1,1072.6,36,1030,1070,1037,1076,1033.1,1072.6,36,22,1071,28,1079,24.8,1074.3,37,233,1071,239,1079,235.8,1074.3,37,421,1071,427,1078,423.6,1073.8,35,716,1071,722,1078,718.6,1073.8,35,1006,1071,1013,1077,1008.9,1073.8,32,370,1072,377,1078,373.1,1074.6,36,630,1072,637,1078,632.9,1074.8,32,177,1073,183,1081,179.8,1076.3,37,218,1075,225,1081,220.9,1077.8,32,350,1075,357,1081,353.1,1077.6,36,208,1076,214,1084,210.8,1079.3,37,611,1076,617,1083,613.6,1078.8,35,284,1077,291,1083,287.1,1079.6,36,316,1077,323,1083,318.9,1079.8,32,683,1077,690,1083,685.9,1079.8,32,736,1078,742,1086,738.8,1081.3,37,47,1079,54,1085,49.9,1081.8,32,499,1079,506,1085,502.1,1081.6,36,858,1079,865,1085,861.1,1081.6,36,892,1079,899,1085,894.9,1081.8,32,1085,1079,1092,1085,1088.1,1081.6,36,521,1080,527,1088,523.8,1083.3,37,672,1082,679,1088,675.1,1084.6,36,78,1083,84,1091,80.8,1086.3,37,247,1083,253,1090,249.6,1085.8,35,273,1084,279,1092,275.8,1087.3,37,835,1085,841,1093,837.8,1088.3,37,1098,1085,1105,1091,1101.1,1087.6,36,226,1086,232,1093,228.6,1088.8,35,817,1086,824,1092,820.1,1088.6,36,261,1087,268,1093,263.9,1089.8,32,419,1087,425,1095,421.8,1090.3,37,759,1088,766,1094,761.9,1090.8,32,881,1088,888,1094,883.9,1090.8,32,859,1089,866,1095,862.1,1091.6,36,1111,1089,1118,1095,1114.1,1091.6,36,331,1090,338,1096,333.9,1092.8,32,610,1090,616,1097,612.6,1092.8,35,194,1091,201,1097,196.9,1093.8,32,480,1091,486,1098,482.6,1093.8,35,708,1091,715,1097,710.9,1093.8,32,686,1093,693,1099,689.1,1095.6,36,146,1094,153,1100,149.1,1096.6,36,724,1094,730,1102,726.8,1097.3,37,740,1095,747,1101,743.1,1097.6,36,109,1096,116,1102,112.1,1098.6,36,530,1096,536,1103,532.6,1098.8,35,1090,1096,1096,1104,1092.8,1099.3,37,16,1097,23,1103,19.1,1099.6,36,241,1097,248,1103,244.1,1099.6,36,661,1097,667,1104,663.6,1099.8,35,899,1097,905,1104,901.6,1099.8,35,1157,1097,1163,1105,1159.8,1100.3,37,454,1098,460,1106,456.8,1101.3,37,920,1098,927,1104,922.9,1100.8,32,1173,1098,1180,1104,1176.1,1100.6,36,546,1099,553,1105,548.9,1101.8,32,1146,1099,1152,1107,1148.8,1102.3,37,512,1100,518,1107,514.6,1102.8,35,884,1100,891,1106,886.9,1102.8,32,961,1100,968,1106,963.9,1102.8,32,994,1100,1001,1106,997.1,1102.6,36,39,1102,45,1110,41.8,1105.3,37,334,1102,341,1108,336.9,1104.8,32,388,1102,394,1110,390.8,1105.3,37,400,1102,406,1109,402.6,1104.8,35,590,1102,596,1110,592.8,1105.3,37,714,1102,721,1108,717.1,1104.6,36,1050,1102,1056,1110,1052.8,1105.3,37,1134,1102,1141,1108,1137.1,1104.6,36,580,1103,586,1110,582.6,1105.8,35,189,1104,195,1112,191.8,1107.3,37,1023,1105,1030,1111,1025.9,1107.8,32,1072,1106,1078,1113,1074.6,1108.8,35,24,1107,30,1115,26.8,1110.3,37,144,1107,150,1115,146.8,1110.3,37,486,1107,493,1113,488.9,1109.8,32,260,1108,266,1116,262.8,1111.3,37,669,1108,676,1114,671.9,1110.8,32,177,1110,184,1116,179.9,1112.8,32,547,1110,553,1117,549.6,1112.8,35,616,1110,623,1116,619.1,1112.6,36,464,1111,471,1117,467.1,1113.6,36,729,1111,735,1119,731.8,1114.3,37,413,1112,420,1118,415.9,1114.8,32,707,1112,713,1120,709.8,1115.3,37,946,1112,952,1119,948.6,1114.8,35,557,1114,564,1120,559.9,1116.8,32,741,1115,747,1122,743.6,1117.8,35,348,1117,354,1124,350.6,1119.8,35,369,1117,376,1123,371.9,1119.8,32,444,1117,451,1123,447.1,1119.6,36,491,1117,497,1124,493.6,1119.8,35,1180,1117,1186,1124,1182.6,1119.8,35,53,1118,60,1124,56.1,1120.6,36,589,1118,596,1124,591.9,1120.8,32,851,1118,857,1126,853.8,1121.3,37,1054,1118,1061,1124,1056.9,1120.8,32,879,1119,886,1125,881.9,1121.8,32,927,1119,934,1125,929.9,1121.8,32,252,1121,259,1127,255.1,1123.6,36,795,1121,802,1127,798.1,1123.6,36,420,1123,427,1129,423.1,1125.6,36,1090,1123,1096,1130,1092.6,1125.8,35,1126,1124,1132,1131,1128.6,1126.8,35,92,1125,98,1133,94.8,1128.3,37,226,1125,232,1132,228.6,1127.8,35,339,1125,346,1131,341.9,1127.8,32,532,1125,539,1131,535.1,1127.6,36,610,1125,617,1131,612.9,1127.8,32,808,1126,815,1132,811.1,1128.6,36,895,1126,901,1133,897.6,1128.8,35,450,1128,456,1136,452.8,1131.3,37,548,1128,555,1134,551.1,1130.6,36,571,1128,578,1134,573.9,1130.8,32,958,1128,965,1134,960.9,1130.8,32,1046,1128,1053,1134,1048.9,1130.8,32,296,1129,303,1135,298.9,1131.8,32,379,1130,386,1136,382.1,1132.6,36,992,1130,999,1136,995.1,1132.6,36,1148,1130,1154,1137,1150.6,1132.8,35,518,1131,525,1137,521.1,1133.6,36,598,1132,605,1138,601.1,1134.6,36,870,1132,877,1138,872.9,1134.8,32,181,1133,188,1139,184.1,1135.6,36,975,1133,982,1139,977.9,1135.8,32,50,1134,57,1140,52.9,1136.8,32,203,1134,209,1142,205.8,1137.3,37,419,1135,426,1141,422.1,1137.6,36,888,1136,894,1144,890.8,1139.3,37,921,1136,927,1143,923.6,1138.8,35,579,1137,585,1145,581.8,1140.3,37,680,1137,687,1143,683.1,1139.6,36,763,1137,769,1144,765.6,1139.8,35,147,1138,153,1145,149.6,1140.8,35,213,1138,220,1144,216.1,1140.6,36,228,1138,235,1144,230.9,1140.8,32,264,1140,270,1148,266.8,1143.3,37,34,1141,41,1147,36.9,1143.8,32,353,1141,360,1147,355.9,1143.8,32,376,1141,383,1147,378.9,1143.8,32,783,1141,790,1147,786.1,1143.6,36,1038,1141,1045,1147,1040.9,1143.8,32,343,1142,349,1149,345.6,1144.8,35,564,1143,571,1149,566.9,1145.8,32,160,1144,166,1151,162.6,1146.8,35,97,1145,103,1152,99.6,1147.8,35,133,1145,140,1151,135.9,1147.8,32,613,1145,619,1153,615.8,1148.3,37,993,1145,999,1153,995.8,1148.3,37,597,1146,604,1152,600.1,1148.6,36,437,1147,443,1154,439.6,1149.8,35,727,1147,733,1154,729.6,1149.8,35,813,1147,820,1153,816.1,1149.6,36,1119,1148,1125,1155,1121.6,1150.8,35,575,1149,582,1155,577.9,1151.8,32,711,1151,718,1157,714.1,1153.6,36,47,1152,53,1159,49.6,1154.8,35,236,1152,242,1160,238.8,1155.3,37,300,1152,307,1158,303.1,1154.6,36,382,1152,389,1158,385.1,1154.6,36,484,1152,490,1159,486.6,1154.8,35,895,1152,902,1158,898.1,1154.6,36,1152,1152,1158,1159,1154.6,1154.8,35,289,1153,296,1159,292.1,1155.6,36,824,1153,831,1159,826.9,1155.8,32,176,1154,182,1162,178.8,1157.3,37,398,1154,404,1162,400.8,1157.3,37,192,1155,199,1161,195.1,1157.6,36,428,1156,435,1162,431.1,1158.6,36,21,1157,28,1163,23.9,1159.8,32,139,1158,146,1164,141.9,1160.8,32,446,1158,452,1166,448.8,1161.3,37,914,1158,921,1164,917.1,1160.6,36,1032,1158,1039,1164,1034.9,1160.8,32,1050,1159,1057,1165,1052.9,1161.8,32,770,1161,777,1167,773.1,1163.6,36,754,1162,760,1169,756.6,1164.8,35,810,1162,817,1168,813.1,1164.6,36,1162,1162,1169,1168,1164.9,1164.8,32,782,1163,788,1171,784.8,1166.3,37,1120,1163,1126,1171,1122.8,1166.3,37,312,1164,319,1170,315.1,1166.6,36,852,1164,858,1172,854.8,1167.3,37,968,1164,974,1171,970.6,1166.8,35,1093,1164,1099,1171,1095.6,1166.8,35,552,1165,559,1171,555.1,1167.6,36,119,1166,125,1174,121.8,1169.3,37,518,1166,524,1173,520.6,1168.8,35,638,1166,644,1174,640.8,1169.3,37,134,1168,141,1174,136.9,1170.8,32,274,1168,281,1174,276.9,1170.8,32,399,1169,405,1176,401.6,1171.8,35,798,1170,805,1176,801.1,1172.6,36,879,1170,885,1178,881.8,1173.3,37,81,1171,88,1177,83.9,1173.8,32,383,1171,389,1178,385.6,1173.8,35,920,1171,927,1177,922.9,1173.8,32,48,1172,54,1180,50.8,1175.3,37,843,1172,849,1179,845.6,1174.8,35,1130,1173,1137,1179,1133.1,1175.6,36,289,1174,295,1181,291.6,1176.8,35,541,1174,547,1182,543.8,1177.3,37,772,1174,779,1180,774.9,1176.8,32,99,1175,105,1182,101.6,1177.8,35,496,1175,502,1182,498.6,1177.8,35,754,1175,761,1181,757.1,1177.6,36,1094,1175,1100,1182,1096.6,1177.8,35,452,1177,459,1183,454.9,1179.8,32,472,1177,479,1183,474.9,1179.8,32,721,1177,727,1184,723.6,1179.8,35,1013,1177,1019,1185,1015.8,1180.3,37,417,1178,423,1185,419.6,1180.8,35,654,1178,660,1186,656.8,1181.3,37,735,1178,741,1186,737.8,1181.3,37,821,1179,827,1187,823.8,1182.3,37,13,1181,19,1189,15.8,1184.3,37,36,1181,42,1189,38.8,1184.3,37,122,1182,129,1188,124.9,1184.8,32,334,1182,340,1189,336.6,1184.8,35,559,1182,566,1188,561.9,1184.8,32,863,1182,869,1189,865.6,1184.8,35,1067,1182,1074,1188,1069.9,1184.8,32,24,1183,30,1190,26.6,1185.8,35,82,1183,88,1190,84.6,1185.8,35,212,1183,219,1189,214.9,1185.8,32,361,1183,367,1190,363.6,1185.8,35,947,1183,953,1190,949.6,1185.8,35,485,1184,492,1190,487.9,1186.8,32];
const _LAKE_COUNT_KINGSHOT = 501;
const _MT_COUNT_KINGSHOT = 1948;

const _TERRAIN_B64 = _TERRAIN_B64_KINGSHOT;
const _LAKE_META   = _LAKE_META_KINGSHOT;
const _MT_META     = _MT_META_KINGSHOT;
const _LAKE_COUNT  = _LAKE_COUNT_KINGSHOT;
const _MT_COUNT    = _MT_COUNT_KINGSHOT;

// Cell lookup Sets — populated async, used for placement checks & cell-level rendering
const _lakeCells = new Set();
const _mtCells   = new Set();
let _terrainReady = false;
let _terrainShowLakes = true;
let _terrainShowMts   = true;

async function _decodeTerrain() {
  _terrainReady = false;
  _lakeCells.clear();
  _mtCells.clear();
  const bin = atob(_TERRAIN_B64);
  const compressed = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) compressed[i] = bin.charCodeAt(i);
  // Detect zlib-wrapped vs raw deflate: zlib starts with CM=8 and valid header checksum
  const isZlib = (compressed[0] & 0x0F) === 8 && (compressed[0] * 256 + compressed[1]) % 31 === 0;
  const deflateData = isZlib ? compressed.slice(2, compressed.length - 4) : compressed;
  const raw = new Uint8Array(await new Response(
    new Blob([deflateData]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  ).arrayBuffer());
  for (let y = 0; y < 1200; y++) {
    for (let x = 0; x < 1200; x += 4) {
      const b = raw[y * 300 + (x >> 2)];
      for (let i = 0; i < 4; i++) {
        const tv = (b >> (i * 2)) & 3;
        if (tv === 1) _mtCells.add((x + i) * 1200 + y);
        else if (tv === 2) _lakeCells.add((x + i) * 1200 + y);
      }
    }
  }
  _terrainReady = true;
  _natBitmapDirty = true;
  scheduleDraw();
}
_decodeTerrain();

function onTerrainCell(gx, gy, size) {
  if (!_terrainReady) return false;
  for (let x = gx; x < gx + size; x++)
    for (let y = gy; y < gy + size; y++)
      if (_lakeCells.has(x * 1200 + y) || _mtCells.has(x * 1200 + y)) return true;
  return false;
}

function _stripTerrainOverlaps(bldgs) {
  return bldgs;
}


// Precompute forbidden zone rectangles — split by cityExempt flag
// Active arrays (let) — rebuilt by rebuildPermRects() on game switch.
let _permForbidRectsAll     = [];
let _permForbidRects        = _permForbidRectsAll; // alias for drawing (all buildings)
let _cityExemptForbidRects  = [];
let _cityBlockedForbidRects = [];
let _permFootprintRects     = [];

// Cell lookup Sets (kept as const — cleared/repopulated by rebuildPermRects).
const _permForbidCells = new Set();   // territory exclusion (guild-type zones only)
const _cityExemptCells = new Set();   // cities allowed without X (Fortress/Sanctuary + maroon + ruins)
const _hiddenFilters = new Set();     // category keys for hidden building types (NOT game-scoped)

function rebuildPermRects() {
  _permForbidRectsAll = PERMANENT_BUILDINGS.map(b => {
    const fx = Math.round(b.gx + b.size / 2 - b.fzone / 2);
    const fy = Math.round(b.gy + b.size / 2 - b.fzone / 2);
    return { x1: fx, y1: fy, x2: fx + b.fzone, y2: fy + b.fzone };
  });
  _permForbidRects = _permForbidRectsAll;

  _cityExemptForbidRects = PERMANENT_BUILDINGS
    .map((b, i) => b.cityExempt ? _permForbidRectsAll[i] : null)
    .filter(Boolean);

  _cityBlockedForbidRects = PERMANENT_BUILDINGS
    .map((b, i) => !b.cityExempt ? _permForbidRectsAll[i] : null)
    .filter(Boolean);

  _permFootprintRects = PERMANENT_BUILDINGS.map(b => ({
    x1: b.gx, y1: b.gy, x2: b.gx + b.size, y2: b.gy + b.size
  }));

  _permForbidCells.clear();
  for (const r of _cityBlockedForbidRects)
    for (let x = Math.max(0,r.x1); x < Math.min(GRID_SIZE,r.x2); x++)
      for (let y = Math.max(0,r.y1); y < Math.min(GRID_SIZE,r.y2); y++)
        _permForbidCells.add(x * 1200 + y);

  _cityExemptCells.clear();
  for (const r of _cityExemptForbidRects)
    for (let x = Math.max(0,r.x1); x < Math.min(GRID_SIZE,r.x2); x++)
      for (let y = Math.max(0,r.y1); y < Math.min(GRID_SIZE,r.y2); y++)
        _cityExemptCells.add(x * 1200 + y);
  // Also include maroon forbidden zone (castle area)
  { const z = ZONES.forbidden;
    for (let x = z.x1; x <= z.x2; x++)
      for (let y = z.y1; y <= z.y2; y++)
        _cityExemptCells.add(x * 1200 + y); }
  // Also include ruins zone — cities allowed here without X
  { const z = ZONES.ruins;
    for (let x = z.x1; x <= z.x2; x++)
      for (let y = z.y1; y <= z.y2; y++)
        _cityExemptCells.add(x * 1200 + y); }
}
rebuildPermRects();

function _rectOverlap(ax1,ay1,ax2,ay2, bx1,by1,bx2,by2) {
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function inForbiddenZone(gx, gy, size, type) {
  const x2 = gx + size, y2 = gy + size;

  // King's zone — blocks everything
  if (_rectOverlap(gx,gy,x2,y2, KING_ZONE.x1,KING_ZONE.y1,KING_ZONE.x2,KING_ZONE.y2)) return true;

  // Permanent building footprints — blocks everything
  for (const r of _permFootprintRects)
    if (_rectOverlap(gx,gy,x2,y2, r.x1,r.y1,r.x2,r.y2)) return true;

  // Terrain (lakes/mountains) — blocks everything unless override is on
  if (!_allowBuildOverTerrain && onTerrainCell(gx, gy, size)) return true;

  // Ruins zone — blocks alliance buildings, resource nodes, and bear traps
  if (type === 'banner' || type === 'hq' || type === 'beartrap' || RESOURCE_SUBTYPES.includes(type) || type === 'resource') {
    const rz = ZONES.ruins;
    if (_rectOverlap(gx,gy,x2,y2, rz.x1,rz.y1,rz.x2+1,rz.y2+1)) return true;
  }
  // HQ additionally blocked in Fertile and Forbidden (only allowed in Badlands/Plains)
  if (type === 'hq') {
    const fz = ZONES.fertile;
    if (_rectOverlap(gx,gy,x2,y2, fz.x1,fz.y1,fz.x2+1,fz.y2+1)) return true;
    const fbz = ZONES.forbidden;
    if (_rectOverlap(gx,gy,x2,y2, fbz.x1,fbz.y1,fbz.x2+1,fbz.y2+1)) return true;
  }

  if (type === 'city') {
    // Cities blocked by guild-type forbidden zones only (not Fortress/Sanctuary)
    for (const r of _cityBlockedForbidRects)
      if (_rectOverlap(gx,gy,x2,y2, r.x1,r.y1,r.x2,r.y2)) return true;
    return false;
  }

  // Non-city: blocked by maroon zone + ALL permanent forbidden zones
  const z = ZONES.forbidden;
  if (_rectOverlap(gx,gy,x2,y2, z.x1,z.y1,z.x2+1,z.y2+1)) return true;
  for (const r of _permForbidRectsAll)
    if (_rectOverlap(gx,gy,x2,y2, r.x1,r.y1,r.x2,r.y2)) return true;

  return false;
}

// Banner cannot be placed in territory owned by a different alliance.
// Checks every cell of the footprint — if any cell is claimed by a label
// that differs from the building's own label, placement is blocked.
function inEnemyTerritory(gx, gy, size, label) {
  for (let x = gx; x < gx + size; x++)
    for (let y = gy; y < gy + size; y++) {
      const owner = currentOwnerMap.get(x * 1200 + y);
      if (owner !== undefined && owner !== label) return true;
    }
  return false;
}

// ─────────────────────────────────────
// STATE
// ─────────────────────────────────────
let buildings    = [];
let selectedType = 'banner';
let tool         = 'place';
let hoverCell    = null;
let selectedId   = null;
let isDragging   = false;
let isMoving     = false;
let moveOriginGx = 0, moveOriginGy = 0;
let dragStartX, dragStartY, dragCamX, dragCamY;
let camX = 0, camY = 0, camScale = 1;
let placementSeq = 0;          // global counter — increments on every placement

// Unique-ID generation for buildings. Uses a session-monotonic counter with a
// 'u' prefix so user-placed buildings categorically cannot collide with each
// other or with server-assigned canonical resource node IDs (whatever format
// those use). Replaces the older `Date.now()+Math.random()` scheme, which
// suffered floating-point precision loss when summed (~30 bits effective
// entropy) and could collide during batch CSV imports landing in the same ms.
let _nextUserId = 0;
function _genId() { return 'u' + (++_nextUserId); }

// ─────────────────────────────────────
// HISTORY (undo/redo) + PERSISTENCE
// ─────────────────────────────────────
const STORAGE_KEY  = 'kingshot-map-v1';
const RES_DISMISSED_KEY = 'kingshot-dismissed-resources';
const MAX_HISTORY  = 50;
let _history = [];
let _future  = [];
let _canonicalResources = [];
let _dismissedResources = new Set();

// Load dismissed set from localStorage
try {
  const raw = localStorage.getItem(RES_DISMISSED_KEY);
  if (raw) _dismissedResources = new Set(JSON.parse(raw));
} catch(e) { /* expected: localStorage may be unavailable */ }

function _saveDismissed() {
  try { localStorage.setItem(RES_DISMISSED_KEY, JSON.stringify([..._dismissedResources])); } catch(e) { /* expected: localStorage may be unavailable */ }
}

function _snapshot() {
  // Only snapshot user buildings (not canonical)
  return { buildings: buildings.filter(b => !b._canonical).map(b => ({...b})), placementSeq };
}

function pushHistory() {
  _history.push(_snapshot());
  if (_history.length > MAX_HISTORY) _history.shift();
  _future = [];
  _updateUndoRedoUI();
}

function saveToStorage() {
  // Strip canonical buildings before saving — only persist user's own data
  const userBuildings = buildings.filter(b => !b._canonical);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ buildings: userBuildings, placementSeq })); } catch(e) { /* expected: localStorage may be unavailable */ }
}

function _scheduleTerrainCleanup() {
  // Terrain ready — trigger redraw so violation highlights appear on any overlapping buildings
  if (_terrainReady) {
    _bldgDirty = true;
    scheduleDraw();
  } else {
    setTimeout(_scheduleTerrainCleanup, 200);
  }
}
setTimeout(_scheduleTerrainCleanup, 300);

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    // Strip any stale _canonical entries — old saved maps may have them, but
    // canonical nodes always come fresh from the server via fetchAndMergeCanonical()
    buildings = (s.buildings || []).filter(b => !b._canonical);
    // Migrate legacy IDs: any non-canonical building without a 'u'-prefixed
    // string ID gets reassigned via _genId(). This catches old saved data that
    // used `Date.now()+Math.random()` (which could collide via FP precision
    // loss) and ensures all id-equality use sites in the codebase work
    // correctly. Two passes: first seed _nextUserId past every existing
    // u-prefixed ID, then mint replacement IDs for legacy ones — single-pass
    // would risk minting an id that collides with a u-prefixed id later in
    // the array.
    for (const b of buildings) {
      if (typeof b.id === 'string' && b.id.startsWith('u')) {
        const n = parseInt(b.id.slice(1), 10);
        if (Number.isFinite(n) && n > _nextUserId) _nextUserId = n;
      }
    }
    let migrated = 0;
    for (const b of buildings) {
      if (typeof b.id !== 'string' || !b.id.startsWith('u')) {
        b.id = _genId();
        migrated++;
      }
    }
    placementSeq = s.placementSeq || Math.max(0, ...buildings.map(b => b.seq || 0));
    // If we rewrote any IDs, persist immediately so the migration is a
    // one-shot transition. Skipping the write when migrated===0 keeps
    // steady-state loads (where all IDs are already u-prefixed) free of
    // unnecessary localStorage I/O.
    if (migrated > 0) saveToStorage();
    invalidateTset();
    return true;
  } catch(e) { return false; }
}

function _reinjectCanonical() {
  // Remove any existing canonical, then re-add from _canonicalResources
  buildings = buildings.filter(b => !b._canonical);
  for (const n of _canonicalResources) {
    if (_dismissedResources.has(`${n.x},${n.y}`)) continue;
    const def = BUILDING_DEFS[n.type] || BUILDING_DEFS.resource;
    buildings.push({
      id: n.id, type: n.type, gx: n.x, gy: n.y,
      label: labelOf(n.type) || def.label,
      color: defaultColorOf(n.type), seq: 0, _canonical: true,
    });
  }
}

function undo() {
  if (!_history.length) return;
  _future.push(_snapshot());
  const prev = _history.pop();
  buildings = prev.buildings;
  placementSeq = prev.placementSeq;
  _reinjectCanonical();
  invalidateTset();
  invalidateBuildings();
  saveToStorage();
  updatePlacedList();
  _updateUndoRedoUI();
  draw();
}

function redo() {
  if (!_future.length) return;
  _history.push(_snapshot());
  const next = _future.pop();
  buildings = next.buildings;
  placementSeq = next.placementSeq;
  _reinjectCanonical();
  invalidateTset();
  invalidateBuildings();
  saveToStorage();
  updatePlacedList();
  _updateUndoRedoUI();
  draw();
}

function _updateUndoRedoUI() {
  const u = _el('btnUndo');
  const r = _el('btnRedo');
  if (u) u.disabled = _history.length === 0;
  if (r) r.disabled = _future.length === 0;
}

// canvas, ctx, wrap — set by each HTML file's init script

// ─────────────────────────────────────
// ISO MATH
// ─────────────────────────────────────
function gridToIso(gx, gy) {
  const c = 599.5;
  return { ix:(gx-gy)*(CELL/2), iy:-(gx+gy-2*c)*(CELL/2) };
}
function isoToGrid(ix, iy) {
  const c = 599.5*2;
  const diff = ix*2/CELL, sum = c - iy*2/CELL;
  return { gx:(sum+diff)/2, gy:(sum-diff)/2 };
}
function isoToScreen(ix, iy) {
  return { sx:canvas.width/2+(ix+camX)*camScale, sy:canvas.height/2+(iy+camY)*camScale };
}
function screenToIso(sx, sy) {
  return { ix:(sx-canvas.width/2)/camScale-camX, iy:(sy-canvas.height/2)/camScale-camY };
}
function screenToGrid(sx, sy) {
  const {ix,iy} = screenToIso(sx,sy);
  return isoToGrid(ix,iy);
}

// ─────────────────────────────────────
// GEOMETRY
// ─────────────────────────────────────
function buildingCorners(gx, gy, size) {
  return [
    gridToIso(gx,      gy),
    gridToIso(gx+size, gy),
    gridToIso(gx+size, gy+size),
    gridToIso(gx,      gy+size),
  ].map(p => isoToScreen(p.ix, p.iy));
}

function drawDiamond(corners, fill, stroke, lw=1) {
  ctx.beginPath();
  ctx.moveTo(corners[0].sx, corners[0].sy);
  for (let i=1;i<corners.length;i++) ctx.lineTo(corners[i].sx, corners[i].sy);
  ctx.closePath();
  if (fill)   { ctx.fillStyle=fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=lw; ctx.stroke(); }
}

function pointInDiamond(sx, sy, c) {
  let inside=false;
  for (let i=0,j=c.length-1;i<c.length;j=i++) {
    const xi=c[i].sx,yi=c[i].sy,xj=c[j].sx,yj=c[j].sy;
    if (((yi>sy)!=(yj>sy))&&(sx<(xj-xi)*(sy-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}

const _hexRgbaCache = Object.create(null);
function hexToRgba(hex, a) {
  const key = hex + a;
  if (_hexRgbaCache[key]) return _hexRgbaCache[key];
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return (_hexRgbaCache[key] = `rgba(${r},${g},${b},${a})`);
}

// Pre-compute RGBA strings for permanent buildings (avoid repeated hex parsing at draw time)
function _buildPermColors(arr) {
  for (const b of arr) {
    b._fillRgba   = hexToRgba(b.color, 0.90);
    b._zoneFill   = hexToRgba(b.color, 0.22);
    b._zoneStroke = hexToRgba(b.color, 0.85);
  }
}
_buildPermColors(PERMANENT_BUILDINGS_KINGSHOT);

// Reusable corner buffer to avoid allocations in hot path
const _cornerBuf = [{sx:0,sy:0},{sx:0,sy:0},{sx:0,sy:0},{sx:0,sy:0}];

// ─────────────────────────────────────
// DRAW
// ─────────────────────────────────────
let animFrame    = null;
let tsetDirty    = true;
let currentTset     = null; // now just an alias reference
let currentOwnerMap = new Map(); // cellInt → alliance label

const _allianceColorCache = Object.create(null);
function _escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Fixed alliance colours (e.g. from kor-layout.js) win over the hashed hue.
const ALLIANCE_COLOR_OVERRIDES = (typeof window !== 'undefined' && window.KOR_LAYOUT && window.KOR_LAYOUT.meta
  && window.KOR_LAYOUT.meta.allianceColors) || {};

function allianceColors(label) {
  if (_allianceColorCache[label]) return _allianceColorCache[label];
  const hex = ALLIANCE_COLOR_OVERRIDES[label];
  if (hex && /^#[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const dim = k => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
    return (_allianceColorCache[label] = { fill: dim(0.55), border: dim(0.9), swatch: hex });
  }
  let h = 5381;
  for (let i = 0; i < label.length; i++) h = ((h << 5) + h + label.charCodeAt(i)) & 0x7fffffff;
  const hue = Math.floor((h * 137.508) % 360);
  return (_allianceColorCache[label] = {
    fill:   `hsl(${hue},55%,32%)`,
    border: `hsl(${hue},60%,50%)`,
    swatch: `hsl(${hue},60%,58%)`,
  });
}

// Ownership map: process territory buildings sorted by seq (ascending).
// Each grid cell is claimed by the FIRST placer — later alliances only occupy unclaimed cells.
// Diagonal stripe pattern for orphan (disconnected) territory rendering
// Draws red dashed outlines around each orphan banner's territory rect at screen scale.
// Called from draw() after the territory bitmap is blitted.
function _drawOrphanOutlines() {
  if (!ctx) return;
  const orphanBanners = buildings.filter(b => b._orphan && b.type === 'banner');
  if (!orphanBanners.length) return;
  const d = CELL / 2 * camScale;
  const baseX = canvas.width / 2 + camX * camScale;
  const baseY = canvas.height / 2 + camY * camScale + 1199 * d;
  ctx.save();
  ctx.strokeStyle = 'rgba(220,60,60,0.85)';
  ctx.lineWidth = Math.max(1.5, 2 * Math.min(camScale, 2));
  ctx.setLineDash([Math.max(4, 6 * camScale), Math.max(3, 4 * camScale)]);
  ctx.lineJoin = 'round';
  for (const b of orphanBanners) {
    const def = BUILDING_DEFS.banner;
    const t = def.territory;
    const tx = Math.round(b.gx + def.size/2 - t/2);
    const ty = Math.round(b.gy + def.size/2 - t/2);
    // 4 corners of the banner's territory diamond in screen space
    const c1x = baseX + (tx - ty) * d,           c1y = baseY - (tx + ty) * d;
    const c2x = baseX + (tx + t - ty) * d,       c2y = baseY - (tx + t + ty) * d;
    const c3x = baseX + (tx + t - (ty + t)) * d, c3y = baseY - (tx + t + ty + t) * d;
    const c4x = baseX + (tx - (ty + t)) * d,     c4y = baseY - (tx + ty + t) * d;
    ctx.beginPath();
    ctx.moveTo(c1x, c1y);
    ctx.lineTo(c2x, c2y);
    ctx.lineTo(c3x, c3y);
    ctx.lineTo(c4x, c4y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

// Compute connectivity for each alliance — banners must chain (8-adjacent on
// owned-cell sets) back to an HQ to be valid. Orphans are mutated with
// _orphan: true. Returns a Set of cell ints belonging to orphan banners.
//
// Connectivity uses OWNED cells, not raw territory rects. A cell is owned by
// the alliance of its earliest-seq non-generic claimant. Same-alliance
// overlaps both retain ownership (no subtraction within alliance). This
// matches what the territory bitmap renders, so a banner whose territory is
// entirely consumed by an enemy alliance has zero owned cells and is
// correctly an orphan even if its raw rect would have touched its own HQ.
// ── Typed-array buffers for connectivity / ownership ──
// One-time allocation. Indexed by cellInt = x*1200 + y.
//
//   _cellBldgIdx[ci]     — index into the per-call `terri` array, or -1.
//                          A non-negative value means SOME building has
//                          first-claimed this cell.
//   _cellAllianceIdx[ci] — alliance index + 1, or 0 for cells that are
//                          claimed but not by an alliance (canonical or
//                          generic-labeled territorials).
//   _cellValid[ci]       — flood-reach mask used during connectivity.
//
// _touchedCells records every cell we wrote on the current call so we can
// reset only those next time — O(work) cleanup, never O(1.44M).
const _CELL_COUNT = GRID_SIZE * GRID_SIZE;
let _connInit = false;
let _cellBldgIdx     = null;
let _cellAllianceIdx = null;
let _cellValid       = null;
const _touchedCells  = []; // cellInts written since last reset

function _ensureConnBuf() {
  if (_connInit) return;
  _cellBldgIdx     = new Int32Array(_CELL_COUNT);
  _cellAllianceIdx = new Uint16Array(_CELL_COUNT);
  _cellValid       = new Uint8Array(_CELL_COUNT);
  _cellBldgIdx.fill(-1);
  _connInit = true;
}

function _resetConnBuf() {
  for (let i = 0; i < _touchedCells.length; i++) {
    const ci = _touchedCells[i];
    _cellBldgIdx[ci]     = -1;
    _cellAllianceIdx[ci] = 0;
    _cellValid[ci]       = 0;
  }
  _touchedCells.length = 0;
}

// Module-level cache of orphan cells, populated by buildOwnershipMap.
let _currentOrphanCells = new Set();

// Merged ownership + alliance connectivity. Replaces the previous pair of
// functions that each iterated the same territorial cells. Uses persistent
// typed arrays to avoid per-call Map/Set allocation in the hot path.
//
// Semantics preserved exactly:
//   * cellOwner is first-claim by seq, including canonical and generic.
//   * Alliance connectivity flood-fills at building granularity from HQs
//     through 8-adjacency, only crossing same-alliance cells. Reaching ANY
//     of a building's cells admits the whole building (matching the prior
//     "promote and add all owned cells to validSet" behavior — important
//     when another alliance carves up a banner's territory).
//   * currentOwnerMap excludes _permForbidCells (matches prior wrapper).
function buildOwnershipMap(bldgs) {
  window.__perf && window.__perf.mark('bfs');
  try {
    _ensureConnBuf();
    _resetConnBuf();

    const orphanCells = new Set();

    // Filter + sort once. Include canonical so currentOwnerMap matches prior
    // semantics; canonical/generic buildings are skipped from the alliance
    // pass below.
    const terri = bldgs
      .filter(b => BUILDING_DEFS[b.type] && BUILDING_DEFS[b.type].territory)
      .sort((a, b) => (a.seq || 0) - (b.seq || 0));
    const N = terri.length;
    if (N === 0) {
      _currentOrphanCells = orphanCells;
      return new Map();
    }

    // Pre-compute clipped territory rect bounds for each terri[i].
    const bX0 = new Int32Array(N);
    const bX1 = new Int32Array(N);
    const bY0 = new Int32Array(N);
    const bY1 = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      const b = terri[i];
      const def = BUILDING_DEFS[b.type];
      const t   = def.territory;
      const tx  = Math.round(b.gx + def.size / 2 - t / 2);
      const ty  = Math.round(b.gy + def.size / 2 - t / 2);
      bX0[i] = tx < 0 ? 0 : tx;
      bX1[i] = tx + t > GRID_SIZE ? GRID_SIZE : tx + t;
      bY0[i] = ty < 0 ? 0 : ty;
      bY1[i] = ty + t > GRID_SIZE ? GRID_SIZE : ty + t;
    }

    // Build alliance registry and per-building alliance index (or -1 for
    // canonical/generic, which don't participate in connectivity).
    const allianceList = []; // { label, hqs:[i], banners:[i] }
    const labelToIdx   = new Map();
    const bldgAIdx     = new Int32Array(N);
    bldgAIdx.fill(-1);
    for (let i = 0; i < N; i++) {
      const b = terri[i];
      if (b._canonical) { b._orphan = false; continue; }
      const lbl = (b.label || '').trim();
      if (_isGenericLabel(lbl)) { b._orphan = false; continue; }
      let idx = labelToIdx.get(lbl);
      if (idx === undefined) {
        idx = allianceList.length;
        labelToIdx.set(lbl, idx);
        allianceList.push({ label: lbl, hqs: [], banners: [] });
      }
      bldgAIdx[i] = idx;
      const grp = allianceList[idx];
      if (b.type === 'hq')          grp.hqs.push(i);
      else if (b.type === 'banner') grp.banners.push(i);
    }

    // Step 1: first-claim ownership across ALL terri (seq-sorted). Writes
    // _cellBldgIdx (always) and _cellAllianceIdx (only when claimant is an
    // alliance building).
    for (let i = 0; i < N; i++) {
      const x0 = bX0[i], x1 = bX1[i], y0 = bY0[i], y1 = bY1[i];
      const aIdx = bldgAIdx[i];
      const aMark = aIdx < 0 ? 0 : aIdx + 1;
      for (let x = x0; x < x1; x++) {
        const rowBase = x * 1200;
        for (let y = y0; y < y1; y++) {
          const ci = rowBase + y;
          if (_cellBldgIdx[ci] !== -1) continue; // already claimed
          _cellBldgIdx[ci]     = i;
          _cellAllianceIdx[ci] = aMark;
          _touchedCells.push(ci);
        }
      }
    }

    // Step 2: per-alliance flood-fill BFS at building granularity.
    // Reused across alliances; cleared in-place.
    const reachedBldgs = new Uint8Array(N);
    const queue = []; // cell indices

    // Admit a building: walk its territory rect, mark each cell that this
    // building actually claimed, enqueue them.
    function _admit(bi) {
      if (reachedBldgs[bi]) return;
      reachedBldgs[bi] = 1;
      const x0 = bX0[bi], x1 = bX1[bi], y0 = bY0[bi], y1 = bY1[bi];
      for (let x = x0; x < x1; x++) {
        const rowBase = x * 1200;
        for (let y = y0; y < y1; y++) {
          const ci = rowBase + y;
          if (_cellBldgIdx[ci] !== bi) continue;
          if (_cellValid[ci]) continue;
          _cellValid[ci] = 1;
          queue.push(ci);
        }
      }
    }

    function _markOrphanCells(bi) {
      const x0 = bX0[bi], x1 = bX1[bi], y0 = bY0[bi], y1 = bY1[bi];
      for (let x = x0; x < x1; x++) {
        const rowBase = x * 1200;
        for (let y = y0; y < y1; y++) {
          const ci = rowBase + y;
          if (_cellBldgIdx[ci] === bi) orphanCells.add(ci);
        }
      }
    }

    for (let a = 0; a < allianceList.length; a++) {
      const grp = allianceList[a];
      if (!grp.hqs.length) {
        // No HQ on the map: the HQ may lie outside the mapped area, so don't
        // flag these banners as orphans.
        for (let k = 0; k < grp.banners.length; k++) terri[grp.banners[k]]._orphan = false;
        continue;
      }

      // Seed flood with HQ buildings.
      queue.length = 0;
      for (let k = 0; k < grp.hqs.length; k++) _admit(grp.hqs[k]);

      const aMark = a + 1;
      while (queue.length > 0) {
        const ci = queue.pop();
        const x = (ci / 1200) | 0;
        const y = ci - x * 1200;
        const nxMin = x > 0            ? x - 1 : 0;
        const nxMax = x < GRID_SIZE-1  ? x + 1 : GRID_SIZE - 1;
        const nyMin = y > 0            ? y - 1 : 0;
        const nyMax = y < GRID_SIZE-1  ? y + 1 : GRID_SIZE - 1;
        for (let nx = nxMin; nx <= nxMax; nx++) {
          const nxBase = nx * 1200;
          for (let ny = nyMin; ny <= nyMax; ny++) {
            if (nx === x && ny === y) continue;
            const nci = nxBase + ny;
            if (_cellValid[nci]) continue;
            if (_cellAllianceIdx[nci] !== aMark) continue;
            _admit(_cellBldgIdx[nci]);
          }
        }
      }

      // Classify banners. A banner whose rect is fully first-claimed by
      // earlier-seq SAME-alliance buildings has zero cells with
      // _cellBldgIdx === bi, so _admit(bi) was never called for it during
      // BFS expansion — even though it is visually inside its own alliance's
      // territory. Recover that case: if ANY cell in the banner's rect was
      // reached by this alliance's flood, the banner is connected.
      for (let k = 0; k < grp.banners.length; k++) {
        const bi = grp.banners[k];
        let isReached = reachedBldgs[bi] === 1;
        if (!isReached) {
          const x0 = bX0[bi], x1 = bX1[bi], y0 = bY0[bi], y1 = bY1[bi];
          outer: for (let x = x0; x < x1; x++) {
            const rowBase = x * 1200;
            for (let y = y0; y < y1; y++) {
              const ci = rowBase + y;
              if (_cellValid[ci] && _cellAllianceIdx[ci] === aMark) {
                isReached = true;
                break outer;
              }
            }
          }
        }
        if (isReached) {
          terri[bi]._orphan = false;
        } else {
          terri[bi]._orphan = true;
          _markOrphanCells(bi);
        }
      }
    }

    // Step 3: build currentOwnerMap by walking the touched-cell list once.
    // Excludes _permForbidCells to match prior buildOwnershipMap behavior.
    const owned = new Map();
    for (let i = 0; i < _touchedCells.length; i++) {
      const ci = _touchedCells[i];
      if (_permForbidCells.has(ci)) continue;
      const bi = _cellBldgIdx[ci];
      if (bi < 0) continue;
      owned.set(ci, terri[bi].label);
    }

    _currentOrphanCells = orphanCells;
    return owned;
  } finally {
    window.__perf && window.__perf.measure('bfs');
  }
}

// ─────────────────────────────────────
// MAP-SPACE BITMAP CACHING
// ─────────────────────────────────────
// Territory and terrain are rendered to 1200×1200 bitmaps (1px/cell) and
// blitted with an affine transform during pan/zoom — O(1) per frame.
// Only rebuilt when DATA changes, not camera moves.

const _mapTerriCanvas = document.createElement('canvas');
_mapTerriCanvas.width = 1200; _mapTerriCanvas.height = 1200;
const _mapTerriCtx = _mapTerriCanvas.getContext('2d');
let _terriBitmapDirty = true;

const _mapNatCanvas = document.createElement('canvas');
_mapNatCanvas.width = 1200; _mapNatCanvas.height = 1200;
const _mapNatCtx = _mapNatCanvas.getContext('2d');
let _natBitmapDirty = true;

function _rebuildTerritoryBitmap() {
  _mapTerriCtx.clearRect(0, 0, 1200, 1200);
  if (currentOwnerMap.size === 0) return;
  const groups = new Map();
  const orphanGroups = new Map();
  for (const [cellInt, label] of currentOwnerMap) {
    const isOrphan = _currentOrphanCells.has(cellInt);
    const target = isOrphan ? orphanGroups : groups;
    let arr = target.get(label);
    if (!arr) { arr = []; target.set(label, arr); }
    arr.push(cellInt);
  }
  // Pass 1: valid cells at full alpha
  for (const [label, cells] of groups) {
    const { fill } = allianceColors(label);
    _mapTerriCtx.fillStyle = fill;
    _mapTerriCtx.beginPath();
    for (const ci of cells) _mapTerriCtx.rect((ci / 1200) | 0, ci % 1200, 1, 1);
    _mapTerriCtx.fill();
  }
  // Pass 2: orphan cells at low alpha (dashed red outline drawn separately in screen space)
  if (orphanGroups.size > 0) {
    _mapTerriCtx.save();
    _mapTerriCtx.globalAlpha = 0.2;
    for (const [label, cells] of orphanGroups) {
      const { fill } = allianceColors(label);
      _mapTerriCtx.fillStyle = fill;
      _mapTerriCtx.beginPath();
      for (const ci of cells) _mapTerriCtx.rect((ci / 1200) | 0, ci % 1200, 1, 1);
      _mapTerriCtx.fill();
    }
    _mapTerriCtx.restore();
  }
}

function _rebuildTerrainBitmap() {
  _mapNatCtx.clearRect(0, 0, 1200, 1200);
  if (!_terrainReady) return;
  if (!_terrainShowLakes && !_terrainShowMts) return;
  const imgData = _mapNatCtx.createImageData(1200, 1200);
  const d = imgData.data;
  if (_terrainShowLakes) {
    for (const ci of _lakeCells) {
      const x = (ci / 1200) | 0, y = ci % 1200;
      const off = (y * 1200 + x) * 4;
      d[off] = 30; d[off+1] = 90; d[off+2] = 170; d[off+3] = 128;
    }
  }
  if (_terrainShowMts) {
    for (const ci of _mtCells) {
      const x = (ci / 1200) | 0, y = ci % 1200;
      const off = (y * 1200 + x) * 4;
      d[off] = 110; d[off+1] = 75; d[off+2] = 35; d[off+3] = 140;
    }
  }
  _mapNatCtx.putImageData(imgData, 0, 0);
}

function _blitMapBitmap(bmp) {
  const d = CELL / 2 * camScale;
  const bx = canvas.width / 2 + camX * camScale;
  const by = canvas.height / 2 + camY * camScale + 1199 * d;
  ctx.save();
  ctx.setTransform(d, -d, -d, -d, bx, by);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bmp, 0, 0);
  ctx.restore();
}

// Hive view: paint only the selected alliance's owned cells (instead of
// blitting the full multi-alliance territory bitmap). Same iso transform
// trick as _blitMapBitmap so the 1×1 cell rects map straight onto the grid.
function _drawAllianceTerritory(tag) {
  if (!tag || currentOwnerMap.size === 0) return;
  const valid = [], orphan = [];
  for (const [ci, label] of currentOwnerMap) {
    if (label !== tag) continue;
    (_currentOrphanCells && _currentOrphanCells.has(ci) ? orphan : valid).push(ci);
  }
  if (!valid.length && !orphan.length) return;
  const d = CELL / 2 * camScale;
  const bx = canvas.width / 2 + camX * camScale;
  const by = canvas.height / 2 + camY * camScale + 1199 * d;
  const { fill } = allianceColors(tag);
  ctx.save();
  ctx.setTransform(d, -d, -d, -d, bx, by);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = fill;
  if (valid.length) {
    ctx.beginPath();
    for (const ci of valid) ctx.rect((ci / 1200) | 0, ci % 1200, 1, 1);
    ctx.fill();
  }
  if (orphan.length) {
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    for (const ci of orphan) ctx.rect((ci / 1200) | 0, ci % 1200, 1, 1);
    ctx.fill();
  }
  ctx.restore();
}

function _drawTerrainLabels() {
  if (!_terrainReady) return;
  const margin = 2;
  const pts = [[0,0],[canvas.width,0],[0,canvas.height],[canvas.width,canvas.height]]
    .map(([x,y]) => screenToGrid(x,y));
  const minGX = Math.max(0, Math.floor(Math.min(pts[0].gx,pts[1].gx,pts[2].gx,pts[3].gx))-margin);
  const maxGX = Math.min(GRID_SIZE-1, Math.ceil(Math.max(pts[0].gx,pts[1].gx,pts[2].gx,pts[3].gx))+margin);
  const minGY = Math.max(0, Math.floor(Math.min(pts[0].gy,pts[1].gy,pts[2].gy,pts[3].gy))-margin);
  const maxGY = Math.min(GRID_SIZE-1, Math.ceil(Math.max(pts[0].gy,pts[1].gy,pts[2].gy,pts[3].gy))+margin);
  const d = CELL / 2 * camScale;
  const bx = canvas.width / 2 + camX * camScale;
  const by = canvas.height / 2 + camY * camScale + 1199 * d;
  function _lbl(meta, label, color, minCells) {
    ctx.font = "600 11px 'Rajdhani',sans-serif";
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    for (let i = 0; i < meta.length; i += 7) {
      const bx1=meta[i],by1=meta[i+1],bx2=meta[i+2],by2=meta[i+3],bcx=meta[i+4],bcy=meta[i+5],cc=meta[i+6];
      if (cc < minCells || bx2 < minGX || bx1 > maxGX || by2 < minGY || by1 > maxGY) continue;
      ctx.fillText(label, bx + (bcx - bcy) * d, by - (bcx + bcy) * d);
    }
    ctx.shadowBlur = 0;
  }
  if (_terrainShowLakes) _lbl(_LAKE_META, '호수', 'rgba(100,190,255,0.88)', 20);
  if (_terrainShowMts)   _lbl(_MT_META, '산', 'rgba(190,150,90,0.88)', 20);
}

function _drawBuildingsLayer(c) {
  const _ctx = ctx; if (c) ctx = c;
  const p0=screenToGrid(0,0), p1=screenToGrid(canvas.width,0),
        p2=screenToGrid(0,canvas.height), p3=screenToGrid(canvas.width,canvas.height);
  const vpad = 6;
  const vMinX = Math.floor(Math.min(p0.gx,p1.gx,p2.gx,p3.gx))-vpad;
  const vMaxX = Math.ceil( Math.max(p0.gx,p1.gx,p2.gx,p3.gx))+vpad;
  const vMinY = Math.floor(Math.min(p0.gy,p1.gy,p2.gy,p3.gy))-vpad;
  const vMaxY = Math.ceil( Math.max(p0.gy,p1.gy,p2.gy,p3.gy))+vpad;
  // Set of building IDs currently being multi-moved (rendered by overlay instead)
  const _multiMovingIds = (_multiMoving && _multiSelected.length) ? new Set(_multiSelected.map(b => b.id)) : null;
  // Hive view: hide OTHER alliances' alliance-bound buildings (HQ/banner/
  // city/beartrap). Everything else — obstacles, canonical resource nodes,
  // user-placed resources — stays visible as map context.
  const hvActive = window.HiveView && HiveView.isActive();
  const hvIds = hvActive ? HiveView.getBuildingIdSet() : null;
  const _ALLIANCE_TYPES = hvIds ? { hq:1, banner:1, city:1, beartrap:1 } : null;
  // Iterate only buckets that overlap the viewport. Large buildings span
  // multiple buckets; `seen` dedupes them.
  _ensureSpatialHash();
  const bMinX = Math.max(0, (vMinX / _BUCKET_SIZE) | 0);
  const bMaxX = Math.min(_BUCKET_COLS - 1, (vMaxX / _BUCKET_SIZE) | 0);
  const bMinY = Math.max(0, (vMinY / _BUCKET_SIZE) | 0);
  const bMaxY = Math.min(_BUCKET_COLS - 1, (vMaxY / _BUCKET_SIZE) | 0);
  const seen = new Set();
  const visible = [];
  for (let bx = bMinX; bx <= bMaxX; bx++) {
    for (let by = bMinY; by <= bMaxY; by++) {
      const bucket = _spatialHash.get(_bucketKey(bx, by));
      if (!bucket) continue;
      for (const b of bucket) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (b._canonical && !_showResourceNodes) continue;
        if (_multiMovingIds && _multiMovingIds.has(b.id)) continue;
        if (hvIds && _ALLIANCE_TYPES[b.type] && !hvIds.has(b.id)) continue;
        const def = BUILDING_DEFS[b.type];
        if (!def) continue;
        const sz = def.size;
        if (b.gx+sz < vMinX || b.gx > vMaxX || b.gy+sz < vMinY || b.gy > vMaxY) continue;
        visible.push(b);
      }
    }
  }
  // Below 50% zoom with many buildings: batch by color (one path per color)
  if (camScale < 0.5 && visible.length > 40) {
    const groups = new Map();
    for (const b of visible) {
      const def = BUILDING_DEFS[b.type];
      const col = b.color || defaultColorOf(b.type);
      let arr = groups.get(col);
      if (!arr) { arr = []; groups.set(col, arr); }
      arr.push(b);
    }
    for (const [col, bldgs] of groups) {
      ctx.beginPath();
      for (const b of bldgs) {
        const corners = buildingCorners(b.gx, b.gy, BUILDING_DEFS[b.type].size);
        ctx.moveTo(corners[0].sx, corners[0].sy);
        ctx.lineTo(corners[1].sx, corners[1].sy);
        ctx.lineTo(corners[2].sx, corners[2].sy);
        ctx.lineTo(corners[3].sx, corners[3].sy);
        ctx.closePath();
      }
      ctx.fillStyle = hexToRgba(col, 0.72);
      ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
    }
  } else {
    for (const b of visible) drawBuilding(b, c || undefined);
  }
  if (c) ctx = _ctx;
}

// ─────────────────────────────────────
// OFFSCREEN SCREEN-SPACE LAYERS
// ─────────────────────────────────────
let _offGrid = null, _offGridCtx = null;
let _offBldg = null, _offBldgCtx = null;

let _gridDirty    = true;
let _bldgDirty    = true;

// Camera state snapshot for dirty detection
let _camSnap = { x: null, y: null, s: null, w: null, h: null };

function _camChanged() {
  return camX !== _camSnap.x || camY !== _camSnap.y || camScale !== _camSnap.s
      || canvas.width !== _camSnap.w || canvas.height !== _camSnap.h;
}
function _snapCam() {
  if (!canvas) return;
  _camSnap = { x: camX, y: camY, s: camScale, w: canvas.width, h: canvas.height };
}

// ─────────────────────────────────────
// CONNECTIVITY WORKER (off-main-thread BFS)
// ─────────────────────────────────────
// The first call runs synchronously so the very first paint has correct
// territory data. Subsequent invalidations dispatch to a Web Worker, with
// the main thread continuing to render against the previous result until
// the new one arrives (1-2 frame lag during a fast banner drag). If the
// Worker fails to start (e.g. blocked by the browser, hosted under a weird
// scheme), the path falls back to the synchronous `buildOwnershipMap`.
let _connWorker = null;
let _connWorkerStarted = false;   // false until we try to start the worker
let _connSyncBootstrapDone = false; // first call ran synchronously
let _connJobInFlight = false;
let _connJobId = 0;
let _connLastApplied = 0;

// Connectivity worker source, embedded as a string so the Worker can be
// constructed from a Blob URL. This avoids the file:// origin-null problem
// where `new Worker('conn_worker.js')` is rejected by the browser, and also
// removes one extra HTTP fetch on http(s) origins.
//
// IMPORTANT: this is the canonical source — there is no separate
// conn_worker.js file. Edit the algorithm here, not anywhere else.
const _CONN_WORKER_SOURCE = `
// KSMapper connectivity worker. Runs the alliance-ownership + orphan-detection
// BFS off the main thread so banner-drag doesn't block input. Mirrors the
// typed-array algorithm in core.js's buildOwnershipMap.

let GRID_SIZE = 1200;
let CELL_COUNT = GRID_SIZE * GRID_SIZE;
let _cellBldgIdx = null;
let _cellAllianceIdx = null;
let _cellValid = null;
let _touched = [];

function _ensureBuf(gridSize) {
  if (gridSize !== GRID_SIZE || !_cellBldgIdx) {
    GRID_SIZE = gridSize;
    CELL_COUNT = gridSize * gridSize;
    _cellBldgIdx = new Int32Array(CELL_COUNT);
    _cellAllianceIdx = new Uint16Array(CELL_COUNT);
    _cellValid = new Uint8Array(CELL_COUNT);
    _cellBldgIdx.fill(-1);
    _touched = [];
  }
}

function _resetBuf() {
  for (let i = 0; i < _touched.length; i++) {
    const ci = _touched[i];
    _cellBldgIdx[ci] = -1;
    _cellAllianceIdx[ci] = 0;
    _cellValid[ci] = 0;
  }
  _touched.length = 0;
}

function _isGenericLabel(lbl) {
  if (!lbl) return true;
  const t = lbl.trim();
  if (!t) return true;
  if (t === 'Banner' || t === 'Alliance HQ') return true;
  if (t === '깃발' || t === '연맹 본부') return true;
  return false;
}

self.onmessage = function (e) {
  const job = e.data;
  _ensureBuf(job.gridSize);
  _resetBuf();

  const permForbidSet = new Set(job.permForbid);
  // Orphan cells accumulated as a plain JS array (typed at the end). Using a
  // Set here would force a structured-clone copy back; an Array converts to
  // an Int32Array we can transfer.
  const orphanCellsArr = [];
  const orphanIds = [];

  const terri = job.buildings
    .filter(b => b && b.territory && b.territory > 0)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const N = terri.length;

  if (N === 0) {
    const empty = new Int32Array(0);
    self.postMessage({
      jobId: job.jobId,
      cellInts: empty,
      labelIdxs: new Uint16Array(0),
      labelTable: [],
      orphanCellInts: empty,
      orphanIds: [],
    }, [empty.buffer]);
    return;
  }

  const bX0 = new Int32Array(N);
  const bX1 = new Int32Array(N);
  const bY0 = new Int32Array(N);
  const bY1 = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const b = terri[i];
    const t = b.territory;
    const tx = Math.round(b.gx + b.size / 2 - t / 2);
    const ty = Math.round(b.gy + b.size / 2 - t / 2);
    bX0[i] = tx < 0 ? 0 : tx;
    bX1[i] = tx + t > GRID_SIZE ? GRID_SIZE : tx + t;
    bY0[i] = ty < 0 ? 0 : ty;
    bY1[i] = ty + t > GRID_SIZE ? GRID_SIZE : ty + t;
  }

  const allianceList = [];
  const labelToIdx = new Map();
  const bldgAIdx = new Int32Array(N);
  bldgAIdx.fill(-1);
  for (let i = 0; i < N; i++) {
    const b = terri[i];
    if (b._canonical) continue;
    const lbl = (b.label || '').trim();
    if (_isGenericLabel(lbl)) continue;
    let idx = labelToIdx.get(lbl);
    if (idx === undefined) {
      idx = allianceList.length;
      labelToIdx.set(lbl, idx);
      allianceList.push({ label: lbl, hqs: [], banners: [] });
    }
    bldgAIdx[i] = idx;
    const grp = allianceList[idx];
    if (b.type === 'hq')          grp.hqs.push(i);
    else if (b.type === 'banner') grp.banners.push(i);
  }

  for (let i = 0; i < N; i++) {
    const x0 = bX0[i], x1 = bX1[i], y0 = bY0[i], y1 = bY1[i];
    const aIdx = bldgAIdx[i];
    const aMark = aIdx < 0 ? 0 : aIdx + 1;
    for (let x = x0; x < x1; x++) {
      const rowBase = x * 1200;
      for (let y = y0; y < y1; y++) {
        const ci = rowBase + y;
        if (_cellBldgIdx[ci] !== -1) continue;
        _cellBldgIdx[ci] = i;
        _cellAllianceIdx[ci] = aMark;
        _touched.push(ci);
      }
    }
  }

  const reachedBldgs = new Uint8Array(N);
  const queue = [];

  function _admit(bi) {
    if (reachedBldgs[bi]) return;
    reachedBldgs[bi] = 1;
    const x0 = bX0[bi], x1 = bX1[bi], y0 = bY0[bi], y1 = bY1[bi];
    for (let x = x0; x < x1; x++) {
      const rowBase = x * 1200;
      for (let y = y0; y < y1; y++) {
        const ci = rowBase + y;
        if (_cellBldgIdx[ci] !== bi) continue;
        if (_cellValid[ci]) continue;
        _cellValid[ci] = 1;
        queue.push(ci);
      }
    }
  }

  function _markOrphan(bi) {
    const b = terri[bi];
    orphanIds.push(b.id);
    const x0 = bX0[bi], x1 = bX1[bi], y0 = bY0[bi], y1 = bY1[bi];
    for (let x = x0; x < x1; x++) {
      const rowBase = x * 1200;
      for (let y = y0; y < y1; y++) {
        const ci = rowBase + y;
        if (_cellBldgIdx[ci] === bi) orphanCellsArr.push(ci);
      }
    }
  }

  for (let a = 0; a < allianceList.length; a++) {
    const grp = allianceList[a];
    if (!grp.hqs.length) continue;   // HQ may lie outside the mapped area — not orphans
    queue.length = 0;
    for (let k = 0; k < grp.hqs.length; k++) _admit(grp.hqs[k]);

    const aMark = a + 1;
    while (queue.length > 0) {
      const ci = queue.pop();
      const x = (ci / 1200) | 0;
      const y = ci - x * 1200;
      const nxMin = x > 0                   ? x - 1 : 0;
      const nxMax = x < GRID_SIZE - 1       ? x + 1 : GRID_SIZE - 1;
      const nyMin = y > 0                   ? y - 1 : 0;
      const nyMax = y < GRID_SIZE - 1       ? y + 1 : GRID_SIZE - 1;
      for (let nx = nxMin; nx <= nxMax; nx++) {
        const nxBase = nx * 1200;
        for (let ny = nyMin; ny <= nyMax; ny++) {
          if (nx === x && ny === y) continue;
          const nci = nxBase + ny;
          if (_cellValid[nci]) continue;
          if (_cellAllianceIdx[nci] !== aMark) continue;
          _admit(_cellBldgIdx[nci]);
        }
      }
    }

    // A banner whose rect is fully first-claimed by earlier-seq same-alliance
    // buildings has zero cells with _cellBldgIdx === bi, so _admit(bi) is
    // never called during BFS — even though it sits inside its own alliance's
    // territory. Recover by checking if any cell in the banner's rect was
    // reached by this alliance's flood.
    for (let k = 0; k < grp.banners.length; k++) {
      const bi = grp.banners[k];
      if (reachedBldgs[bi]) continue;
      let isReached = false;
      const x0 = bX0[bi], x1 = bX1[bi], y0 = bY0[bi], y1 = bY1[bi];
      outer: for (let x = x0; x < x1; x++) {
        const rowBase = x * 1200;
        for (let y = y0; y < y1; y++) {
          const ci = rowBase + y;
          if (_cellValid[ci] && _cellAllianceIdx[ci] === aMark) {
            isReached = true;
            break outer;
          }
        }
      }
      if (!isReached) _markOrphan(bi);
    }
  }

  // Build owned-cells payload as struct-of-arrays:
  //   cellInts[i]   — cell index
  //   labelIdxs[i]  — index into labelTable[]
  //   labelTable    — unique alliance labels (small JS string array)
  // The two TypedArrays are Transferable; the main thread rehydrates the
  // Map<cellInt, label> in one tight loop. Avoids the 30-50 ms structured-
  // clone of a 70k-entry Map.
  const ownedCount = _touched.length;
  // Worst-case sizing; we trim at the end with subarray.
  const cellIntsBuf  = new ArrayBuffer(ownedCount * 4);
  const labelIdxsBuf = new ArrayBuffer(ownedCount * 2);
  const cellIntsView  = new Int32Array(cellIntsBuf);
  const labelIdxsView = new Uint16Array(labelIdxsBuf);
  const labelTable = [];
  const labelToTblIdx = new Map();
  let outN = 0;
  for (let i = 0; i < ownedCount; i++) {
    const ci = _touched[i];
    if (permForbidSet.has(ci)) continue;
    const bi = _cellBldgIdx[ci];
    if (bi < 0) continue;
    const lbl = terri[bi].label;
    let tIdx = labelToTblIdx.get(lbl);
    if (tIdx === undefined) {
      tIdx = labelTable.length;
      labelToTblIdx.set(lbl, tIdx);
      labelTable.push(lbl);
    }
    cellIntsView[outN]  = ci;
    labelIdxsView[outN] = tIdx;
    outN++;
  }
  // Tight subarrays sharing the same buffers; we transfer the full buffers
  // and the main thread reads length from the views (which we send as-is).
  const cellInts  = cellIntsView.subarray(0, outN);
  const labelIdxs = labelIdxsView.subarray(0, outN);
  const orphanCellInts = new Int32Array(orphanCellsArr);

  self.postMessage({
    jobId: job.jobId,
    cellInts,
    labelIdxs,
    labelTable,
    orphanCellInts,
    orphanIds,
  }, [cellIntsBuf, labelIdxsBuf, orphanCellInts.buffer]);
};
`;

function _initConnWorker() {
  if (_connWorkerStarted) return;
  _connWorkerStarted = true;
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    console.warn('[KSMapper] Web Worker / Blob URLs not available, using sync BFS');
    return;
  }
  try {
    // Construct via Blob URL so the Worker loads on any origin — including
    // file://, which rejects new Worker('conn_worker.js') because the page
    // has a null origin. revokeObjectURL is safe to call immediately: the
    // Worker has already captured the source by the time the URL is freed.
    const blob = new Blob([_CONN_WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    _connWorker = new Worker(url);
    URL.revokeObjectURL(url);
    _connWorker.onmessage = _onConnResult;
    _connWorker.onerror = (e) => {
      console.warn('[KSMapper] conn worker error, falling back to sync:',
        (e && (e.message || e.filename + ':' + e.lineno)) || e);
      try { _connWorker.terminate(); } catch (_) {}
      _connWorker = null;
      _clearConnTimeout();
      _connJobInFlight = false;
    };
    console.log('[KSMapper] conn worker started');
  } catch (e) {
    console.warn('[KSMapper] conn worker init failed:', e && e.message);
    _connWorker = null;
  }
}

// Cached subset of `buildings` whose type has positive territory (banner, hq).
// On a 13k-building map this saves two full-array scans per BFS round-trip
// (snapshot + orphan-flag apply). Banner moves keep the index valid; we
// rebuild on additions, removals, AND any path that reassigns `buildings`
// (undo, eraseAt, commitMultiMove, loadFromStorage, etc.) — without the
// identity check we'd hold dead references after an undo that restored the
// same length, and orphan flags would silently land on phantom objects.
//
// Known limitation: if a building's TYPE changes without an add/remove or
// array reassignment, the index won't rebuild. Type changes don't happen
// in normal user flows.
let _territorialIndex = null;
let _territorialIndexRef = null;
let _territorialIndexLen = -1;

function _ensureTerritorialIndex() {
  if (_territorialIndex !== null
      && _territorialIndexRef === buildings
      && _territorialIndexLen === buildings.length) {
    return _territorialIndex;
  }
  const arr = [];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const def = BUILDING_DEFS[b.type];
    if (def && def.territory) arr.push(b);
  }
  _territorialIndex = arr;
  _territorialIndexRef = buildings;
  _territorialIndexLen = buildings.length;
  return arr;
}

// Build a structured-clone-safe snapshot of just the territorial buildings.
// Includes geometry (size, territory) so the worker doesn't need BUILDING_DEFS.
function _snapshotForConn() {
  const terri = _ensureTerritorialIndex();
  const out = new Array(terri.length);
  for (let i = 0; i < terri.length; i++) {
    const b = terri[i];
    const def = BUILDING_DEFS[b.type];
    out[i] = {
      id: b.id,
      type: b.type,
      gx: b.gx,
      gy: b.gy,
      label: b.label || '',
      _canonical: !!b._canonical,
      seq: b.seq || 0,
      size: def.size,
      territory: def.territory,
    };
  }
  return out;
}

// Watchdog timeout: if the worker doesn't reply within this many ms we assume
// it's hung (we hit this once during development) and tear it down so the
// next BFS request falls back to the sync path. 500 ms is plenty — even on a
// huge map a worker compute should be tens of ms.
const _CONN_WORKER_TIMEOUT_MS = 500;
let _connTimeoutHandle = null;

function _clearConnTimeout() {
  if (_connTimeoutHandle != null) {
    clearTimeout(_connTimeoutHandle);
    _connTimeoutHandle = null;
  }
}

function _onConnTimeout() {
  _connTimeoutHandle = null;
  if (!_connJobInFlight) return;
  console.warn('[KSMapper] conn worker timed out, terminating and falling back to sync');
  try { _connWorker && _connWorker.terminate(); } catch (_) {}
  _connWorker = null;
  _connJobInFlight = false;
  // Re-set dirty so the next draw picks up the BFS via sync fallback.
  tsetDirty = true;
  scheduleDraw();
}

function _postConnJob() {
  if (!_connWorker) return false;
  _connJobInFlight = true;
  tsetDirty = false; // optimistic — set back to true on further mutations
  window.__perf && window.__perf.mark('connRTT');
  const job = {
    jobId: ++_connJobId,
    buildings: _snapshotForConn(),
    permForbid: Array.from(_permForbidCells),
    gridSize: GRID_SIZE,
  };
  _connWorker.postMessage(job);
  _clearConnTimeout();
  _connTimeoutHandle = setTimeout(_onConnTimeout, _CONN_WORKER_TIMEOUT_MS);
  return true;
}

function _onConnResult(e) {
  const r = e.data;
  _clearConnTimeout();
  window.__perf && window.__perf.measure('connRTT');
  // Discard stale results. (Shouldn't happen with our single-flight model
  // but it's a cheap guard against future regressions.)
  if (r.jobId < _connLastApplied) return;
  _connLastApplied = r.jobId;
  _connJobInFlight = false;

  // An incremental sync BFS ran while this job was in flight, so this
  // result reflects pre-incremental state and would clobber the correct
  // post-incremental state if applied. Drop it and re-dispatch if anything
  // is still dirty.
  if (_connDiscardNext) {
    _connDiscardNext = false;
    if (tsetDirty) _postConnJob();
    return;
  }

  // Rehydrate currentOwnerMap from the worker's struct-of-arrays payload.
  // The TypedArrays arrived via Transferable (zero-copy); the only real cost
  // is the Map.set loop here.
  const cellInts   = r.cellInts;
  const labelIdxs  = r.labelIdxs;
  const labelTable = r.labelTable;
  const owned = new Map();
  const n = cellInts.length;
  for (let i = 0; i < n; i++) {
    owned.set(cellInts[i], labelTable[labelIdxs[i]]);
  }
  currentOwnerMap = owned;
  currentTset = currentOwnerMap;
  _currentOrphanCells = new Set(r.orphanCellInts);

  // Apply orphan flags to live building objects by id lookup. Walks just the
  // territorial subset (~1k on a 13k map) instead of the full buildings array.
  const orphanSet = new Set(r.orphanIds);
  const terri = _ensureTerritorialIndex();
  for (let i = 0; i < terri.length; i++) {
    const b = terri[i];
    if (b._canonical) continue;
    const lbl = (b.label || '').trim();
    if (_isGenericLabel(lbl)) { b._orphan = false; continue; }
    b._orphan = orphanSet.has(b.id);
  }

  _terriBitmapDirty = true;
  _bldgDirty = true;
  scheduleUpdateAllianceLegend();

  // If the user mutated the map while the worker was computing, queue another.
  if (tsetDirty) _postConnJob();
  else scheduleDraw();
}

// Called from draw() when tsetDirty is set. Returns true if we handled it
// (either sync first-call, or worker dispatched), false to mean "caller
// should fall back to sync recomputation this frame".
function _scheduleConnectivity() {
  if (!_connWorkerStarted) _initConnWorker();
  if (!_connWorker) return false; // sync fallback
  if (!_connSyncBootstrapDone) {
    // First-ever call: do it synchronously so initial paint is correct.
    _connSyncBootstrapDone = true;
    return false;
  }
  if (_connJobInFlight) {
    // Result for the latest mutation will be re-queued when the in-flight
    // job returns (see _onConnResult). Don't post another now.
    return true;
  }
  return _postConnJob();
}

// ─────────────────────────────────────
// INCREMENTAL SYNC BFS (single-building moves)
// ─────────────────────────────────────
// When the user drags ONE banner/HQ, we don't need to re-flood the entire
// map. Only the moved building's alliance — plus any alliances whose cells
// overlap the moved building's old or new territory rect — can change. The
// rest of the map is stable.
//
// _runIncrementalSyncBFS recomputes first-claim ownership in the changed
// region (~50-450 cells), then re-floods just the affected alliances. On a
// 13k-building map this typically completes in 5-12 ms, comfortably under
// the 16 ms frame budget. Result: the territory bitmap is correct in the
// SAME frame as the move, with no async round-trip lag.
//
// `_pendingIncrementalMove` is set in the mousemove drag-move handler with
// the building's position from the LAST applied BFS. On each successful
// incremental update, we advance the reference position so subsequent
// frames only process the per-frame delta (small).
//
// If anything looks complex (canonical building, generic label, no movement)
// the function returns false and the caller falls back to the async path.
let _pendingIncrementalMove = null; // { bldg, refGx, refGy }
// Set true when an incremental update has superseded an in-flight async job.
// The next async result that arrives will be discarded rather than applied
// over the (correct) incremental state.
let _connDiscardNext = false;

function _runIncrementalSyncBFS(move) {
  const bldg = move.bldg;
  if (!bldg) return false;
  const def = BUILDING_DEFS[bldg.type];
  if (!def || !def.territory) return false;
  if (bldg._canonical) return false;
  const lbl = (bldg.label || '').trim();
  if (_isGenericLabel(lbl)) return false; // generic labels don't participate in connectivity

  // Safety: if the building was removed during the drag (rare — e.g. an
  // erase keypress mid-drag), the reference still works but the building
  // isn't in the territorial index. Clear the stale state and fall back to
  // async so the next BFS reflects the removal correctly.
  const terri = _ensureTerritorialIndex();
  if (terri.indexOf(bldg) < 0) {
    _pendingIncrementalMove = null;
    return false;
  }

  window.__perf && window.__perf.mark('incBFS');
  try {
    const t = def.territory;
    const sz = def.size;
    const oldTx = Math.round(move.refGx + sz / 2 - t / 2);
    const oldTy = Math.round(move.refGy + sz / 2 - t / 2);
    const newTx = Math.round(bldg.gx + sz / 2 - t / 2);
    const newTy = Math.round(bldg.gy + sz / 2 - t / 2);
    if (oldTx === newTx && oldTy === newTy) return true; // no positional change

    // ── Step 1: cells in (oldRect XOR newRect) — the only cells whose
    // first-claim could have changed. Cells in BOTH rects are still claimed
    // by `bldg` (no other building's seq beats it in the overlap, since the
    // overlap was already this building's claim last frame).
    const changedCells = [];
    function _pushIfNotInOther(x, y, otherTx, otherTy) {
      if (x < 0 || x >= GRID_SIZE) return;
      if (y < 0 || y >= GRID_SIZE) return;
      if (x >= otherTx && x < otherTx + t && y >= otherTy && y < otherTy + t) return;
      changedCells.push(x * 1200 + y);
    }
    for (let x = oldTx; x < oldTx + t; x++) {
      for (let y = oldTy; y < oldTy + t; y++) _pushIfNotInOther(x, y, newTx, newTy);
    }
    for (let x = newTx; x < newTx + t; x++) {
      for (let y = newTy; y < newTy + t; y++) _pushIfNotInOther(x, y, oldTx, oldTy);
    }

    // ── Step 2: collect alliances whose claim in `changedCells` is changing.
    // The moved building's own alliance is always affected. Any alliance
    // that currently owns a cell in changedCells may either lose it (if
    // bldg now claims) or gain it (if bldg previously claimed there).
    const affected = new Set([lbl]);
    for (let i = 0; i < changedCells.length; i++) {
      const prev = currentOwnerMap.get(changedCells[i]);
      if (prev && prev !== lbl && !_isGenericLabel(prev)) affected.add(prev);
    }

    // ── Step 3: recompute first-claim for each cell in changedCells.
    // We iterate the territorial index in seq order — first non-generic,
    // non-canonical building whose rect contains the cell wins.
    const terriBySeq = terri.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
    for (let i = 0; i < changedCells.length; i++) {
      const ci = changedCells[i];
      if (_permForbidCells.has(ci)) { currentOwnerMap.delete(ci); continue; }
      const cx = (ci / 1200) | 0;
      const cy = ci - cx * 1200;
      let newOwner = null;
      for (let j = 0; j < terriBySeq.length; j++) {
        const c = terriBySeq[j];
        if (c._canonical) continue;
        const clbl = (c.label || '').trim();
        if (_isGenericLabel(clbl)) continue;
        const cdef = BUILDING_DEFS[c.type];
        const ct = cdef.territory;
        const ctx = Math.round(c.gx + cdef.size / 2 - ct / 2);
        const cty = Math.round(c.gy + cdef.size / 2 - ct / 2);
        if (cx >= ctx && cx < ctx + ct && cy >= cty && cy < cty + ct) {
          newOwner = clbl;
          break;
        }
      }
      if (newOwner) currentOwnerMap.set(ci, newOwner);
      else currentOwnerMap.delete(ci);
      // Cell membership changed; remove any stale orphan-cell entry. Steps
      // below will re-add for whichever alliance owns it now.
      _currentOrphanCells.delete(ci);
    }

    // ── Step 4: for each affected alliance, re-flood from its HQs.
    // We compute the alliance's currently-owned cells from the now-fresh
    // currentOwnerMap, then run the same 8-adjacency BFS as the worker.
    for (const allianceLabel of affected) {
      _refloodAllianceForIncremental(allianceLabel, terri);
    }
    return true;
  } finally {
    window.__perf && window.__perf.measure('incBFS');
  }
}

function _refloodAllianceForIncremental(label, terri) {
  // Group this alliance's buildings.
  const hqs = [];
  const banners = [];
  for (let i = 0; i < terri.length; i++) {
    const b = terri[i];
    if (b._canonical) continue;
    if ((b.label || '').trim() !== label) continue;
    if (b.type === 'hq')          hqs.push(b);
    else if (b.type === 'banner') banners.push(b);
  }

  // Per-building owned cells (cells in this building's rect currently owned
  // by this alliance per currentOwnerMap). cellToBldgs is a multi-map: when
  // multiple same-alliance buildings cover the same cell, ALL of them must
  // be admittable through that cell — otherwise an overshadowed banner whose
  // every rect cell is also in a later-processed banner's rect would have no
  // entry pointing to it and never get admitted.
  const ownedByBldg = new Map();
  const cellToBldgs = new Map();
  for (let i = 0; i < hqs.length; i++) _computeOwnedForBldg(hqs[i], label, ownedByBldg, cellToBldgs);
  for (let i = 0; i < banners.length; i++) _computeOwnedForBldg(banners[i], label, ownedByBldg, cellToBldgs);

  // Clear this alliance's stale orphan cells before re-marking below.
  for (const [, cells] of ownedByBldg) {
    for (const ci of cells) _currentOrphanCells.delete(ci);
  }

  if (!hqs.length) {
    // No HQ on the map: the HQ may lie outside the mapped area — not orphans.
    for (let i = 0; i < banners.length; i++) banners[i]._orphan = false;
    return;
  }

  // Flood-fill from HQs.
  const reached = new Set();
  const queue = [];
  function _admit(b) {
    if (reached.has(b)) return;
    reached.add(b);
    const owned = ownedByBldg.get(b);
    if (!owned) return;
    for (const ci of owned) queue.push(ci);
  }
  for (let i = 0; i < hqs.length; i++) _admit(hqs[i]);

  while (queue.length > 0) {
    const ci = queue.pop();
    const x = (ci / 1200) | 0;
    const y = ci - x * 1200;
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      if (nx < 0 || nx >= GRID_SIZE) continue;
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy;
        if (ny < 0 || ny >= GRID_SIZE) continue;
        const owners = cellToBldgs.get(nx * 1200 + ny);
        if (!owners) continue;
        for (let oi = 0; oi < owners.length; oi++) _admit(owners[oi]);
      }
    }
  }

  // Apply orphan classification.
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    if (reached.has(b)) {
      b._orphan = false;
    } else {
      b._orphan = true;
      const owned = ownedByBldg.get(b);
      if (owned) for (const ci of owned) _currentOrphanCells.add(ci);
    }
  }
}

function _computeOwnedForBldg(b, label, ownedByBldg, cellToBldgs) {
  const def = BUILDING_DEFS[b.type];
  const t = def.territory;
  const tx = Math.round(b.gx + def.size / 2 - t / 2);
  const ty = Math.round(b.gy + def.size / 2 - t / 2);
  const owned = new Set();
  for (let x = Math.max(0, tx); x < Math.min(GRID_SIZE, tx + t); x++) {
    const rowBase = x * 1200;
    for (let y = Math.max(0, ty); y < Math.min(GRID_SIZE, ty + t); y++) {
      const ci = rowBase + y;
      if (currentOwnerMap.get(ci) === label) {
        owned.add(ci);
        let list = cellToBldgs.get(ci);
        if (!list) { list = []; cellToBldgs.set(ci, list); }
        list.push(b);
      }
    }
  }
  ownedByBldg.set(b, owned);
}

function invalidateTset() {
  tsetDirty = true;
  // _terriBitmapDirty intentionally NOT set here — with the async connectivity
  // worker, `currentOwnerMap` hasn't been recomputed yet, so rebuilding the
  // 1.44M-cell bitmap right now would just re-render stale data. The bitmap
  // is marked dirty in _onConnResult / the sync fallback once we actually
  // have fresh ownership data.
  _bldgDirty = true;
  _spatialDirty = true;
}

function invalidateBuildings() {
  _bldgDirty = true;
  _spatialDirty = true;
}

function _ensureOffscreen() {
  const w = canvas.width, h = canvas.height;
  if (!_offGrid || _offGrid.width !== w || _offGrid.height !== h) {
    _offGrid = new OffscreenCanvas(w, h); _offGridCtx = _offGrid.getContext('2d');
    _offBldg = new OffscreenCanvas(w, h); _offBldgCtx = _offBldg.getContext('2d');
    _gridDirty = _bldgDirty = true;
  }
}

// Track previous ghost position to know when overlay-only redraw is needed
let _lastGhostGx = null, _lastGhostGy = null;

// `draw()` is the public entry point used by ~40 call sites (event handlers,
// state mutations, post-import refreshes). To prevent any single one from
// running the heavy pipeline (BFS, bitmap rebuild) synchronously inside an
// input handler, we make `draw()` a thin RAF-coalescing scheduler. The actual
// pipeline lives in `_drawImmediate()`, which `scheduleDraw()`'s RAF callback
// calls. Multiple `draw()` calls within the same task collapse to one frame.
function draw() { scheduleDraw(); }

function _drawImmediate() {
  if (!canvas || !ctx) return;
  window.__perf && window.__perf.mark('draw');
  try {
    const camMoved = _camChanged();
    if (camMoved) { _gridDirty = true; _bldgDirty = true; _snapCam(); }

    if (tsetDirty) {
      // Fast path: if a single banner/HQ moved, recompute connectivity
      // synchronously for just its alliance(s). Eliminates the async round-
      // trip lag that otherwise makes territory trail behind the cursor.
      let handled = false;
      if (_pendingIncrementalMove && _runIncrementalSyncBFS(_pendingIncrementalMove)) {
        _pendingIncrementalMove.refGx = _pendingIncrementalMove.bldg.gx;
        _pendingIncrementalMove.refGy = _pendingIncrementalMove.bldg.gy;
        tsetDirty = false;
        _terriBitmapDirty = true;
        _bldgDirty = true;
        scheduleUpdateAllianceLegend();
        // If an async job is in flight from a prior frame, its result will be
        // stale by the time it arrives — mark it to be discarded.
        if (_connJobInFlight) _connDiscardNext = true;
        handled = true;
      }

      // Otherwise: dispatch to the Web Worker so the BFS doesn't block the
      // current frame. If the worker isn't available, fall back to sync.
      if (!handled && !_scheduleConnectivity()) {
        currentOwnerMap = buildOwnershipMap(buildings);
        currentTset = currentOwnerMap;
        tsetDirty = false;
        _terriBitmapDirty = true;
        _bldgDirty = true;
        scheduleUpdateAllianceLegend();
      }
    }

    // Rebuild map-space bitmaps only when data changes (NOT on camera moves)
    if (_terriBitmapDirty) {
      window.__perf && window.__perf.mark('terriBmp');
      _rebuildTerritoryBitmap();
      window.__perf && window.__perf.measure('terriBmp');
      _terriBitmapDirty = false;
    }
    if (_natBitmapDirty)   { _rebuildTerrainBitmap();   _natBitmapDirty = false; }

    _ensureOffscreen();

    // ── Layer 0: grid + zones + permanent buildings ──
    if (_gridDirty) {
      _offGridCtx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid(_offGridCtx);
      drawCastleOverlay(_offGridCtx);
      drawPermanentBuildings(_offGridCtx);
      _gridDirty = false;
    }

    // ── Layer 1: user buildings ──
    // Force rebuild during multi-move so selected buildings disappear from this layer
    if (_multiMoving) _bldgDirty = true;
    if (_bldgDirty) {
      _offBldgCtx.clearRect(0, 0, canvas.width, canvas.height);
      window.__perf && window.__perf.mark('bldgLayer');
      _drawBuildingsLayer(_offBldgCtx);
      window.__perf && window.__perf.measure('bldgLayer');
      _bldgDirty = false;
    }

    // ── Composite (bitmap blits are O(1) GPU ops) ──
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hive view: clip the entire composite to the bbox diamond so anything
    // outside the alliance's hive boundary is hidden. Skip editor overlays.
    const _hvActive = window.HiveView && HiveView.isActive();
    if (_hvActive) {
      const bb = HiveView.getBbox();
      const corners = [
        gridToIso(bb.x1, bb.y1),
        gridToIso(bb.x2, bb.y1),
        gridToIso(bb.x2, bb.y2),
        gridToIso(bb.x1, bb.y2),
      ].map(p => isoToScreen(p.ix, p.iy));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(corners[0].sx, corners[0].sy);
      ctx.lineTo(corners[1].sx, corners[1].sy);
      ctx.lineTo(corners[2].sx, corners[2].sy);
      ctx.lineTo(corners[3].sx, corners[3].sy);
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(_offGrid, 0, 0);
    if (_hvActive) {
      const _hvTag = HiveView.getTag && HiveView.getTag();
      if (_hvTag) _drawAllianceTerritory(_hvTag);
    } else if (currentOwnerMap.size > 0) {
      _blitMapBitmap(_mapTerriCanvas);
    }
    if (!_hvActive) _drawOrphanOutlines();
    if (!_hvActive && (_terrainShowLakes || _terrainShowMts)) _blitMapBitmap(_mapNatCanvas);
    if (!_hvActive && camScale >= 0.5) _drawTerrainLabels();
    ctx.drawImage(_offBldg, 0, 0);

    // ── Live overlays (suppressed in hive view) ──
    if (!_hvActive) {
      if (tool==='place' && hoverCell) drawGhost(hoverCell.gx, hoverCell.gy, ctx);
      if (selectedId) drawSelectionOutline(ctx);
      drawOptimizerOverlay();
      drawEraseRectOverlay();
      drawMultiSelectOverlay();
    }

    if (_hvActive) ctx.restore();

    // Per-file hooks (e.g. admin resource overlay)
    window.__perf && window.__perf.mark('hooks');
    for (const hook of _postDrawHooks) hook();
    window.__perf && window.__perf.measure('hooks');
  } finally {
    if (window.__perf) {
      window.__perf.measure('draw');
      window.__perf.gauge('bldgs', buildings.length);
      window.__perf.tick();
    }
  }
}

function drawGrid(c) {
  const _ctx = ctx; if (c) ctx = c;
  const m=2;
  const p0=screenToGrid(0,0), p1=screenToGrid(canvas.width,0),
        p2=screenToGrid(0,canvas.height), p3=screenToGrid(canvas.width,canvas.height);
  const minGX=Math.max(0,Math.floor(Math.min(p0.gx,p1.gx,p2.gx,p3.gx))-m);
  const maxGX=Math.min(GRID_SIZE-1,Math.ceil(Math.max(p0.gx,p1.gx,p2.gx,p3.gx))+m);
  const minGY=Math.max(0,Math.floor(Math.min(p0.gy,p1.gy,p2.gy,p3.gy))-m);
  const maxGY=Math.min(GRID_SIZE-1,Math.ceil(Math.max(p0.gy,p1.gy,p2.gy,p3.gy))+m);

  // ── 1. Clip to the full map diamond ──────────────────
  ctx.save();
  const mapC = buildingCorners(0,0,GRID_SIZE);
  ctx.beginPath();
  ctx.moveTo(mapC[0].sx,mapC[0].sy);
  for (let i=1;i<mapC.length;i++) ctx.lineTo(mapC[i].sx,mapC[i].sy);
  ctx.closePath();
  ctx.clip();

  // ── 2. Paint zones in priority order (each overpaints previous) ──
  // Badlands → Plains → Fertile → Ruins → Forbidden
  // No stacking: each is drawn as a solid fill, later ones paint over earlier
  const zOrder = ['badlands','plains','fertile','ruins','forbidden'];
  for (const zk of zOrder) {
    const z = ZONES[zk];
    const zc = zoneCorners(z.x1, z.y1, z.x2+1, z.y2+1);
    ctx.beginPath();
    ctx.moveTo(zc[0].sx,zc[0].sy);
    for (let i=1;i<zc.length;i++) ctx.lineTo(zc[i].sx,zc[i].sy);
    ctx.closePath();
    ctx.fillStyle = z.fill;
    ctx.fill();
    if (z.stroke) {
      ctx.strokeStyle = z.stroke;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6,4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();

  // ── 3. Grid lines (skip at low zoom — invisible and wasteful) ──
  if (camScale > 0.12 && (maxGX-minGX)*(maxGY-minGY) <= 8000) {
    // Single batched path — one beginPath/stroke for all visible cells
    const Wg = canvas.width/2, Hg = canvas.height/2;
    const dg = CELL/2 * camScale;
    const baseXg = Wg + camX*camScale;
    const baseYg = Hg + camY*camScale + 1199*dg;
    ctx.beginPath();
    for (let gx=minGX; gx<=maxGX; gx++) {
      for (let gy=minGY; gy<=maxGY; gy++) {
        if (gx<0||gy<0||gx>=GRID_SIZE||gy>=GRID_SIZE) continue;
        const sx0 = baseXg + (gx-gy)*dg;
        const sy0 = baseYg - (gx+gy)*dg;
        ctx.moveTo(sx0,      sy0);
        ctx.lineTo(sx0+dg,   sy0-dg);
        ctx.lineTo(sx0,      sy0-2*dg);
        ctx.lineTo(sx0-dg,   sy0-dg);
        ctx.closePath();
      }
    }
    ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=0.4; ctx.stroke();
  }

  // Major axis lines every 100
  for (let n=0;n<=GRID_SIZE;n+=100) {
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=0.8;
    let a=isoToScreen(gridToIso(n,0).ix,gridToIso(n,0).iy);
    let b=isoToScreen(gridToIso(n,GRID_SIZE).ix,gridToIso(n,GRID_SIZE).iy);
    ctx.beginPath(); ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.stroke();
    a=isoToScreen(gridToIso(0,n).ix,gridToIso(0,n).iy);
    b=isoToScreen(gridToIso(GRID_SIZE,n).ix,gridToIso(GRID_SIZE,n).iy);
    ctx.beginPath(); ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.stroke();
  }

  // Map border
  drawDiamond(buildingCorners(0,0,GRID_SIZE), null, '#2a5040', 2);

  // Cardinal labels
  function lbl(gx,gy,t,col) {
    const p=isoToScreen(gridToIso(gx,gy).ix,gridToIso(gx,gy).iy);
    ctx.save(); ctx.font="11px 'Rajdhani',sans-serif"; ctx.fillStyle=col;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='#000'; ctx.shadowBlur=4; ctx.fillText(t,p.sx,p.sy); ctx.restore();
  }
  lbl(0,0,'0,0 남','#c9a84c'); lbl(1199,1199,'1199,1199 북','#c9a84c');
  lbl(1199,0,'동','#aaaaaa');  lbl(0,1199,'서','#aaaaaa');
  if (c) ctx = _ctx; // restore global ctx
}

function drawTerritoryUnion(c) {
  const _ctx = ctx; if (c) ctx = c;
  if (currentOwnerMap.size === 0) { if (c) ctx = _ctx; return; }

  // Viewport bounds for culling
  const margin = 2;
  const pts = [[0,0],[canvas.width,0],[0,canvas.height],[canvas.width,canvas.height]]
    .map(([x,y]) => screenToGrid(x,y));
  const minGX = Math.max(0,          Math.floor(Math.min(pts[0].gx,pts[1].gx,pts[2].gx,pts[3].gx))-margin);
  const maxGX = Math.min(GRID_SIZE-1, Math.ceil( Math.max(pts[0].gx,pts[1].gx,pts[2].gx,pts[3].gx))+margin);
  const minGY = Math.max(0,          Math.floor(Math.min(pts[0].gy,pts[1].gy,pts[2].gy,pts[3].gy))-margin);
  const maxGY = Math.min(GRID_SIZE-1, Math.ceil( Math.max(pts[0].gy,pts[1].gy,pts[2].gy,pts[3].gy))+margin);

  const W = canvas.width / 2, H = canvas.height / 2;
  const d = CELL / 2 * camScale;
  const baseX = W + camX * camScale;
  const baseY = H + camY * camScale + 1199 * d;

  // Bucket owned cells by alliance — iterate ownerMap directly (sparse, not viewport scan)
  const groups = new Map();
  for (const [cellInt, label] of currentOwnerMap) {
    const gx = (cellInt / 1200) | 0;
    const gy = cellInt % 1200;
    // Viewport cull
    if (gx < minGX || gx > maxGX || gy < minGY || gy > maxGY) continue;
    let arr = groups.get(label);
    if (!arr) { arr = []; groups.set(label, arr); }
    arr.push(gx, gy);
  }

  // One fill pass per alliance — no stacking, no blending between alliances
  for (const [label, cells] of groups) {
    const { fill } = allianceColors(label);
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < cells.length; i += 2) {
      const gx = cells[i], gy = cells[i+1];
      const sx0 = baseX + (gx - gy) * d;
      const sy0 = baseY - (gx + gy) * d;
      ctx.moveTo(sx0,     sy0);
      ctx.lineTo(sx0 + d, sy0 - d);
      ctx.lineTo(sx0,     sy0 - 2*d);
      ctx.lineTo(sx0 - d, sy0 - d);
      ctx.closePath();
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }
  if (c) ctx = _ctx;
}


function drawNaturalTerrain(c) {
  const _ctx = ctx; if (c) ctx = c;

  const margin = 2;
  const pts = [[0,0],[canvas.width,0],[0,canvas.height],[canvas.width,canvas.height]]
    .map(([x,y]) => screenToGrid(x,y));
  const minGX = Math.max(0,          Math.floor(Math.min(pts[0].gx,pts[1].gx,pts[2].gx,pts[3].gx))-margin);
  const maxGX = Math.min(GRID_SIZE-1, Math.ceil( Math.max(pts[0].gx,pts[1].gx,pts[2].gx,pts[3].gx))+margin);
  const minGY = Math.max(0,          Math.floor(Math.min(pts[0].gy,pts[1].gy,pts[2].gy,pts[3].gy))-margin);
  const maxGY = Math.min(GRID_SIZE-1, Math.ceil( Math.max(pts[0].gy,pts[1].gy,pts[2].gy,pts[3].gy))+margin);

  const d = CELL / 2 * camScale;
  const baseX = canvas.width / 2 + camX * camScale;
  const baseY = canvas.height / 2 + camY * camScale + 1199 * d;
  const detailed = camScale >= 0.40 && _terrainReady;

  // ── Draw cells or blob bounds ──
  function _drawCells(cellSet, fillColor) {
    ctx.beginPath();
    for (const ci of cellSet) {
      const gx = (ci / 1200) | 0, gy = ci % 1200;
      if (gx < minGX || gx > maxGX || gy < minGY || gy > maxGY) continue;
      const sx = baseX + (gx - gy) * d, sy = baseY - (gx + gy) * d;
      ctx.moveTo(sx, sy); ctx.lineTo(sx+d, sy-d);
      ctx.lineTo(sx, sy-2*d); ctx.lineTo(sx-d, sy-d); ctx.closePath();
    }
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  function _drawBlobs(meta, fillColor) {
    ctx.beginPath();
    for (let i = 0; i < meta.length; i += 7) {
      const bx1 = meta[i], by1 = meta[i+1], bx2 = meta[i+2], by2 = meta[i+3];
      if (bx2 < minGX || bx1 > maxGX || by2 < minGY || by1 > maxGY) continue;
      const s0x = baseX + (bx1 - by1) * d, s0y = baseY - (bx1 + by1) * d;
      const s1x = baseX + (bx2 - by1) * d, s1y = baseY - (bx2 + by1) * d;
      const s2x = baseX + (bx2 - by2) * d, s2y = baseY - (bx2 + by2) * d;
      const s3x = baseX + (bx1 - by2) * d, s3y = baseY - (bx1 + by2) * d;
      ctx.moveTo(s0x, s0y); ctx.lineTo(s1x, s1y);
      ctx.lineTo(s2x, s2y); ctx.lineTo(s3x, s3y); ctx.closePath();
    }
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  function _drawLabels(meta, label, color, minCells) {
    ctx.font = "600 11px 'Rajdhani',sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    for (let i = 0; i < meta.length; i += 7) {
      const bx1 = meta[i], by1 = meta[i+1], bx2 = meta[i+2], by2 = meta[i+3];
      const bcx = meta[i+4], bcy = meta[i+5], cc = meta[i+6];
      if (cc < minCells || bx2 < minGX || bx1 > maxGX || by2 < minGY || by1 > maxGY) continue;
      ctx.fillText(label, baseX + (bcx - bcy) * d, baseY - (bcx + bcy) * d);
    }
    ctx.shadowBlur = 0;
  }

  if (_terrainShowLakes) {
    if (detailed) _drawCells(_lakeCells, 'rgba(30,90,170,0.35)');
    else _drawBlobs(_LAKE_META, 'rgba(30,90,170,0.35)');
    if (camScale >= 0.5) _drawLabels(_LAKE_META, '호수', 'rgba(100,190,255,0.88)', 20);
  }

  if (_terrainShowMts) {
    if (detailed) _drawCells(_mtCells, 'rgba(110,75,35,0.38)');
    else _drawBlobs(_MT_META, 'rgba(110,75,35,0.38)');
    if (camScale >= 0.5) _drawLabels(_MT_META, '산', 'rgba(190,150,90,0.88)', 20);
  }

  if (c) ctx = _ctx;
}

// Static king's castle structures — gold, unplaceable, always drawn
const CASTLE_STRUCTURES = [
  { label: "King's Castle", gx: 597, gy: 597, size: 6 },
  { label: 'S Turret',      gx: 594, gy: 594, size: 2 },
  { label: 'N Turret',      gx: 604, gy: 604, size: 2 },
  { label: 'W Turret',      gx: 594, gy: 604, size: 2 },
  { label: 'E Turret',      gx: 604, gy: 594, size: 2 },
];

function drawCastleOverlay(c) {
  const _ctx = ctx; if (c) ctx = c;
  // ── Exclusion zone perimeter ──────────────────────────
  // Use buildingCorners(594, 594, 11) — same math as all other zone outlines,
  // traces the outer diamond edge from 594,594 → 605,605
  const kCorners = buildingCorners(KING_ZONE.x1, KING_ZONE.y1, KING_ZONE.x2 - KING_ZONE.x1);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(kCorners[0].sx, kCorners[0].sy);
  for (let i = 1; i < kCorners.length; i++) ctx.lineTo(kCorners[i].sx, kCorners[i].sy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(201,168,76,0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.75)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();

  // ── Castle structures ─────────────────────────────────
  for (const s of CASTLE_STRUCTURES) {
    const corners = buildingCorners(s.gx, s.gy, s.size);
    const isCastle = s.size === 6;
    drawDiamond(corners,
      isCastle ? 'rgba(201,168,76,0.28)' : 'rgba(201,168,76,0.22)',
      '#c9a84c',
      isCastle ? 2 : 1.5
    );
    const cx = (corners[0].sx + corners[1].sx + corners[2].sx + corners[3].sx) * 0.25;
    const cy = (corners[0].sy + corners[1].sy + corners[2].sy + corners[3].sy) * 0.25;
    const fs = Math.max(10, Math.min(14, s.size * CELL * camScale * 0.22));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners[0].sx, corners[0].sy);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
    ctx.closePath(); ctx.clip();
    ctx.font = `600 ${fs}px 'Rajdhani', sans-serif`;
    ctx.fillStyle = '#c9a84c';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (camScale > 0.15) { ctx.shadowColor = '#000'; ctx.shadowBlur = 4; }
    ctx.fillText(koName(s.label), cx, cy);
    ctx.restore();
  }
  if (c) ctx = _ctx;
}

function drawPermanentBuildings(c) {
  const _ctx = ctx; if (c) ctx = c;

  // Group by color to batch forbidden zone outlines
  const byColor = new Map();
  PERMANENT_BUILDINGS.forEach((b, i) => {
    if (_hiddenFilters.has(b.category)) return;
    if (!byColor.has(b.color)) byColor.set(b.color, []);
    byColor.get(b.color).push({ b, r: _permForbidRects[i] });
  });

  // Draw forbidden zone outlines (one batched path per color)
  for (const [color, items] of byColor) {
    ctx.save();
    ctx.beginPath();
    for (const { r } of items) {
      const fc = buildingCorners(r.x1, r.y1, r.x2 - r.x1);
      ctx.moveTo(fc[0].sx, fc[0].sy);
      for (let i = 1; i < fc.length; i++) ctx.lineTo(fc[i].sx, fc[i].sy);
      ctx.closePath();
    }
    // Use pre-computed RGBA from first building in group
    ctx.fillStyle   = items[0].b._zoneFill;
    ctx.fill();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = items[0].b._zoneStroke;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Draw building footprints + labels
  const showLabels = camScale >= 0.5; // hide text below 50% zoom
  for (const b of PERMANENT_BUILDINGS) {
    if (_hiddenFilters.has(b.category)) continue;
    const corners = buildingCorners(b.gx, b.gy, b.size);
    drawDiamond(corners, b._fillRgba, b.color, b.size === 6 ? 1.8 : 1.3);

    if (showLabels) {
      const cx = (corners[0].sx + corners[1].sx + corners[2].sx + corners[3].sx) * 0.25;
      const cy = (corners[0].sy + corners[1].sy + corners[2].sy + corners[3].sy) * 0.25;
      const fs = Math.max(11, Math.min(16, b.size * CELL * camScale * 0.26));
      if (fs >= 6) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(corners[0].sx, corners[0].sy);
        for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
        ctx.closePath(); ctx.clip();
        ctx.font = `bold ${fs}px 'Rajdhani', sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (camScale > 0.15) { ctx.shadowColor = '#000'; ctx.shadowBlur = 5; }
        ctx.fillText(koName(b.label), cx, cy);
        ctx.restore();
      }
    }
  }
  if (c) ctx = _ctx;
}

function drawGhost(gx, gy, c) {
  const _ctx = ctx; if (c) ctx = c;
  const def=BUILDING_DEFS[selectedType], col=(_el('buildingColor')||{}).value;
  let blocked = wouldOverlap(gx, gy, def.size, null) || inForbiddenZone(gx, gy, def.size, selectedType);
  // Banners blocked in enemy territory
  if (!blocked && selectedType === 'banner') {
    const label = (_el('buildingLabel')||{}).value || def.label;
    if (inEnemyTerritory(gx, gy, def.size, label)) blocked = true;
  }
  const ghostCol = blocked ? '#f85149' : col;
  const ghostAlpha = blocked ? 0.35 : 0.28;
  drawDiamond(buildingCorners(gx,gy,def.size), hexToRgba(ghostCol,ghostAlpha), ghostCol, blocked ? 2 : 1.5);

  if (!blocked && def.territory > 0) {
    const t = def.territory, tx = gx + def.size/2 - t/2, ty = gy + def.size/2 - t/2;
    ctx.save();
    ctx.setLineDash([5, 3]);
    drawDiamond(buildingCorners(tx,ty,t), 'rgba(255,160,40,0.07)', '#ff9f1a', 1.8);
    ctx.setLineDash([]);
    ctx.restore();
  }
  if (c) ctx = _ctx;
}

function _overlapsAnyCanonical(gx, gy, size) {
  for (const cn of _canonicalResources) {
    const cnDef = BUILDING_DEFS[cn.type] || BUILDING_DEFS.resource;
    if (footprintsOverlap(gx, gy, size, cn.x, cn.y, cnDef.size)) return true;
  }
  return false;
}

function drawBuilding(b, c) {
  const _ctx = ctx; if (c) ctx = c;
  const def=BUILDING_DEFS[b.type], col=b.color||defaultColorOf(b.type);
  const corners=buildingCorners(b.gx,b.gy,def.size);
  const sel=b.id===selectedId;
  drawDiamond(corners, hexToRgba(col,sel?0.88:0.72), col, sel?2.5:1.5);

  // Highlight user buildings that illegally sit on terrain or canonical nodes when override is off
  if (!b._canonical && !_allowBuildOverTerrain) {
    if (onTerrainCell(b.gx, b.gy, def.size) || _overlapsAnyCanonical(b.gx, b.gy, def.size)) {
      drawDiamond(corners, 'rgba(255,30,30,0.18)', '#ff2020', 3);
    }
  }

  const cx2 = (corners[0].sx + corners[1].sx + corners[2].sx + corners[3].sx) * 0.25;
  const cy2 = (corners[0].sy + corners[1].sy + corners[2].sy + corners[3].sy) * 0.25;
  const useShadow = camScale > 0.15;
  // Below 50% zoom: render as coloured boxes only — no labels or coordinates
  if (camScale >= 0.5) {
    // Hive view overrides label rendering for cities (multi-line march
    // times) and bear traps ((TAG) Bear 1/2). See hive_view.js.
    const _hvOn = window.HiveView && HiveView.isActive();
    const _hvCity = _hvOn && b.type === 'city';
    const _hvBear = _hvOn && b.type === 'beartrap';
    const _bearOverride = _hvBear ? HiveView.getBearLabel(b.id) : null;
    const _cityTimes   = _hvCity ? HiveView.getCityTimes(b.id) : null;
    const _hvCityMulti = !!(_cityTimes && _cityTimes.b1 != null);

    if (b.label || _bearOverride || _hvCityMulti) {
      const fs=Math.max(10,Math.min(15,def.size*CELL*camScale*0.26));
      const displayLabel = _bearOverride || koName(b.label) || '';

      if (_hvCityMulti) {
        // Multi-line centered render: [label?, "B1: Xs", "B2: Xs"]. Skip
        // diamond clip — the hive-view scene clip in _drawImmediate already
        // bounds the drawing to the bbox.
        const lines = [];
        if (b.label) lines.push(koName(b.label));
        lines.push(`B1: ${_cityTimes.b1}s`);
        if (_cityTimes.b2 != null) lines.push(`B2: ${_cityTimes.b2}s`);
        const lineH = fs * 1.15;
        const startOffset = -((lines.length - 1) / 2) * lineH;
        ctx.save();
        ctx.font=`bold ${fs}px 'Rajdhani',sans-serif`;
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
        if (useShadow) { ctx.shadowColor='#000'; ctx.shadowBlur=5; }
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], cx2, cy2 + startOffset + i * lineH);
        }
        ctx.restore();
      } else {
        // Single-line path (default + bear trap override).
        ctx.save();
        ctx.beginPath(); ctx.moveTo(corners[0].sx,corners[0].sy);
        for(let i=1;i<corners.length;i++) ctx.lineTo(corners[i].sx,corners[i].sy);
        ctx.closePath(); ctx.clip();
        ctx.font=`bold ${fs}px 'Rajdhani',sans-serif`;
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
        if (useShadow) { ctx.shadowColor='#000'; ctx.shadowBlur=5; }
        ctx.fillText(displayLabel,cx2,cy2); ctx.restore();
      }
    }
    if (camScale > 0.08) {
      const south=corners[0];
      const fs2=Math.max(9,Math.min(12,CELL*camScale*0.24));
      ctx.save(); ctx.font=`${fs2}px 'Inter',sans-serif`;
      ctx.fillStyle='rgba(180,210,255,0.65)'; ctx.textAlign='center'; ctx.textBaseline='top';
      if (useShadow) { ctx.shadowColor='#000'; ctx.shadowBlur=3; }
      ctx.fillText(`${b.gx},${b.gy}`,south.sx,south.sy+2); ctx.restore();
    }
  }

  // ── X overlay for city outside alliance territory ──
  if (b.type === 'city') {
    // Check if all footprint cells are inside alliance territory
    let inTerri = true;
    for (let x = b.gx; x < b.gx + def.size && inTerri; x++)
      for (let y = b.gy; y < b.gy + def.size && inTerri; y++)
        if (!currentTset.has(x * 1200 + y)) inTerri = false;
    // No X in castle maroon zone, Fortress zones, or Sanctuary zones
    const inExempt = (()=>{
      for (let x = b.gx; x < b.gx + def.size; x++)
        for (let y = b.gy; y < b.gy + def.size; y++)
          if (_cityExemptCells.has(x * 1200 + y)) return true;
      return false;
    })();
    if (!inTerri && !inExempt) {
      const span = def.size * CELL * camScale;
      const xSize = span * 0.38;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(corners[0].sx,corners[0].sy);
      for(let i=1;i<corners.length;i++) ctx.lineTo(corners[i].sx,corners[i].sy);
      ctx.closePath(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,40,40,0.92)';
      ctx.lineWidth   = Math.max(1.5, span * 0.055);
      ctx.lineCap     = 'round';
      if (useShadow) { ctx.shadowColor = '#000'; ctx.shadowBlur = 4; }
      ctx.beginPath(); ctx.moveTo(cx2-xSize, cy2-xSize); ctx.lineTo(cx2+xSize, cy2+xSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2+xSize, cy2-xSize); ctx.lineTo(cx2-xSize, cy2+xSize); ctx.stroke();
      ctx.restore();
    }
  }
  if (c) ctx = _ctx;
}

function drawSelectionOutline(c) {
  const _ctx = ctx; if (c) ctx = c;
  const b=buildings.find(x=>x.id===selectedId); if (!b) { if(c) ctx=_ctx; return; }
  const def=BUILDING_DEFS[b.type];
  const corners=buildingCorners(b.gx,b.gy,def.size);
  ctx.save();
  ctx.setLineDash([5,4]);
  drawDiamond(corners,null,'rgba(88,166,255,0.9)',2);
  ctx.setLineDash([]); ctx.restore();
  if (c) ctx = _ctx;
}

// Pure on-demand rendering — no background loop.
// Every interaction that changes state calls scheduleDraw() or draw() directly.
let _animLoopId = null;
let _drawPending = false;

function scheduleDraw() {
  if (_drawPending) return;
  _drawPending = true;
  requestAnimationFrame(() => { _drawPending = false; _drawImmediate(); });
}

function startAnimLoop() { scheduleDraw(); } // no-op loop; just trigger one draw on init
function stopAnimLoop()  { _drawPending = false; }

// Debounced updatePlacedList — DOM rebuild runs at most every 120ms
let _placedListTimer = null;
function scheduleUpdatePlacedList() {
  if (_placedListTimer) return;
  _placedListTimer = setTimeout(() => { _placedListTimer = null; updatePlacedList(); }, 120);
}

// Debounced updateAllianceLegend — fires after BFS results. During a fast
// banner drag the worker returns ~20-30 results per second; without this
// debounce each one rebuilt the legend's innerHTML synchronously (5-10 ms
// on large maps), eating frame budget for no visible benefit.
let _legendTimer = null;
function scheduleUpdateAllianceLegend() {
  if (_legendTimer) return;
  _legendTimer = setTimeout(() => { _legendTimer = null; updateAllianceLegend(); }, 120);
}

// ─────────────────────────────────────
// HIT TEST — grid space, not screen space
// Isometric diamonds visually overlap even when footprints don't,
// so screen-space pointInDiamond picks the wrong building at edges.
// Grid-space is unambiguous: whichever building's footprint contains
// the hover cell is the one the user intended to click.
// ─────────────────────────────────────
function getBuildingAt(sx, sy) {
  // Prefer grid-cell hit when hoverCell is available
  if (hoverCell) {
    const { gx, gy } = hoverCell;
    // Iterate in reverse (top of draw order first)
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i], def = BUILDING_DEFS[b.type];
      if (gx >= b.gx && gx < b.gx + def.size &&
          gy >= b.gy && gy < b.gy + def.size) return b;
    }
  }
  // Fallback: screen-space test (e.g. called before hoverCell updates)
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i], def = BUILDING_DEFS[b.type];
    if (pointInDiamond(sx, sy, buildingCorners(b.gx, b.gy, def.size))) return b;
  }
  return null;
}

// ─────────────────────────────────────
// OVERLAP CHECK (footprints only, not territory)
// ─────────────────────────────────────
function footprintsOverlap(ax, ay, asize, bx, by, bsize) {
  // Two axis-aligned diamond footprints overlap if their grid rectangles intersect
  return ax < bx+bsize && ax+asize > bx && ay < by+bsize && ay+asize > by;
}

// Spatial hash for fast overlap queries during drag/place
const _BUCKET_SIZE = 16;
const _BUCKET_COLS = Math.ceil(GRID_SIZE / _BUCKET_SIZE);
let _spatialHash = null; // Map<bucketKey, Set<buildingId>>
let _spatialDirty = true;

function _bucketKey(bx, by) { return by * _BUCKET_COLS + bx; }

function _rebuildSpatialHash() {
  _spatialHash = new Map();
  for (const b of buildings) {
    const def = BUILDING_DEFS[b.type];
    const bx0 = (b.gx / _BUCKET_SIZE) | 0;
    const by0 = (b.gy / _BUCKET_SIZE) | 0;
    const bx1 = ((b.gx + def.size - 1) / _BUCKET_SIZE) | 0;
    const by1 = ((b.gy + def.size - 1) / _BUCKET_SIZE) | 0;
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        const key = _bucketKey(bx, by);
        let set = _spatialHash.get(key);
        if (!set) { set = new Set(); _spatialHash.set(key, set); }
        set.add(b);
      }
    }
  }
  _spatialDirty = false;
}

function _ensureSpatialHash() {
  if (_spatialDirty || !_spatialHash) _rebuildSpatialHash();
}

function invalidateSpatialHash() { _spatialDirty = true; }

function wouldOverlap(gx, gy, size, excludeId) {
  _ensureSpatialHash();
  const bx0 = (gx / _BUCKET_SIZE) | 0;
  const by0 = (gy / _BUCKET_SIZE) | 0;
  const bx1 = ((gx + size - 1) / _BUCKET_SIZE) | 0;
  const by1 = ((gy + size - 1) / _BUCKET_SIZE) | 0;
  const checked = new Set();
  for (let bx = bx0; bx <= bx1; bx++) {
    for (let by = by0; by <= by1; by++) {
      const set = _spatialHash.get(_bucketKey(bx, by));
      if (!set) continue;
      for (const b of set) {
        if (b.id === excludeId || checked.has(b.id)) continue;
        checked.add(b.id);
        if (_allowBuildOverTerrain && b._canonical) continue;
        const def = BUILDING_DEFS[b.type];
        if (footprintsOverlap(gx, gy, size, b.gx, b.gy, def.size)) return true;
      }
    }
  }
  return false;
}
function getCursor() {
  return tool==='select'?'pointer':'crosshair';
}

// ─────────────────────────────────────
// PLACE / ERASE
// ─────────────────────────────────────
function placeBuilding(gx,gy) {
  const isRes = (selectedType === 'resource');
  const actualType = isRes ? (_el('resourceSubtype')||{}).value : selectedType;
  const def=BUILDING_DEFS[actualType];
  if (!def) return;
  if (wouldOverlap(gx, gy, def.size, null)) return;
  if (inForbiddenZone(gx, gy, def.size, actualType)) return;
  const label = isRes ? (RES_SUBTYPE_LABELS[actualType] || def.label) : ((_el('buildingLabel')||{}).value||def.label);
  // Banners cannot be placed inside another alliance's territory
  if (actualType === 'banner' && inEnemyTerritory(gx, gy, def.size, label)) return;
  // Alliance limit checks (only for non-empty labels on banner/HQ)
  let _overLimit = false;
  const trimmedLabel = (label||'').trim();
  if (trimmedLabel && !_isGenericLabel(trimmedLabel) && (actualType === 'banner' || actualType === 'hq')) {
    const sameLabel = buildings.filter(b => !b._canonical && b.type === actualType && (b.label||'').trim() === trimmedLabel && !_isGenericLabel((b.label||'').trim()));
    if (actualType === 'banner' && sameLabel.length >= 285) {
      if (!_suppressPlacementWarnings && !confirm(`연맹 "${trimmedLabel}"에 이미 깃발이 285개 있습니다. 그래도 배치하시겠습니까?\n\n(팁: 배치 탭에서 경고 표시 안 함을 체크하면 이 메시지가 나오지 않습니다)`)) return;
      _overLimit = true;
    }
    if (actualType === 'hq') {
      if (sameLabel.length >= 2) {
        if (!_suppressPlacementWarnings && !confirm(`연맹 "${trimmedLabel}"에 이미 본부가 2개 있습니다. 그래도 배치하시겠습니까?\n\n(팁: 배치 탭에서 경고 표시 안 함을 체크하면 이 메시지가 나오지 않습니다)`)) return;
        _overLimit = true;
      } else {
        // Per-zone HQ check (only badlands/plains valid)
        const newZone = _zoneAt(gx + Math.floor(def.size/2), gy + Math.floor(def.size/2));
        for (const existing of sameLabel) {
          const eDef = BUILDING_DEFS[existing.type];
          const existingZone = _zoneAt(existing.gx + Math.floor(eDef.size/2), existing.gy + Math.floor(eDef.size/2));
          if (newZone === existingZone) {
            if (!_suppressPlacementWarnings && !confirm(`연맹 "${trimmedLabel}"은(는) 이미 ${koName(newZone)}에 본부가 있습니다. 그래도 배치하시겠습니까?\n\n(팁: 배치 탭에서 경고 표시 안 함을 체크하면 이 메시지가 나오지 않습니다)`)) return;
            _overLimit = true;
            break;
          }
        }
      }
    }
  }
  // Banner connectivity check (non-generic labels only)
  let _orphan = false;
  if (actualType === 'banner' && trimmedLabel && !_isGenericLabel(trimmedLabel)) {
    const allySame = buildings.filter(b => !b._canonical && (b.label||'').trim() === trimmedLabel);
    const hasHQ = allySame.some(b => b.type === 'hq');
    if (!hasHQ) {
      if (!_suppressPlacementWarnings) alert(`연맹 "${trimmedLabel}"에 본부가 없습니다. 깃발을 배치하기 전에 먼저 본부를 배치하세요.`);
      return;
    }
    // Check 8-adjacency to existing valid alliance territory
    const bdef = BUILDING_DEFS.banner;
    const bt = bdef.territory;
    const btx = Math.round(gx + bdef.size/2 - bt/2);
    const bty = Math.round(gy + bdef.size/2 - bt/2);
    // Build set of cells currently owned by THIS alliance, valid only
    const allyValidCells = new Set();
    for (const b of allySame) {
      if (b._orphan) continue;
      const d = BUILDING_DEFS[b.type]; const t = d.territory;
      const tx = Math.round(b.gx + d.size/2 - t/2);
      const ty = Math.round(b.gy + d.size/2 - t/2);
      for (let x = tx; x < tx + t; x++)
        for (let y = ty; y < ty + t; y++) {
          if (x<0||y<0||x>=GRID_SIZE||y>=GRID_SIZE) continue;
          allyValidCells.add(x * 1200 + y);
        }
    }
    // Test 8-adjacency: expand new banner rect by 1 cell on each side
    let connected = false;
    outer: for (let x = btx - 1; x < btx + bt + 1; x++)
      for (let y = bty - 1; y < bty + bt + 1; y++) {
        if (x<0||y<0||x>=GRID_SIZE||y>=GRID_SIZE) continue;
        if (allyValidCells.has(x * 1200 + y)) { connected = true; break outer; }
      }
    if (!connected) {
      if (!_suppressPlacementWarnings && !confirm(`이 깃발은 연맹 "${trimmedLabel}"의 어떤 본부와도 연결되어 있지 않습니다. 무효 깃발로 배치하시겠습니까?`)) return;
      _orphan = true;
    }
  }
  pushHistory();
  const newB = {
    id:_genId(), type:actualType, gx, gy,
    label,
    color:(_el('buildingColor')||{}).value,
    seq: ++placementSeq,
  };
  if (_overLimit) newB._overLimit = true;
  if (_orphan) newB._orphan = true;
  buildings.push(newB);
  if (def.territory) invalidateTset(); else invalidateBuildings();
  saveToStorage();
  updatePlacedList(); draw();
}

// Determine which zone a single grid cell falls into.
// Returns: 'Forbidden' | 'Ruins' | 'Fertile' | 'Plains' | 'Badlands'
function _zoneAt(gx, gy) {
  const z = ZONES;
  if (gx >= z.forbidden.x1 && gx <= z.forbidden.x2 && gy >= z.forbidden.y1 && gy <= z.forbidden.y2) return 'Forbidden';
  if (gx >= z.ruins.x1     && gx <= z.ruins.x2     && gy >= z.ruins.y1     && gy <= z.ruins.y2)     return 'Ruins';
  if (gx >= z.fertile.x1   && gx <= z.fertile.x2   && gy >= z.fertile.y1   && gy <= z.fertile.y2)   return 'Fertile';
  if (gx >= z.plains.x1    && gx <= z.plains.x2    && gy >= z.plains.y1    && gy <= z.plains.y2)    return 'Plains';
  return 'Badlands';
}

function eraseAt(gx,gy) {
  const before = buildings.length;
  const next = buildings.filter(b=>{
    if (b._canonical) return true; // cannot erase canonical
    const def=BUILDING_DEFS[b.type];
    return !(gx>=b.gx&&gx<b.gx+def.size&&gy>=b.gy&&gy<b.gy+def.size);
  });
  if (next.length === before) return; // nothing erased
  pushHistory();
  buildings = next;
  invalidateTset();
  if (selectedId&&!buildings.find(b=>b.id===selectedId)) deselectBuilding();
  saveToStorage();
  updatePlacedList(); draw();
}

function removeBuilding(id) {
  const b = buildings.find(x=>x.id===id);
  if (!b || b._canonical) return; // cannot remove canonical
  pushHistory();
  if (BUILDING_DEFS[b.type].territory) invalidateTset(); else invalidateBuildings();
  buildings=buildings.filter(b=>b.id!==id);
  if (selectedId===id) deselectBuilding();
  saveToStorage();
  updatePlacedList(); draw();
}

// ─────────────────────────────────────
// SELECT / EDIT
// ─────────────────────────────────────
// Safe DOM helpers (elements may not exist in all HTML files)
function _el(id) { return document.getElementById(id); }
function _elShow(id, show) { var e=_el(id); if(e) e.style.display = show===false ? 'none' : (show===true ? '' : show); }
function _elText(id, t) { var e=_el(id); if(e) e.textContent = t; }

function selectBuilding(id) {
  selectedId=id;
  const b=buildings.find(x=>x.id===id);
  if (b && b._canonical) {
    _elShow('editPanelUser', false);
    _elShow('editPanelCanonical', true);
    _elText('editSectionTitle', '검증된 자원지');
    const def = BUILDING_DEFS[b.type] || BUILDING_DEFS.resource;
    _elText('canonicalTitle', `${koName(b.label)} @ ${b.gx},${b.gy}`);
    _elText('canonicalCoordInfo', `종류: ${koName(RES_SUBTYPE_LABELS[b.type] || def.label)} · 크기: ${def.size}×${def.size}`);
  } else {
    _elShow('editPanelUser', true);
    _elShow('editPanelCanonical', false);
    _elText('editSectionTitle', '선택 항목 편집');
    syncEditPanel(b);
  }
  _elShow('editSection', 'flex');
  invalidateBuildings();
  updatePlacedList(); draw();
}

function deselectBuilding() {
  selectedId=null;
  _elShow('editSection', false);
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame=null; }
  invalidateBuildings();
  updatePlacedList(); draw();
}

// ── Copy / Paste (Ctrl+C / Ctrl+V) ──
// Copies the selected building's type, label, and color. Ctrl+V switches to
// place mode with those properties pre-filled, ready to click on the map.
let _clipboard = null; // { type, label, color }
let _suppressPlacementWarnings = false; // "Don't show warnings" checkbox; resets on localStorage clear

// ── Rectangle erase (right-click drag in erase mode) ──
// State: null = idle, {gx,gy} = first corner placed, waiting for second
let _eraseRectStart = null;  // first corner {gx, gy}
let _eraseRectEnd = null;    // current hover corner for preview (tracks mouse)

function startEraseRect(gx, gy) {
  _eraseRectStart = { gx, gy };
  _eraseRectEnd = { gx, gy };
  draw();
}

function updateEraseRect(gx, gy) {
  if (!_eraseRectStart) return;
  _eraseRectEnd = { gx, gy };
  draw();
}

function commitEraseRect(gx, gy) {
  if (!_eraseRectStart) return;
  _eraseRectEnd = { gx, gy };
  const x1 = Math.min(_eraseRectStart.gx, _eraseRectEnd.gx);
  const y1 = Math.min(_eraseRectStart.gy, _eraseRectEnd.gy);
  const x2 = Math.max(_eraseRectStart.gx, _eraseRectEnd.gx);
  const y2 = Math.max(_eraseRectStart.gy, _eraseRectEnd.gy);
  
  // Find all user-placed (non-canonical) buildings that overlap the rectangle
  const toDelete = buildings.filter(b => {
    if (b._canonical) return false;
    const def = BUILDING_DEFS[b.type]; if (!def) return false;
    // Building occupies gx..gx+size-1, gy..gy+size-1
    return b.gx + def.size > x1 && b.gx <= x2 && b.gy + def.size > y1 && b.gy <= y2;
  });
  
  cancelEraseRect();
  
  if (!toDelete.length) return;
  
  if (!_suppressPlacementWarnings) {
    if (!confirm(`영역 (${x1},${y1}) ~ (${x2},${y2})의 건물 ${toDelete.length}개를 삭제하시겠습니까?`)) return;
  }
  
  // Single history entry for the whole batch
  pushHistory();
  const deleteIds = new Set(toDelete.map(b => b.id));
  buildings = buildings.filter(b => !deleteIds.has(b.id));
  invalidateTset(); invalidateBuildings();
  saveToStorage(); updatePlacedList(); draw();
}

function cancelEraseRect() {
  _eraseRectStart = null;
  _eraseRectEnd = null;
  draw();
}

// ── Multi-select (left-click drag in select mode) ──
// Phase 1: drag to create selection rect → _multiSelected populated
// Phase 2: click+drag to move selected group → _multiMoving
let _multiSelectStart = null;  // {gx, gy} during drag-select
let _multiSelectEnd = null;    // current mouse pos during drag
let _multiSelected = [];       // array of building objects in selection
let _multiMoving = false;      // true when dragging the selected group
let _multiMoveAnchor = null;   // {gx, gy} where the move-drag started
let _multiMoveOffset = null;   // {dx, dy} accumulated offset

function startMultiSelect(gx, gy) {
  clearMultiSelect();
  _multiSelectStart = { gx, gy };
  _multiSelectEnd = { gx, gy };
}

function updateMultiSelect(gx, gy) {
  if (!_multiSelectStart) return;
  _multiSelectEnd = { gx, gy };
  draw();
}

function commitMultiSelect() {
  if (!_multiSelectStart || !_multiSelectEnd) return;
  const x1 = Math.min(_multiSelectStart.gx, _multiSelectEnd.gx);
  const y1 = Math.min(_multiSelectStart.gy, _multiSelectEnd.gy);
  const x2 = Math.max(_multiSelectStart.gx, _multiSelectEnd.gx);
  const y2 = Math.max(_multiSelectStart.gy, _multiSelectEnd.gy);
  _multiSelectStart = null;
  _multiSelectEnd = null;

  // Select all non-canonical user buildings in the rectangle
  _multiSelected = buildings.filter(b => {
    if (b._canonical) return false;
    const def = BUILDING_DEFS[b.type]; if (!def) return false;
    return b.gx + def.size > x1 && b.gx <= x2 && b.gy + def.size > y1 && b.gy <= y2;
  });

  if (!_multiSelected.length) {
    clearMultiSelect();
    return;
  }
  draw();
}

function startMultiMove(gx, gy) {
  if (!_multiSelected.length) return;
  _multiMoving = true;
  _multiMoveAnchor = { gx, gy };
  _multiMoveOffset = { dx: 0, dy: 0 };
  pushHistory();
}

function updateMultiMove(gx, gy) {
  if (!_multiMoving || !_multiMoveAnchor) return;
  _multiMoveOffset = { dx: gx - _multiMoveAnchor.gx, dy: gy - _multiMoveAnchor.gy };
  draw();
}

function commitMultiMove() {
  if (!_multiMoving || !_multiMoveOffset) { _multiMoving = false; return; }
  _multiMoving = false;
  const dx = _multiMoveOffset.dx;
  const dy = _multiMoveOffset.dy;
  _multiMoveOffset = null;
  _multiMoveAnchor = null;

  if (dx === 0 && dy === 0) { draw(); return; }

  const selectedIds = new Set(_multiSelected.map(b => b.id));
  // For each selected building, check if its new position is valid
  const survived = [];  // {b, newGx, newGy} — buildings that land cleanly
  const doomed = [];    // buildings from the selection that must be deleted (overlap/restricted)

  for (const b of _multiSelected) {
    const def = BUILDING_DEFS[b.type]; if (!def) continue;
    const newGx = b.gx + dx;
    const newGy = b.gy + dy;

    // Check bounds
    if (newGx < 0 || newGy < 0 || newGx + def.size > GRID_SIZE || newGy + def.size > GRID_SIZE) {
      doomed.push(b);
      continue;
    }

    // Check forbidden zone, terrain, permanent buildings
    let onRestricted = false;
    for (let x = newGx; x < newGx + def.size && !onRestricted; x++)
      for (let y = newGy; y < newGy + def.size && !onRestricted; y++) {
        const ci = x * 1200 + y;
        if (_permForbidCells.has(ci)) onRestricted = true;
        if (!_allowBuildOverTerrain && _lakeCells.has(ci)) onRestricted = true;
        if (!_allowBuildOverTerrain && _mtCells.has(ci)) onRestricted = true;
      }
    if (!onRestricted && inForbiddenZone(newGx, newGy, def.size, b.type)) onRestricted = true;

    if (onRestricted) {
      doomed.push(b);
      continue;
    }

    // Check overlap with ALL non-selected buildings (including canonical + user-placed resources)
    // The non-moving building takes precedence — the moving one gets deleted
    let hasOverlap = false;
    for (const other of buildings) {
      if (selectedIds.has(other.id)) continue; // skip other selected (they move too)
      if (_allowBuildOverTerrain && other._canonical) continue;
      const oDef = BUILDING_DEFS[other.type]; if (!oDef) continue;
      if (newGx < other.gx + oDef.size && newGx + def.size > other.gx &&
          newGy < other.gy + oDef.size && newGy + def.size > other.gy) {
        hasOverlap = true;
        break;
      }
    }

    if (hasOverlap) {
      doomed.push(b);
      continue;
    }

    survived.push({ b, newGx, newGy });
  }

  // Confirm if any buildings will be lost
  if (doomed.length) {
    let msg = `건물 ${survived.length}개를 (${dx}, ${dy})만큼 이동합니다.`;
    msg += `\n선택한 건물 중 ${doomed.length}개는 삭제됩니다 (기존 건물 또는 배치 제한 구역과 겹침).`;
    if (!_suppressPlacementWarnings && !confirm(msg)) {
      undo();
      clearMultiSelect();
      return;
    }
  }

  // Apply: move survivors, delete doomed
  for (const { b, newGx, newGy } of survived) {
    b.gx = newGx;
    b.gy = newGy;
  }

  if (doomed.length) {
    const doomedIds = new Set(doomed.map(b => b.id));
    buildings = buildings.filter(b => !doomedIds.has(b.id));
  }

  invalidateTset(); invalidateBuildings();
  saveToStorage(); updatePlacedList();
  clearMultiSelect();
  draw();
}

function clearMultiSelect() {
  _multiSelectStart = null;
  _multiSelectEnd = null;
  _multiSelected = [];
  _multiMoving = false;
  _multiMoveAnchor = null;
  _multiMoveOffset = null;
}

function drawMultiSelectOverlay() {
  if (!ctx || !canvas) return;
  const d = CELL / 2 * camScale;
  const baseX = canvas.width / 2 + camX * camScale;
  const baseY = canvas.height / 2 + camY * camScale + 1199 * d;
  function _pt(gx, gy) { return { sx: baseX + (gx - gy) * d, sy: baseY - (gx + gy) * d }; }

  // Draw selection rectangle during drag-select phase
  if (_multiSelectStart && _multiSelectEnd) {
    const x1 = Math.min(_multiSelectStart.gx, _multiSelectEnd.gx);
    const y1 = Math.min(_multiSelectStart.gy, _multiSelectEnd.gy);
    const x2 = Math.max(_multiSelectStart.gx, _multiSelectEnd.gx) + 1;
    const y2 = Math.max(_multiSelectStart.gy, _multiSelectEnd.gy) + 1;
    const c1 = _pt(x1, y1), c2 = _pt(x2, y1), c3 = _pt(x2, y2), c4 = _pt(x1, y2);
    ctx.save();
    ctx.fillStyle = 'rgba(74, 158, 221, 0.15)';
    ctx.beginPath();
    ctx.moveTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy);
    ctx.lineTo(c3.sx, c3.sy); ctx.lineTo(c4.sx, c4.sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 158, 221, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // Highlight selected buildings and show move preview
  if (_multiSelected.length && !_multiSelectStart) {
    const dx = _multiMoving && _multiMoveOffset ? _multiMoveOffset.dx : 0;
    const dy = _multiMoving && _multiMoveOffset ? _multiMoveOffset.dy : 0;
    const selectedIds = new Set(_multiSelected.map(b => b.id));

    // Compute which buildings would be doomed at current offset (for live preview)
    const doomedIds = new Set();
    if (_multiMoving && (dx !== 0 || dy !== 0)) {
      for (const b of _multiSelected) {
        const def = BUILDING_DEFS[b.type]; if (!def) continue;
        const ngx = b.gx + dx, ngy = b.gy + dy;
        let isDoom = false;
        // Bounds
        if (ngx < 0 || ngy < 0 || ngx + def.size > GRID_SIZE || ngy + def.size > GRID_SIZE) isDoom = true;
        // Restricted cells
        if (!isDoom) {
          for (let x = ngx; x < ngx + def.size && !isDoom; x++)
            for (let y = ngy; y < ngy + def.size && !isDoom; y++) {
              const ci = x * 1200 + y;
              if (_permForbidCells.has(ci) || (!_allowBuildOverTerrain && (_lakeCells.has(ci) || _mtCells.has(ci)))) isDoom = true;
            }
        }
        if (!isDoom && inForbiddenZone(ngx, ngy, def.size, b.type)) isDoom = true;
        // Overlap with non-selected buildings
        if (!isDoom) {
          for (const other of buildings) {
            if (selectedIds.has(other.id)) continue;
            if (_allowBuildOverTerrain && other._canonical) continue;
            const oDef = BUILDING_DEFS[other.type]; if (!oDef) continue;
            if (ngx < other.gx + oDef.size && ngx + def.size > other.gx &&
                ngy < other.gy + oDef.size && ngy + def.size > other.gy) {
              isDoom = true; break;
            }
          }
        }
        if (isDoom) doomedIds.add(b.id);
      }
    }

    // Draw outlines on each selected building
    ctx.save();
    for (const b of _multiSelected) {
      const def = BUILDING_DEFS[b.type]; if (!def) continue;
      const gx = b.gx + dx, gy = b.gy + dy;
      const sz = def.size;
      const c1 = _pt(gx, gy), c2 = _pt(gx+sz, gy), c3 = _pt(gx+sz, gy+sz), c4 = _pt(gx, gy+sz);

      const isDoomed = doomedIds.has(b.id);

      // Ghost fill
      ctx.globalAlpha = isDoomed ? 0.3 : 0.5;
      ctx.beginPath();
      ctx.moveTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy);
      ctx.lineTo(c3.sx, c3.sy); ctx.lineTo(c4.sx, c4.sy);
      ctx.closePath();
      ctx.fillStyle = isDoomed ? 'rgba(220,60,60,0.4)' : (b.color || defaultColorOf(b.type));
      ctx.fill();

      // Outline
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isDoomed ? 'rgba(220,60,60,0.95)' : 'rgba(74,158,221,0.95)';
      ctx.lineWidth = Math.max(1.5, 2 * Math.min(camScale, 2));
      ctx.setLineDash(isDoomed ? [3, 3] : [4, 3]);
      ctx.stroke();

      // Red X over doomed buildings
      if (isDoomed) {
        ctx.strokeStyle = 'rgba(220,60,60,0.9)';
        ctx.lineWidth = Math.max(2, 3 * Math.min(camScale, 2));
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(c1.sx, c1.sy); ctx.lineTo(c3.sx, c3.sy);
        ctx.moveTo(c2.sx, c2.sy); ctx.lineTo(c4.sx, c4.sy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawEraseRectOverlay() {
  if (!_eraseRectStart || !_eraseRectEnd || !ctx || !canvas) return;
  const x1 = Math.min(_eraseRectStart.gx, _eraseRectEnd.gx);
  const y1 = Math.min(_eraseRectStart.gy, _eraseRectEnd.gy);
  const x2 = Math.max(_eraseRectStart.gx, _eraseRectEnd.gx) + 1;
  const y2 = Math.max(_eraseRectStart.gy, _eraseRectEnd.gy) + 1;
  
  const d = CELL / 2 * camScale;
  const baseX = canvas.width / 2 + camX * camScale;
  const baseY = canvas.height / 2 + camY * camScale + 1199 * d;
  
  function _pt(gx, gy) { return { sx: baseX + (gx - gy) * d, sy: baseY - (gx + gy) * d }; }
  const c1 = _pt(x1, y1);
  const c2 = _pt(x2, y1);
  const c3 = _pt(x2, y2);
  const c4 = _pt(x1, y2);
  
  ctx.save();
  ctx.fillStyle = 'rgba(220, 60, 60, 0.15)';
  ctx.beginPath();
  ctx.moveTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy);
  ctx.lineTo(c3.sx, c3.sy); ctx.lineTo(c4.sx, c4.sy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(220, 60, 60, 0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
}

function copyBuilding() {
  if (!selectedId || tool !== 'select') return;
  const b = buildings.find(x => x.id === selectedId);
  if (!b || b._canonical) return; // can't copy canonical nodes
  _clipboard = { type: b.type, label: b.label, color: b.color };
}

function pasteBuilding() {
  if (!_clipboard) return;
  // Switch to place mode with the copied building's properties
  setTool('place');
  // Set building type selector
  const isRes = RESOURCE_SUBTYPES.includes(_clipboard.type);
  if (isRes) {
    selectType('resource');
    const subSel = _el('resourceSubtype');
    if (subSel) subSel.value = _clipboard.type;
  } else {
    selectType(_clipboard.type);
  }
  // Set label
  const labelInput = _el('buildingLabel');
  if (labelInput) labelInput.value = _clipboard.label || '';
  // Set color
  const colorInput = _el('buildingColor');
  if (colorInput) colorInput.value = _clipboard.color || defaultColorOf(_clipboard.type);
}

function syncEditPanel(b) {
  if (!b) return;
  const def=BUILDING_DEFS[b.type];
  if (!def) return;
  _el('editTitle').textContent=`${koName(def.label)} @ ${b.gx},${b.gy}`;
  const isResType = RESOURCE_SUBTYPES.includes(b.type) || b.type === 'resource';
  { var _e=_el('editLabel'); if(_e) _e.style.display=isResType ? 'none' : ''; }
  const resLabelEl = _el('editResLabel');
  if (resLabelEl) resLabelEl.style.display = isResType ? '' : 'none';
  // Hide color picker for resource types
  const editColorEl = _el('editColor');
  // Hide color picker for resource types
  _elShow('editColorRow', !isResType);
  if (isResType && resLabelEl) {
    resLabelEl.value = RES_SUBTYPE_LABELS[b.type] || b.label;
  } else {
    { var _e=_el('editLabel'); if(_e) _e.value=b.label; }
  }
  if (editColorEl) editColorEl.value=b.color||defaultColorOf(b.type);
  { var _e=_el('editType'); if(_e) _e.value=b.type; }
  _elText('editCoordInfo', `크기: ${def.size}×${def.size}`+(def.territory?` · 영토: ${def.territory}×${def.territory}`:''))
}

function applyEdit() {
  const b=buildings.find(x=>x.id===selectedId); if (!b || b._canonical) return;
  pushHistory();
  const isResType = RESOURCE_SUBTYPES.includes(b.type) || b.type === 'resource';
  if (isResType) {
    const selLabel = (_el('editResLabel')||{}).value;
    b.label = selLabel;
    const typeMap = Object.fromEntries(Object.entries(RES_SUBTYPE_LABELS).map(([k,v]) => [v,k]));
    if (typeMap[selLabel]) {
      b.type = typeMap[selLabel];
      b.color = defaultColorOf(b.type);
    }
  } else {
    b.label=(_el('editLabel')||{}).value;
    b.color=(_el('editColor')||{}).value;
  }
  syncEditPanel(b);
  invalidateBuildings();
  saveToStorage();
  scheduleUpdatePlacedList();
}

function applyEditColor() {
  const b=buildings.find(x=>x.id===selectedId); if (!b) return;
  b.color=(_el('editColor')||{}).value;
  invalidateBuildings();
}

function applyEditType() {
  const b=buildings.find(x=>x.id===selectedId); if (!b) return;
  pushHistory();
  b.type=(_el('editType')||{}).value;
  invalidateTset();
  syncEditPanel(b);
  saveToStorage();
  updatePlacedList();
}

function deleteSelected() { if (selectedId) removeBuilding(selectedId); }

// ─────────────────────────────────────
// INLINE RENAME POPUP
// ─────────────────────────────────────
let _renameCleanup = null;

function openRenamePopup(b, sx, sy) {
  // Clean up any previous popup listeners first
  if (_renameCleanup) { _renameCleanup(); _renameCleanup = null; }
  const popup = _el('renamePopup');
  const input = _el('renameInput');
  input.value = b.label;

  // Position near the click, keep inside canvas-wrap
  const wrapRect = wrap.getBoundingClientRect();
  let left = sx + 8, top = sy + 8;
  // Clamp so it doesn't overflow right/bottom
  if (left + 210 > wrapRect.width)  left = sx - 218;
  if (top  + 90  > wrapRect.height) top  = sy - 94;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
  popup.classList.add('open');

  input.focus();
  input.select();

  // Commit on Enter, cancel on Escape
  function onKey(ev) {
    if (ev.key === 'Enter') {
      const b2 = buildings.find(x=>x.id===selectedId);
      if (b2) { pushHistory(); b2.label = input.value; syncEditPanel(b2); invalidateBuildings(); saveToStorage(); updatePlacedList(); draw(); }
      closeRenamePopup();
    }
    if (ev.key === 'Escape') { closeRenamePopup(); }
    ev.stopPropagation();
  }
  // Close if clicking outside the popup
  function onOutside(ev) {
    if (!popup.contains(ev.target)) { closeRenamePopup(); }
  }
  function cleanup() {
    input.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onOutside, true);
    _renameCleanup = null;
  }
  _renameCleanup = cleanup;
  input.addEventListener('keydown', onKey);
  // Slight delay so the current dblclick mousedown doesn't immediately close it
  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 100);
}

function closeRenamePopup() {
  if (_renameCleanup) { _renameCleanup(); }
  _el('renamePopup')?.classList.remove('open');
}

// ─────────────────────────────────────
// UI
// ─────────────────────────────────────
function setTool(t) {
  tool=t;
  if (t!=='select') { deselectBuilding(); clearMultiSelect(); }
  if (t!=='erase') cancelEraseRect(); // cancel any pending rectangle erase
  _el('btnPlace') .className='tb-btn'+(t==='place' ?' active-place' :'');
  _el('btnSelect').className='tb-btn'+(t==='select'?' active-select':'');
  _el('btnErase') .className='tb-btn'+(t==='erase' ?' active-erase' :'');
  _el('typeSection').style.display  = t==='place'?'flex':'none';
  _el('labelSection').style.display = t==='place'?'flex':'none';
  // editSection visibility is controlled only by selectBuilding/deselectBuilding — NOT here
  const hints={
    place: '[D] 건물 배치  |  좌클릭: 배치  |  드래그: 지도 이동  |  스크롤: 확대/축소',
    select:'[S] 선택  |  클릭: 선택  |  건물 드래그: 옮기기  |  빈 곳 드래그: 지도 이동  |  Shift+드래그: 다중 선택  |  우클릭: 지우기',
    erase: '[E] 지우기  |  좌클릭: 하나 지우기  |  드래그: 지도 이동  |  우클릭: 사각형 영역 지우기',
  };
  _el('hintText').textContent=hints[t];
  canvas.style.cursor=getCursor();
  // Tab sync — don't disturb Map tab
  const activePanel=[...document.querySelectorAll('.sidebar-panel')].find(p=>p.classList.contains('active'));
  if (activePanel?.id !== 'panel-map') {
    const targetId  = t==='place' ? 'panel-place' : 'panel-placed';
    const targetIdx = t==='place' ? 0 : 1;
    document.querySelectorAll('.sidebar-panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active'));
    _el(targetId)?.classList.add('active');
    document.querySelectorAll('.stab')[targetIdx]?.classList.add('active');
  }
}

function selectType(type) {
  selectedType=type;
  document.querySelectorAll('.building-btn').forEach(b=>b.classList.remove('active'));
  _el('bt_'+type)?.classList.add('active');
  const isRes = (type === 'resource');
  { var _e=_el('buildingLabel'); if(_e) _e.style.display=isRes ? 'none' : ''; }
  { var _e=_el('resourceSubtype'); if(_e) _e.style.display=isRes ? '' : 'none'; }
  // Hide color picker for resource nodes — color is fixed by type
  _elShow('colorRow', !isRes);
  if (isRes) {
    const sub = (_el('resourceSubtype')||{}).value;
    { var _e=_el('buildingColor'); if(_e) _e.value=defaultColorOf(sub); }
  } else {
    { var _e=_el('buildingColor'); if(_e) _e.value=defaultColorOf(type); }
  }
}

function _initResourceSubtypeListener() {
  const el = _el('resourceSubtype');
  if (el) el.addEventListener('change', function() {
    if (selectedType === 'resource') {
      { var _e=_el('buildingColor'); if(_e) _e.value=defaultColorOf(this.value); }
    }
  });
}

function updateAllianceLegend() {
  window.__perf && window.__perf.mark('legend');
  try {
    const seen = new Map(); // label → { minSeq, hq, banners, cities }
    for (const b of buildings) {
      if (!BUILDING_DEFS[b.type].territory) continue;
      const s = b.seq || 0;
      if (!seen.has(b.label)) seen.set(b.label, { minSeq: s, hq: 0, banners: 0, cities: 0 });
      const entry = seen.get(b.label);
      if (s < entry.minSeq) entry.minSeq = s;
      if (b.type === 'hq')     entry.hq++;
      if (b.type === 'banner') entry.banners++;
    }

    // City attribution by territory ownership (≥3 of 4 cells owned) — same
    // rule as the Alliance Territory Summary. Only increments alliances that
    // already have an HQ/banner entry (cities aren't standalone alliances).
    if (currentOwnerMap && currentOwnerMap.size > 0) {
      const citySz = BUILDING_DEFS.city.size;
      for (const b of buildings) {
        if (b._canonical || b.type !== 'city') continue;
        const cellOwners = {};
        for (let x = b.gx; x < b.gx + citySz; x++) {
          for (let y = b.gy; y < b.gy + citySz; y++) {
            const owner = currentOwnerMap.get(x * 1200 + y);
            if (owner && !_isGenericLabel(owner)) {
              cellOwners[owner] = (cellOwners[owner] || 0) + 1;
            }
          }
        }
        for (const [lbl, count] of Object.entries(cellOwners)) {
          if (count >= 3 && seen.has(lbl)) {
            seen.get(lbl).cities++;
            break;
          }
        }
      }
    }

    const section = _el('allianceSection');
    const legend  = _el('allianceLegend');
    if (seen.size === 0) { section.style.display='none'; return; }
    section.style.display = 'flex';
    const sorted = [...seen.entries()].sort((a,b) => a[1].minSeq - b[1].minSeq);
    legend.innerHTML = sorted.map(([label, info]) => { label = _escHtml(label);
      const { swatch } = allianceColors(label);
      const parts = [];
      if (info.hq)      parts.push(`본부 ${info.hq}`);
      if (info.banners) parts.push(`깃발 ${info.banners}`);
      if (info.cities)  parts.push(`도시 ${info.cities}`);
      return `<div class="zone-legend-item" style="justify-content:space-between;width:100%">
        <div style="display:flex;align-items:center;gap:7px">
          <div class="zone-legend-dot" style="background:${swatch};border-color:${swatch}"></div>
          <span style="color:var(--text);font-weight:500">${koName(label)}</span>
        </div>
        <span style="font-size:0.68rem;color:var(--text-dim);white-space:nowrap">${parts.join(' · ')}</span>
      </div>`;
    }).join('');
  } finally {
    window.__perf && window.__perf.measure('legend');
  }
}

let _placedListHash = 0;  // Numeric content hash; 0 forces first rebuild
let _placedListSelId = null;  // Track which item has selected-item class

// djb2-style numeric hash over the fields that affect the placed-list DOM.
// Replaces a previous string-builder approach (buildings.map().join('\n'))
// that allocated a ~500 KB string on each call and showed up as a hot path
// during fast input loops on large maps. Pure integer ops, no allocations.
//
// Canonical buildings (server-managed resource nodes, fortress, etc.) are
// skipped — the sidebar only renders user buildings, so canonical mutations
// (e.g. an admin moving a resource node) shouldn't trigger a list rebuild.
function _hashPlacedListState() {
  let h = 5381 | 0;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (b._canonical) continue;
    const id = b.id || '';
    for (let j = 0; j < id.length; j++) h = ((h * 33) ^ id.charCodeAt(j)) | 0;
    const lbl = b.label || '';
    for (let j = 0; j < lbl.length; j++) h = ((h * 33) ^ lbl.charCodeAt(j)) | 0;
    h = ((h * 33) ^ b.gx) | 0;
    h = ((h * 33) ^ b.gy) | 0;
    const col = b.color || '';
    for (let j = 0; j < col.length; j++) h = ((h * 33) ^ col.charCodeAt(j)) | 0;
  }
  return h;
}

function updatePlacedList() {
  window.__perf && window.__perf.mark('placedList');
  try {
  const list=_el('placedList');
  const userBuildings = buildings.filter(b => !b._canonical);
  _el('placedCount').textContent=userBuildings.length;

  const hash = _hashPlacedListState();
  const selChanged = selectedId !== _placedListSelId;

  if (hash === _placedListHash && !selChanged) return; // Nothing changed

  // If only selection changed (same buildings), just toggle CSS classes
  if (hash === _placedListHash && selChanged) {
    const items = list.children;
    for (let i = 0; i < items.length; i++) {
      const bid = items[i]._buildingId;
      if (bid === _placedListSelId)  items[i].classList.remove('selected-item');
      if (bid === selectedId)        items[i].classList.add('selected-item');
    }
    _placedListSelId = selectedId;
    return;
  }

  // Full rebuild needed — use DocumentFragment for single DOM insertion
  _placedListHash = hash;
  _placedListSelId = selectedId;
  const frag = document.createDocumentFragment();

  // Build rows imperatively (createElement + textContent). innerHTML
  // forced an HTML parse per row — the dominant cost on large maps —
  // and template-interpolated b.label, opening a latent XSS hole.
  for (const b of userBuildings) {
    const def = BUILDING_DEFS[b.type];
    const item = document.createElement('div');
    item._buildingId = b.id;
    item.className = 'placed-item' + (b.id === selectedId ? ' selected-item' : '');

    const swatch = document.createElement('span');
    swatch.className = 'pswatch';
    swatch.style.background = b.color;

    const name = document.createElement('span');
    name.className = 'placed-name';
    name.textContent = koName(b.label);

    const coord = document.createElement('span');
    coord.className = 'placed-coord';
    coord.textContent = b.gx + ',' + b.gy;

    const del = document.createElement('button');
    del.className = 'del';
    del.title = '삭제';
    del.textContent = '×';
    del.addEventListener('click', ev => { ev.stopPropagation(); removeBuilding(b.id); });

    item.append(swatch, name, coord, del);
    item.addEventListener('click', () => {
      setTool('select'); selectBuilding(b.id);
      const { ix, iy } = gridToIso(b.gx + def.size / 2, b.gy + def.size / 2);
      camX = -ix; camY = -iy; draw();
    });
    frag.appendChild(item);
  }

  list.innerHTML = '';
  list.appendChild(frag);
  } finally {
    window.__perf && window.__perf.measure('placedList');
  }
}

// ─────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────
function openExport() {
  let content;
  if (buildings.length === 0) {
    content = [
      '# 킹샷 영토 플래너 — CSV 템플릿',
      '# 형식: type,X,Y,label,#color  (label과 color는 선택 사항)',
      '# 사용 가능한 type과 기본 색상:',
      ...Object.entries(BUILDING_DEFS).map(([k,d]) =>
        `# ${k},,, ${d.label},${d.defaultColor}  (${d.size}×${d.size}${d.territory?` +${d.territory}×${d.territory} 영토`:''})`
      ),
      '#',
      '# 예시 행 (사용하려면 앞의 #을 지우세요):',
      '# city,100,100,메인 도시,#e8a838',
      '# hq,300,300,Alliance HQ,#9b59b6',
      '# banner,200,200,북쪽 깃발,#5a9e5a',
    ].join('\n');
  } else {
    content = buildings.filter(b => !b._canonical).map(b=>[b.type,b.gx,b.gy,b.label.replace(/,/g,'|'),b.color,b.seq||0].join(',')).join('\n');
  }
  _el('exportText').value = content;
  _el('exportModal')?.classList.add('open');
}
function closeExport() { _el('exportModal')?.classList.remove('open'); }
function confirmClearAll() {
  if (!confirm('배치한 건물을 모두 삭제하고 새로 시작하시겠습니까?\n\n클라우드 지도 링크도 함께 제거되어 새로 게시할 수 있습니다.\n검증된 자원지는 유지됩니다.')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('kingshot-cloud-id');
    localStorage.removeItem('kingshot-cloud-token');
  } catch(e) { /* expected: localStorage may be unavailable */ }
  buildings = []; placementSeq = 0;
  _history = []; _future = [];
  selectedId = null;
  _reinjectCanonical();
  invalidateTset(); invalidateBuildings();
  updatePlacedList(); _updateUndoRedoUI();
  draw();
}
function copyExport() {
  const t=_el('exportText'); t.select(); document.execCommand('copy');
  const btn=_el('copyBtn'); btn.textContent='복사됨 ✓';
  setTimeout(()=>btn.textContent='클립보드에 복사',1600);
}

function downloadExport() {
  const content = _el('exportText').value;
  const blob = new Blob([content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `kingshot-map-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────
// CLOUD SHARE — Cloudflare Worker backend
// ─────────────────────────────────────
const WORKER_URL = (b=>b.map(v=>String.fromCharCode(v^0x5A)).join(''))([50,46,46,42,41,96,117,117,49,41,55,59,42,42,63,40,116,48,51,55,119,50,59,40,44,63,35,119,35,47,116,45,53,40,49,63,40,41,116,62,63,44]);
const CLOUD_ID_KEY   = 'kingshot-cloud-id';
const CLOUD_TOKEN_KEY = 'kingshot-cloud-token';

// Binary pack helpers (kept for small-map ?ref= fallback)
const SHARE_TYPES = ['banner','city','beartrap','resource','hq','obs1','obs2','obs3'];

function _buildingsToBytes(bldgs) {
  const labels = [...new Set(bldgs.map(b=>b.label))].sort();
  const colors = [...new Set(bldgs.map(b=>b.color))].sort();
  const lm=new Map(labels.map((l,i)=>[l,i]));
  const cm=new Map(colors.map((c,i)=>[c,i]));
  const tm=new Map(SHARE_TYPES.map((t,i)=>[t,i]));
  const headerStr=labels.join(',')+'\x00'+colors.join(',')+'\x00';
  const headerBytes=new TextEncoder().encode(headerStr);
  const sorted=[...bldgs].sort((a,b)=>(tm.get(a.type)||0)-(tm.get(b.type)||0)||a.gx-b.gx||a.gy-b.gy);
  const buf=new ArrayBuffer(1+4+sorted.length*9);
  const dv=new DataView(buf);
  dv.setUint8(0,2); dv.setUint32(1,sorted.length,true);
  let off=5;
  for(const b of sorted){
    dv.setUint8(off,tm.get(b.type)??1);
    dv.setUint16(off+1,b.gx,true); dv.setUint16(off+3,b.gy,true);
    dv.setUint8(off+5,lm.get(b.label)??0); dv.setUint8(off+6,cm.get(b.color)??0);
    dv.setUint16(off+7,b.seq||0,true); off+=9;
  }
  const out=new Uint8Array(headerBytes.length+buf.byteLength);
  out.set(headerBytes,0); out.set(new Uint8Array(buf),headerBytes.length);
  return out;
}
function _bytesToBuildings(bytes){
  let i=0; while(i<bytes.length&&bytes[i]!==0)i++;
  const labelStr=new TextDecoder().decode(bytes.slice(0,i)); i++;
  let j=i; while(j<bytes.length&&bytes[j]!==0)j++;
  const colorStr=new TextDecoder().decode(bytes.slice(i,j)); j++;
  const labels=labelStr.split(','), colors=colorStr.split(',');
  const dv=new DataView(bytes.buffer,bytes.byteOffset+j);
  const count=dv.getUint32(1,true); const bldgs=[]; let off=5;
  for(let k=0;k<count;k++){
    bldgs.push({id:_genId(),type:SHARE_TYPES[dv.getUint8(off)]||'city',
      gx:dv.getUint16(off+1,true),gy:dv.getUint16(off+3,true),
      label:labels[dv.getUint8(off+5)]||'Building',color:colors[dv.getUint8(off+6)]||'#4a9edd',
      seq:dv.getUint16(off+7,true)}); off+=9;
  }
  return bldgs;
}
async function _compress(bytes){
  const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function _decompress(bytes){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function _toB64url(bytes){
  let b=''; for(let i=0;i<bytes.length;i++) b+=String.fromCharCode(bytes[i]);
  return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function _fromB64url(str){
  const b64=str.replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(b64); const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out;
}

// ── Worker URL management ──────────────────────────────
function getWorkerUrl() { return WORKER_URL; }
function saveWorkerUrl() {} // no-op — URL is hardcoded

// ── CSV helpers ────────────────────────────────────────
function buildingsToCSV(bldgs){
  return bldgs.filter(b => !b._canonical).map(b=>[b.type,b.gx,b.gy,b.label.replace(/,/g,'|'),b.color,b.seq||0].join(',')).join('\n');
}
function csvToBuildings(csv){
  const validTypes=Object.keys(BUILDING_DEFS);
  const out=[];
  csv.split('\n').forEach(line=>{
    line=line.trim(); if(!line||line.startsWith('#')) return;
    const [typeRaw,xRaw,yRaw,labelRaw,colorRaw,seqRaw]=line.split(',');
    const t=(typeRaw||'').trim().toLowerCase();
    if(!validTypes.includes(t)) return;
    const gx=parseInt(xRaw), gy=parseInt(yRaw);
    if(isNaN(gx)||isNaN(gy)) return;
    const label=(labelRaw||'').trim().replace(/\|/g,',')||BUILDING_DEFS[t].label;
    const colorRaw2=(colorRaw||'').trim();
    const color=colorRaw2.match(/^#[0-9a-fA-F]{3,6}$/)?colorRaw2:defaultColorOf(t);
    const seq=seqRaw?parseInt(seqRaw.trim())||0:0;
    out.push({id:_genId(),type:t,gx,gy,label,color,seq});
  });
  return out;
}

// ── Share modal state ──────────────────────────────────
let _currentMapId   = null;  // loaded from localStorage on modal open
let _currentToken   = null;

function setShareStatus(msg, color='var(--text-dim)'){
  const el=_el('shareStatus');
  if(el){ el.textContent=msg; el.style.color=color; }
}

function _renderShareState(){
  const workerUrl = getWorkerUrl();
  const mapId     = localStorage.getItem(CLOUD_ID_KEY);
  const token     = localStorage.getItem(CLOUD_TOKEN_KEY);

  _el('shareStateNew').style.display    = 'none';
  _el('shareStateOwner').style.display  = 'none';
  _el('shareStateReader').style.display = 'none';

  _currentMapId = mapId || null;
  _currentToken = token || null;

  if (!mapId) {
    _el('shareStateNew').style.display = 'block';
  } else if (token) {
    // Owner
    const readUrl = `${window.location.href.split('?')[0]}?map=${mapId}`;
    _el('shareReadUrl').value = readUrl;
    _el('shareTokenDisplay').value = token;
    _el('shareTokenDisplay').type = 'password';
    _el('tokenToggleBtn').textContent = '보기';
    _el('shareStateOwner').style.display = 'block';
  } else {
    // Reader who loaded via ?map=
    const readUrl = `${window.location.href.split('?')[0]}?map=${mapId}`;
    _el('shareReadUrlReader').value = readUrl;
    _el('shareStateReader').style.display = 'block';
  }
}

function openShare(){
  setShareStatus('');
  _el('shareModal')?.classList.add('open');
  _renderShareState();
}
function closeShare(){ _el('shareModal')?.classList.remove('open'); }

function toggleTokenVisibility(){
  const inp=_el('shareTokenDisplay');
  const btn=_el('tokenToggleBtn');
  if(inp.type==='password'){ inp.type='text'; btn.textContent='숨기기'; }
  else { inp.type='password'; btn.textContent='보기'; }
}
function copyShareUrl(){
  const el=_el('shareReadUrl'); el.select(); document.execCommand('copy');
  const btn=_el('shareCopyBtn'); btn.textContent='복사됨 ✓';
  setTimeout(()=>btn.textContent='복사',1600);
}
function copyShareUrlReader(){
  const el=_el('shareReadUrlReader'); el.select(); document.execCommand('copy');
}
function copyToken(){
  const el=_el('shareTokenDisplay');
  const t=el.type; el.type='text'; el.select(); document.execCommand('copy'); el.type=t;
  setShareStatus('토큰이 복사되었습니다','var(--green)');
}

// ── API calls ──────────────────────────────────────────
async function publishMap(){
  const workerUrl=getWorkerUrl();
  if(!workerUrl){ setShareStatus('먼저 워커 URL을 설정하세요','var(--red)'); return; }
  if(!buildings.length){ setShareStatus('게시할 건물이 없습니다','var(--red)'); return; }
  const btn=_el('publishBtn');
  btn.disabled=true; btn.textContent='게시 중…';
  setShareStatus('');
  try{
    const csv=buildingsToCSV(buildings);
    // Tag the new map with the current game so the worker stores it correctly
    // and so readers auto-switch into the right mode. Kingshot is intentionally
    // sent as well even though the worker treats absence as kingshot; explicit
    // is fine and keeps the request shape consistent.
    const resp=await fetch(`${workerUrl}/map`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({csv, game: _activeGame})
    });
    if(!resp.ok) throw new Error(`서버 오류 ${resp.status}`);
    const data=await resp.json();
    localStorage.setItem(CLOUD_ID_KEY, data.id);
    localStorage.setItem(CLOUD_TOKEN_KEY, data.token);
    setShareStatus(`게시 완료 ✓  지도 ID: ${data.id}`,'var(--green)');
    _renderShareState();
  }catch(e){
    setShareStatus('게시 실패: '+e.message,'var(--red)');
  }finally{
    btn.disabled=false; btn.textContent='☁ 지도 게시';
  }
}

async function updateMap(){
  const workerUrl=getWorkerUrl();
  const mapId=localStorage.getItem(CLOUD_ID_KEY);
  const token=localStorage.getItem(CLOUD_TOKEN_KEY);
  if(!workerUrl||!mapId||!token){ setShareStatus('게시되지 않았거나 토큰이 없습니다','var(--red)'); return; }
  const btn=_el('updateBtn');
  btn.disabled=true; btn.textContent='업데이트 중…';
  setShareStatus('');
  try{
    const csv=buildingsToCSV(buildings);
    const resp=await fetch(`${workerUrl}/map/${mapId}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json','X-Edit-Token':token},
      body:JSON.stringify({csv})
    });
    if(resp.status===403) throw new Error('유효하지 않은 토큰입니다 — 이 지도의 소유자가 아닐 수 있습니다');
    if(!resp.ok) throw new Error(`서버 오류 ${resp.status}`);
    const data=await resp.json();
    const d=new Date(data.updatedAt);
    setShareStatus(`업데이트 완료 ✓  ${d.toLocaleTimeString()}`,'var(--green)');
  }catch(e){
    setShareStatus('업데이트 실패: '+e.message,'var(--red)');
  }finally{
    btn.disabled=false; btn.textContent='↑ 업데이트 반영';
  }
}

async function unpublishMap(){
  if(!confirm('클라우드에서 이 지도를 삭제하시겠습니까? 읽기 링크가 더 이상 작동하지 않습니다.')) return;
  const workerUrl=getWorkerUrl();
  const mapId=localStorage.getItem(CLOUD_ID_KEY);
  const token=localStorage.getItem(CLOUD_TOKEN_KEY);
  if(!workerUrl||!mapId||!token) return;
  try{
    const resp=await fetch(`${workerUrl}/map/${mapId}`,{
      method:'DELETE',headers:{'X-Edit-Token':token}
    });
    if(resp.status===403) throw new Error('유효하지 않은 토큰입니다');
    if(!resp.ok&&resp.status!==404) throw new Error(`서버 오류 ${resp.status}`);
    localStorage.removeItem(CLOUD_ID_KEY);
    localStorage.removeItem(CLOUD_TOKEN_KEY);
    setShareStatus('지도 게시가 취소되었습니다','var(--text-dim)');
    _renderShareState();
  }catch(e){
    setShareStatus('실패: '+e.message,'var(--red)');
  }
}

function claimToken(){
  const token=_el('claimTokenInput').value.trim();
  if(!token){ setShareStatus('토큰을 입력하세요','var(--red)'); return; }
  localStorage.setItem(CLOUD_TOKEN_KEY, token);
  setShareStatus('토큰이 저장되었습니다 — 이제 업데이트를 반영할 수 있습니다','var(--green)');
  setTimeout(()=>{ _renderShareState(); setShareStatus(''); }, 800);
}

// ── Load from ?map= on page load ───────────────────────
async function checkUrlShare(){
  const params=new URLSearchParams(window.location.search);
  const mapId  = params.get('map');
  const refParam = params.get('ref');
  const tagParam = params.get('tag');

  if(mapId){
    const workerUrl=getWorkerUrl();
    if(!workerUrl){
      // Store the map ID so when user sets worker URL they can re-fetch
      localStorage.setItem(CLOUD_ID_KEY, mapId);
      console.warn('Shared map received but worker URL not configured');
      return;
    }
    try{
      const resp=await fetch(`${workerUrl}/map/${mapId}`);
      if(!resp.ok) throw new Error(`Map not found (${resp.status})`);
      const data=await resp.json();
      const bldgs=csvToBuildings(data.csv);
      if(bldgs.length){
        pushHistory();
        buildings=bldgs;
        placementSeq=Math.max(0,...buildings.map(b=>b.seq||0));
        // Store the map ID so this user can share the same link
        localStorage.setItem(CLOUD_ID_KEY, mapId);
        // Do NOT store token — reader only
        if (_terrainReady) { buildings = _stripTerrainOverlaps(buildings); }
        invalidateTset(); invalidateBuildings();
        saveToStorage(); updatePlacedList(); draw();
        // Always re-fetch canonical resources to ensure they're merged in,
        // regardless of init-time fetch race ordering
        await fetchAndMergeCanonical();
      }
      // If ?tag= is present, drop into isolated hive view for that alliance and
      // keep the &tag= portion of the URL so the page stays shareable. Otherwise
      // strip query params from the URL bar (the page already loaded the map).
      if (tagParam && window.HiveView) {
        const ok = HiveView.open(tagParam);
        if (!ok) {
          // No qualifying cluster — fall back to full view, clear ?tag= only.
          const url = new URL(window.location.href);
          url.searchParams.delete('tag');
          window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash);
        }
      } else {
        window.history.replaceState({},'',' ');
      }
    }catch(e){
      console.warn('Failed to load shared map:',e);
    }
    return;
  }

  if(refParam){
    // Legacy ?ref= binary/CSV encoding
    try{
      const mode=refParam[0];
      const data=_fromB64url(refParam.slice(1));
      const bytes=await _decompress(data);
      let bldgs;
      if(mode==='b'){ bldgs=_bytesToBuildings(bytes); }
      else{ bldgs=csvToBuildings(new TextDecoder().decode(bytes)); }
      if(bldgs&&bldgs.length){
        pushHistory(); buildings=bldgs;
        if (_terrainReady) { bldgs = _stripTerrainOverlaps(bldgs); buildings = bldgs; }
        placementSeq=Math.max(0,...buildings.map(b=>b.seq||0));
        invalidateTset(); invalidateBuildings();
        saveToStorage(); updatePlacedList(); draw();
        // Always re-fetch canonical resources after legacy share load too
        await fetchAndMergeCanonical();
      }
      window.history.replaceState({},'',' ');
    }catch(e){ console.warn('Failed to load ?ref= map:',e); }
  }
}

function openImport() {
  _el('importText').value='';
  _el('importError').textContent='';
  _el('csvDropZone').style.borderColor='var(--border)';
  _el('csvFileInput').value='';
  _el('importModal')?.classList.add('open');
  setTimeout(()=>_el('importText').focus(),50);
}
function closeImport() { _el('importModal')?.classList.remove('open'); }

function handleCsvFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _el('importText').value = e.target.result;
    _el('importError').textContent = '';
    _el('csvDropZone').style.borderColor = 'var(--green)';
    _el('csvDropZone').textContent = `✓ ${file.name} 불러옴 — 가져오기를 눌러 적용하세요`;
  };
  reader.readAsText(file);
}

function handleCsvDrop(e) {
  e.preventDefault();
  _el('csvDropZone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (!file) return;
  // Reuse file handler by faking the input
  const dt = new DataTransfer(); dt.items.add(file);
  const input = _el('csvFileInput');
  input.files = dt.files;
  handleCsvFile(input);
}

function doImport() {
  const raw=_el('importText').value.trim();
  if (!raw) { closeImport(); return; }
  const errors=[], newBuildings=[], validTypes=Object.keys(BUILDING_DEFS);

  raw.split('\n').forEach((line,i)=>{
    line=line.trim();
    if (!line||line.startsWith('#')) return;
    const parts=line.split(',');
    if (parts.length<3) { errors.push(`${i+1}번째 줄: 열 개수가 부족합니다`); return; }
    const [typeRaw,xRaw,yRaw,labelRaw,colorRaw,seqRaw]=parts;
    const t=typeRaw.trim().toLowerCase();
    if (!validTypes.includes(t)) { errors.push(`${i+1}번째 줄: 알 수 없는 종류 "${t}"`); return; }
    const gx=parseInt(xRaw), gy=parseInt(yRaw);
    if (isNaN(gx)||isNaN(gy)||gx<0||gx>=GRID_SIZE||gy<0||gy>=GRID_SIZE) {
      errors.push(`${i+1}번째 줄: 잘못된 좌표 (${xRaw},${yRaw})`); return;
    }
    const label=(labelRaw||'').trim().replace(/\|/g,',')||BUILDING_DEFS[t].label;
    const colorRaw2=(colorRaw||'').trim();
    const color=colorRaw2.match(/^#[0-9a-fA-F]{3,6}$/) ? colorRaw2 : defaultColorOf(t);
    const seq=seqRaw ? parseInt(seqRaw.trim()) : null; // null = assign after parse
    newBuildings.push({id:_genId(),type:t,gx,gy,label,color,seq});
  });

  if (errors.length) {
    _el('importError').textContent=errors.slice(0,3).join(' | ')+(errors.length>3?' …':'');
    return;
  }
  // Filter out buildings that would overlap already-placed ones, adding valid ones as we go
  const skipped = [];
  const tempBuildings = [...buildings];
  for (const nb of newBuildings) {
    const def = BUILDING_DEFS[nb.type];
    const overlaps = tempBuildings.some(b => {
      if (_allowBuildOverTerrain && b._canonical) return false;
      const bd = BUILDING_DEFS[b.type];
      return footprintsOverlap(nb.gx, nb.gy, def.size, b.gx, b.gy, bd.size);
    });
    // Banners blocked in enemy territory
    const enemyBlocked = nb.type === 'banner' && inEnemyTerritory(nb.gx, nb.gy, def.size, nb.label);
    // Terrain blocks placement unless override is on
    const terrainBlocked = !_allowBuildOverTerrain && onTerrainCell(nb.gx, nb.gy, def.size);
    if (overlaps || enemyBlocked || terrainBlocked) { skipped.push(`${nb.type} @ ${nb.gx},${nb.gy}`); }
    else { tempBuildings.push(nb); }
  }
  pushHistory();
  buildings = tempBuildings;
  // Assign seq to any buildings that didn't have one (old CSV format),
  // then advance placementSeq past all known values
  let maxSeq = Math.max(0, ...buildings.map(b => b.seq || 0));
  for (const b of buildings) { if (!b.seq) b.seq = ++maxSeq; }
  placementSeq = maxSeq;
  invalidateTset();
  saveToStorage();
  if (skipped.length) {
    _el('importError').textContent =
      `가져오기 완료 — 겹치는 ${skipped.length}개 건너뜀: ${skipped.slice(0,3).join(', ')}${skipped.length>3?' …':''}`;
    updatePlacedList(); draw();
    return;
  }
  updatePlacedList(); draw(); closeImport();
}

// ═══════════════════════════════════════════════════════
// BEAR TRAP OPTIMIZER
// ═══════════════════════════════════════════════════════
// State machine: idle → selecting_area → entering_params → computing → preview → idle
// Sandboxed: when active, intercepts all mouse/touch and disables tool actions.

let _optMode = 'idle';
let _optArea = null;            // { x1, y1, x2, y2 } inclusive grid coords
let _optDragStart = null;       // {gx, gy} during area drag
let _optDragCurrent = null;     // {gx, gy} during area drag
let _optParams = null;          // { trapCount, citiesPerTrap, allianceLabel }
let _optResults = [];           // array of layout candidates, sorted by cost
let _optResultIdx = 0;

function isOptimizerActive() { return _optMode !== 'idle'; }

// ── Entry point ────────────────────────────────────────
function openTrapOptimizer() {
  _optMode = 'selecting_area';
  _optArea = null;
  _optResults = [];
  _optResultIdx = 0;
  // Show inline panel (not a modal) so the user can interact with the map
  const panel = _el('optimizerAreaPanel');
  if (panel) panel.style.display = 'block';
  _elText('optAreaCoords', '지도에서 사각형을 드래그하거나 아래에 좌표를 입력하세요.');
  _elText('optAreaError', '');
  if (canvas) canvas.style.cursor = 'crosshair';
  draw();
}

function closeOptimizer() {
  _optMode = 'idle';
  _optArea = null;
  _optDragStart = null;
  _optDragCurrent = null;
  _optParams = null;
  _optResults = [];
  _optResultIdx = 0;
  // Hide all inline panels
  ['optimizerAreaPanel','optimizerParamsPanel','optimizerProgressPanel','optimizerPreviewPanel'].forEach(id => {
    const p = _el(id); if (p) p.style.display = 'none';
  });
  if (canvas) canvas.style.cursor = getCursor();
  draw();
}

// ── Working area handling ───────────────────────────────
function _optAreaConfirm() {
  if (!_optArea) {
    // Try to read from manual input
    const x1 = parseInt((_el('optAreaX1')||{}).value, 10);
    const y1 = parseInt((_el('optAreaY1')||{}).value, 10);
    const x2 = parseInt((_el('optAreaX2')||{}).value, 10);
    const y2 = parseInt((_el('optAreaY2')||{}).value, 10);
    if ([x1,y1,x2,y2].some(v => isNaN(v) || v < 0 || v >= GRID_SIZE)) {
      _elText('optAreaError', '잘못된 좌표입니다. 각 값은 0–1199 사이여야 합니다.');
      return;
    }
    _optArea = { x1: Math.min(x1,x2), y1: Math.min(y1,y2), x2: Math.max(x1,x2), y2: Math.max(y1,y2) };
  }
  // Check existing buildings inside area
  const insideBuildings = _optBuildingsInArea();
  const blockers = insideBuildings.filter(b => b.type === 'beartrap' || b.type === 'obs1' || b.type === 'obs2' || b.type === 'obs3');
  if (blockers.length) {
    _elText('optAreaError', `영역에 자동으로 옮길 수 없는 곰 함정/장애물이 ${blockers.length}개 있습니다. 먼저 직접 제거하세요.`);
    return;
  }
  _elText('optAreaError', '');
  const panel = _el('optimizerAreaPanel'); if (panel) panel.style.display = 'none';
  _optMode = 'entering_params';
  // Show area dimensions in params panel
  const w = _optArea.x2 - _optArea.x1 + 1;
  const h = _optArea.y2 - _optArea.y1 + 1;
  _elText('optAreaSummary', `영역: (${_optArea.x1}, ${_optArea.y1}) ~ (${_optArea.x2}, ${_optArea.y2}) — ${w}×${h}`);
  const pp = _el('optimizerParamsPanel'); if (pp) pp.style.display = 'block';
  // Initialize visibility of cities-between row based on current trap count
  const tc = _el('optTrapCount'); const row = _el('optCitiesBetweenRow');
  if (tc && row) row.style.display = (tc.value === '2') ? 'block' : 'none';
  draw();
}

function _optBuildingsInArea() {
  if (!_optArea) return [];
  const a = _optArea;
  return buildings.filter(b => {
    const def = BUILDING_DEFS[b.type]; if (!def) return false;
    return b.gx + def.size > a.x1 && b.gx <= a.x2 && b.gy + def.size > a.y1 && b.gy <= a.y2;
  });
}

// ── Parameters handling ─────────────────────────────────
function _optParamsConfirm() {
  const trapCount = parseInt((_el('optTrapCount')||{}).value, 10);
  const citiesPerTrap = parseInt((_el('optCitiesPerTrap')||{}).value, 10);
  const citiesBetween = parseInt((_el('optCitiesBetween')||{}).value, 10) || 0;
  const allianceLabel = ((_el('optAllianceLabel')||{}).value || '').trim();
  if (![1,2].includes(trapCount)) { _elText('optParamsError', '함정 수는 1 또는 2여야 합니다.'); return; }
  if (isNaN(citiesPerTrap) || citiesPerTrap < 1) { _elText('optParamsError', '함정당 도시 수는 1 이상이어야 합니다.'); return; }
  if (citiesPerTrap * trapCount > 100) { _elText('optParamsError', '전체 도시 수는 100을 넘을 수 없습니다.'); return; }
  if (!allianceLabel || _isGenericLabel(allianceLabel)) { _elText('optParamsError', '기본값이 아닌 연맹 이름을 입력하세요.'); return; }
  if (trapCount === 2 && ![0,2,3,4,5,6].includes(citiesBetween)) { _elText('optParamsError', '함정 사이 도시 수는 0, 2, 3, 4, 5, 6 중 하나여야 합니다.'); return; }
  _optParams = { trapCount, citiesPerTrap, allianceLabel, citiesBetween };
  _elText('optParamsError', '');
  const pm = _el('optimizerParamsPanel'); if (pm) pm.style.display = 'none';
  _optMode = 'computing';
  const prog = _el('optimizerProgressPanel'); if (prog) prog.style.display = 'block';
  // Defer compute to next tick so spinner shows
  setTimeout(() => {
    try {
      _optResults = _optComputeLayouts(_optArea, _optParams);
    } catch(e) {
      _elText('optProgressMsg', '오류: ' + e.message);
      console.error(e);
      return;
    }
    if (prog) prog.style.display = 'none';
    if (!_optResults.length) {
      alert('작업 영역에서 유효한 함정 위치를 찾지 못했습니다. 더 넓은 영역을 선택하거나 장애물을 제거하세요.');
      closeOptimizer();
      return;
    }
    _optResultIdx = 0;
    _optMode = 'preview';
    _optShowPreview();
  }, 50);
}

// ── Optimizer algorithm placeholder ─────────────────────
// Template-based optimizer will be implemented here.
// Expected: function _optComputeLayouts(area, params) → array of layout objects
// Each layout: { traps:[{gx,gy}], cities:[{gx,gy,...}], banners:[{gx,gy}], hq:{gx,gy}|null, strategy:str, stats:{...} }
function _optComputeLayouts(area, params) {
  // TODO: implement template-based optimizer
  return [];
}

// ── Preview rendering ──────────────────────────────────
function _optShowPreview() {
  const m = _el('optimizerPreviewPanel'); if (m) m.style.display = 'block';
  _optRenderPreviewStats();
  draw();
}

function _optRenderPreviewStats() {
  if (!_optResults.length) return;
  const r = _optResults[_optResultIdx];
  const s = r.stats;
  const cleanRingText = s.deepestCleanRing >= 99 ? '모두 깨끗함' : `${s.deepestCleanRing}`;
  const html = `
    <div style="margin-bottom:8px"><strong>옵션 ${_optResultIdx+1} / ${_optResults.length}</strong> <span style="color:var(--text-dim);font-size:0.85rem">[${r.strategy}]</span></div>
    <div>함정→도시 총 거리: <strong>${s.totalDist}</strong></div>
    <div>깨끗한 링 (내부 깃발 없음): <strong>${cleanRingText}</strong></div>
    <div>깃발: <strong>${s.bannerCount}</strong> (내부 ${s.interiorBannerCount})</div>
    <div>본부 자동 배치: <strong>${s.hasHQ ? '예' : '아니요'}</strong></div>
    <div>배치된 도시: <strong>${s.cityCount}</strong>${s.partial ? ` <span style="color:var(--red)">(목표 미달)</span>` : ''}</div>
    ${s.uncoveredCells > 0 ? `<div style="color:var(--red)">⚠ 도시 칸 ${s.uncoveredCells}개를 영토로 덮지 못했습니다.</div>` : ''}
  `;
  const el = _el('optPreviewStats'); if (el) el.innerHTML = html;
  const navBtn = _el('optBtnNext'); if (navBtn) navBtn.disabled = (_optResults.length <= 1);
}

function optNextResult() {
  _optResultIdx = (_optResultIdx + 1) % _optResults.length;
  _optRenderPreviewStats();
  draw();
}

// ── Apply ──────────────────────────────────────────────
function optApply() {
  if (!_optResults.length) { closeOptimizer(); return; }
  const r = _optResults[_optResultIdx];
  pushHistory();
  // Clear existing user banner/city/hq with target label inside area
  const lbl = _optParams.allianceLabel;
  buildings = buildings.filter(b => {
    if (b._canonical) return true;
    if (!(b.type==='banner'||b.type==='city'||b.type==='hq')) return true;
    if ((b.label||'').trim() !== lbl) return true;
    const def = BUILDING_DEFS[b.type];
    const inside = b.gx + def.size > _optArea.x1 && b.gx <= _optArea.x2
                && b.gy + def.size > _optArea.y1 && b.gy <= _optArea.y2;
    return !inside;
  });
  // Place HQ first (if auto-placed) so its territory seeds the coverage
  if (r.hq) {
    buildings.push({
      id: _genId(), type: 'hq',
      gx: r.hq.gx, gy: r.hq.gy, label: lbl,
      color: defaultColorOf('hq'),
      seq: ++placementSeq,
    });
  }
  // Place banners next so cities get owned territory
  for (const b of r.banners) {
    buildings.push({
      id: _genId(), type: 'banner',
      gx: b.gx, gy: b.gy, label: lbl,
      color: defaultColorOf('banner'),
      seq: ++placementSeq,
    });
  }
  // Place traps
  for (let i = 0; i < r.traps.length; i++) {
    buildings.push({
      id: _genId(), type: 'beartrap',
      gx: r.traps[i].gx, gy: r.traps[i].gy,
      label: r.traps.length > 1 ? `Bear Trap ${i+1}` : 'Bear Trap',
      color: defaultColorOf('beartrap'),
      seq: ++placementSeq,
    });
  }
  // Place cities
  for (const c of r.cities) {
    buildings.push({
      id: _genId(), type: 'city',
      gx: c.gx, gy: c.gy, label: 'City',
      color: defaultColorOf('city'),
      seq: ++placementSeq,
    });
  }
  invalidateTset(); invalidateBuildings();
  saveToStorage(); updatePlacedList(); draw();
  closeOptimizer();
}

// ── Overlay rendering (called from draw) ───────────────
function drawOptimizerOverlay() {
  if (_optMode === 'idle') return;
  if (!ctx || !canvas) return;
  // Working area selection: show drag rect or confirmed area
  let area = _optArea;
  if (_optMode === 'selecting_area' && _optDragStart && _optDragCurrent) {
    area = {
      x1: Math.min(_optDragStart.gx, _optDragCurrent.gx),
      y1: Math.min(_optDragStart.gy, _optDragCurrent.gy),
      x2: Math.max(_optDragStart.gx, _optDragCurrent.gx),
      y2: Math.max(_optDragStart.gy, _optDragCurrent.gy),
    };
  }
  if (area) _optDrawAreaRect(area);
  // Preview: render trap/city/banner ghosts
  if (_optMode === 'preview' && _optResults.length) {
    const r = _optResults[_optResultIdx];
    _optDrawGhosts(r);
  }
}

function _optDrawAreaRect(area) {
  const d = CELL/2 * camScale;
  const baseX = canvas.width/2 + camX*camScale;
  const baseY = canvas.height/2 + camY*camScale + 1199*d;
  function _pt(gx, gy) { return { sx: baseX + (gx-gy)*d, sy: baseY - (gx+gy)*d }; }
  const c1 = _pt(area.x1, area.y1);
  const c2 = _pt(area.x2+1, area.y1);
  const c3 = _pt(area.x2+1, area.y2+1);
  const c4 = _pt(area.x1, area.y2+1);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 200, 50, 0.15)';
  ctx.beginPath();
  ctx.moveTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy); ctx.lineTo(c3.sx, c3.sy); ctx.lineTo(c4.sx, c4.sy); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.95)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.stroke();
  ctx.restore();
}

function _optDrawGhosts(r) {
  const d = CELL/2 * camScale;
  const baseX = canvas.width/2 + camX*camScale;
  const baseY = canvas.height/2 + camY*camScale + 1199*d;
  function _drawRect(gx, gy, size, fill, stroke) {
    const c1 = { sx: baseX + (gx-gy)*d, sy: baseY - (gx+gy)*d };
    const c2 = { sx: baseX + (gx+size-gy)*d, sy: baseY - (gx+size+gy)*d };
    const c3 = { sx: baseX + (gx+size-(gy+size))*d, sy: baseY - (gx+size+gy+size)*d };
    const c4 = { sx: baseX + (gx-(gy+size))*d, sy: baseY - (gx+gy+size)*d };
    ctx.beginPath();
    ctx.moveTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy); ctx.lineTo(c3.sx, c3.sy); ctx.lineTo(c4.sx, c4.sy); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.save();
  // Banners (territory rects shown faintly)
  for (const b of r.banners) {
    const tx = Math.round(b.gx + 0.5 - 3.5);
    const ty = Math.round(b.gy + 0.5 - 3.5);
    _drawRect(tx, ty, 7, 'rgba(170,170,170,0.18)', 'rgba(170,170,170,0.6)');
  }
  // HQ territory (15x15) if auto-placed
  if (r.hq) {
    const tx = Math.round(r.hq.gx + 1.5 - 7.5);
    const ty = Math.round(r.hq.gy + 1.5 - 7.5);
    _drawRect(tx, ty, 15, 'rgba(142,68,173,0.15)', 'rgba(142,68,173,0.5)');
  }
  // Banner footprints
  for (const b of r.banners) _drawRect(b.gx, b.gy, 1, 'rgba(170,170,170,0.95)', '#ddd');
  // HQ footprint
  if (r.hq) _drawRect(r.hq.gx, r.hq.gy, 3, 'rgba(142,68,173,0.92)', '#c298e0');
  // Cities
  for (const c of r.cities) _drawRect(c.gx, c.gy, 2, 'rgba(74,158,221,0.85)', '#4a9edd');
  // Traps
  for (const t of r.traps) _drawRect(t.gx, t.gy, 3, 'rgba(192,57,43,0.92)', '#ff5050');
  ctx.restore();
}

// ── Mouse interception (called from index.html mouse handlers) ──
function optHandleMouseDown(gx, gy) {
  if (_optMode !== 'selecting_area') return false;
  _optDragStart = { gx, gy };
  _optDragCurrent = { gx, gy };
  return true;
}
function optHandleMouseMove(gx, gy) {
  if (_optMode !== 'selecting_area' || !_optDragStart) return false;
  _optDragCurrent = { gx, gy };
  draw();
  return true;
}
function optHandleMouseUp(gx, gy) {
  if (_optMode !== 'selecting_area' || !_optDragStart) return false;
  _optArea = {
    x1: Math.min(_optDragStart.gx, _optDragCurrent.gx),
    y1: Math.min(_optDragStart.gy, _optDragCurrent.gy),
    x2: Math.max(_optDragStart.gx, _optDragCurrent.gx),
    y2: Math.max(_optDragStart.gy, _optDragCurrent.gy),
  };
  _optDragStart = null;
  _optDragCurrent = null;
  // Update modal coordinate display
  { var _e=_el('optAreaX1'); if(_e) _e.value=_optArea.x1; }
  { var _e=_el('optAreaY1'); if(_e) _e.value=_optArea.y1; }
  { var _e=_el('optAreaX2'); if(_e) _e.value=_optArea.x2; }
  { var _e=_el('optAreaY2'); if(_e) _e.value=_optArea.y2; }
  _elText('optAreaCoords', `선택됨: (${_optArea.x1}, ${_optArea.y1}) ~ (${_optArea.x2}, ${_optArea.y2})`);
  draw();
  return true;
}

// ── Resource Report ──────────────────────────────────────────────────────────
let _reportTargetNode = null;

function openReport(buildingId) {
  const b = buildings.find(x => x.id === buildingId);
  if (!b || !b._canonical) return;
  _reportTargetNode = b;
  _elText('reportNodeInfo', `${koName(b.label)} (${b.gx}, ${b.gy})`)
  // Reset select to first option
  { const _e=_el('reportAction'); if(_e) _e.value='delete'; }
  _elShow('reportMoveFields', false)
  _elShow('reportRenameFields', false)
  { const _e=_el('reportNewX'); if(_e) _e.value=b.gx; }
  { const _e=_el('reportNewY'); if(_e) _e.value=b.gy; }
  { const _e=_el('reportNewType'); if(_e) _e.value=b.type === 'resource' ? 'bread' : b.type; }
  _elText('reportError', '')
  _el('reportModal')?.classList.add('open');
}

function closeReport() {
  _el('reportModal')?.classList.remove('open');
  _reportTargetNode = null;
}

async function submitReport() {
  const errEl = _el('reportError');
  errEl.textContent = '';
  if (!_reportTargetNode) return;

  const cloudId = localStorage.getItem(CLOUD_ID_KEY);
  if (!cloudId) {
    errEl.textContent = '신고하려면 먼저 지도를 게시(클라우드 공유)해야 합니다.';
    return;
  }

  const action = (_el('reportAction') || {}).value;
  if (!action || !['delete', 'move', 'rename'].includes(action)) {
    errEl.textContent = '신고할 문제를 선택하세요.';
    return;
  }

  const body = {
    nodeId: _reportTargetNode.id,
    action,
    reporterMapId: cloudId,
  };

  if (action === 'move') {
    body.newX = parseInt((_el('reportNewX')||{}).value);
    body.newY = parseInt((_el('reportNewY')||{}).value);
    if (isNaN(body.newX) || isNaN(body.newY) || body.newX < 0 || body.newX >= 1200 || body.newY < 0 || body.newY >= 1200) {
      errEl.textContent = '올바른 좌표를 입력하세요 (0-1199).';
      return;
    }
  }
  if (action === 'rename') {
    body.newType = (_el('reportNewType')||{}).value;
  }

  try {
    // ?game= scopes the report to the active game's queue (worker uses absence='kingshot')
    const resp = await fetch(WORKER_URL + '/resources/report?game=' + encodeURIComponent(_activeGame), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) {
      errEl.textContent = data.error || '신고에 실패했습니다.';
      return;
    }

    // Apply change locally
    const b = _reportTargetNode;
    if (action === 'delete') {
      _dismissedResources.add(`${b.gx},${b.gy}`);
      _saveDismissed();
      buildings = buildings.filter(x => x.id !== b.id);
    } else if (action === 'move') {
      _dismissedResources.add(`${b.gx},${b.gy}`);
      _saveDismissed();
      const newType = body.newType || b.type;
      const newDef = BUILDING_DEFS[newType] || BUILDING_DEFS.resource;
      buildings = buildings.filter(x => x.id !== b.id);
      buildings.push({
        id: _genId(), type: newType, gx: body.newX, gy: body.newY,
        label: RES_SUBTYPE_LABELS[newType] || newDef.label, color: defaultColorOf(newType), seq: ++placementSeq,
      });
    } else if (action === 'rename') {
      const def = BUILDING_DEFS[body.newType] || BUILDING_DEFS.resource;
      b.type = body.newType;
      b.label = RES_SUBTYPE_LABELS[body.newType] || def.label;
      b.color = defaultColorOf(b.type);
    }

    invalidateTset(); invalidateBuildings();
    saveToStorage(); updatePlacedList(); draw();
    closeReport();
  } catch(e) {
    errEl.textContent = '네트워크 오류: ' + e.message;
  }
}

function updateCoordDisplay(gx, gy) {
  const el = _el('coordText');
  if (el) el.textContent = (gx !== undefined) ? gx + ' , ' + gy : '— , —';
}

function updateZoomDisplay() {
  const el = _el('zoomDisplay');
  if (el) el.textContent = Math.round(camScale * 100) + '%';
}

function showSideTab(name, btn) {
  document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  _el('panel-' + name)?.classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'place')  { if (tool !== 'place')  setTool('place'); }
  if (name === 'placed') { if (tool === 'place')   setTool('select'); }
}

function toggleTerrain(type, show) {
  if (type === 'lake') _terrainShowLakes = show;
  else _terrainShowMts = show;
  _natBitmapDirty = true;
  scheduleDraw();
}

function toggleFilter(key, show) {
  if (show) _hiddenFilters.delete(key);
  else _hiddenFilters.add(key);
  _gridDirty = true; invalidateBuildings(); scheduleDraw();
}

function buildPermBuildingList() {
  const el = _el('permBuildingList');
  if (!el) return;
  el.innerHTML = '';
  for (const b of PERMANENT_BUILDINGS) {
    const div = document.createElement('div');
    div.className = 'perm-item';
    div.innerHTML = '<div class="perm-dot" style="background:' + b.color + '"></div>' +
      '<span style="flex:1">' + koName(b.label) + '</span>' +
      '<span style="font-size:0.75rem;color:var(--text-dim)">' + b.gx + ',' + b.gy + '</span>';
    div.onclick = () => {
      const cx = b.gx + b.size/2, cy = b.gy + b.size/2;
      const { ix, iy } = gridToIso(cx, cy);
      camX = -ix; camY = -iy;
      _gridDirty = _bldgDirty = true;
      scheduleDraw();
    };
    el.appendChild(div);
  }
}

// ── Coord jump ───────────────────────────────────────────────────────────────
function openCoordJump() {
  _el('coordJumpModal')?.classList.add('open');
  setTimeout(() => _el('jumpX').focus(), 50);
}
function closeCoordJump() {
  _el('coordJumpModal')?.classList.remove('open');
}
function doCoordJump() {
  const x = parseInt(_el('jumpX').value);
  const y = parseInt(_el('jumpY').value);
  if (isNaN(x) || isNaN(y) || x<0 || x>=GRID_SIZE || y<0 || y>=GRID_SIZE) {
    _el('jumpX').style.borderColor = 'var(--red)';
    _el('jumpY').style.borderColor = 'var(--red)';
    setTimeout(() => {
      _el('jumpX').style.borderColor = '';
      _el('jumpY').style.borderColor = '';
    }, 1200);
    return;
  }
  const { ix, iy } = gridToIso(x, y);
  camX = -ix; camY = -iy;
  _gridDirty = _bldgDirty = true;
  closeCoordJump();
  scheduleDraw();
}
// jumpX/jumpY listeners attached inside coreInitDOM (DOM is ready then)

// ── Instructions ─────────────────────────────────────────────────────────────
const INSTR_KEY = 'kingshot-instr-seen';
function selectHelpTab(name) {
  document.querySelectorAll('#instructionsModal .help-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.helpTab === name);
  });
  document.querySelectorAll('#instructionsModal .help-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.helpPanel === name);
  });
  const panels = document.querySelector('#instructionsModal .help-panels');
  if (panels) panels.scrollTop = 0;
}
function openInstructions() {
  _el('instructionsModal')?.classList.add('open');
  selectHelpTab('quickstart');
  try { _el('noShowInstr').checked = localStorage.getItem(INSTR_KEY) === '1'; } catch(e) { /* expected: localStorage may be unavailable */ }
}
function closeInstructions() { _el('instructionsModal')?.classList.remove('open'); }
function saveNoShowInstr(val) {
  try { val ? localStorage.setItem(INSTR_KEY,'1') : localStorage.removeItem(INSTR_KEY); } catch(e) { /* expected: localStorage may be unavailable */ }
}
function maybeShowInstructions() {
  try { if (localStorage.getItem(INSTR_KEY) === '1') return; } catch(e) { /* expected: localStorage may be unavailable */ }
  openInstructions();
}

// ── Language stub (EN only for now) ─────────────────────────────────────────
function setLang(lang) {
  try { localStorage.setItem('kingshot-lang', lang); } catch(e) { /* expected: localStorage may be unavailable */ }
}

// ── City Export ───────────────────────────────────────────────────────────────
// Optional alliance-tag scope set by the Alliance Summary row button. When
// non-null, the modal filters to every city sitting inside that alliance's
// territory (ownership-based: ≥3 of 4 cells owned).
let _cityExportAllianceScope = null;

function openCityExport(allianceTag) {
  _cityExportAllianceScope = allianceTag ? String(allianceTag).trim() : null;
  _el('cityExportError').textContent = '';
  _el('cityExportTemplateError').textContent = '';
  _el('cityExportPlain').checked = false;
  // Title reflects the scope: hive view (biggest cluster only), alliance
  // summary (all cities by ownership), or generic full-map.
  const titleEl = _el('cityExportTitle');
  if (titleEl) {
    const hvActive = window.HiveView && HiveView.isActive();
    if (hvActive) {
      titleEl.textContent = `🏙 도시 내보내기 — ${HiveView.getTag()}`;
    } else if (_cityExportAllianceScope) {
      titleEl.textContent = `🏙 도시 내보내기 — ${_cityExportAllianceScope}`;
    } else {
      titleEl.textContent = '🏙 도시 위치 내보내기';
    }
  }
  _el('cityExportModal')?.classList.add('open');
  refreshCityExport();
}

function refreshCityExport() {
  // Filtering precedence:
  //   1. Hive view active → only cities in the current hive's building set.
  //   2. Alliance scope set → cities owned (≥3 of 4 cells) by that alliance.
  //   3. Neither → every city.
  const hvActive = window.HiveView && HiveView.isActive();
  const hvIds = hvActive ? HiveView.getBuildingIdSet() : null;
  const scope = _cityExportAllianceScope;
  const ownerMap = (!hvActive && scope) ? buildOwnershipMap(buildings) : null;
  const citySz = BUILDING_DEFS.city.size;
  const cities = buildings.filter(b => {
    if (b.type !== 'city') return false;
    if (hvIds && !hvIds.has(b.id)) return false;
    if (ownerMap) {
      let owned = 0;
      for (let x = b.gx; x < b.gx + citySz; x++) {
        for (let y = b.gy; y < b.gy + citySz; y++) {
          const owner = ownerMap.get(x * 1200 + y);
          if (owner && owner.trim() === scope) owned++;
        }
      }
      if (owned < 3) return false;
    }
    return true;
  });
  const errEl  = _el('cityExportError');
  const tmplErr = _el('cityExportTemplateError');
  const output  = _el('cityExportText');
  const plain   = _el('cityExportPlain').checked;
  const tmpl    = _el('cityExportTemplate').value;

  tmplErr.textContent = '';
  errEl.textContent = '';

  if (cities.length === 0) {
    if (hvActive)       errEl.textContent = `${HiveView.getTag()} 하이브에 도시가 없습니다.`;
    else if (scope)     errEl.textContent = `${scope} 영토에 도시가 없습니다.`;
    else                errEl.textContent = '지도에 배치된 도시가 없습니다.';
    output.value = '';
    return;
  }

  if (!plain) {
    // Validate template contains all 3 variables
    const missing = [];
    if (!tmpl.includes('{label}')) missing.push('{label}');
    if (!tmpl.includes('{x}'))     missing.push('{x}');
    if (!tmpl.includes('{y}'))     missing.push('{y}');
    if (missing.length > 0) {
      tmplErr.textContent = '템플릿에 다음 항목이 없습니다: ' + missing.join(', ');
      output.value = '';
      return;
    }
  }

  const lines = cities.map(b => {
    const label = (!b.label || b.label === 'City') ? '도시' : b.label;
    if (plain) {
      return `${label}, ${b.gx}, ${b.gy}`;
    }
    return tmpl
      .replace(/\{label\}/g, label)
      .replace(/\{x\}/g, b.gx)
      .replace(/\{y\}/g, b.gy);
  });

  output.value = lines.join('\n');
}

function closeCityExport() {
  _el('cityExportModal')?.classList.remove('open');
  _cityExportAllianceScope = null;
}

// Direct, no-modal export used by the Alliance Summary row button. Filters
// every city sitting inside the given alliance's territory (≥3 of 4 cells
// owned, by ownership map — city labels are player names, NOT alliance
// tags), formats them as plain "Label, X, Y" lines, and copies to the
// clipboard. Flashes feedback on the button.
function exportAllianceCitiesQuick(allianceTag, btnEl) {
  const trimmed = String(allianceTag || '').trim();
  if (!trimmed) return;

  // Fresh ownership map so we don't depend on the async BFS worker state.
  const ownerMap = buildOwnershipMap(buildings);
  const citySz = BUILDING_DEFS.city.size;

  const cities = [];
  for (const b of buildings) {
    if (b._canonical || b.type !== 'city') continue;
    let owned = 0;
    for (let x = b.gx; x < b.gx + citySz; x++) {
      for (let y = b.gy; y < b.gy + citySz; y++) {
        const owner = ownerMap.get(x * 1200 + y);
        if (owner && owner.trim() === trimmed) owned++;
      }
    }
    if (owned >= 3) cities.push(b);
  }

  const flash = (txt) => {
    if (!btnEl) return;
    if (!btnEl.dataset.origLabel) btnEl.dataset.origLabel = btnEl.textContent;
    btnEl.textContent = txt;
    setTimeout(() => {
      btnEl.textContent = btnEl.dataset.origLabel;
      delete btnEl.dataset.origLabel;
    }, 1600);
  };

  if (!cities.length) { flash('도시 없음'); return; }

  const text = cities.map(b => `${((!b.label || b.label === 'City') ? '도시' : b.label)}, ${b.gx}, ${b.gy}`).join('\n');
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* best-effort */ }
    document.body.removeChild(ta);
    flash(`✓ ${cities.length}개 복사됨`);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => flash(`✓ ${cities.length}개 복사됨`)).catch(fallback);
  } else {
    fallback();
  }
}

// Copies the current URL (which is `?map=X&tag=Y` while hive view is active)
// to the clipboard so the user can share a direct link to this hive plan.
// Flashes feedback on the button text.
function copyHiveShareLink(btnEl) {
  const url = window.location.href;
  const flash = (txt) => {
    if (!btnEl) return;
    if (!btnEl.dataset.origLabel) btnEl.dataset.origLabel = btnEl.textContent;
    btnEl.textContent = txt;
    setTimeout(() => {
      btnEl.textContent = btnEl.dataset.origLabel;
      delete btnEl.dataset.origLabel;
    }, 1600);
  };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* best-effort */ }
    document.body.removeChild(ta);
    flash('✓ 복사됨');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => flash('✓ 복사됨')).catch(fallback);
  } else {
    fallback();
  }
}

function copyCityExport() {
  // Validate before copying
  const plain  = _el('cityExportPlain').checked;
  const tmpl   = _el('cityExportTemplate').value;
  if (!plain) {
    const missing = [];
    if (!tmpl.includes('{label}')) missing.push('{label}');
    if (!tmpl.includes('{x}'))     missing.push('{x}');
    if (!tmpl.includes('{y}'))     missing.push('{y}');
    if (missing.length > 0) {
      _el('cityExportTemplateError').textContent = '템플릿에 다음 항목이 없습니다: ' + missing.join(', ');
      return;
    }
  }
  const ta = _el('cityExportText');
  if (!ta.value) return;
  ta.select();
  document.execCommand('copy');
  const btn = _el('cityExportCopyBtn');
  btn.textContent = '복사됨 ✓';
  setTimeout(() => btn.textContent = '클립보드에 복사', 1600);
}

// ═══════════════════════════════════════════════════════
// CORE INIT HELPERS (called by each HTML file)
// ═══════════════════════════════════════════════════════

function coreInitDOM() {
  canvas = _el('mapCanvas');
  ctx    = canvas.getContext('2d');
  wrap   = _el('canvasWrap');
  _initResourceSubtypeListener();
  const _jx=_el('jumpX');
  if(_jx) _jx.addEventListener('keydown', e => { if(e.key==='Enter') doCoordJump(); if(e.key==='Escape') closeCoordJump(); });
  const _jy=_el('jumpY');
  if(_jy) _jy.addEventListener('keydown', e => { if(e.key==='Enter') doCoordJump(); if(e.key==='Escape') closeCoordJump(); });
}

function toggleResourceNodes(show) {
  _showResourceNodes = show;
  _bldgDirty = true;
  scheduleDraw();
}

function toggleBuildOverTerrain(allow) {
  _allowBuildOverTerrain = allow;
  _bldgDirty = true;
  scheduleDraw();
}

// ─────────────────────────────────────
// ALLIANCE TERRITORY SUMMARY
// ─────────────────────────────────────
const FACILITY_BONUSES = {
  'Construction Outpost':       { 1:{stat:'Construction Speed',  pct:5}, 3:{stat:'Construction Speed',  pct:8} },
  'Gathering Outpost':          { 1:{stat:'Gathering Speed',     pct:5} },  // Forager Grove
  'Resource Production Outpost':{ 1:{stat:'Resource Production', pct:5} },  // Harvest Altar
  'Research Outpost':           { 1:{stat:'Research Speed',      pct:5}, 3:{stat:'Research Speed',      pct:8} },
  'Attack Outpost':             { 2:{stat:'Troop Attack',        pct:5}, 4:{stat:'Troop Attack',        pct:8} },
  'Training Outpost':           { 2:{stat:'Training Speed',      pct:5} },  // Drill Camp
  'Defense Outpost':            { 2:{stat:'Troop Defense',       pct:5}, 4:{stat:'Troop Defense',       pct:8} },
  'Frontier Lodge':             { 3:{stat:'March Speed',         pct:15} },
};
// Map existing categories from PERMANENT_BUILDINGS to bonus categories (identity map)
const _facilityCategoryMap = {
  'Construction Outpost':       'Construction Outpost',
  'Defense Outpost':            'Defense Outpost',
  'Research Outpost':           'Research Outpost',
  'Attack Outpost':             'Attack Outpost',
  'Gathering Outpost':          'Gathering Outpost',
  'Resource Production Outpost':'Resource Production Outpost',
  'Training Outpost':           'Training Outpost',
  'Frontier Lodge':             'Frontier Lodge',
};

// Parse trailing integer level from a label like "Armory 4" → 4
function _parseFacilityLevel(label) {
  const m = (label||'').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

// Precompute "touches" cells for each facility — fzone rect cells (interior + perimeter all in one set).
// An alliance "touches" the facility if any of these cells is owned by that alliance.
const _facilityTouchData = PERMANENT_BUILDINGS.map((b, i) => {
  const fz = _permForbidRectsAll[i]; // {x1,y1,x2,y2} of forbidden zone
  const cells = new Set();
  // Include the fzone interior plus 1-cell perimeter outside it
  for (let x = Math.max(0, fz.x1 - 1); x <= Math.min(GRID_SIZE - 1, fz.x2); x++) {
    for (let y = Math.max(0, fz.y1 - 1); y <= Math.min(GRID_SIZE - 1, fz.y2); y++) {
      cells.add(x * 1200 + y);
    }
  }
  return { idx: i, label: b.label, category: b.category, level: _parseFacilityLevel(b.label), cells };
}).filter(f => f.level !== null && _facilityCategoryMap[f.category]);

const RESOURCE_PER_HOUR = 3600;

// Returns true if a label is a default/generic placeholder, not a real alliance name.
// These should be aggregated as "(Unlabeled)" rather than treated as real alliances.
function _isGenericLabel(lbl) {
  if (!lbl) return true;
  const t = lbl.trim();
  if (!t) return true;
  // Default labels from BUILDING_DEFS for territory-bearing types
  if (t === 'Banner' || t === 'Alliance HQ') return true;
  if (t === '깃발' || t === '연맹 본부') return true; // Korean defaults (display-name inputs)
  return false;
}

function computeAllianceSummary() {
  // Build cell→label ownership map (Map<cellInt, label>)
  const ownerMap = buildOwnershipMap(buildings);
  const summary = {}; // label → entry
  function _ensure(lbl) {
    if (!summary[lbl]) summary[lbl] = {
      label: lbl, hqCount: 0, bannerCount: 0, validBannerCount: 0, orphanBannerCount: 0,
      cityCount: 0, biggestCityClusterCount: 0,
      hqOverLimit: false, bannerOverLimit: false,
      hqsByZone: {},
      resources: { bread:0, woodmill:0, quarry:0, ironmine:0 },
      bonuses: {},
      facilitiesTouched: [],
    };
    return summary[lbl];
  }
  function _key(lbl) {
    return _isGenericLabel(lbl) ? '(Unlabeled)' : lbl.trim();
  }

  // Tally HQs and banners (with orphan split). Cities are NOT counted by
  // label here — city labels are player names, not alliance tags, so doing
  // so would create one summary entry per player. Cities are attributed to
  // alliances below via territory ownership (same heuristic as resources).
  for (const b of buildings) {
    if (b._canonical) continue;
    if (b.type === 'banner') {
      const e = _ensure(_key(b.label));
      e.bannerCount++;
      if (b._orphan) e.orphanBannerCount++; else e.validBannerCount++;
      if (b._overLimit) e.bannerOverLimit = true;
    } else if (b.type === 'hq') {
      const e = _ensure(_key(b.label));
      e.hqCount++;
      const def = BUILDING_DEFS.hq;
      const z = _zoneAt(b.gx + Math.floor(def.size/2), b.gy + Math.floor(def.size/2));
      e.hqsByZone[z] = (e.hqsByZone[z] || 0) + 1;
      if (b._overLimit) e.hqOverLimit = true;
    }
  }

  // City attribution by ownership: a city is "in" alliance X if ≥3 of its 4
  // cells are owned by X — orphan cells INCLUDED, so the count matches the
  // visual "this is X's territory" semantics on the map (territory is shown
  // for orphan banners too, just with different styling). Only increments
  // existing summary entries — does NOT create new ones, so we never get
  // one row per player-name city label.
  for (const b of buildings) {
    if (b._canonical) continue;
    if (b.type !== 'city') continue;
    const def = BUILDING_DEFS.city;
    const cellOwners = {};
    for (let x = b.gx; x < b.gx + def.size; x++) {
      for (let y = b.gy; y < b.gy + def.size; y++) {
        const cellInt = x * 1200 + y;
        const owner = ownerMap.get(cellInt);
        if (owner && !_isGenericLabel(owner)) {
          const k = owner.trim();
          cellOwners[k] = (cellOwners[k] || 0) + 1;
        }
      }
    }
    for (const [lbl, count] of Object.entries(cellOwners)) {
      if (count >= 3 && summary[lbl]) {
        summary[lbl].cityCount++;
        break;
      }
    }
  }

  // Biggest-city-cluster count per alliance — used to gate the "View Hive
  // Plan" button. Skips alliances with <10 cities cheaply. Reuses the
  // ownership map already built above so HiveView doesn't recompute.
  if (window.HiveView && typeof HiveView.biggestCityClusterFor === 'function') {
    for (const lbl of Object.keys(summary)) {
      if (lbl === '(Unlabeled)') continue;
      const e = summary[lbl];
      if (e.cityCount < 10) continue;
      e.biggestCityClusterCount = HiveView.biggestCityClusterFor(lbl, ownerMap);
    }
  }

  // Resource gathering: for each resource node, check ownership of ≥3 of 4 cells
  // Skip cells that are owned by orphan banners (those don't produce)
  for (const b of buildings) {
    const def = BUILDING_DEFS[b.type];
    if (!def) continue;
    const isResType = (b.type === 'resource' || RESOURCE_SUBTYPES.includes(b.type));
    if (!isResType) continue;
    const cellOwners = {};
    for (let x = b.gx; x < b.gx + def.size; x++) {
      for (let y = b.gy; y < b.gy + def.size; y++) {
        const cellInt = x * 1200 + y;
        if (_currentOrphanCells.has(cellInt)) continue; // skip orphan cells
        const owner = ownerMap.get(cellInt);
        if (owner && !_isGenericLabel(owner)) {
          const k = owner.trim();
          cellOwners[k] = (cellOwners[k] || 0) + 1;
        }
      }
    }
    for (const [lbl, count] of Object.entries(cellOwners)) {
      if (count >= 3) {
        const e = _ensure(lbl);
        const resKey = (b.type === 'resource') ? 'bread' : b.type;
        if (e.resources[resKey] !== undefined) e.resources[resKey] += RESOURCE_PER_HOUR;
        break;
      }
    }
  }

  // Outpost adjacency — skip cells owned by orphan banners
  for (const f of _facilityTouchData) {
    const touchedBy = new Set();
    for (const ci of f.cells) {
      if (_currentOrphanCells.has(ci)) continue;
      const owner = ownerMap.get(ci);
      if (owner && !_isGenericLabel(owner)) touchedBy.add(owner.trim());
    }
    if (!touchedBy.size) continue;
    const bonusInfo = FACILITY_BONUSES[_facilityCategoryMap[f.category]]?.[f.level];
    if (!bonusInfo) continue;
    for (const lbl of touchedBy) {
      const e = _ensure(lbl);
      e.facilitiesTouched.push({ label: f.label, level: f.level, stat: bonusInfo.stat, pct: bonusInfo.pct });
      const dedupKey = f.category + '|' + f.level;
      if (!e.bonuses[bonusInfo.stat]) e.bonuses[bonusInfo.stat] = { pct: 0, seen: new Set() };
      if (!e.bonuses[bonusInfo.stat].seen.has(dedupKey)) {
        e.bonuses[bonusInfo.stat].pct += bonusInfo.pct;
        e.bonuses[bonusInfo.stat].seen.add(dedupKey);
      }
    }
  }

  // Convert to sorted array, (Unlabeled) last
  const arr = Object.values(summary).sort((a, b) => {
    if (a.label === '(Unlabeled)') return 1;
    if (b.label === '(Unlabeled)') return -1;
    return a.label.localeCompare(b.label);
  });
  return arr;
}

function openAllianceSummary() {
  const modal = _el('allianceSummaryModal');
  if (!modal) { alert('연맹 요약을 사용할 수 없습니다 — 이 페이지에 모달 요소가 없습니다.'); return; }
  _renderAllianceSummary();
  modal.classList.add('open');
}
function closeAllianceSummary() {
  const modal = _el('allianceSummaryModal');
  if (modal) modal.classList.remove('open');
}

function _renderAllianceSummary() {
  const container = _el('allianceSummaryContent');
  if (!container) return;
  const data = computeAllianceSummary();
  if (!data.length) {
    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px">지도에 아직 연맹이 없습니다. 먼저 깃발이나 본부를 배치하세요!</p>';
    return;
  }
  const rows = data.map(e => {
    const warnings = [];
    if (e.bannerCount > 285) warnings.push(`⚠ 깃발 ${e.bannerCount}/285 (한도 초과)`);
    if (e.hqCount > 2) warnings.push(`⚠ 본부 ${e.hqCount}/2 (한도 초과)`);
    for (const [z, c] of Object.entries(e.hqsByZone)) {
      if (c > 1) warnings.push(`⚠ ${koName(z)}에 본부 ${c}개`);
    }
    if (e.bannerOverLimit) warnings.push('⚠ 깃발 한도 초과 배치됨');
    if (e.hqOverLimit) warnings.push('⚠ 본부 한도 초과 배치됨');
    if (e.orphanBannerCount > 0) warnings.push(`⚠ 무효 깃발 ${e.orphanBannerCount}개 (본부와 연결 끊김)`);

    const resHtml = Object.entries(e.resources)
      .filter(([_,v]) => v > 0)
      .map(([k,v]) => `<div><span style="color:var(--text-dim)">${koName(RES_SUBTYPE_LABELS[k]||k)}:</span> +${v.toLocaleString()}/시간</div>`)
      .join('') || '<div style="color:var(--text-dim)">없음</div>';

    const bonusHtml = Object.entries(e.bonuses)
      .map(([stat,info]) => `<div><span style="color:var(--text-dim)">${koName(stat)}:</span> +${info.pct}%</div>`)
      .join('') || '<div style="color:var(--text-dim)">없음</div>';

    const warnHtml = warnings.length
      ? `<div style="color:var(--red);font-size:0.85rem;margin-top:6px">${warnings.join('<br>')}</div>`
      : '';

    const bannerLine = e.orphanBannerCount > 0
      ? `깃발 ${e.bannerCount} (유효 ${e.validBannerCount} · 무효 ${e.orphanBannerCount})`
      : `깃발 ${e.bannerCount}`;
    const cityLine = e.cityCount > 0
      ? ` · 도시 ${e.cityCount}`
      : '';

    const tagArg = _escHtml(e.label).replace(/'/g, "\\'");
    const showHiveBtn   = e.label !== '(Unlabeled)' && e.biggestCityClusterCount >= 10;
    const showExportBtn = e.label !== '(Unlabeled)' && e.cityCount > 0;
    const hiveBtnHtml = showHiveBtn
      ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:0.8rem;white-space:nowrap"
          onclick="openHiveViewForAlliance('${tagArg}')">하이브 계획</button>`
      : '';
    const exportBtnHtml = showExportBtn
      ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:0.8rem;white-space:nowrap"
          onclick="openCityExport('${tagArg}')">도시 내보내기</button>`
      : '';

    return `<div style="border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px;background:var(--bg)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <strong style="font-size:1.1rem;color:var(--gold)">${_escHtml(koName(e.label))}</strong>
          ${hiveBtnHtml}
          ${exportBtnHtml}
        </div>
        <span style="color:var(--text-dim);font-size:0.85rem">본부 ${e.hqCount} · ${bannerLine}${cityLine}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.9rem">
        <div><strong>시간당 자원</strong>${resHtml}</div>
        <div><strong>보너스</strong>${bonusHtml}</div>
      </div>
      ${warnHtml}
    </div>`;
  }).join('');
  container.innerHTML = rows;
}

async function fetchAndMergeCanonical() {
  try {
    // ?game= is interpreted by the worker; absence (and 'kingshot') maps to the
    // legacy 'resource-nodes' KV key so existing data and old clients keep working.
    const resp = await fetch(WORKER_URL + '/resources?game=' + encodeURIComponent(_activeGame));
    if (!resp.ok) return;
    const data = await resp.json();
    _canonicalResources = data.nodes || [];
    if (!_canonicalResources.length) return;
    const canonSet = new Set(_canonicalResources.map(n => `${n.x},${n.y}`));
    // Strip user buildings at canonical coords (canonical wins)
    buildings = buildings.filter(b => {
      if (b._canonical) return false; // remove stale canonical, will be re-added
      const def = BUILDING_DEFS[b.type];
      if (!def) return true;
      for (let x = b.gx; x < b.gx + def.size; x++)
        for (let y = b.gy; y < b.gy + def.size; y++)
          if (canonSet.has(`${x},${y}`)) return false;
      return true;
    });
    _reinjectCanonical();
    // Always invalidate + redraw after merging — old saved maps may have had
    // stale _canonical entries that got swapped without changing the count.
    saveToStorage(); invalidateTset(); invalidateBuildings();
    updatePlacedList(); draw();
  } catch(e) { /* silently fail */ }
}

function resizeCanvas() {
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  _gridDirty = _bldgDirty = true;
  draw();
}

function resetView() {
  const dw = GRID_SIZE * CELL;
  camScale = Math.min(canvas.width, canvas.height) / (dw * 1.05);
  camX = 0; camY = 0;
  updateZoomDisplay();
  draw();
}

// Fit camera so the grid-space rectangle (x1,y1)-(x2,y2) fills the viewport
// with margin. Used by HiveView to focus on an alliance's hive bbox.
function fitCameraToBbox(x1, y1, x2, y2) {
  if (!canvas) return;
  // Bbox in iso space is a diamond — project all four corners and take the
  // axis-aligned bounding box of those screen points.
  const corners = [
    gridToIso(x1, y1),
    gridToIso(x2, y1),
    gridToIso(x2, y2),
    gridToIso(x1, y2),
  ];
  let ixMin = Infinity, ixMax = -Infinity, iyMin = Infinity, iyMax = -Infinity;
  for (const p of corners) {
    if (p.ix < ixMin) ixMin = p.ix;
    if (p.ix > ixMax) ixMax = p.ix;
    if (p.iy < iyMin) iyMin = p.iy;
    if (p.iy > iyMax) iyMax = p.iy;
  }
  const w = ixMax - ixMin;
  const h = iyMax - iyMin;
  const margin = 1.1; // 10% breathing room
  const sx = canvas.width  / (w * margin);
  const sy = canvas.height / (h * margin);
  camScale = Math.max(0.03, Math.min(8, Math.min(sx, sy)));
  // Center the bbox: solve isoToScreen(centerIx, centerIy) = canvas center.
  const cIx = (ixMin + ixMax) / 2;
  const cIy = (iyMin + iyMax) / 2;
  camX = -cIx;
  camY = -cIy;
  updateZoomDisplay();
  scheduleDraw();
}

// Thin wrapper invoked by the Alliance Summary "View Hive Plan" button.
function openHiveViewForAlliance(tag) {
  if (window.HiveView && typeof HiveView.open === 'function') {
    closeAllianceSummary();
    HiveView.open(tag);
  }
}
window.openHiveViewForAlliance = openHiveViewForAlliance;


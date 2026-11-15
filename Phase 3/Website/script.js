/* =========================================================================
   Virtual City Simulator — script.js
   Browser version of the C++ console project. Plain ES6, no libraries.

   File layout
     1.  Constants
     2.  Central simulation state (create / save / load / reset)
     3.  Road network: intersections, roads, adjacency list, capacity
     4.  Buildings and population
     5.  Min-priority queue (binary heap) + Dijkstra's algorithm
     6.  Traffic signals (70-second cycle)
     7.  Vehicle management
     8.  Simulation engine (one-second ticks, ambulance priority, FIFO)
     9.  City management: water, electricity, budget
     10. Formatting helpers
     11. User interface: navigation, toasts, dropdowns
     12. City map (SVG)
     13. Page renderers
     14. Form handlers and simulation controls
     15. Start-up
   ========================================================================= */

'use strict';

/* =========================================================================
   1. CONSTANTS  (same values as the C++ program)
   ========================================================================= */
const MAX_INTERSECTIONS = 100;          // C++: MAX
const MAX_BUILDINGS = 100;              // C++: MAX (buildings array)
const MAX_VEHICLES = 200;               // C++: MAXV
const ROAD_CAPACITY = 3;                // vehicles per direction
const SIGNAL_CYCLE = 70;                // seconds
const MAX_ADVANCE_SECONDS = 3600;       // custom advance limit
const SECONDS_PER_DAY = 86400;
const INITIAL_BUDGET = 500000;
const INITIAL_WATER_SUPPLY = 10000;     // litres/day
const INITIAL_ELECTRICITY_SUPPLY = 5000; // kWh/day
const VEHICLE_SPEEDS = { Car: 10, Ambulance: 15, DeliveryBike: 6 }; // m/s
const BUILDING_TYPES = ['House', 'Hospital', 'Restaurant'];
const DEPARTMENTS = ['Roads', 'Water', 'Electricity', 'Healthcare', 'Traffic'];
const STORAGE_KEY = 'virtualCitySimulator.v1';
const LOG_LIMIT = 300;

// Map canvas size (SVG viewBox units)
const MAP_W = 1000;
const MAP_H = 620;

/* =========================================================================
   2. CENTRAL SIMULATION STATE
   One object holds everything. Every page reads from it, so all pages
   always show the same numbers.
   ========================================================================= */
let state = null;

/** Builds an empty city with n intersections (C++: RoadNetwork(int n)). */
function createEmptyState(n) {
  return {
    intersections: n,                 // ids are 0 .. n-1
    positions: [],                    // map coordinates for each intersection
    adjacencyList: [],                // adjacencyList[i] = [{ to, length }, ...]
    roadCapacity: {},                 // key "a>b" -> capacity in direction a -> b
    roadOccupancy: {},                // key "a>b" -> vehicles on road a -> b
    buildings: [],                    // { id, type, intersection, population }
    vehicles: [],                     // see createVehicle()
    currentTime: 0,                   // simulation clock in seconds
    waterSupply: INITIAL_WATER_SUPPLY,
    electricitySupply: INITIAL_ELECTRICITY_SUPPLY,
    waterConsumed: 0,
    electricityConsumed: 0,
    remainingBudget: INITIAL_BUDGET,
    totalSpent: 0,
    allocations: [],                  // { department, amount, time }
    log: [],                          // { time, kind, text }  (like the C++ console messages)
    highlight: null                   // { route: [...], kind } route drawn on the map
  };
}

/** Recreates exactly the starting city from the C++ main() function. */
function createInitialState() {
  state = createEmptyState(5);
  state.positions = [
    { x: 110, y: 330 },   // I0
    { x: 370, y: 150 },   // I1
    { x: 640, y: 170 },   // I2
    { x: 520, y: 470 },   // I3
    { x: 860, y: 400 }    // I4
  ];
  for (let i = 0; i < state.intersections; i++) state.adjacencyList[i] = [];

  addRoad(0, 1, 100);
  addRoad(1, 2, 80);
  addRoad(2, 3, 100);
  addRoad(3, 4, 80);
  addRoad(4, 2, 90);
  addRoad(1, 3, 120);

  addBuilding('H1', 'House', 0, 4);
  addBuilding('H2', 'House', 4, 3);
  addBuilding('Hospital1', 'Hospital', 1, 0);
  addBuilding('Restaurant1', 'Restaurant', 3, 0);

  addLog('info', 'Virtual City Simulator initialized.');
  return state;
}

/** Saves the whole state to localStorage. */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Storage may be full or blocked (private mode). The simulation keeps working in memory.
  }
}

/** Loads the saved state. Returns true when a valid saved city was found. */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!isValidSavedState(saved)) return false;
    state = Object.assign(createEmptyState(saved.intersections), saved);
    return true;
  } catch (e) {
    return false;
  }
}

/** Basic shape check so a damaged save cannot break the simulator. */
function isValidSavedState(s) {
  return s && Number.isInteger(s.intersections) &&
    s.intersections >= 0 && s.intersections <= MAX_INTERSECTIONS &&
    Array.isArray(s.adjacencyList) && s.adjacencyList.length === s.intersections &&
    Array.isArray(s.positions) && s.positions.length === s.intersections &&
    Array.isArray(s.buildings) && Array.isArray(s.vehicles) &&
    typeof s.roadCapacity === 'object' && typeof s.roadOccupancy === 'object' &&
    typeof s.currentTime === 'number';
}

/** Puts the city back to the original configuration. */
function resetSimulation() {
  createInitialState();
  saveState();
}

/* =========================================================================
   3. ROAD NETWORK (C++ class RoadNetwork)
   ========================================================================= */

/** Key used for the per-direction capacity and occupancy counters. */
function roadKey(from, to) {
  return from + '>' + to;
}

/** C++: valid(id) */
function isValidIntersection(id) {
  return Number.isInteger(id) && id >= 0 && id < state.intersections;
}

/** C++: addIntersection(). Returns the new id, or -1 at the limit. */
function addIntersection() {
  if (state.intersections >= MAX_INTERSECTIONS) return -1;
  const id = state.intersections;
  state.intersections++;
  state.adjacencyList[id] = [];
  state.positions[id] = findFreeMapPosition();
  return id;
}

/** C++: addRoad(a, b, length). Returns { ok, error }. */
function addRoad(a, b, length) {
  if (!isValidIntersection(a) || !isValidIntersection(b)) return { ok: false, error: 'Both intersections must exist.' };
  if (a === b) return { ok: false, error: 'Starting and ending intersections cannot be the same.' };
  if (!(typeof length === 'number' && isFinite(length) && length > 0)) return { ok: false, error: 'Road length must be greater than zero.' };

  // Check whether a road already connects a and b.
  for (const road of state.adjacencyList[a]) {
    if (road.to === b) return { ok: false, error: 'A road between I' + a + ' and I' + b + ' already exists.' };
  }

  // Roads are bidirectional, so store the connection both ways.
  state.adjacencyList[a].push({ to: b, length: length });
  state.adjacencyList[b].push({ to: a, length: length });

  // Capacity is tracked separately for each travel direction.
  state.roadCapacity[roadKey(a, b)] = ROAD_CAPACITY;
  state.roadCapacity[roadKey(b, a)] = ROAD_CAPACITY;
  state.roadOccupancy[roadKey(a, b)] = 0;
  state.roadOccupancy[roadKey(b, a)] = 0;
  return { ok: true };
}

/** Length of the road from -> to, or 0 if there is no such road. */
function getRoadLength(from, to) {
  if (!isValidIntersection(from)) return 0;
  for (const road of state.adjacencyList[from]) {
    if (road.to === to) return road.length;
  }
  return 0;
}

function getCapacity(from, to) { return state.roadCapacity[roadKey(from, to)] || 0; }
function getOccupancy(from, to) { return state.roadOccupancy[roadKey(from, to)] || 0; }

/** C++: canEnterRoad(from, to) */
function canEnterRoad(from, to) {
  return isValidIntersection(from) && isValidIntersection(to) &&
    getCapacity(from, to) > 0 &&
    getOccupancy(from, to) < getCapacity(from, to);
}

/** C++: enterRoad(from, to) */
function enterRoad(from, to) {
  if (isValidIntersection(from) && isValidIntersection(to)) {
    state.roadOccupancy[roadKey(from, to)] = getOccupancy(from, to) + 1;
  }
}

/** C++: leaveRoad(from, to) */
function leaveRoad(from, to) {
  if (isValidIntersection(from) && isValidIntersection(to) && getOccupancy(from, to) > 0) {
    state.roadOccupancy[roadKey(from, to)] = getOccupancy(from, to) - 1;
  }
}

/** Every road listed once, in the order it was added. */
function getAllRoads() {
  const seen = {};
  const roads = [];
  for (let a = 0; a < state.intersections; a++) {
    for (const road of state.adjacencyList[a]) {
      const b = road.to;
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      if (seen[key]) continue;
      seen[key] = true;
      roads.push({ a: a, b: b, length: road.length });
    }
  }
  return roads;
}

function countRoads() {
  let total = 0;
  for (let i = 0; i < state.intersections; i++) total += state.adjacencyList[i].length;
  return total / 2; // every road is stored twice
}

/* =========================================================================
   4. BUILDINGS AND POPULATION
   ========================================================================= */

/** C++: addBuilding(id, type, intersection, population). Returns { ok, error }. */
function addBuilding(id, type, intersection, population) {
  id = String(id || '').trim();
  if (!isValidIntersection(intersection)) return { ok: false, error: 'Intersection must exist.' };
  if (state.buildings.length >= MAX_BUILDINGS) return { ok: false, error: 'Maximum of ' + MAX_BUILDINGS + ' buildings reached.' };
  if (id === '') return { ok: false, error: 'Building ID cannot be empty.' };
  if (/\s/.test(id)) return { ok: false, error: 'Building ID cannot contain spaces.' };
  if (!Number.isInteger(population) || population < 0) return { ok: false, error: 'Population must be a whole number, 0 or more.' };
  if (BUILDING_TYPES.indexOf(type) === -1) return { ok: false, error: 'Type must be House, Hospital or Restaurant.' };

  for (const b of state.buildings) {
    if (b.id === id) return { ok: false, error: 'Building ID "' + id + '" already exists.' };
  }

  // Only houses can have population.
  if (type !== 'House') population = 0;

  state.buildings.push({ id: id, type: type, intersection: intersection, population: population });
  return { ok: true };
}

/** C++: hasBuilding(intersection, type) */
function hasBuilding(intersection, type) {
  return state.buildings.some(b => b.intersection === intersection && b.type === type);
}

function getBuildingsAt(intersection) {
  return state.buildings.filter(b => b.intersection === intersection);
}

function getBuildingsOfType(type) {
  return state.buildings.filter(b => b.type === type);
}

/** Sum of all house populations (C++: displayPopulation). */
function getTotalPopulation() {
  let total = 0;
  for (const b of state.buildings) if (b.type === 'House') total += b.population;
  return total;
}

/* =========================================================================
   5. MIN-PRIORITY QUEUE + DIJKSTRA
   ========================================================================= */

/**
 * Binary-heap min-priority queue of { dist, node } items.
 * Ordered like C++ priority_queue<pair<double,int>, ..., greater<>>:
 * smallest distance first, and on a tie the smaller intersection id first.
 */
class MinPriorityQueue {
  constructor() { this.heap = []; }

  size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }

  static less(x, y) {
    return x.dist !== y.dist ? x.dist < y.dist : x.node < y.node;
  }

  push(item) {
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {                               // bubble up
      const parent = (i - 1) >> 1;
      if (!MinPriorityQueue.less(h[i], h[parent])) break;
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
    }
  }

  pop() {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      while (true) {                              // sink down
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < h.length && MinPriorityQueue.less(h[l], h[smallest])) smallest = l;
        if (r < h.length && MinPriorityQueue.less(h[r], h[smallest])) smallest = r;
        if (smallest === i) break;
        [h[i], h[smallest]] = [h[smallest], h[i]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Dijkstra's shortest path (C++: shortestPath).
 * Edge weight = road length. Ignores traffic, signals, speed and occupancy.
 * Returns { found, path, distance, dist, parent }.
 */
function dijkstra(source, destination) {
  const n = state.intersections;
  const dist = new Array(n).fill(Infinity);   // 1. distance array, 3. all infinite
  const parent = new Array(n).fill(-1);       // 2. parent array
  const empty = { found: false, path: [], distance: 0, dist: dist, parent: parent };

  if (!isValidIntersection(source) || !isValidIntersection(destination)) return empty;

  const pq = new MinPriorityQueue();          // 5. min-priority queue
  dist[source] = 0;                           // 4. source distance = 0
  pq.push({ dist: 0, node: source });

  while (!pq.isEmpty()) {
    const { dist: currentDist, node: u } = pq.pop();
    if (currentDist > dist[u]) continue;      // ignore an outdated queue entry

    for (const road of state.adjacencyList[u]) {  // 6. relax neighbouring edges
      const v = road.to;
      const newDist = dist[u] + road.length;
      if (newDist < dist[v]) {
        dist[v] = newDist;
        parent[v] = u;
        pq.push({ dist: newDist, node: v });
      }
    }
  }

  if (dist[destination] === Infinity) return empty;

  // 7. rebuild the path backwards with parent[], then reverse it
  const path = [];
  for (let at = destination; at !== -1; at = parent[at]) path.push(at);
  path.reverse();

  return { found: true, path: path, distance: dist[destination], dist: dist, parent: parent };
}

/** Total length of a route by adding up its road lengths. */
function routeDistance(route) {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += getRoadLength(route[i - 1], route[i]);
  return total;
}

/* =========================================================================
   6. TRAFFIC SIGNALS  (C++: signalAllows / signalState)
   Simplified model: the signal depends only on the parity of the
   DESTINATION intersection id of the road being entered.
   ========================================================================= */

/** True when a vehicle may enter a road towards `next` at `time`. */
function signalAllows(next, time) {
  const phase = time % SIGNAL_CYCLE;
  const greenGroup = phase < 35 ? 0 : 1;
  return (phase % 35) < 30 && (next % 2 === greenGroup);
}

/** GREEN / YELLOW / RED for roads leading to `next` at `time`. */
function signalState(next, time) {
  const phase = time % SIGNAL_CYCLE;
  if (next % 2 === 0) {
    if (phase < 30) return 'GREEN';
    if (phase < 35) return 'YELLOW';
    return 'RED';
  }
  if (phase >= 35 && phase < 65) return 'GREEN';
  if (phase >= 65) return 'YELLOW';
  return 'RED';
}

/* =========================================================================
   7. VEHICLE MANAGEMENT  (C++ class VehicleManager)
   ========================================================================= */

/**
 * C++: create(type, start, destination, parked, city).
 * `service` is only a label for the UI ('manual', 'ambulance', 'delivery').
 * Returns { ok, vehicle } or { ok: false, error }.
 */
function createVehicle(type, start, destination, parked, service) {
  if (state.vehicles.length >= MAX_VEHICLES) return { ok: false, error: 'Vehicle limit of ' + MAX_VEHICLES + ' reached.' };
  if (!VEHICLE_SPEEDS[type]) return { ok: false, error: 'Invalid vehicle type.' };
  if (!isValidIntersection(start)) return { ok: false, error: 'Invalid starting intersection.' };
  if (type === 'Ambulance' && !hasBuilding(start, 'Hospital')) return { ok: false, error: 'Ambulance must start at an intersection with a Hospital.' };
  if (type === 'DeliveryBike' && !hasBuilding(start, 'Restaurant')) return { ok: false, error: 'DeliveryBike must start at an intersection with a Restaurant.' };

  let route = [];
  if (!parked) {
    if (!isValidIntersection(destination)) return { ok: false, error: 'Invalid destination.' };
    if (type === 'DeliveryBike' && !hasBuilding(destination, 'House')) return { ok: false, error: 'Food delivery destination must contain a House.' };
    const result = dijkstra(start, destination);
    if (!result.found) return { ok: false, error: 'No route exists from I' + start + ' to I' + destination + '.' };
    route = result.path;
  }

  const vehicle = {
    id: state.vehicles.length + 1,
    type: type,
    current: start,
    destination: parked ? -1 : destination,
    route: route,
    nextIndex: 1,
    speed: VEHICLE_SPEEDS[type],
    distance: 0,          // progress on the current road (m)
    totalDistance: 0,     // total distance travelled (m)
    parked: parked,
    completed: !parked && start === destination,
    onRoad: false,
    waiting: false,
    service: service || 'manual',
    createdAt: state.currentTime,
    completedAt: (!parked && start === destination) ? state.currentTime : null
  };
  state.vehicles.push(vehicle);

  if (parked) {
    addLog('vehicle', type + ' V' + vehicle.id + ' parked at I' + start + '.');
  } else {
    addLog(service === 'ambulance' ? 'emergency' : service === 'delivery' ? 'delivery' : 'vehicle',
      type + ' V' + vehicle.id + ' created. Route: ' + formatRoute(route) +
      (vehicle.completed ? ' (already at destination)' : '') + '.');
  }
  return { ok: true, vehicle: vehicle };
}

/** Status text exactly as the C++ displayStatus() decides it. */
function getVehicleStatus(v) {
  if (v.parked) return 'PARKED';
  if (v.completed) return 'COMPLETED';
  if (v.waiting) return 'WAITING';
  return 'MOVING';
}

/** Next intersection on the vehicle's route, or null. */
function getNextIntersection(v) {
  if (v.parked || v.completed || v.nextIndex >= v.route.length) return null;
  return v.route[v.nextIndex];
}

function countVehicles(filterFn) {
  return state.vehicles.filter(filterFn || (() => true)).length;
}

/** Vehicle counts used by the dashboard and reports. */
function getVehicleStats(list) {
  list = list || state.vehicles;
  const s = { total: list.length, active: 0, moving: 0, waiting: 0, parked: 0, completed: 0 };
  for (const v of list) {
    const st = getVehicleStatus(v);
    if (st === 'PARKED') s.parked++;
    else if (st === 'COMPLETED') s.completed++;
    else {
      s.active++;
      if (st === 'WAITING') s.waiting++; else s.moving++;
    }
  }
  return s;
}

/* =========================================================================
   8. SIMULATION ENGINE  (C++: VehicleManager::advance)
   ========================================================================= */

/**
 * Builds the processing order for one tick.
 * Ambulances: priority queue (all priority 3; lower vehicle index first,
 * like C++ pushing {3, -i} into a max-heap). Others: FIFO queue.
 */
function buildProcessingOrder() {
  const emergencyQueue = [];
  const normalQueue = [];
  for (let i = 0; i < state.vehicles.length; i++) {
    const v = state.vehicles[i];
    if (v.parked || v.completed) continue;
    if (v.type === 'Ambulance') emergencyQueue.push({ priority: 3, index: i });
    else normalQueue.push(i);
  }
  // Priority queue order: higher priority first, then lower index first.
  emergencyQueue.sort((x, y) => (y.priority - x.priority) || (x.index - y.index));
  return emergencyQueue.map(e => e.index).concat(normalQueue);
}

/** Moves the whole simulation forward by exactly one second. */
function simulateOneSecond() {
  state.currentTime++;                                     // 1. increment time
  const order = buildProcessingOrder();                    // 2. emergency + normal queues

  for (const i of order) {                                 // 3. process in priority order
    const v = state.vehicles[i];
    if (v.parked || v.completed) continue;

    const next = v.route[v.nextIndex];                     // 4. next intersection on route
    const length = getRoadLength(v.current, next);         // 5. road length

    if (length <= 0) {                                     // no road (defensive, as in C++)
      v.completed = true;
      v.completedAt = state.currentTime;
      continue;
    }

    // A vehicle enters a road only when the signal and capacity both allow it.
    if (!v.onRoad) {
      if (!signalAllows(next, state.currentTime)) {        // 6. signal check
        v.waiting = true;
        continue;
      }
      if (!canEnterRoad(v.current, next)) {                // 7. capacity check
        v.waiting = true;
        continue;
      }
      enterRoad(v.current, next);                          // 8. enter road, occupancy + 1
      v.onRoad = true;
      v.waiting = false;
    }

    const remaining = length - v.distance;
    const movement = v.speed;                              // 9. move by speed for 1 second

    if (movement >= remaining) {                           // 11. reached next intersection
      v.totalDistance += remaining;                        // 10. distance travelled
      v.distance = 0;
      leaveRoad(v.current, next);                          //     occupancy - 1
      v.onRoad = false;
      v.current = next;                                    // 12. update position and index
      v.nextIndex++;
      addLog(logKindFor(v), 'V' + v.id + ' reached I' + next + ' at ' + state.currentTime + ' seconds.');

      if (v.current === v.destination || v.nextIndex >= v.route.length) {  // 13. completed
        v.completed = true;
        v.completedAt = state.currentTime;
        addLog(logKindFor(v), 'V' + v.id + ' (' + v.type + ') journey completed at I' + v.current + '.');
      }
    } else {
      v.distance += movement;
      v.totalDistance += movement;
      v.waiting = false;
    }
  }
}

/**
 * Public advance function used by every button and by automatic mode.
 * C++ main(): vehicles.advance(seconds) then management.updateConsumption(seconds).
 */
function advanceSimulation(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_ADVANCE_SECONDS) {
    return { ok: false, error: 'Enter a whole number of seconds between 0 and ' + MAX_ADVANCE_SECONDS + '.' };
  }
  for (let t = 0; t < seconds; t++) simulateOneSecond();
  updateConsumption(seconds);
  return { ok: true };
}

function logKindFor(v) {
  return v.service === 'ambulance' || v.type === 'Ambulance' ? 'emergency'
    : v.service === 'delivery' || v.type === 'DeliveryBike' ? 'delivery' : 'vehicle';
}

function addLog(kind, text) {
  state.log.push({ time: state.currentTime, kind: kind, text: text });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

/* =========================================================================
   9. CITY MANAGEMENT  (C++ class CityManagement)
   ========================================================================= */

/** C++: calculateDemand(). Returns { water, electricity, population, hospitals, restaurants }. */
function calculateDemand() {
  let population = 0, hospitals = 0, restaurants = 0;
  for (const b of state.buildings) {
    if (b.type === 'House') population += b.population;
    else if (b.type === 'Hospital') hospitals++;
    else if (b.type === 'Restaurant') restaurants++;
  }
  return {
    population: population,
    hospitals: hospitals,
    restaurants: restaurants,
    water: population * 150 + hospitals * 500 + restaurants * 300,       // litres/day
    electricity: population * 2 + hospitals * 50 + restaurants * 30      // kWh/day
  };
}

/** C++: updateConsumption(city, seconds) */
function updateConsumption(seconds) {
  const d = calculateDemand();
  state.waterConsumed += d.water * seconds / SECONDS_PER_DAY;
  state.electricityConsumed += d.electricity * seconds / SECONDS_PER_DAY;
}

function setWaterSupply(value) {
  if (!(typeof value === 'number' && isFinite(value))) return { ok: false, error: 'Enter a valid number.' };
  if (value < 0) return { ok: false, error: 'Supply cannot be negative.' };
  state.waterSupply = value;
  return { ok: true };
}

function setElectricitySupply(value) {
  if (!(typeof value === 'number' && isFinite(value))) return { ok: false, error: 'Enter a valid number.' };
  if (value < 0) return { ok: false, error: 'Supply cannot be negative.' };
  state.electricitySupply = value;
  return { ok: true };
}

/** C++: allocateBudget(department, amount) */
function allocateBudget(department, amount) {
  if (!department || DEPARTMENTS.indexOf(department) === -1) return { ok: false, error: 'Select a department.' };
  if (!(typeof amount === 'number' && isFinite(amount) && amount > 0)) return { ok: false, error: 'Amount must be greater than zero.' };
  if (amount > state.remainingBudget) return { ok: false, error: 'Insufficient city budget. Remaining: ' + formatRupees(state.remainingBudget) + '.' };
  state.remainingBudget -= amount;
  state.totalSpent += amount;
  state.allocations.push({ department: department, amount: amount, time: state.currentTime });
  return { ok: true };
}

function getDepartmentTotals() {
  const totals = {};
  DEPARTMENTS.forEach(d => { totals[d] = 0; });
  for (const a of state.allocations) totals[a.department] = (totals[a.department] || 0) + a.amount;
  return totals;
}

/* =========================================================================
   10. FORMATTING HELPERS
   ========================================================================= */

/** Indian number grouping: 500000 -> 5,00,000 */
function formatIndian(n, decimals) {
  decimals = decimals || 0;
  const negative = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const parts = fixed.split('.');
  let intPart = parts[0];
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = rest + ',' + last3;
  }
  return (negative ? '-' : '') + intPart + (parts[1] ? '.' + parts[1] : '');
}

function formatRupees(n) {
  return '₹' + formatIndian(n, Number.isInteger(n) ? 0 : 2);
}

function formatNumber(n, decimals) {
  if (decimals === undefined) decimals = Number.isInteger(n) ? 0 : 2;
  return formatIndian(n, decimals);
}

function formatMetres(n) {
  return formatNumber(n, Number.isInteger(n) ? 0 : 1) + ' m';
}

function formatRoute(route) {
  return route.map(i => 'I' + i).join(' → ');
}

/** Escapes text before putting it into HTML. */
function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* =========================================================================
   11. USER INTERFACE BASICS
   ========================================================================= */
const $ = id => document.getElementById(id);

let activeSection = 'dashboard';
let selection = null;        // { kind: 'node'|'road'|'vehicle', ... } selected on the map
let lastPlan = null;         // last Dijkstra result shown on the planner page

function showSection(name) {
  activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === 'section-' + name));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  closeMobileNav();
  window.scrollTo({ top: 0 });
  renderAll();
}

function openMobileNav() {
  document.body.classList.add('nav-open');
  if (!$('navOverlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'navOverlay';
    overlay.addEventListener('click', closeMobileNav);
    document.body.appendChild(overlay);
  }
}

function closeMobileNav() {
  document.body.classList.remove('nav-open');
  const overlay = $('navOverlay');
  if (overlay) overlay.remove();
}

/** Small pop-up message in the corner. */
function toast(message, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.textContent = message;
  const area = $('toastArea');
  area.appendChild(el);
  while (area.children.length > 3) area.firstChild.remove();   // keep at most 3 on screen
  setTimeout(() => el.remove(), 3800);
}

/** Fills an intersection <select>, keeping the current choice when possible. */
function fillIntersectionSelect(select, ids, placeholder) {
  const previous = select.value;
  ids = ids || Array.from({ length: state.intersections }, (_, i) => i);
  let html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
  html += ids.map(i => '<option value="' + i + '">I' + i + '</option>').join('');
  select.innerHTML = html;
  if ([...select.options].some(o => o.value === previous)) select.value = previous;
}

/** Fills a <select> with buildings of one type; option value = building id. */
function fillBuildingSelect(select, type) {
  const previous = select.value;
  const list = getBuildingsOfType(type);
  select.innerHTML = list.length
    ? list.map(b => '<option value="' + esc(b.id) + '">' + esc(b.id) + ' (at I' + b.intersection + ')</option>').join('')
    : '<option value="">No ' + type.toLowerCase() + ' registered</option>';
  if ([...select.options].some(o => o.value === previous)) select.value = previous;
}

function refreshDropdowns() {
  ['mapRoadFrom', 'mapRoadTo', 'roadFrom', 'roadTo', 'buildingIntersection',
    'vehicleStart', 'vehicleDest', 'ambAccident', 'planSource', 'planDest'].forEach(id => fillIntersectionSelect($(id)));
  fillBuildingSelect($('ambHospital'), 'Hospital');
  fillBuildingSelect($('delRestaurant'), 'Restaurant');
  fillBuildingSelect($('delHouse'), 'House');
}

/** Small helpers that build repeated HTML. */
function kpi(label, value, sub, tone) {
  return '<div class="kpi ' + (tone || '') + '"><div class="kpi-label">' + esc(label) + '</div>' +
    '<div class="kpi-value">' + value + '</div>' + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
}

function statLine(label, value) {
  return '<div class="stat-line"><span>' + label + '</span><b>' + value + '</b></div>';
}

function barRow(label, value, max, valueText, tone) {
  const pct = max > 0 ? Math.min(100, value / max * 100) : 0;
  return '<div class="bar-row"><span>' + label + '</span><div class="bar ' + (tone || '') + '"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
    '<span class="bar-value">' + valueText + '</span></div>';
}

function badge(text, cls) {
  return '<span class="badge ' + (cls || text) + '">' + esc(text) + '</span>';
}

function occupancyHtml(from, to) {
  const occ = getOccupancy(from, to);
  const cap = getCapacity(from, to);
  const cls = occ >= cap ? 'full' : occ > 0 ? 'busy' : '';
  return '<span class="occ ' + cls + '">' + occ + ' / ' + cap + '</span>';
}

function table(headers, rows, emptyText) {
  const head = '<thead><tr>' + headers.map(h => '<th class="' + (h.num ? 'num' : '') + '">' + esc(h.label || h) + '</th>').join('') + '</tr></thead>';
  const body = rows.length
    ? rows.map(r => '<tr>' + r.map((c, i) => '<td class="' + (headers[i].num ? 'num' : '') + '">' + c + '</td>').join('') + '</tr>').join('')
    : '<tr class="empty-row"><td colspan="' + headers.length + '">' + esc(emptyText || 'Nothing to show yet.') + '</td></tr>';
  return head + '<tbody>' + body + '</tbody>';
}

function resultBox(html, ok) {
  return '<div class="result ' + (ok ? 'ok' : 'err') + '">' + html + '</div>';
}

function routeChips(route) {
  return '<div class="route-chips">' + route.map((n, i) =>
    (i ? '<span class="chip-arrow">→</span>' : '') + '<span class="chip">I' + n + '</span>').join('') + '</div>';
}

/* =========================================================================
   12. CITY MAP (SVG built by JavaScript from the real graph)
   ========================================================================= */
const SVG_NS = 'http://www.w3.org/2000/svg';
const vehicleLayers = new WeakMap();   // svg -> Map(vehicleId -> <g>) so vehicles can glide

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}

/** Picks a free spot for a new intersection: the grid point furthest from existing ones. */
function findFreeMapPosition() {
  let best = { x: MAP_W / 2, y: MAP_H / 2 };
  let bestScore = -1;
  for (let x = 80; x <= MAP_W - 80; x += 60) {
    for (let y = 70; y <= MAP_H - 70; y += 60) {
      let minDist = Infinity;
      for (const p of state.positions) {
        if (!p) continue;
        minDist = Math.min(minDist, Math.hypot(p.x - x, p.y - y));
      }
      if (minDist > bestScore) { bestScore = minDist; best = { x: x, y: y }; }
    }
  }
  return best;
}

/** Position of a vehicle on the map, derived only from simulation state. */
function vehiclePosition(v, slot) {
  const a = state.positions[v.current];
  const next = getNextIntersection(v);
  if (v.onRoad && next !== null) {
    const b = state.positions[next];
    const length = getRoadLength(v.current, next);
    const t = length > 0 ? v.distance / length : 0;
    // Keep each direction on its own side of the road.
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = -dy / len * 9, oy = dx / len * 9;
    return { x: a.x + dx * t + ox, y: a.y + dy * t + oy };
  }
  // At an intersection: spread vehicles in a small ring so they do not overlap.
  const angle = -Math.PI / 4 + slot * 0.9;
  const r = 34 + Math.floor(slot / 7) * 14;
  return { x: a.x + Math.cos(angle) * r, y: a.y + Math.sin(angle) * r };
}

/**
 * Draws the city into an <svg>.
 * opts.interactive: click/drag handlers. opts.highlight: route to draw.
 */
function renderMap(svg, opts) {
  opts = opts || {};
  const highlight = opts.highlight !== undefined ? opts.highlight : state.highlight;
  const routeSet = new Set(highlight ? highlight.route : []);
  const routeEdges = new Set();
  if (highlight) for (let i = 1; i < highlight.route.length; i++) {
    routeEdges.add(Math.min(highlight.route[i - 1], highlight.route[i]) + '-' + Math.max(highlight.route[i - 1], highlight.route[i]));
  }

  // Remove everything except the persistent vehicle layer.
  let vehLayer = svg.querySelector('g.layer-vehicles');
  [...svg.childNodes].forEach(c => { if (c !== vehLayer) svg.removeChild(c); });

  const roadsG = svgEl('g', { class: 'layer-roads' });
  const routeG = svgEl('g', { class: 'layer-route' });
  const bldG = svgEl('g', { class: 'layer-buildings' });
  const nodesG = svgEl('g', { class: 'layer-nodes' });
  svg.insertBefore(roadsG, vehLayer);
  svg.insertBefore(routeG, vehLayer);
  svg.insertBefore(bldG, vehLayer);
  if (!vehLayer) { vehLayer = svgEl('g', { class: 'layer-vehicles' }, svg); }
  svg.appendChild(nodesG);
  svg.appendChild(vehLayer); // vehicles drawn on top of nodes

  // ---- Roads ----
  for (const road of getAllRoads()) {
    const p = state.positions[road.a], q = state.positions[road.b];
    const occA = getOccupancy(road.a, road.b), occB = getOccupancy(road.b, road.a);
    const full = occA >= getCapacity(road.a, road.b) || occB >= getCapacity(road.b, road.a);
    const busy = occA + occB > 0;
    const isSel = selection && selection.kind === 'road' &&
      ((selection.a === road.a && selection.b === road.b) || (selection.a === road.b && selection.b === road.a));
    const g = svgEl('g', { class: 'road' + (full ? ' full' : busy ? ' busy' : '') + (isSel ? ' selected' : '') }, roadsG);
    svgEl('line', { class: 'road-base', x1: p.x, y1: p.y, x2: q.x, y2: q.y }, g);
    svgEl('line', { class: 'road-lane', x1: p.x, y1: p.y, x2: q.x, y2: q.y }, g);
    const hit = svgEl('line', { class: 'road-hit', x1: p.x, y1: p.y, x2: q.x, y2: q.y }, g);
    const label = svgEl('text', { class: 'road-len', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 12, 'text-anchor': 'middle' }, g);
    label.textContent = formatMetres(road.length);
    const title = svgEl('title', {}, hit);
    title.textContent = 'I' + road.a + ' ↔ I' + road.b + ': ' + formatMetres(road.length) +
      ' | I' + road.a + '→I' + road.b + ' ' + occA + '/' + getCapacity(road.a, road.b) +
      ' | I' + road.b + '→I' + road.a + ' ' + occB + '/' + getCapacity(road.b, road.a);
    if (opts.interactive) hit.addEventListener('click', () => selectOnMap({ kind: 'road', a: road.a, b: road.b }));
  }

  // ---- Highlighted route ----
  if (highlight && highlight.route.length > 1) {
    const pts = highlight.route.map(i => state.positions[i].x + ',' + state.positions[i].y).join(' ');
    svgEl('polyline', { class: 'route-hl ' + highlight.kind, points: pts }, routeG);
  }

  // ---- Buildings (small icons around their intersection) ----
  for (let i = 0; i < state.intersections; i++) {
    const p = state.positions[i];
    getBuildingsAt(i).forEach((b, k) => {
      const angle = Math.PI / 2 + (k - (getBuildingsAt(i).length - 1) / 2) * 0.75;
      const bx = p.x + Math.cos(angle) * 48, by = p.y + Math.sin(angle) * 48;
      const g = svgEl('g', { class: 'bld ' + b.type, transform: 'translate(' + bx + ',' + by + ')' }, bldG);
      svgEl('rect', { x: -11, y: -11, width: 22, height: 22, rx: 5 }, g);
      if (b.type === 'House') svgEl('path', { d: 'M-6 1 L0 -6 L6 1 L6 7 L-6 7 Z' }, g);
      else if (b.type === 'Hospital') svgEl('path', { d: 'M-2.5 -7 h5 v4.5 h4.5 v5 h-4.5 v4.5 h-5 v-4.5 h-4.5 v-5 h4.5 Z' }, g);
      else svgEl('path', { d: 'M-5 -7 h2 v5 h1 v-5 h2 v5 h1 v-5 h2 v7 q0 2 -3 2 v5 h-2 v-5 q-3 0 -3 -2 Z' }, g);
      const t = svgEl('text', { x: 0, y: 25, 'text-anchor': 'middle' }, g);
      t.textContent = b.id;
      const title = svgEl('title', {}, g);
      title.textContent = b.id + ' (' + b.type + ') at I' + b.intersection + (b.type === 'House' ? ', population ' + b.population : '');
    });
  }

  // ---- Intersections ----
  for (let i = 0; i < state.intersections; i++) {
    const p = state.positions[i];
    const isSel = selection && selection.kind === 'node' && selection.id === i;
    const g = svgEl('g', { class: 'node' + (isSel ? ' selected' : '') + (routeSet.has(i) ? ' on-route' : ''), transform: 'translate(' + p.x + ',' + p.y + ')' }, nodesG);
    svgEl('circle', { class: 'body', r: 22 }, g);
    const t = svgEl('text', { x: 0, y: 5, 'text-anchor': 'middle' }, g);
    t.textContent = 'I' + i;
    // Entry signal for roads leading INTO this intersection (depends on its id parity).
    const sig = signalState(i, state.currentTime);
    svgEl('circle', { class: 'sig-dot ' + sig, cx: 17, cy: -17, r: 7 }, g);
    const title = svgEl('title', {}, g);
    title.textContent = 'I' + i + ' — entry signal for roads leading here: ' + sig;
    if (opts.interactive) attachNodeInteractions(svg, g, i);
  }

  renderVehicles(svg, vehLayer, opts);
}

/** Vehicles keep their <g> between renders so CSS can animate their movement. */
function renderVehicles(svg, layer, opts) {
  let map = vehicleLayers.get(svg);
  if (!map) { map = new Map(); vehicleLayers.set(svg, map); }
  const alive = new Set();
  const slotsAtNode = {};

  for (const v of state.vehicles) {
    alive.add(v.id);
    let slot = 0;
    if (!v.onRoad) {
      slotsAtNode[v.current] = (slotsAtNode[v.current] || 0);
      slot = slotsAtNode[v.current]++;
    }
    const pos = vehiclePosition(v, slot);
    let g = map.get(v.id);
    if (!g) {
      g = svgEl('g', {}, layer);
      svgEl('rect', { x: -15, y: -10, width: 30, height: 20, rx: 6 }, g);
      const t = svgEl('text', { x: 0, y: 4.5, 'text-anchor': 'middle' }, g);
      t.textContent = v.id;
      svgEl('title', {}, g);
      if (opts.interactive) g.addEventListener('click', (e) => { e.stopPropagation(); selectOnMap({ kind: 'vehicle', id: v.id }); });
      g.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
      map.set(v.id, g);
    }
    const status = getVehicleStatus(v);
    const isSel = selection && selection.kind === 'vehicle' && selection.id === v.id;
    g.setAttribute('class', 'veh ' + v.type + (v.parked ? ' parked' : '') + (v.completed ? ' completed' : '') +
      (status === 'WAITING' ? ' waiting' : '') + (isSel ? ' selected' : ''));
    g.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
    g.querySelector('title').textContent = 'V' + v.id + ' ' + v.type + ' — ' + status +
      (v.destination >= 0 ? ', destination I' + v.destination : '');
  }
  // Remove vehicles that no longer exist (after a reset).
  for (const [id, g] of map) {
    if (!alive.has(id)) { g.remove(); map.delete(id); }
  }
}

/** Click to select, drag to move an intersection. */
function attachNodeInteractions(svg, g, id) {
  g.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    let moved = false;
    const startX = e.clientX, startY = e.clientY;

    // Listen on window: the node element is redrawn while dragging.
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      state.positions[id] = {
        x: Math.round(Math.max(30, Math.min(MAP_W - 30, p.x))),
        y: Math.round(Math.max(30, Math.min(MAP_H - 30, p.y)))
      };
      svg.classList.add('no-anim');
      renderMap(svg, { interactive: true });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      svg.classList.remove('no-anim');
      if (moved) { saveState(); renderAll(); }
      else selectOnMap({ kind: 'node', id: id });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function selectOnMap(sel) {
  selection = sel;
  renderAll();
}

/** Details panel next to the main map. */
function renderMapDetails() {
  const box = $('mapDetails');
  if (!selection) { box.innerHTML = '<p class="muted">Select an intersection, road or vehicle on the map.</p>'; return; }

  if (selection.kind === 'node') {
    const i = selection.id;
    if (!isValidIntersection(i)) { selection = null; return renderMapDetails(); }
    const roads = state.adjacencyList[i];
    const buildings = getBuildingsAt(i);
    const vehiclesHere = state.vehicles.filter(v => !v.parked && !v.completed && v.current === i);
    box.innerHTML =
      '<h3>Intersection I' + i + '</h3>' +
      statLine('Entry signal for roads leading here', badge(signalState(i, state.currentTime))) +
      statLine('Connected roads', roads.length) +
      '<ul class="detail-list">' + (roads.length ? roads.map(r => '<li>I' + i + ' → I' + r.to + ' · ' + formatMetres(r.length) +
        ' · traffic ' + occupancyHtml(i, r.to) + ' · ' + badge(signalState(r.to, state.currentTime)) + '</li>').join('') : '<li class="muted">No roads</li>') + '</ul>' +
      statLine('Buildings', buildings.length) +
      '<ul class="detail-list">' + (buildings.length ? buildings.map(b => '<li>' + esc(b.id) + ' (' + b.type + ')' +
        (b.type === 'House' ? ', population ' + b.population : '') + '</li>').join('') : '<li class="muted">None</li>') + '</ul>' +
      statLine('Active vehicles at this intersection', vehiclesHere.length) +
      '<ul class="detail-list">' + (vehiclesHere.length ? vehiclesHere.map(v => '<li>V' + v.id + ' ' + v.type + ' · ' + getVehicleStatus(v) + '</li>').join('') : '<li class="muted">None</li>') + '</ul>';
    return;
  }

  if (selection.kind === 'road') {
    const a = selection.a, b = selection.b;
    const length = getRoadLength(a, b);
    if (!length) { selection = null; return renderMapDetails(); }
    box.innerHTML =
      '<h3>Road I' + a + ' ↔ I' + b + '</h3>' +
      statLine('Length', formatMetres(length)) +
      statLine('I' + a + ' → I' + b + ' occupancy', occupancyHtml(a, b)) +
      statLine('I' + a + ' → I' + b + ' signal', badge(signalState(b, state.currentTime))) +
      statLine('I' + b + ' → I' + a + ' occupancy', occupancyHtml(b, a)) +
      statLine('I' + b + ' → I' + a + ' signal', badge(signalState(a, state.currentTime))) +
      '<p class="note">Capacity is ' + ROAD_CAPACITY + ' vehicles in each direction, counted separately.</p>';
    return;
  }

  if (selection.kind === 'vehicle') {
    const v = state.vehicles.find(x => x.id === selection.id);
    if (!v) { selection = null; return renderMapDetails(); }
    box.innerHTML = '<h3>V' + v.id + ' · ' + v.type + '</h3>' + vehicleDetailLines(v);
  }
}

function vehicleDetailLines(v) {
  const next = getNextIntersection(v);
  const length = next !== null ? getRoadLength(v.current, next) : 0;
  return statLine('Status', badge(getVehicleStatus(v))) +
    statLine('Current intersection', 'I' + v.current) +
    statLine('Destination', v.destination >= 0 ? 'I' + v.destination : '—') +
    statLine('Route', v.route.length ? formatRoute(v.route) : '—') +
    statLine('Current road', currentRoadText(v)) +
    statLine('Progress on road', v.onRoad ? formatMetres(v.distance) + ' / ' + formatMetres(length) : '—') +
    statLine('Distance travelled', formatMetres(v.totalDistance)) +
    statLine('Speed', v.speed + ' m/s');
}

function currentRoadText(v) {
  const next = getNextIntersection(v);
  if (next === null) return '—';
  if (v.onRoad) return 'I' + v.current + ' → I' + next;
  if (v.waiting) return 'Waiting to enter I' + v.current + ' → I' + next;
  return 'Next: I' + v.current + ' → I' + next;
}

/* =========================================================================
   13. PAGE RENDERERS
   ========================================================================= */

function renderTopbar() {
  $('clockValue').textContent = formatNumber(state.currentTime) + ' s';
  $('clockPhase').textContent = 'Signal phase ' + (state.currentTime % SIGNAL_CYCLE) + ' / ' + SIGNAL_CYCLE;
}

function renderDashboard() {
  const vs = getVehicleStats();
  const counts = {
    House: getBuildingsOfType('House').length,
    Hospital: getBuildingsOfType('Hospital').length,
    Restaurant: getBuildingsOfType('Restaurant').length
  };
  $('dashKpis').innerHTML =
    kpi('Intersections', state.intersections, null, 'blue') +
    kpi('Roads', countRoads(), null, 'blue') +
    kpi('Buildings', state.buildings.length, counts.House + ' houses · ' + counts.Hospital + ' hospital' + (counts.Hospital === 1 ? '' : 's') + ' · ' + counts.Restaurant + ' restaurant' + (counts.Restaurant === 1 ? '' : 's')) +
    kpi('Population', formatNumber(getTotalPopulation()), 'From houses only', 'green') +
    kpi('Total vehicles', vs.total) +
    kpi('Active vehicles', vs.active, vs.moving + ' moving', 'blue') +
    kpi('Waiting vehicles', vs.waiting, 'At signal or full road', vs.waiting ? 'orange' : '') +
    kpi('Parked vehicles', vs.parked) +
    kpi('Completed vehicles', vs.completed, null, 'green') +
    kpi('Simulation time', formatNumber(state.currentTime) + ' s') +
    kpi('Remaining budget', formatRupees(state.remainingBudget), 'of ' + formatRupees(INITIAL_BUDGET), 'green');

  // Traffic summary
  const roads = getAllRoads();
  let occupied = 0, capacity = 0, fullDirections = 0;
  for (const r of roads) {
    for (const [f, t] of [[r.a, r.b], [r.b, r.a]]) {
      occupied += getOccupancy(f, t); capacity += getCapacity(f, t);
      if (getOccupancy(f, t) >= getCapacity(f, t)) fullDirections++;
    }
  }
  const phase = state.currentTime % SIGNAL_CYCLE;
  $('dashTraffic').innerHTML =
    statLine('Occupied road slots', occupied + ' / ' + capacity) +
    statLine('Full road directions', fullDirections) +
    statLine('Vehicles waiting', vs.waiting) +
    statLine('Roads to even intersections', badge(signalState(0, state.currentTime))) +
    statLine('Roads to odd intersections', badge(signalState(1, state.currentTime))) +
    statLine('Signal phase', phase + ' of ' + SIGNAL_CYCLE + ' s');

  const d = calculateDemand();
  $('dashWater').innerHTML = utilitySummary(d.water, state.waterSupply, state.waterConsumed, 'litres/day', 'litres');
  $('dashElectricity').innerHTML = utilitySummary(d.electricity, state.electricitySupply, state.electricityConsumed, 'kWh/day', 'kWh');
  $('dashBudget').innerHTML =
    barRow('Spent', state.totalSpent, INITIAL_BUDGET, formatRupees(state.totalSpent), 'orange') +
    statLine('Initial budget', formatRupees(INITIAL_BUDGET)) +
    statLine('Total spent', formatRupees(state.totalSpent)) +
    statLine('Remaining', formatRupees(state.remainingBudget)) +
    statLine('Allocations made', state.allocations.length);

  $('dashActivity').innerHTML = feedFromLog(l => l.kind === 'vehicle' || l.kind === 'emergency' || l.kind === 'delivery', 'No vehicle activity yet.');
  $('dashEmergency').innerHTML = vehicleFeed(v => v.type === 'Ambulance', 'No ambulance requests yet.');
  $('dashDelivery').innerHTML = vehicleFeed(v => v.type === 'DeliveryBike', 'No food deliveries yet.');
}

function utilitySummary(demand, supply, consumed, unit, consumedUnit) {
  const ok = supply >= demand;
  return barRow('Demand', demand, Math.max(demand, supply), Math.round(demand / Math.max(supply, 1) * 100) + '%', ok ? 'green' : 'red') +
    statLine('Demand', formatNumber(demand) + ' ' + unit) +
    statLine('Supply', formatNumber(supply) + ' ' + unit) +
    statLine('Status', ok ? badge('SUFFICIENT', 'ok') : badge('SHORTAGE', 'bad')) +
    statLine('Consumed in simulation', formatNumber(consumed, 2) + ' ' + consumedUnit);
}

function feedFromLog(filter, emptyText) {
  const items = state.log.filter(filter).slice(-6).reverse();
  if (!items.length) return '<li class="empty">' + esc(emptyText) + '</li>';
  return items.map(l => '<li><span class="t">' + l.time + ' s</span><span>' + esc(l.text) + '</span></li>').join('');
}

function vehicleFeed(filter, emptyText) {
  const items = state.vehicles.filter(filter).slice(-5).reverse();
  if (!items.length) return '<li class="empty">' + esc(emptyText) + '</li>';
  return items.map(v => '<li><span class="t">V' + v.id + '</span><span>' +
    (v.route.length ? formatRoute(v.route) : 'Parked at I' + v.current) + ' ' + badge(getVehicleStatus(v)) + '</span></li>').join('');
}

function renderRoadsPage() {
  $('adjacencyList').innerHTML = Array.from({ length: state.intersections }, (_, i) =>
    '<div><b>I' + i + '</b>: ' + (state.adjacencyList[i].length
      ? state.adjacencyList[i].map(r => 'I' + r.to + ' (' + formatMetres(r.length) + ', capacity ' + getCapacity(i, r.to) + ')').join(', ')
      : '<span class="muted">No roads</span>') + '</div>').join('');

  const rows = getAllRoads().map((r, k) => [
    'R' + (k + 1) + ' · I' + r.a + ' ↔ I' + r.b, 'I' + r.a, 'I' + r.b, formatMetres(r.length),
    getCapacity(r.a, r.b) + ' / ' + getCapacity(r.b, r.a),
    occupancyHtml(r.a, r.b), occupancyHtml(r.b, r.a)
  ]);
  $('roadsTable').innerHTML = table(
    ['Road', 'Start', 'End', { label: 'Length', num: true }, 'Capacity (each way)', 'Occupancy start→end', 'Occupancy end→start'],
    rows, 'No roads yet.');
}

function renderBuildingsPage() {
  const counts = BUILDING_TYPES.map(t => getBuildingsOfType(t).length);
  $('buildingKpis').innerHTML =
    kpi('Total buildings', state.buildings.length, 'Limit ' + MAX_BUILDINGS, 'blue') +
    kpi('Houses', counts[0]) + kpi('Hospitals', counts[1]) + kpi('Restaurants', counts[2]);
  $('buildingsTable').innerHTML = table(
    ['Building ID', 'Type', 'Intersection', { label: 'Population', num: true }],
    state.buildings.map(b => [esc(b.id), b.type, 'I' + b.intersection, b.type === 'House' ? b.population : '—']),
    'No buildings registered.');
}

function renderPopulationPage() {
  const houses = getBuildingsOfType('House');
  const total = getTotalPopulation();
  $('populationKpis').innerHTML =
    kpi('Total population', formatNumber(total), null, 'green') +
    kpi('Houses', houses.length) +
    kpi('Average per house', houses.length ? (total / houses.length).toFixed(1) : '0');
  const max = Math.max(1, ...houses.map(h => h.population));
  $('populationBars').innerHTML = houses.length
    ? houses.map(h => barRow(esc(h.id) + ' (I' + h.intersection + ')', h.population, max,
        h.population + ' · ' + (total ? (h.population / total * 100).toFixed(0) : 0) + '%')).join('')
    : '<p class="muted">No houses registered.</p>';
}

function renderTrafficPage() {
  const t = state.currentTime;
  const phase = t % SIGNAL_CYCLE;
  const cursor = (phase / SIGNAL_CYCLE * 100).toFixed(2);
  $('signalCycle').innerHTML =
    '<div class="cycle-row"><span>Roads to even IDs</span><div class="cycle-track">' +
      '<span class="g" style="width:42.86%"></span><span class="y" style="width:7.14%"></span><span class="r" style="width:50%"></span>' +
      '<i class="cycle-cursor" style="left:' + cursor + '%"></i></div></div>' +
    '<div class="cycle-row"><span>Roads to odd IDs</span><div class="cycle-track">' +
      '<span class="r" style="width:50%"></span><span class="g" style="width:42.86%"></span><span class="y" style="width:7.14%"></span>' +
      '<i class="cycle-cursor" style="left:' + cursor + '%"></i></div></div>' +
    '<div class="cycle-now"><span>Second <b>' + phase + '</b> of the cycle</span>' +
      '<span>Even: ' + badge(signalState(0, t)) + '</span><span>Odd: ' + badge(signalState(1, t)) + '</span></div>' +
    '<p class="note">Even: green 0–29, yellow 30–34, red 35–69. Odd: red 0–34, green 35–64, yellow 65–69. ' +
      'The next tick checks second <b>' + ((t + 1) % SIGNAL_CYCLE) + '</b> (time is increased before vehicles move).</p>';

  const order = buildProcessingOrder();
  $('processingOrder').innerHTML = order.length
    ? '<ol class="detail-list">' + order.map(i => {
        const v = state.vehicles[i];
        return '<li>V' + v.id + ' ' + v.type + (v.type === 'Ambulance' ? ' ' + badge('priority queue', 'bad') : ' ' + badge('FIFO', 'grey')) + '</li>';
      }).join('') + '</ol>'
    : '<p class="muted">No active vehicles.</p>';

  const rows = [];
  for (let i = 0; i < state.intersections; i++) {
    const active = state.vehicles.filter(v => !v.parked && !v.completed && v.current === i).length;
    if (!state.adjacencyList[i].length) {
      rows.push(['I' + i, active, '—', '—', '—', '<span class="muted">No connected roads</span>']);
      continue;
    }
    state.adjacencyList[i].forEach((r, k) => {
      rows.push([k === 0 ? '<b>I' + i + '</b>' : '', k === 0 ? active : '', 'I' + i + ' → I' + r.to, formatMetres(r.length),
        occupancyHtml(i, r.to), badge(signalState(r.to, t))]);
    });
  }
  $('trafficTable').innerHTML = table(
    ['Intersection', { label: 'Active vehicles here', num: true }, 'Outgoing road', { label: 'Length', num: true }, 'Traffic', 'Signal'],
    rows);
}

function renderVehiclesPage() {
  const vs = getVehicleStats();
  $('vehicleKpis').innerHTML =
    kpi('Total', vs.total, 'Limit ' + MAX_VEHICLES, 'blue') + kpi('Moving', vs.moving, null, 'blue') +
    kpi('Waiting', vs.waiting, null, vs.waiting ? 'orange' : '') + kpi('Parked', vs.parked) +
    kpi('Completed', vs.completed, null, 'green');
  $('vehiclesTable').innerHTML = vehicleTable(state.vehicles, 'No vehicles yet. Create one above.');

  // Form hints and the destination field
  const type = $('vehicleType').value;
  const parked = $('vehicleMode').value === 'parked';
  $('vehicleDest').disabled = parked;
  $('vehicleDestLabel').style.opacity = parked ? 0.5 : 1;
  const hints = {
    Car: 'A car can start at any intersection.',
    Ambulance: 'An ambulance must start at an intersection with a hospital (' +
      (getBuildingsOfType('Hospital').map(b => esc(b.id) + ' at I' + b.intersection).join(', ') || 'none registered') + ').',
    DeliveryBike: 'A delivery bike must start at a restaurant (' +
      (getBuildingsOfType('Restaurant').map(b => esc(b.id) + ' at I' + b.intersection).join(', ') || 'none') +
      ') and travel to a house (' + (getBuildingsOfType('House').map(b => esc(b.id) + ' at I' + b.intersection).join(', ') || 'none') + ').'
  };
  $('vehicleHint').innerHTML = hints[type] + (parked ? ' Parked vehicles stay at their starting intersection.' : '');
}

function vehicleTable(list, emptyText) {
  return table(
    ['Vehicle', 'Type', 'Current', 'Destination', 'Route', 'Current road', { label: 'Distance travelled', num: true },
      'Progress on road', { label: 'Speed', num: true }, 'Status'],
    list.map(v => {
      const next = getNextIntersection(v);
      const length = next !== null ? getRoadLength(v.current, next) : 0;
      return ['V' + v.id, v.type, 'I' + v.current, v.destination >= 0 ? 'I' + v.destination : '—',
        v.route.length ? formatRoute(v.route) : '—', currentRoadText(v), formatMetres(v.totalDistance),
        v.onRoad ? formatMetres(v.distance) + ' / ' + formatMetres(length) + ' (' + Math.round(v.distance / length * 100) + '%)' : '—',
        v.speed + ' m/s', badge(getVehicleStatus(v))];
    }), emptyText);
}

function renderAmbulancePage() {
  const list = state.vehicles.filter(v => v.type === 'Ambulance');
  const s = getVehicleStats(list);
  $('ambKpis').innerHTML =
    kpi('Total ambulances', s.total, null, 'red') + kpi('Active', s.moving, null, 'blue') +
    kpi('Waiting', s.waiting, null, s.waiting ? 'orange' : '') + kpi('Completed journeys', s.completed, null, 'green');
  $('ambTable').innerHTML = vehicleTable(list, 'No ambulance requests yet.');
}

function renderDeliveryPage() {
  const list = state.vehicles.filter(v => v.type === 'DeliveryBike');
  const s = getVehicleStats(list);
  $('delKpis').innerHTML =
    kpi('Total requests', s.total, null, 'orange') + kpi('Active', s.moving, null, 'blue') +
    kpi('Waiting', s.waiting, null, s.waiting ? 'orange' : '') + kpi('Completed', s.completed, null, 'green');
  $('delTable').innerHTML = vehicleTable(list, 'No deliveries yet.');
}

function renderPlannerPage() {
  if (!lastPlan) {
    $('planArrays').innerHTML = table(['Intersection', { label: 'dist[v]', num: true }, 'parent[v]'], [], 'Run the planner to see the arrays.');
  } else {
    $('planArrays').innerHTML = table(
      ['Intersection', { label: 'dist[v] (m)', num: true }, 'parent[v]', 'On route'],
      lastPlan.result.dist.map((d, v) => ['I' + v, d === Infinity ? '∞' : formatNumber(d),
        lastPlan.result.parent[v] === -1 ? '−1' : 'I' + lastPlan.result.parent[v],
        lastPlan.result.path.indexOf(v) >= 0 ? badge('yes', 'ok') : '']));
  }
  renderMap($('planMap'), { highlight: lastPlan && lastPlan.result.found ? { route: lastPlan.result.path, kind: 'planner' } : null });
}

function renderUtilityPage(kind) {
  const d = calculateDemand();
  const isWater = kind === 'water';
  const demand = isWater ? d.water : d.electricity;
  const supply = isWater ? state.waterSupply : state.electricitySupply;
  const consumed = isWater ? state.waterConsumed : state.electricityConsumed;
  const unit = isWater ? 'litres/day' : 'kWh/day';
  const cUnit = isWater ? 'litres' : 'kWh';
  const ok = supply >= demand;
  const surplus = supply - demand;

  $(isWater ? 'waterKpis' : 'elecKpis').innerHTML =
    kpi('Daily demand', formatNumber(demand), unit, 'blue') +
    kpi('Daily supply', formatNumber(supply), unit) +
    kpi('Status', ok ? 'SUFFICIENT' : 'SHORTAGE', ok ? 'Supply covers demand' : 'Demand exceeds supply', ok ? 'green' : 'red') +
    kpi(ok ? 'Surplus vs demand' : 'Shortfall vs demand', formatNumber(Math.abs(surplus)), unit + ' (' + (demand ? Math.round(supply / demand * 100) : 0) + '% of demand)', ok ? 'green' : 'red') +
    kpi('Consumed in simulation', formatNumber(consumed, 2), cUnit + ' over ' + formatNumber(state.currentTime) + ' s', 'orange');

  const input = $(isWater ? 'waterSupplyInput' : 'elecSupplyInput');
  if (document.activeElement !== input) input.placeholder = 'Current: ' + supply;

  const rates = isWater ? [150, 500, 300] : [2, 50, 30];
  $(isWater ? 'waterFormula' : 'elecFormula').innerHTML =
    statLine('Population × ' + rates[0], d.population + ' × ' + rates[0] + ' = ' + formatNumber(d.population * rates[0])) +
    statLine('Hospitals × ' + rates[1], d.hospitals + ' × ' + rates[1] + ' = ' + formatNumber(d.hospitals * rates[1])) +
    statLine('Restaurants × ' + rates[2], d.restaurants + ' × ' + rates[2] + ' = ' + formatNumber(d.restaurants * rates[2])) +
    statLine('Total demand', formatNumber(demand) + ' ' + unit) +
    '<p class="note">Each simulation advance adds demand × seconds ÷ 86,400 to consumption.</p>';
}

function renderBudgetPage() {
  $('budgetKpis').innerHTML =
    kpi('Initial budget', formatRupees(INITIAL_BUDGET), null, 'blue') +
    kpi('Total spent', formatRupees(state.totalSpent), null, 'orange') +
    kpi('Remaining', formatRupees(state.remainingBudget), Math.round(state.remainingBudget / INITIAL_BUDGET * 100) + '% left', 'green');
  const totals = getDepartmentTotals();
  $('deptBars').innerHTML = DEPARTMENTS.map(d => barRow(d, totals[d], INITIAL_BUDGET, formatRupees(totals[d]))).join('');
  $('allocTable').innerHTML = table(
    ['#', 'Department', { label: 'Amount', num: true }, { label: 'At simulation time', num: true }],
    state.allocations.slice().reverse().map((a, k) => [state.allocations.length - k, a.department, formatRupees(a.amount), a.time + ' s']),
    'No allocations yet.');
}

function renderReportsPage() {
  const vs = getVehicleStats();
  const amb = getVehicleStats(state.vehicles.filter(v => v.type === 'Ambulance'));
  const del = getVehicleStats(state.vehicles.filter(v => v.type === 'DeliveryBike'));
  const d = calculateDemand();
  const totals = getDepartmentTotals();
  const card = (title, body) => '<div class="card"><h2>' + title + '</h2>' + body + '</div>';

  const trafficRows = [];
  for (const r of getAllRoads()) {
    for (const [f, t] of [[r.a, r.b], [r.b, r.a]]) {
      trafficRows.push(['I' + f + ' → I' + t, occupancyHtml(f, t), badge(signalState(t, state.currentTime))]);
    }
  }

  $('reportsArea').innerHTML =
    card('City report',
      statLine('Total intersections', state.intersections) + statLine('Total roads', countRoads()) +
      statLine('Total buildings', state.buildings.length) + statLine('Total population', getTotalPopulation())) +
    card('Vehicle report',
      statLine('Total vehicles', vs.total) +
      statLine('Cars', countVehicles(v => v.type === 'Car')) +
      statLine('Ambulances', countVehicles(v => v.type === 'Ambulance')) +
      statLine('Delivery bikes', countVehicles(v => v.type === 'DeliveryBike')) +
      statLine('Moving', vs.moving) + statLine('Waiting', vs.waiting) +
      statLine('Parked', vs.parked) + statLine('Completed', vs.completed)) +
    card('Traffic report',
      statLine('Simulation time', state.currentTime + ' s (phase ' + (state.currentTime % SIGNAL_CYCLE) + ')') +
      statLine('Waiting vehicles', vs.waiting) +
      '<div class="table-wrap mt"><table>' + table(['Direction', 'Occupancy / capacity', 'Signal'], trafficRows) + '</table></div>') +
    card('Emergency report',
      statLine('Ambulance requests', amb.total) + statLine('Active journeys', amb.active) +
      statLine('Completed journeys', amb.completed)) +
    card('Delivery report',
      statLine('Total delivery requests', del.total) + statLine('Active deliveries', del.active) +
      statLine('Completed deliveries', del.completed)) +
    card('Utility report',
      statLine('Water demand', formatNumber(d.water) + ' litres/day') +
      statLine('Water supply', formatNumber(state.waterSupply) + ' litres/day') +
      statLine('Water consumption', formatNumber(state.waterConsumed, 2) + ' litres') +
      statLine('Electricity demand', formatNumber(d.electricity) + ' kWh/day') +
      statLine('Electricity supply', formatNumber(state.electricitySupply) + ' kWh/day') +
      statLine('Electricity consumption', formatNumber(state.electricityConsumed, 2) + ' kWh')) +
    card('Financial report',
      statLine('Initial budget', formatRupees(INITIAL_BUDGET)) +
      statLine('Total expenditure', formatRupees(state.totalSpent)) +
      statLine('Remaining budget', formatRupees(state.remainingBudget)) +
      DEPARTMENTS.map(dep => statLine(dep, formatRupees(totals[dep]))).join(''));
}

/** Re-renders every page so all views always agree. */
function renderAll() {
  refreshDropdowns();
  renderTopbar();
  renderDashboard();
  renderMap($('miniMap'));
  renderMap($('mainMap'), { interactive: true });
  renderMapDetails();
  renderRoadsPage();
  renderBuildingsPage();
  renderPopulationPage();
  renderTrafficPage();
  renderVehiclesPage();
  renderAmbulancePage();
  renderDeliveryPage();
  renderPlannerPage();
  renderUtilityPage('water');
  renderUtilityPage('electricity');
  renderBudgetPage();
  renderReportsPage();
}

/** Every change goes through here: save, then redraw. */
function commit() {
  saveState();
  renderAll();
}

/* =========================================================================
   14. FORM HANDLERS AND SIMULATION CONTROLS
   ========================================================================= */
let autoTimer = null;
let autoMode = 'stopped';   // 'stopped' | 'running' | 'paused'

function readInt(id) {
  const raw = $(id).value.trim();
  if (raw === '' || !/^-?\d+$/.test(raw)) return NaN;
  return parseInt(raw, 10);
}

function readNumber(id) {
  const raw = $(id).value.trim();
  return raw === '' ? NaN : Number(raw);
}

function runAdvance(seconds) {
  const maps = document.querySelectorAll('.city-map');
  // Glide smoothly for one-second steps; jump straight there for bigger steps.
  maps.forEach(m => m.classList.toggle('no-anim', seconds !== 1));
  const res = advanceSimulation(seconds);
  if (!res.ok) { toast(res.error, 'error'); return false; }
  commit();
  return true;
}

function startAuto() {
  stopTimer();
  autoTimer = setInterval(() => runAdvance(1), Number($('autoSpeed').value));
  autoMode = 'running';
  updateAutoButton();
}

function stopTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

function updateAutoButton() {
  const btn = $('autoBtn');
  btn.textContent = autoMode === 'running' ? 'Pause' : autoMode === 'paused' ? 'Resume' : 'Start';
  btn.className = 'btn ' + (autoMode === 'running' ? 'btn-running' : 'btn-primary');
}

function addIntersectionAction() {
  const id = addIntersection();
  if (id === -1) { toast('Intersection limit of ' + MAX_INTERSECTIONS + ' reached.', 'error'); return; }
  addLog('info', 'Created intersection I' + id + '.');
  selection = { kind: 'node', id: id };
  commit();
  toast('Created intersection I' + id + '. Connect it with a road.', 'success');
}

function addRoadAction(fromId, toId, lengthId) {
  const a = readInt(fromId), b = readInt(toId), length = readNumber(lengthId);
  const res = addRoad(a, b, length);
  if (!res.ok) { toast(res.error, 'error'); return; }
  addLog('info', 'Road added: I' + a + ' ↔ I' + b + ' (' + length + ' m).');
  $(lengthId).value = '';
  commit();
  toast('Road I' + a + ' ↔ I' + b + ' added (' + formatMetres(length) + ').', 'success');
}

function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => showSection(b.dataset.section)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showSection(b.dataset.goto)));
  $('menuToggle').addEventListener('click', () => document.body.classList.contains('nav-open') ? closeMobileNav() : openMobileNav());

  // Simulation controls
  document.querySelectorAll('[data-advance]').forEach(b => b.addEventListener('click', () => {
    const s = parseInt(b.dataset.advance, 10);
    if (runAdvance(s)) toast('Simulation advanced by ' + s + ' second' + (s === 1 ? '' : 's') + '.', 'info');
  }));
  $('customAdvanceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const s = readInt('customSeconds');
    if (isNaN(s) || s < 0 || s > MAX_ADVANCE_SECONDS) { toast('Enter a whole number between 0 and ' + MAX_ADVANCE_SECONDS + '.', 'error'); return; }
    if (runAdvance(s)) { toast('Simulation advanced by ' + s + ' second' + (s === 1 ? '' : 's') + '.', 'info'); $('customSeconds').value = ''; }
  });
  $('autoBtn').addEventListener('click', () => {
    if (autoMode === 'running') { stopTimer(); autoMode = 'paused'; updateAutoButton(); toast('Simulation paused.', 'info'); }
    else {
      const resuming = autoMode === 'paused';
      startAuto();
      toast(resuming ? 'Simulation resumed.' : 'Automatic simulation started (1 tick per interval).', 'info');
    }
  });
  $('autoSpeed').addEventListener('change', () => { if (autoMode === 'running') startAuto(); });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset the simulation? The city will return to its original configuration and all progress will be lost.')) return;
    stopTimer(); autoMode = 'stopped'; updateAutoButton();
    selection = null; lastPlan = null;
    document.querySelectorAll('.city-map').forEach(m => m.classList.add('no-anim'));
    resetSimulation();
    renderAll();
    $('ambResult').innerHTML = ''; $('delResult').innerHTML = ''; $('planResult').innerHTML = '';
    toast('Simulation reset to the original city.', 'success');
  });

  // Map page
  $('mapAddIntersection').addEventListener('click', addIntersectionAction);
  $('mapAddRoadForm').addEventListener('submit', (e) => { e.preventDefault(); addRoadAction('mapRoadFrom', 'mapRoadTo', 'mapRoadLength'); });
  $('clearHighlight').addEventListener('click', () => { state.highlight = null; commit(); });
  $('mainMap').addEventListener('click', (e) => { if (e.target === $('mainMap')) { selection = null; renderAll(); } });

  // Road page
  $('addIntersectionBtn').addEventListener('click', addIntersectionAction);
  $('addRoadForm').addEventListener('submit', (e) => { e.preventDefault(); addRoadAction('roadFrom', 'roadTo', 'roadLength'); });

  // Buildings
  $('buildingType').addEventListener('change', syncPopulationField);
  $('addBuildingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = $('buildingType').value;
    const population = type === 'House' ? readInt('buildingPopulation') : 0;
    const res = addBuilding($('buildingId').value, type, readInt('buildingIntersection'), population);
    if (!res.ok) { toast(res.error, 'error'); return; }
    const id = $('buildingId').value.trim();
    addLog('info', 'Building ' + id + ' (' + type + ') added at I' + readInt('buildingIntersection') + '.');
    $('buildingId').value = '';
    commit();
    toast('Building ' + id + ' added.', 'success');
  });

  // Vehicles
  $('vehicleType').addEventListener('change', renderVehiclesPage);
  $('vehicleMode').addEventListener('change', renderVehiclesPage);
  $('vehicleForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const parked = $('vehicleMode').value === 'parked';
    const res = createVehicle($('vehicleType').value, readInt('vehicleStart'), parked ? -1 : readInt('vehicleDest'), parked, 'manual');
    if (!res.ok) { toast(res.error, 'error'); return; }
    const v = res.vehicle;
    if (!parked && v.route.length > 1) state.highlight = { route: v.route, kind: 'vehicle' };
    commit();
    toast(v.type + ' V' + v.id + (parked ? ' parked at I' + v.current : ' created: ' + formatRoute(v.route)) + '.', 'success');
  });

  // Ambulance
  $('ambulanceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const hospital = state.buildings.find(b => b.id === $('ambHospital').value && b.type === 'Hospital');
    if (!hospital) { $('ambResult').innerHTML = resultBox('A registered hospital is required.', false); toast('No hospital selected.', 'error'); return; }
    const accident = readInt('ambAccident');
    if (!isValidIntersection(accident)) { $('ambResult').innerHTML = resultBox('Invalid accident intersection.', false); return; }
    const res = createVehicle('Ambulance', hospital.intersection, accident, false, 'ambulance');
    if (!res.ok) { $('ambResult').innerHTML = resultBox(esc(res.error), false); toast(res.error, 'error'); return; }
    const v = res.vehicle;
    state.highlight = { route: v.route, kind: 'ambulance' };
    $('ambResult').innerHTML = resultBox('<b>Ambulance V' + v.id + '</b> dispatched from ' + esc(hospital.id) + ' (I' + hospital.intersection + ') to the accident at I' + accident + '.' +
      routeChips(v.route) + 'Shortest distance: <b>' + formatMetres(routeDistance(v.route)) + '</b> at 15 m/s.' +
      (v.completed ? ' The accident is at the hospital itself, so the journey is already complete.' : ' Advance the simulation to move it.'), true);
    commit();
    toast('Ambulance V' + v.id + ' dispatched.', 'success');
  });

  // Food delivery
  $('deliveryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const restaurant = state.buildings.find(b => b.id === $('delRestaurant').value && b.type === 'Restaurant');
    const house = state.buildings.find(b => b.id === $('delHouse').value && b.type === 'House');
    if (!restaurant) { $('delResult').innerHTML = resultBox('A registered restaurant is required.', false); return; }
    if (!house) { $('delResult').innerHTML = resultBox('A registered house is required as the destination.', false); return; }
    const res = createVehicle('DeliveryBike', restaurant.intersection, house.intersection, false, 'delivery');
    if (!res.ok) { $('delResult').innerHTML = resultBox(esc(res.error), false); toast(res.error, 'error'); return; }
    const v = res.vehicle;
    state.highlight = { route: v.route, kind: 'delivery' };
    $('delResult').innerHTML = resultBox('<b>Delivery bike V' + v.id + '</b> from ' + esc(restaurant.id) + ' (I' + restaurant.intersection + ') to ' + esc(house.id) + ' (I' + house.intersection + ').' +
      routeChips(v.route) + 'Shortest distance: <b>' + formatMetres(routeDistance(v.route)) + '</b> at 6 m/s.' +
      (v.completed ? ' Restaurant and house share an intersection, so delivery is already complete.' : ' Advance the simulation to move it.'), true);
    commit();
    toast('Delivery V' + v.id + ' placed.', 'success');
  });

  // Dijkstra planner
  $('plannerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const s = readInt('planSource'), d = readInt('planDest');
    const result = dijkstra(s, d);
    lastPlan = { source: s, destination: d, result: result };
    if (!result.found) {
      $('planResult').innerHTML = resultBox('No route exists between I' + s + ' and I' + d + ', or an intersection is invalid.', false);
      state.highlight = null;
    } else {
      $('planResult').innerHTML = resultBox(
        statLine('Source', 'I' + s) + statLine('Destination', 'I' + d) +
        '<div class="mt">Shortest route</div>' + routeChips(result.path) +
        statLine('Total distance', formatMetres(result.distance)) +
        statLine('Intersections on route', result.path.length), true);
      state.highlight = { route: result.path, kind: 'planner' };
    }
    commit();
  });

  // Utilities
  $('waterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = setWaterSupply(readNumber('waterSupplyInput'));
    if (!res.ok) { toast(res.error, 'error'); return; }
    $('waterSupplyInput').value = '';
    commit();
    toast('Water supply updated.', 'success');
  });
  $('elecForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = setElectricitySupply(readNumber('elecSupplyInput'));
    if (!res.ok) { toast(res.error, 'error'); return; }
    $('elecSupplyInput').value = '';
    commit();
    toast('Electricity supply updated.', 'success');
  });

  // Budget
  $('budgetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const dept = $('budgetDept').value;
    const amount = readNumber('budgetAmount');
    const res = allocateBudget(dept, amount);
    if (!res.ok) { toast(res.error, 'error'); return; }
    $('budgetAmount').value = '';
    commit();
    toast(formatRupees(amount) + ' allocated to ' + dept + '.', 'success');
  });
}

/** Hospitals and restaurants always have population 0. */
function syncPopulationField() {
  const isHouse = $('buildingType').value === 'House';
  $('buildingPopulation').disabled = !isHouse;
  if (!isHouse) $('buildingPopulation').value = 0;
}

/* =========================================================================
   15. START-UP
   ========================================================================= */
function init() {
  if (!loadState()) {        // restore the saved city, or build the original one
    createInitialState();
    saveState();
  }
  bindEvents();
  syncPopulationField();
  document.querySelectorAll('.city-map').forEach(m => m.classList.add('no-anim'));
  renderAll();
  // Allow movement animation after the first draw.
  requestAnimationFrame(() => document.querySelectorAll('.city-map').forEach(m => m.classList.remove('no-anim')));
}

document.addEventListener('DOMContentLoaded', init);

# Virtual City Simulator

> **PBL Phase 3: Integration, Testing & Evaluation**  
> **Team Name:** ucss.mehul

---

## 📋 Phase 3 Overview

Phase 2 built the core engine: road network, buildings, vehicles, and Dijkstra routing.
Phase 3 adds emergency and delivery services, traffic handling, utilities, the city budget, and a console dashboard that shows everything together.

**Tech Stack:** C++17 (OOP + STL) · Console-based dashboard

---

## 🏗️ Phase 3 Modules

| Module | How It Works |
|---|---|
| 🚑 Ambulance Service | User picks a hospital and an accident location; Dijkstra finds the shortest route |
| 🛵 Food Delivery | User picks a restaurant and a house; a bike follows the shortest route |
| 🚦 Traffic Handling | Each second, ambulances are processed first (Priority Queue), then other vehicles in order (Queue) |
| 🗺️ Traffic Visualization | Shows active vehicles at each intersection and on each road |
| 💧 Water & Electricity | Daily demand is calculated from population and buildings and compared with supply |
| 💰 City Budget | Budget allocated to departments, with checks for insufficient funds |
| 📊 City Dashboard | One menu option displays the network, buildings, vehicles, utilities, budget and traffic |

---

## 🧠 Key Algorithms

| Algorithm / Structure | Used For | Complexity |
|---|---|---|
| Dijkstra (min-priority queue) | Shortest routes | O((V + E) log V) |
| Priority Queue | Ambulance-first processing | O(log n) |
| Queue | FIFO processing of other vehicles | O(1) |

---

## 🧪 Testing

Tested on the built-in demo city (5 intersections, 6 roads). Every route found by Dijkstra was checked against the hand-calculated shortest path.

---

## 📊 Evaluation

| Trip | Route Found | Distance | Travel Time |
|---|---|---|---|
| Ambulance: Hospital (I1) → I0 | I1 → I0 | 100 m | 7 s |
| Ambulance: Hospital (I1) → I3 | I1 → I3 | 120 m | 8 s |
| Ambulance: Hospital (I1) → I4 | I1 → I2 → I4 | 170 m | 12 s |
| Car: I1 → I4 | I1 → I2 → I4 | 170 m | 17 s |
| Delivery: Restaurant (I3) → House H1 (I0) | I3 → I1 → I0 | 220 m | 37 s |
| Delivery: Restaurant (I3) → House H2 (I4) | I3 → I4 | 80 m | 14 s |

**Dijkstra runtime:** about 64 µs per query on a 100-intersection graph (the code's maximum size), averaged over 100,000 queries.

**Observations**
- All routes matched the hand-calculated shortest paths. For example, I1 → I4 takes I1 → I2 → I4 (170 m) instead of I1 → I3 → I4 (200 m).
- On the same route, the ambulance (15 m/s) arrives in 12 s, compared with 17 s for a car (10 m/s).
- Ambulance priority changes the processing order, but not travel time, because vehicles do not slow each other down yet.

**Limitations:** no congestion model, one order per delivery trip, and a maximum of 100 intersections.

---

## 🗺️ Milestones

- [x] Proposal & Dashboard Design
- [x] Road Network, Buildings & Vehicles
- [x] Dijkstra Routing
- [x] Ambulance & Food-Delivery Services
- [x] Traffic Handling (Queue & Priority Queue)
- [x] Water, Electricity & Budget Modules
- [x] Console City Dashboard
- [x] Testing & Evaluation
- [ ] Final Demonstration

---

## 🚀 Getting Started

Follow these steps to run the C++ simulation engine locally.

### Prerequisites

Make sure you have the following installed:

- A C++ compiler supporting C++17 or later
- Git
- A terminal or command-line interface

### 1. Clone the Repository

```bash
git clone https://github.com/ucss-mehul/Virtual-City-Simulator.git
```

### 2. Navigate to the Project Directory

```bash
cd Virtual-City-Simulator
```

### 3. Compile the C++ Simulation

```bash
g++ -std=c++17 src/main.cpp -o simulator
```

### 4. Run the Simulation

**On macOS / Linux:**

```bash
./simulator
```

**On Windows:**

```bash
simulator.exe
```

> **Note:** These commands assume that the main C++ source file is located at `src/main.cpp`. If your project uses a different directory structure or filename, update the compilation command accordingly.

---

## 🔮 Future Scope

- Congestion-based road costs, so busy roads slow vehicles down
- Web-based dashboard connected to the C++ engine
- Import real city maps from OpenStreetMap
- Faster routing on large maps using A* search
- Smart traffic signal timing to reduce congestion
- Disaster scenarios such as road closures and power outages
- Public transport simulation (buses and metro)

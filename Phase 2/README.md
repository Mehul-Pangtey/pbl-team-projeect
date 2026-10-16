# Virtual City Simulator

> **PBL Phase 2 Project Proposal**  
> **Team Name:** ucss.mehul

---

## 📋 Project Overview & Phase 2 Status

Modern cities consist of complex, interconnected systems, including roads, buildings, traffic, emergency services, water, electricity, and finance. Managing these systems efficiently is essential, especially during traffic congestion and emergencies.

In **Phase 2**, we have implemented the core C++ backend simulation engine, integrating the following modules:

- Road Network using a Weighted Undirected Graph
- Building and Population Management
- Vehicle Management and Route Optimization using Dijkstra's Algorithm

The project demonstrates the practical application of **Data Structures and Algorithms (DSA)** and **Object-Oriented Programming (OOP)** in an urban simulation environment.

---

## ⚙️ Technology Stack

- **Backend:** C++
- **Data Structures:** Graphs, Vectors, Queues, Priority Queues
- **Graph Representation:** Adjacency List
- **Algorithms:** Dijkstra's Algorithm, Breadth-First Search (BFS), Depth-First Search (DFS)
- **Programming Concepts:** Classes, Inheritance, Polymorphism, Encapsulation, and STL

---

## 🏗️ System Architecture & Implemented Modules

### 1. User Interface
A web-based dashboard for visualizing and monitoring city parameters.

### 2. Road Network Module
- Represents city intersections as graph nodes.
- Represents roads as weighted edges.
- Uses an adjacency list for efficient graph storage and traversal.

### 3. Building & Population Module
- Manages houses, hospitals, restaurants, schools, and parks.
- Tracks population associated with residential buildings.
- Connects buildings to city intersections.

### 4. Vehicle Management Module
Manages different vehicle types:
- 🚗 Cars
- 🚑 Ambulances
- 🛵 Food Delivery Bikes

Vehicle status can include parked, moving, or completed.

---

## 🧠 Data Structures & Algorithms Used

| Data Structure / Algorithm | Application |
|---|---|
| Weighted Graph | Represents roads and intersections |
| Adjacency List | Stores road network connections |
| Queue | Manages waiting vehicles |
| Priority Queue | Handles dynamic traffic priorities |
| BFS | Traverses the city graph |
| DFS | Explores graph connectivity |
| OOP | Organizes buildings, vehicles, and simulation modules |

---

## 🗺️ Project Milestones

- [x] Requirement Analysis & Proposal Design
- [x] Interface Design & Dashboard Layout
- [x] Road Network Graph Implementation
- [x] Building & Population Module
- [x] Vehicle Management 
- [x] Dijkstra's Shortest-Path Integration
- [ ] Emergency & Food-Delivery Routing
- [ ] Traffic Management using Queues & Priority Queues
- [ ] Resources & City Finance Integration
- [ ] Complete System Integration and Testing
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


## 🔮 Next Phase

- Water and electricity distribution simulation
- City budget and resource allocation
- Enhanced traffic visualization
- Dijkstra's Shortest-Path Integration
- Traffic Management using Queues & Priority Queues
- Emergency & Food-Delivery Routing
- Real-time simulation updates
- Improved frontend and backend integration
- Comprehensive testing and performance optimization

---

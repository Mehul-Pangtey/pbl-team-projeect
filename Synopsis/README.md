# 🏙️ Virtual City Simulator
> **An Interactive Urban Management & Simulation Platform Powered by DSA & OOP**  
> **Team Name:** ucss.mehul

---

## 📋 Project Overview
The **Virtual City Simulator** is a web-based and C++ powered application designed to demonstrate how core computer science concepts—specifically **Data Structures and Algorithms (DSA)** and **Object-Oriented Programming (OOP)**—can be applied to solve practical city management problems. The platform monitors, manages, and simulates road networks, emergency responses, traffic light controls, resources, and municipal finance through a single unified dashboard.

---

## ⚙️ Core Modules & Implementation Details

* **Road Network (Graph & Adjacency List):** 
  * The entire city road network is represented as a weighted, undirected graph where intersections act as vertices (nodes) and roads act as edges.
  * It is efficiently stored using an adjacency list (`vector<vector<pair<int, int>>> graph`).
* **Buildings & Population:** 
  * Buildings such as houses, hospitals, and restaurants are mapped to intersections. 
  * Population tracking strictly counts people living in houses, excluding hospital/restaurant staff or customers.
* **Vehicles & Route Optimization (Dijkstra's Algorithm):** 
  * Vehicles including cars, ambulances, and food-delivery bikes run across the city road grid. 
  * **Dijkstra's algorithm** is utilized for route optimization, specifically managing rapid ambulance dispatch to accident sites and efficient food delivery from restaurants to houses.
* **Smart Traffic Management:** 
  * Traffic lights are positioned at intersections where three or more roads meet. 
  * The system monitors incoming car counts and waiting durations to compute a priority score (`Priority = Waiting Cars × Waiting Time`). 
  * To prevent starvation, any road with a waiting vehicle for 60 seconds or more automatically gains signal priority.
* **Water, Electricity & City Finance:** 
  * City funds increase via donations and decrease through operational expenses or resource purchases. 
  * If available water and electricity supplies fall below required thresholds, the city finance system triggers automated resource purchases.
* **Web Dashboard:** A clean, interactive web interface provides visual monitoring and control of the entire simulation.

---

## 💻 Tech Stack & Concepts
* **Core Logic / Backend:** C++
* **Core OOP:** Classes, objects, encapsulation, inheritance, constructors, and polymorphism.
* **Core DSA:** Graphs, adjacency lists, weighted/undirected graphs, queues, priority queues, Dijkstra's algorithm, searching, and traversal.
* **Frontend Dashboard:** HTML, CSS.

---

## 🚀 Getting Started
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/ucss-mehul/Virtual-City-Simulator.git](https://github.com/ucss-mehul/Virtual-City-Simulator.git)

# 🏙️ Virtual City Simulator
> **An Interactive Urban Management & Simulation Platform Powered by DSA & OOP**  
> **Team Name:** ucss.mehul

---

## 📌 1. Topic Name
**Virtual City Simulator: A Comprehensive Urban Management and Route Optimization System**

---

## 🔍 2. What is the Problem and Solution?

### **The Problem**
Modern urban environments comprise massive, deeply interconnected systems—including road networks, vehicular traffic, emergency services, buildings, population distributions, water supply, electricity grids, and municipal finance. Managing these components efficiently is exceptionally difficult, especially when faced with unexpected traffic congestion, emergency crises, or scarce resources. 

### **The Solution**
Our project, **Virtual City Simulator**, addresses this challenge by providing a fully functional, interactive digital model of a city. It bridges theoretical computer science concepts with real-world utility by using **Data Structures and Algorithms (DSA)** and **Object-Oriented Programming (OOP)** to seamlessly monitor, manage, and optimize all core city operations from a single unified control platform.

---

## 📊 3. Problem, Real-World Impact & Solution Matrix

| Urban Domain / Subsystem | Real-World Problem | Real-World Impact | Proposed Solution in Simulator |
| :--- | :--- | :--- | :--- |
| **Road Network & Traffic** | Congestion at intersections and inefficient vehicle routing. | High fuel consumption, delays, and frustrated commuters. | Weighted graph representation using adjacency lists; **Dijkstra’s Algorithm** for shortest path routing. |
| **Emergency Response** | Ambulances getting stuck in heavy traffic during medical crises. | Loss of critical response time, putting human lives at extreme risk. | Priority-based routing and automated emergency dispatch module leveraging optimized paths. |
| **Traffic Management** | Unorganized vehicle queues waiting at red lights without priority handling. | Gridlocks and disorganized traffic flow at major city junctions. | Utilization of **Queues and Priority Queues** based on vehicle waiting time and volume. |
| **Municipal Resources & Finance** | Mismanagement of water, electricity, and city budgets. | Utility shortages, operational deficits, and financial mismanagement. | Dedicated Resource & Finance module tracking funds, operational expenses, and utility distribution. |

---

## ✨ 4. Key Features
* **Graph-Based Road Network:** Intersections modeled as nodes and roads modeled as weighted edges using efficient adjacency lists.
* **Dynamic Route Optimization:** Implementation of Dijkstra’s algorithm to compute the most efficient paths between locations for various vehicles.
* **Smart Emergency & Delivery Routing:** Specialized logic for fast-tracking ambulances and food-delivery bikes from source to destination.
* **Advanced Traffic Control:** Queue and priority-queue mechanisms to manage waiting vehicles dynamically based on congestion levels and waiting duration.
* **Building & Population Control:** Modular tracking for houses, hospitals, restaurants, and citizen demographics.
* **Resource & Financial Dashboard:** Real-time monitoring of water/electricity supplies alongside city funds, operational expenses, and resource purchases.
* **Interactive Web UI:** Clean, responsive user dashboard for seamless visualization and control of the entire virtual city.

---

## 💻 5. Technology Used & Tech Stack
* **Core Simulation & Logic Engine:** C++ (utilizing Standard Template Library vectors, queues, priority queues, and custom class structures).
* **Frontend & Dashboard:** HTML5, CSS3, and JavaScript for rendering an intuitive visual representation and control interface.
* **Algorithm Design:** Graph theory, Dijkstra’s shortest path algorithm, and priority-based scheduling logic.
* **Development Methodology:** Modular software architecture enabling isolated component design, unit testing, and smooth system integration.

---

## 🏛️ 6. System Architecture
The application runs on a modular, decoupled architecture where individual subsystems communicate cleanly with the core control engine:

```text
┌─────────────────────────────────────────────────────────┐
│                    User Interface                       │
│        (Web-based Dashboard & Monitoring Panel)         │
└────────────┬───────────────────────────────┬────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Road Network Module   │     │ Building & Population   │
│ (Weighted Graph / Nodes)│     │ (Houses, Hospitals, etc)│
└────────────┬────────────┘     └────────────┬────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┤
│ Route Optimization (DSA)│     │    Vehicle Management   │
│  (Dijkstra's Algorithm) │     │(Cars, Ambulances, Bikes)│
└────────────┬────────────┘     └────────────┬────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Traffic Management    │     │  Resources & Finance    │
│  (Queues/Priority Qs)   │     │ (Water, Power, Budgets) │
└─────────────────────────┘     └─────────────────────────┘
```

🚀 7. Getting Started
To get a local copy up and running, follow these simple steps:

Clone the repository:

Bash
git clone [https://github.com/ucss-mehul/Virtual-City-Simulator.git](https://github.com/ucss-mehul/Virtual-City-Simulator.git)
Navigate to the project directory:

Bash
cd Virtual-City-Simulator
Compile and Run the Core C++ Engine:

Bash
g++ -std=c++17 src/main.cpp -o simulator
./simulator
Launch the Dashboard:

Open src/index.html in your web browser to interact with the visual interface and monitoring panel.

👥 8. Team Details
Name	Role / Section	University Roll No.	Student ID	Email
Mehul Pangtey (Team Lead)	Section B	2518462	25101281550	ucss.mehul@gmail.com
Parakram Bhatt	Section A	2518503	25101280890	parakrambhatt30@gmail.com
Abhinav Chauhan	Section A	2518120	25101280513	kumarabhinav4545@gmail.com
Anjali Nawani	Section C	2518199	25101281728	anjali.nawani19@gmail.com
Shaurya Goel	Section ML1	2518637	2510011439	goelshaurya7488@gmail.com
Piyush Bani Bani	Section C	2518514	25101280853	pbani5833@gmail.com
🙏 9. Thank You
Thank you for checking out the Virtual City Simulator repository! We hope this platform demonstrates a clean and practical integration of core computer science fundamentals with real-world problem-solving.

If you find this project useful or interesting, consider giving it a star ⭐! Feel free to open issues or contribute to the development roadmap.

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <limits>
#include <map>
#include <memory>
#include <queue>
#include <set>
#include <string>
#include <utility>
#include <vector>

using namespace std;

// Units: road lengths in metres, speeds in metres/second, time in seconds.

struct Road {
    int to;
    double length;
};

struct RoadKey {
    int from;
    int to;

    bool operator<(const RoadKey& other) const {
        if (from != other.from) return from < other.from;
        return to < other.to;
    }
};

struct Building {
    string buildingID;
    string type; // House, Hospital, Restaurant
    int population = 0;
    int intersectionID = -1;
};

class RoadNetwork {
private:
    vector<vector<Road>> graph;
    vector<Building> buildings;
    set<pair<int, int>> roadSet;

public:
    explicit RoadNetwork(int intersections = 0) {
        graph.resize(max(0, intersections));
    }

    int intersectionCount() const { return static_cast<int>(graph.size()); }

    bool validIntersection(int id) const {
        return id >= 0 && id < intersectionCount();
    }

    int addIntersection() {
        graph.emplace_back();
        return intersectionCount() - 1;
    }

    bool addRoad(int a, int b, double length) {
        if (!validIntersection(a) || !validIntersection(b) ||
            a == b || !(length > 0)) {
            return false;
        }

        pair<int, int> key = minmax(a, b);
        if (roadSet.count(key)) return false;

        graph[a].push_back({b, length});
        graph[b].push_back({a, length});
        roadSet.insert(key);
        return true;
    }

    bool hasRoad(int a, int b) const {
        if (!validIntersection(a) || !validIntersection(b)) return false;
        for (const auto& edge : graph[a]) {
            if (edge.to == b) return true;
        }
        return false;
    }

    double roadLength(int a, int b) const {
        if (!validIntersection(a)) return -1;
        for (const auto& edge : graph[a]) {
            if (edge.to == b) return edge.length;
        }
        return -1;
    }

    const vector<Road>& neighbours(int id) const {
        static const vector<Road> empty;
        if (!validIntersection(id)) return empty;
        return graph[id];
    }

    int roadDegree(int id) const {
        if (!validIntersection(id)) return 0;
        return static_cast<int>(graph[id].size());
    }

    bool addBuilding(const string& id, const string& type,
                     int intersectionID, int population = 0) {
        if (!validIntersection(intersectionID) || id.empty() ||
            (type != "House" && type != "Hospital" &&
             type != "Restaurant") || population < 0) {
            return false;
        }
        for (const auto& b : buildings) {
            if (b.buildingID == id) return false;
        }
        if (type != "House") population = 0;
        buildings.push_back({id, type, population, intersectionID});
        return true;
    }

    bool hasBuildingAt(int intersectionID, const string& type) const {
        for (const auto& b : buildings) {
            if (b.intersectionID == intersectionID && b.type == type) {
                return true;
            }
        }
        return false;
    }

    int buildingIntersection(const string& id) const {
        for (const auto& b : buildings) {
            if (b.buildingID == id) return b.intersectionID;
        }
        return -1;
    }

    string buildingType(const string& id) const {
        for (const auto& b : buildings) {
            if (b.buildingID == id) return b.type;
        }
        return "";
    }

    vector<int> shortestPath(int source, int destination) const {
        const double INF = numeric_limits<double>::infinity();
        if (!validIntersection(source) || !validIntersection(destination)) {
            return {};
        }

        vector<double> dist(intersectionCount(), INF);
        vector<int> parent(intersectionCount(), -1);
        using State = pair<double, int>;
        priority_queue<State, vector<State>, greater<State>> pq;

        dist[source] = 0;
        pq.push({0, source});

        while (!pq.empty()) {
            auto [d, u] = pq.top();
            pq.pop();
            if (d != dist[u]) continue;
            if (u == destination) break;

            for (const auto& edge : graph[u]) {
                double nd = d + edge.length;
                if (nd < dist[edge.to]) {
                    dist[edge.to] = nd;
                    parent[edge.to] = u;
                    pq.push({nd, edge.to});
                }
            }
        }

        if (!isfinite(dist[destination])) return {};
        vector<int> path;
        for (int at = destination; at != -1; at = parent[at]) {
            path.push_back(at);
        }
        reverse(path.begin(), path.end());
        return path;
    }

    void displayNetwork() const {
        cout << "\n--- ROAD NETWORK ---\n";
        for (int i = 0; i < intersectionCount(); ++i) {
            cout << "I" << i << " (degree " << roadDegree(i) << "): ";
            if (graph[i].empty()) cout << "no roads";
            for (size_t j = 0; j < graph[i].size(); ++j) {
                if (j) cout << ", ";
                cout << "I" << graph[i][j].to << " ["
                     << graph[i][j].length << " m]";
            }
            cout << '\n';
        }
    }

    void displayBuildings() const {
        cout << "\n--- BUILDINGS ---\n";
        if (buildings.empty()) cout << "No buildings registered.\n";
        for (const auto& b : buildings) {
            cout << b.buildingID << " (" << b.type << ") at I"
                 << b.intersectionID;
            if (b.type == "House") cout << ", population " << b.population;
            cout << '\n';
        }
    }
};

struct WaitingVehicle {
    int vehicleID;
    int incomingFrom;
    double enteredQueueAt;
};

class TrafficLight {
public:
    int intersectionID;
    int greenFrom = -1;
    double phaseStartedAt = 0;
    double minimumGreenSeconds = 5.0;
    double amberSeconds = 1.0;
    bool amber = false;

    explicit TrafficLight(int id = -1) : intersectionID(id) {}

    bool isGreenFor(int from) const {
        return !amber && greenFrom == from;
    }
};

class Vehicle {
public:
    int id;
    string category;
    int currentIntersection;
    int destinationIntersection;
    vector<int> route;
    size_t nextRouteIndex = 1;
    double speed;
    double distanceOnRoad = 0.0;
    bool waitingAtSignal = false;
    bool taskCompleted = false;
    bool queued = false;
    double waitStartedAt = -1.0;
    double totalWaitingSeconds = 0.0;
    bool isParked = false;

    // Constructor for moving vehicle
    Vehicle(int vehicleID, string type, int start, int destination,
            vector<int> assignedRoute, double metresPerSecond)
        : id(vehicleID), category(std::move(type)),
          currentIntersection(start), destinationIntersection(destination),
          route(std::move(assignedRoute)), speed(metresPerSecond), isParked(false) {
        taskCompleted = (start == destination);
    }

    // Constructor for parked vehicle
    Vehicle(int vehicleID, string type, int start)
        : id(vehicleID), category(std::move(type)),
          currentIntersection(start), destinationIntersection(-1),
          speed(0.0), isParked(true), taskCompleted(false) {}

    int nextIntersection() const {
        if (isParked || nextRouteIndex >= route.size()) return -1;
        return route[nextRouteIndex];
    }
};

class VehicleManager {
private:
    vector<unique_ptr<Vehicle>> vehicles;
    int nextID = 1;

public:
    Vehicle* find(int id) {
        for (auto& v : vehicles) if (v->id == id) return v.get();
        return nullptr;
    }

    const vector<unique_ptr<Vehicle>>& all() const { return vehicles; }

    int create(const string& category, int start, int destination,
               bool parked, const RoadNetwork& network) {
        if (category != "Car" && category != "Ambulance" &&
            category != "DeliveryBike") {
            cout << "Invalid category. Choose Car, Ambulance, or DeliveryBike.\n";
            return -1;
        }
        if (!network.validIntersection(start)) {
            cout << "Invalid start intersection.\n";
            return -1;
        }

        // Real-world validation checks based on building locations
        if (category == "Ambulance" && !network.hasBuildingAt(start, "Hospital")) {
            cout << "Error: Ambulance must start from an intersection with a Hospital!\n";
            return -1;
        }
        if (category == "DeliveryBike" && !network.hasBuildingAt(start, "Restaurant")) {
            cout << "Error: Delivery Bike must start from an intersection with a Restaurant!\n";
            return -1;
        }

        int id = nextID++;

        if (parked) {
            vehicles.push_back(make_unique<Vehicle>(id, category, start));
            cout << category << " V" << id << " created and parked at I" << start << ".\n";
            return id;
        }

        if (!network.validIntersection(destination)) {
            cout << "Invalid destination intersection.\n";
            return -1;
        }

        vector<int> path = network.shortestPath(start, destination);
        if (path.empty()) {
            cout << "No route exists between those intersections.\n";
            return -1;
        }

        double speed = category == "Ambulance" ? 15.0 :
                       category == "DeliveryBike" ? 6.0 : 10.0;
        
        vehicles.push_back(make_unique<Vehicle>(
            id, category, start, destination, path, speed));
        
        cout << category << " V" << id << " created with route: ";
        for (size_t i = 0; i < path.size(); ++i) {
            if (i) cout << " -> ";
            cout << "I" << path[i];
        }
        cout << '\n';
        return id;
    }
};

class TrafficManager {
private:
    const RoadNetwork& network;
    VehicleManager& vehicleManager;
    map<int, TrafficLight> lights;
    map<RoadKey, queue<WaitingVehicle>> queues;
    set<RoadKey> dischargedThisTick;
    double now = 0.0;
    double tickSeconds = 1.0;
    double greenPhaseSeconds = 8.0;

    static RoadKey keyFor(int from, int to) { return {from, to}; }

    bool hasQueue(int from, int intersection) const {
        auto it = queues.find(keyFor(from, intersection));
        return it != queues.end() && !it->second.empty();
    }

    int queueCount(int from, int intersection) const {
        auto it = queues.find(keyFor(from, intersection));
        return it == queues.end() ? 0 : static_cast<int>(it->second.size());
    }

    double oldestWait(int from, int intersection) const {
        auto it = queues.find(keyFor(from, intersection));
        if (it == queues.end() || it->second.empty()) return 0.0;
        return max(0.0, now - it->second.front().enteredQueueAt);
    }

    double priorityScore(int from, int intersection) const {
        return 10.0 * queueCount(from, intersection) +
               0.5 * oldestWait(from, intersection);
    }

    bool hasOverdueVehicle(int from, int intersection) const {
        return hasQueue(from, intersection) &&
               oldestWait(from, intersection) >= 60.0;
    }

    void installEligibleLights() {
        for (int i = 0; i < network.intersectionCount(); ++i) {
            if (network.roadDegree(i) >= 3 && !lights.count(i)) {
                lights.emplace(i, TrafficLight(i));
                cout << "Traffic light installed at I" << i << ".\n";
            }
        }
    }

    void enqueueVehicle(Vehicle& v, int from, int intersection) {
        if (v.queued) return;
        queues[keyFor(from, intersection)].push({v.id, from, now});
        v.queued = true;
        v.waitingAtSignal = true;
        v.waitStartedAt = now;
        cout << "V" << v.id << " joined queue on I" << from
             << " -> I" << intersection << " at t=" << now << "s.\n";
    }

    void chooseGreenRoad(int intersection, TrafficLight& light) {
        vector<int> incoming;
        for (const auto& edge : network.neighbours(intersection)) {
            incoming.push_back(edge.to);
        }

        bool overdueExists = false;
        for (int from : incoming) {
            if (hasOverdueVehicle(from, intersection)) {
                overdueExists = true;
                break;
            }
        }

        int bestFrom = -1;
        double bestScore = -numeric_limits<double>::infinity();
        for (int from : incoming) {
            if (!hasQueue(from, intersection)) continue;
            if (overdueExists && !hasOverdueVehicle(from, intersection)) continue;

            double score = priorityScore(from, intersection);
            if (score > bestScore) {
                bestScore = score;
                bestFrom = from;
            }
        }

        if (bestFrom == -1) {
            if (light.greenFrom != -1 &&
                network.hasRoad(light.greenFrom, intersection)) {
                return;
            }
            if (!incoming.empty()) bestFrom = incoming.front();
            else return;
        }

        if (light.greenFrom != bestFrom) {
            light.greenFrom = bestFrom;
            light.phaseStartedAt = now;
            light.amber = false;
            cout << "Signal at I" << intersection << ": green for incoming road I"
                 << bestFrom << " -> I" << intersection << ".\n";
        }
    }

    void updateSignals() {
        for (auto& entry : lights) {
            int intersection = entry.first;
            TrafficLight& light = entry.second;

            if (light.greenFrom == -1) {
                chooseGreenRoad(intersection, light);
                light.phaseStartedAt = now;
                continue;
            }

            if (light.amber) {
                if (now - light.phaseStartedAt >= light.amberSeconds) {
                    light.amber = false;
                    chooseGreenRoad(intersection, light);
                    light.phaseStartedAt = now;
                }
                continue;
            }

            if (now - light.phaseStartedAt >= greenPhaseSeconds &&
                now - light.phaseStartedAt >= light.minimumGreenSeconds) {
                light.amber = true;
                light.phaseStartedAt = now;
                cout << "Signal at I" << intersection
                     << ": amber/clearance interval.\n";
            }
        }
    }

    void advanceThroughIntersection(Vehicle& v, int next, const char* verb) {
        v.currentIntersection = next;
        v.distanceOnRoad = 0.0;
        ++v.nextRouteIndex;
        cout << "V" << v.id << " " << verb << " I" << next
             << " at t=" << now << "s.\n";
        if (v.currentIntersection == v.destinationIntersection ||
            v.nextRouteIndex >= v.route.size()) {
            v.taskCompleted = true;
            cout << "V" << v.id << " completed its journey/task.\n";
        }
    }

    void updateVehicle(Vehicle& v) {
        if (v.isParked || v.taskCompleted || v.route.empty()) return;

        int next = v.nextIntersection();
        if (next == -1) {
            v.taskCompleted = true;
            return;
        }

        int from = v.currentIntersection;
        double length = network.roadLength(from, next);
        if (length < 0) {
            cout << "Route error for V" << v.id << ": missing road I"
                 << from << " -> I" << next << ".\n";
            v.taskCompleted = true;
            return;
        }

        RoadKey key = keyFor(from, next);
        auto lightIt = lights.find(next);
        bool hasSignal = lightIt != lights.end();
        bool green = !hasSignal || lightIt->second.isGreenFor(from);

        if (v.queued) {
            auto qIt = queues.find(key);
            bool isFront = qIt != queues.end() && !qIt->second.empty() &&
                           qIt->second.front().vehicleID == v.id;
            if (!green || !isFront || dischargedThisTick.count(key)) return;

            qIt->second.pop();
            dischargedThisTick.insert(key);
            v.queued = false;
            v.waitingAtSignal = false;
            if (v.waitStartedAt >= 0) {
                v.totalWaitingSeconds += max(0.0, now - v.waitStartedAt);
            }
            v.waitStartedAt = -1.0;
            advanceThroughIntersection(v, next, "passed intersection");
            return;
        }

        double remaining = length - v.distanceOnRoad;
        double stepDistance = v.speed * tickSeconds;

        if (remaining <= stepDistance) {
            if (hasSignal) {
                bool blocked = !green || hasQueue(from, next) ||
                               dischargedThisTick.count(key);
                if (blocked) {
                    v.distanceOnRoad = length;
                    enqueueVehicle(v, from, next);
                    return;
                }
                dischargedThisTick.insert(key);
            }
            advanceThroughIntersection(v, next, "reached");
        } else {
            v.distanceOnRoad += stepDistance;
        }
    }

public:
    TrafficManager(const RoadNetwork& net, VehicleManager& vm)
        : network(net), vehicleManager(vm) {
        installEligibleLights();
    }

    void refreshSignals() { installEligibleLights(); }

    void tick() {
        now += tickSeconds;
        dischargedThisTick.clear();
        refreshSignals();
        updateSignals();

        for (const auto& ptr : vehicleManager.all()) {
            updateVehicle(*ptr);
        }
    }

    void runTicks(int count) {
        for (int i = 0; i < count; ++i) tick();
    }

    void displayStatus() const {
        ios_base::fmtflags oldFlags = cout.flags();
        streamsize oldPrecision = cout.precision();
        cout << fixed << setprecision(1);

        cout << "\n========== SIMULATION STATUS ==========\n";
        cout << "Simulation time: " << now << " seconds\n";

        // Vehicle statistics summary
        int totalVehicles = vehicleManager.all().size();
        int parkedCount = 0;
        int movingCount = 0;
        int completedCount = 0;

        for (const auto& ptr : vehicleManager.all()) {
            if (ptr->isParked) parkedCount++;
            else if (ptr->taskCompleted) completedCount++;
            else movingCount++;
        }

        cout << "\nVehicle Statistics:\n";
        cout << "  - Total Vehicles in City : " << totalVehicles << "\n"
             << "  - Moving / Active        : " << movingCount << "\n"
             << "  - Parked                 : " << parkedCount << "\n"
             << "  - Completed Journeys     : " << completedCount << "\n";

        cout << "\nTraffic lights:\n";
        if (lights.empty()) cout << "No signalized intersections (need degree >= 3).\n";
        for (const auto& entry : lights) {
            const TrafficLight& light = entry.second;
            cout << "I" << entry.first << ": ";
            if (light.amber) cout << "AMBER/CLEARANCE";
            else if (light.greenFrom == -1) cout << "UNINITIALIZED";
            else cout << "GREEN for I" << light.greenFrom << " -> I"
                       << entry.first;
            cout << '\n';
        }

        cout << "\nVehicle Details:\n";
        if (vehicleManager.all().empty()) cout << "No vehicles registered.\n";
        for (const auto& ptr : vehicleManager.all()) {
            const Vehicle& v = *ptr;
            cout << "V" << v.id << " [" << v.category << "] ";
            if (v.isParked) {
                cout << "PARKED at I" << v.currentIntersection;
            } else if (v.taskCompleted) {
                cout << "COMPLETED at I" << v.currentIntersection;
            } else if (v.queued) {
                cout << "WAITING before I" << v.nextIntersection()
                     << " from I" << v.currentIntersection
                     << ", wait " << max(0.0, now - v.waitStartedAt) << "s";
            } else {
                cout << "at/after I" << v.currentIntersection
                     << ", next I" << v.nextIntersection();
                if (v.nextIntersection() != -1) {
                    double len = network.roadLength(v.currentIntersection,
                                                    v.nextIntersection());
                    cout << ", road progress " << v.distanceOnRoad
                         << "/" << len << " m";
                }
            }
            cout << ", total waiting " << v.totalWaitingSeconds << "s\n";
        }

        cout << "\nNon-empty queues:\n";
        bool any = false;
        for (const auto& entry : queues) {
            if (entry.second.empty()) continue;
            any = true;
            const RoadKey& key = entry.first;
            cout << "I" << key.from << " -> I" << key.to
                 << ": " << entry.second.size() << " vehicle(s), priority "
                 << priorityScore(key.from, key.to)
                 << ", oldest wait " << oldestWait(key.from, key.to) << "s";
            if (hasOverdueVehicle(key.from, key.to)) cout << " [60s PRIORITY]";
            cout << "\n  Queue order: ";
            queue<WaitingVehicle> copy = entry.second;
            bool first = true;
            while (!copy.empty()) {
                if (!first) cout << " -> ";
                cout << "V" << copy.front().vehicleID;
                copy.pop();
                first = false;
            }
            cout << '\n';
        }
        if (!any) cout << "No vehicles waiting.\n";
        cout << "=======================================\n";

        cout.flags(oldFlags);
        cout.precision(oldPrecision);
    }

    double currentTime() const { return now; }
};

template <typename T>
bool readValue(T& out) {
    if (cin >> out) return true;
    if (cin.eof()) return false;
    cin.clear();
    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    return false;
}

void printMenu() {
    cout << "\n========== VIRTUAL CITY TRAFFIC ==========\n"
         << "1. Display road network\n"
         << "2. Add intersection\n"
         << "3. Add road\n"
         << "4. Add building\n"
         << "5. Display buildings\n"
         << "6. Create vehicle (Moving or Parked)\n"
         << "7. Advance simulation by N seconds\n"
         << "8. Display traffic/vehicle status\n"
         << "9. Refresh signal detection\n"
         << "0. Exit\n"
         << "Choice: ";
}

int main() {
    RoadNetwork city(5);
    city.addRoad(0, 1, 100);
    city.addRoad(1, 2, 80);
    city.addRoad(2, 3, 100);
    city.addRoad(3, 4, 80);
    city.addRoad(4, 2, 90);
    city.addRoad(1, 3, 120);

    city.addBuilding("H1", "House", 0, 4);
    city.addBuilding("H2", "House", 4, 3);
    city.addBuilding("Hospital1", "Hospital", 1);
    city.addBuilding("Restaurant1", "Restaurant", 3);

    VehicleManager vehicles;
    TrafficManager traffic(city, vehicles);

    cout << "Virtual City Simulator initialized with a sample city.\n";
    city.displayNetwork();
    city.displayBuildings();

    while (true) {
        printMenu();
        int choice;
        if (!readValue(choice)) {
            if (cin.eof()) {
                cout << "\nInput closed. Exiting.\n";
                break;
            }
            cout << "Invalid input. Please enter a number.\n";
            continue;
        }

        if (choice == 0) {
            cout << "Exiting traffic simulator.\n";
            break;
        } else if (choice == 1) {
            city.displayNetwork();
        } else if (choice == 2) {
            int id = city.addIntersection();
            cout << "Created I" << id << ". Add roads, then refresh signals.\n";
        } else if (choice == 3) {
            int a, b;
            double length;
            cout << "Enter start intersection, end intersection, length in metres: ";
            if (!readValue(a) || !readValue(b) || !readValue(length)) {
                cout << "Invalid input.\n";
                if (cin.eof()) break;
                continue;
            }
            if (city.addRoad(a, b, length)) {
                cout << "Road added successfully.\n";
                traffic.refreshSignals();
            } else {
                cout << "Could not add road. Check IDs, length, and duplicates.\n";
            }
        } else if (choice == 4) {
            string id, type;
            int intersection, population = 0;
            cout << "Enter building ID and type (House/Hospital/Restaurant): ";
            if (!readValue(id) || !readValue(type)) {
                cout << "Invalid input.\n";
                if (cin.eof()) break;
                continue;
            }
            cout << "Enter intersection ID: ";
            if (!readValue(intersection)) {
                cout << "Invalid input.\n";
                if (cin.eof()) break;
                continue;
            }
            if (type == "House") {
                cout << "Enter population: ";
                if (!readValue(population)) {
                    cout << "Invalid input.\n";
                    if (cin.eof()) break;
                    continue;
                }
            }
            if (city.addBuilding(id, type, intersection, population))
                cout << "Building added.\n";
            else
                cout << "Could not add building. Check ID, type, intersection, population.\n";
        } else if (choice == 5) {
            city.displayBuildings();
        } else if (choice == 6) {
            string category;
            int start, destination = -1;
            char parkedChoice;
            cout << "Vehicle type (Car/Ambulance/DeliveryBike): ";
            if (!readValue(category)) {
                cout << "Invalid input.\n";
                if (cin.eof()) break;
                continue;
            }
            cout << "Is the vehicle parked? (y/n): ";
            if (!readValue(parkedChoice)) {
                cout << "Invalid input.\n";
                if (cin.eof()) break;
                continue;
            }

            bool isParked = (parkedChoice == 'y' || parkedChoice == 'Y');

            if (isParked) {
                cout << "Enter intersection ID where it is parked: ";
                if (!readValue(start)) {
                    cout << "Invalid input.\n";
                    if (cin.eof()) break;
                    continue;
                }
                vehicles.create(category, start, destination, true, city);
            } else {
                cout << "Enter start and destination intersection IDs: ";
                if (!readValue(start) || !readValue(destination)) {
                    cout << "Invalid input.\n";
                    if (cin.eof()) break;
                    continue;
                }
                vehicles.create(category, start, destination, false, city);
            }
        } else if (choice == 7) {
            int seconds;
            cout << "Advance how many simulation seconds? ";
            if (!readValue(seconds)) {
                cout << "Invalid input.\n";
                if (cin.eof()) break;
                continue;
            }
            if (seconds < 0 || seconds > 3600) {
                cout << "Please enter a value between 0 and 3600.\n";
            } else {
                traffic.runTicks(seconds);
                cout << "Simulation advanced.\n";
            }
        } else if (choice == 8) {
            traffic.displayStatus();
        } else if (choice == 9) {
            traffic.refreshSignals();
            cout << "Signal detection refreshed.\n";
        } else {
            cout << "Invalid menu option.\n";
        }
    }

    return 0;
}

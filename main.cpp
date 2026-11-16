#include <iostream>
#include <string>
#include <vector>
#include <utility>
#include <queue>
#include <functional>
#include <iomanip>
using namespace std;

const int MAX = 100;
const int MAXV = 200;

struct Building {
    string id, type;
    int intersection, population;
};

struct Vehicle {
    int id;
    string type;
    int current, destination;
    int route[MAX], routeSize, nextIndex;
    double speed, distance, totalDistance;
    bool parked, completed;
    bool onRoad, waiting;
};

class RoadNetwork {
public:
    vector<pair<int, double>> adj[MAX];
    int intersections;
    Building buildings[MAX];
    int buildingCount;
    int roadCapacity[MAX][MAX] = {};
    int roadOccupancy[MAX][MAX] = {};

    RoadNetwork(int n = 5) {
        intersections = n;
        buildingCount = 0;

    }

    bool valid(int id) {
        return id >= 0 && id < intersections;
    }

    int addIntersection() {
        if (intersections >= MAX)
            return -1;

        return intersections++;
    }

    bool addRoad(int a, int b, double length) {
        if (!valid(a) || !valid(b) || a == b || length <= 0)
            return false;

        // Check whether a road already connects a and b.
        for (const auto &road : adj[a]) {
            if (road.first == b)
                return false;
        }

        // Roads are bidirectional, so store each connection both ways.
        adj[a].push_back({b, length});
        adj[b].push_back({a, length});
        // Capacity is tracked separately for each travel direction.
        roadCapacity[a][b] = roadCapacity[b][a] = 3;
        return true;
    }

    bool canEnterRoad(int from, int to) {
        return valid(from) && valid(to) &&
               roadCapacity[from][to] > 0 &&
               roadOccupancy[from][to] < roadCapacity[from][to];
    }

    void enterRoad(int from, int to) {
        if (valid(from) && valid(to)) roadOccupancy[from][to]++;
    }

    void leaveRoad(int from, int to) {
        if (valid(from) && valid(to) && roadOccupancy[from][to] > 0)
            roadOccupancy[from][to]--;
    }

    // Demonstration signal: even-numbered exits and odd-numbered exits
    // receive alternating 30-second green phases, with 5-second yellow phases.
    bool signalAllows(int /*intersection*/, int next, int time) {
        int phase = time % 70;
        int greenGroup = (phase < 35) ? 0 : 1;
        return (phase % 35) < 30 && (next % 2 == greenGroup);
    }

    string signalState(int next, int time) {
        int phase = time % 70;
        int group = next % 2;
        if (group == 0) {
            if (phase < 30) return "GREEN";
            if (phase < 35) return "YELLOW";
            return "RED";
        }
        if (phase >= 35 && phase < 65) return "GREEN";
        if (phase >= 65) return "YELLOW";
        return "RED";
    }

    bool addBuilding(string id, string type,
                     int intersection, int population = 0) {
        if (!valid(intersection) ||
            buildingCount >= MAX ||
            id == "" || population < 0)
            return false;

        if (type != "House" &&
            type != "Hospital" &&
            type != "Restaurant")
            return false;

        for (int i = 0; i < buildingCount; i++) {
            if (buildings[i].id == id)
                return false;
        }

        if (type != "House")
            population = 0;

        buildings[buildingCount++] =
            {id, type, intersection, population};

        return true;
    }

    bool hasBuilding(int intersection, string type) {
        for (int i = 0; i < buildingCount; i++) {
            if (buildings[i].intersection == intersection &&
                buildings[i].type == type)
                return true;
        }

        return false;
    }

    void displayNetwork() {
        cout << "\n--- ROAD NETWORK ---\n";

        for (int i = 0; i < intersections; i++) {
            cout << "I" << i << ": ";
            bool found = false;

            for (const auto &road : adj[i]) {
                cout << "I" << road.first << " ("
                     << road.second << " m, capacity "
                     << roadCapacity[i][road.first] << ") ";
                found = true;
            }

            if (!found)
                cout << "No roads";

            cout << "\n";
        }
    }

    void displayBuildings() {
        cout << "\n--- BUILDINGS ---\n";

        if (buildingCount == 0)
            cout << "No buildings registered.\n";

        for (int i = 0; i < buildingCount; i++) {
            cout << buildings[i].id << " ("
                 << buildings[i].type << ") at I"
                 << buildings[i].intersection;

            if (buildings[i].type == "House")
                cout << ", population "
                     << buildings[i].population;

            cout << "\n";
        }
    }

    void displayPopulation() {
        int total = 0;

        cout << "\n--- POPULATION MANAGEMENT ---\n";

        for (int i = 0; i < buildingCount; i++) {
            if (buildings[i].type == "House") {
                cout << buildings[i].id
                     << ": " << buildings[i].population
                     << " people\n";

                total += buildings[i].population;
            }
        }

        cout << "Total population: " << total << "\n";
    }

    int shortestPath(int source, int destination,
                     int path[]) {
        if (!valid(source) || !valid(destination))
            return 0;

        const double INF = 1e18;
        double dist[MAX];
        int parent[MAX];

        for (int i = 0; i < intersections; i++) {
            dist[i] = INF;
            parent[i] = -1;
        }

        // Min-priority queue stores {distance, intersection}.
        // The intersection with the smallest distance comes out first.
        priority_queue<
            pair<double, int>,
            vector<pair<double, int>>,
            greater<pair<double, int>>
        > pq;

        dist[source] = 0;
        pq.push({0, source});

        // Dijkstra using both an adjacency list and a min-priority queue.
        while (!pq.empty()) {
            double currentDist = pq.top().first;
            int u = pq.top().second;
            pq.pop();

            // Ignore an outdated queue entry.
            if (currentDist > dist[u])
                continue;

            // Visit only the neighbors actually connected to u.
            for (const auto &road : adj[u]) {
                int v = road.first;
                double length = road.second;
                double newDist = dist[u] + length;

                if (newDist < dist[v]) {
                    dist[v] = newDist;
                    parent[v] = u;
                    pq.push({newDist, v});
                }
            }
        }

        if (dist[destination] == INF)
            return 0;

        // Reconstruct the path backwards using parent[].
        int temp[MAX];
        int count = 0;

        for (int at = destination; at != -1; at = parent[at])
            temp[count++] = at;

        // Reverse it so the path goes source -> destination.
        for (int i = 0; i < count; i++)
            path[i] = temp[count - 1 - i];

        return count;
    }
};

class VehicleManager {
public:
    Vehicle vehicles[MAXV];
    int count;
    double currentTime;

    VehicleManager() {
        count = 0;
        currentTime = 0;
    }

    int create(string type, int start, int destination,
               bool parked, RoadNetwork &city) {
        if (count >= MAXV) {
            cout << "Vehicle limit reached.\n";
            return -1;
        }

        if (type != "Car" &&
            type != "Ambulance" &&
            type != "DeliveryBike") {
            cout << "Invalid vehicle type.\n";
            return -1;
        }

        if (!city.valid(start)) {
            cout << "Invalid starting intersection.\n";
            return -1;
        }

        if (type == "Ambulance" &&
            !city.hasBuilding(start, "Hospital")) {
            cout << "Ambulance must start at a Hospital.\n";
            return -1;
        }

        if (type == "DeliveryBike" &&
            !city.hasBuilding(start, "Restaurant")) {
            cout << "DeliveryBike must start at a Restaurant.\n";
            return -1;
        }

        int path[MAX];
        int size = 0;

        if (!parked) {
            if (!city.valid(destination)) {
                cout << "Invalid destination.\n";
                return -1;
            }

            if (type == "DeliveryBike" &&
                !city.hasBuilding(destination, "House")) {
                cout << "Food delivery destination must contain a House.\\n";
                return -1;
            }

            size = city.shortestPath(start, destination, path);

            if (size == 0) {
                cout << "No route exists.\n";
                return -1;
            }
        }

        Vehicle &v = vehicles[count];

        v.id = count + 1;
        v.type = type;
        v.current = start;
        v.destination = parked ? -1 : destination;
        v.parked = parked;
        v.completed = !parked && start == destination;
        v.distance = 0;
        v.totalDistance = 0;
        v.nextIndex = 1;
        v.routeSize = size;
        v.onRoad = false;
        v.waiting = false;

        v.speed = type == "Ambulance" ? 15 :
                  type == "DeliveryBike" ? 6 : 10;

        for (int i = 0; i < size; i++)
            v.route[i] = path[i];

        count++;

        cout << type << " V" << v.id;

        if (parked) {
            cout << " parked at I" << start;
        } else {
            cout << "\nRoute: ";

            for (int i = 0; i < size; i++) {
                if (i > 0)
                    cout << " -> ";

                cout << "I" << path[i];
            }

            if (v.completed)
                cout << "\nAlready at destination.";
        }

        cout << "\n";
        return v.id;
    }

    void advance(RoadNetwork &city, int seconds) {
        for (int t = 0; t < seconds; t++) {
            currentTime++;

            // Ambulances are considered before normal vehicles at each tick.
            priority_queue<pair<int, int>> emergencyQueue;
            queue<int> normalQueue;

            for (int i = 0; i < count; i++) {
                if (vehicles[i].parked || vehicles[i].completed) continue;
                if (vehicles[i].type == "Ambulance")
                    emergencyQueue.push({3, -i});
                else
                    normalQueue.push(i);
            }

            vector<int> processingOrder;
            while (!emergencyQueue.empty()) {
                processingOrder.push_back(-emergencyQueue.top().second);
                emergencyQueue.pop();
            }
            while (!normalQueue.empty()) {
                processingOrder.push_back(normalQueue.front());
                normalQueue.pop();
            }

            for (int i : processingOrder) {
                Vehicle &v = vehicles[i];
                if (v.parked || v.completed) continue;

                int next = v.route[v.nextIndex];
                double length = 0;
                for (const auto &road : city.adj[v.current]) {
                    if (road.first == next) {
                        length = road.second;
                        break;
                    }
                }

                if (length <= 0) {
                    v.completed = true;
                    continue;
                }

                // A vehicle enters a road only when capacity and signal permit it.
                if (!v.onRoad) {
                    if (!city.signalAllows(v.current, next,
                                           static_cast<int>(currentTime))) {
                        v.waiting = true;
                        continue;
                    }
                    if (!city.canEnterRoad(v.current, next)) {
                        v.waiting = true;
                        continue;
                    }
                    city.enterRoad(v.current, next);
                    v.onRoad = true;
                    v.waiting = false;
                }

                double remaining = length - v.distance;
                double movement = v.speed;

                if (movement >= remaining) {
                    v.totalDistance += remaining;
                    v.distance = 0;
                    city.leaveRoad(v.current, next);
                    v.onRoad = false;
                    v.current = next;
                    v.nextIndex++;

                    cout << "V" << v.id << " reached I" << next
                         << " at " << currentTime << " seconds.\n";

                    if (v.current == v.destination ||
                        v.nextIndex >= v.routeSize) {
                        v.completed = true;
                        cout << "V" << v.id << " journey completed.\n";
                    }
                } else {
                    v.distance += movement;
                    v.totalDistance += movement;
                    v.waiting = false;
                }
            }
        }

        cout << "Simulation advanced by " << seconds << " seconds.\n";
    }

    void displayStatus() {
        cout << "\n--- SIMULATION STATUS ---\n";
        cout << "Time: " << currentTime << " seconds\n";

        int parked = 0;
        int moving = 0;
        int completed = 0;

        for (int i = 0; i < count; i++) {
            Vehicle &v = vehicles[i];

            cout << "\nV" << v.id
                 << " [" << v.type << "] ";

            if (v.parked) {
                cout << "PARKED at I" << v.current;
                parked++;
            } else if (v.completed) {
                cout << "COMPLETED at I" << v.current;
                completed++;
            } else if (v.waiting) {
                cout << "WAITING at I" << v.current
                     << " for road capacity / green signal";
                moving++;
            } else {
                cout << "MOVING from I" << v.current
                     << " to I" << v.route[v.nextIndex];
                moving++;
            }

            cout << "\nDistance travelled: "
                 << v.totalDistance << " m";

            if (!v.parked && !v.completed && v.onRoad)
                cout << "\nProgress on current road: "
                     << v.distance << " m";

            cout << "\n";
        }

        cout << "\nTotal vehicles: " << count
             << "\nMoving: " << moving
             << "\nParked: " << parked
             << "\nCompleted: " << completed << "\n";
    }
};


// Utility distribution, consumption tracking and city-budget management.
class CityManagement {
    double waterSupply, electricitySupply;
    double waterConsumed, electricityConsumed;
    double remainingBudget, totalSpent;
    vector<pair<string, double>> allocations;

public:
    CityManagement() : waterSupply(10000), electricitySupply(5000),
        waterConsumed(0), electricityConsumed(0),
        remainingBudget(500000), totalSpent(0) {}

    void calculateDemand(RoadNetwork &city, double &water, double &electricity) {
        int population = 0, hospitals = 0, restaurants = 0;
        for (int i = 0; i < city.buildingCount; i++) {
            Building &b = city.buildings[i];
            if (b.type == "House") population += b.population;
            else if (b.type == "Hospital") hospitals++;
            else if (b.type == "Restaurant") restaurants++;
        }
        // Example assumptions: 150 L/person/day and 2 kWh/person/day.
        water = population * 150.0 + hospitals * 500.0 + restaurants * 300.0;
        electricity = population * 2.0 + hospitals * 50.0 + restaurants * 30.0;
    }

    void setSupply(double water, double electricity) {
        if (water < 0 || electricity < 0) {
            cout << "Supply cannot be negative.\n";
            return;
        }
        waterSupply = water;
        electricitySupply = electricity;
        cout << "Water and electricity supply updated.\n";
    }

    void updateConsumption(RoadNetwork &city, int seconds) {
        double water, electricity;
        calculateDemand(city, water, electricity);
        waterConsumed += water * seconds / 86400.0;
        electricityConsumed += electricity * seconds / 86400.0;
    }

    void displayUtilities(RoadNetwork &city) {
        double water, electricity;
        calculateDemand(city, water, electricity);
        cout << fixed << setprecision(2);
        cout << "\n--- WATER AND ELECTRICITY DISTRIBUTION ---\n";
        cout << "Water demand: " << water << " litres/day\n";
        cout << "Water supply: " << waterSupply << " litres/day\n";
        cout << "Water status: " << (waterSupply >= water ? "SUFFICIENT" : "SHORTAGE") << "\n";
        cout << "Electricity demand: " << electricity << " kWh/day\n";
        cout << "Electricity supply: " << electricitySupply << " kWh/day\n";
        cout << "Electricity status: "
             << (electricitySupply >= electricity ? "SUFFICIENT" : "SHORTAGE") << "\n";
        cout << "Water consumed in simulation: " << waterConsumed << " litres\n";
        cout << "Electricity consumed in simulation: "
             << electricityConsumed << " kWh\n";
    }

    void displayBudget() {
        cout << fixed << setprecision(2);
        cout << "\n--- CITY BUDGET ---\n";
        cout << "Initial budget: Rs. " << remainingBudget + totalSpent << "\n";
        cout << "Spent: Rs. " << totalSpent << "\n";
        cout << "Remaining: Rs. " << remainingBudget << "\n";
        if (allocations.empty()) cout << "No allocations yet.\n";
        for (const auto &a : allocations)
            cout << a.first << ": Rs. " << a.second << "\n";
    }

    void allocateBudget(string department, double amount) {
        if (department.empty() || amount <= 0) {
            cout << "Enter a valid department and positive amount.\n";
            return;
        }
        if (amount > remainingBudget) {
            cout << "Insufficient city budget.\n";
            return;
        }
        remainingBudget -= amount;
        totalSpent += amount;
        allocations.push_back({department, amount});
        cout << "Rs. " << amount << " allocated to " << department << ".\n";
    }
};

// Console-based traffic visualization: vehicle counts at intersections
// and active traffic on each outgoing road.
void displayTrafficVisualization(RoadNetwork &city, VehicleManager &vehicles) {
    cout << "\n--- LIVE TRAFFIC VISUALIZATION ---\n";
    for (int i = 0; i < city.intersections; i++) {
        int atIntersection = 0;
        for (int j = 0; j < vehicles.count; j++) {
            Vehicle &v = vehicles.vehicles[j];
            if (!v.parked && !v.completed && v.current == i)
                atIntersection++;
        }
        cout << "I" << i << " [active vehicles: " << atIntersection << "] -> ";
        if (city.adj[i].empty()) cout << "No connected roads";
        for (const auto &road : city.adj[i]) {
            cout << "I" << road.first << " (" << road.second
                 << "m, traffic " << city.roadOccupancy[i][road.first]
                 << "/" << city.roadCapacity[i][road.first]
                 << ", signal " << city.signalState(road.first,
                         static_cast<int>(vehicles.currentTime)) << ") ";
        }
        cout << "\n";
    }
    cout << "Traffic is shown as occupied road slots / road capacity.\n";
    cout << "Signal phases alternate by exit ID parity (demo model).\n";
}

int selectBuildingIntersection(RoadNetwork &city, const string &type,
                               const string &prompt) {
    vector<int> matches;
    cout << "\nAvailable " << type << " locations:\n";
    for (int i = 0; i < city.buildingCount; i++) {
        if (city.buildings[i].type == type) {
            matches.push_back(city.buildings[i].intersection);
            cout << matches.size() << ". " << city.buildings[i].id
                 << " at I" << city.buildings[i].intersection << "\n";
        }
    }
    if (matches.empty()) {
        cout << "No " << type << " building has been registered.\n";
        return -1;
    }

    int selection;
    cout << prompt;
    if (!(cin >> selection)) {
        cin.clear();
        cin.ignore(10000, '\n');
        cout << "Invalid input.\n";
        return -1;
    }
    if (selection < 1 || selection > static_cast<int>(matches.size())) {
        cout << "Invalid selection.\n";
        return -1;
    }
    return matches[selection - 1];
}

void requestAmbulance(RoadNetwork &city, VehicleManager &vehicles) {
    cout << "\n--- AMBULANCE EMERGENCY SERVICE ---\n";
    int hospital = selectBuildingIntersection(
        city, "Hospital", "Select hospital number: ");
    if (hospital == -1) return;

    int accident;
    cout << "Enter intersection ID where the accident occurred: I";
    if (!(cin >> accident)) {
        cin.clear();
        cin.ignore(10000, '\n');
        cout << "Invalid input.\n";
        return;
    }
    if (!city.valid(accident)) {
        cout << "Invalid accident intersection.\n";
        return;
    }

    cout << "Finding shortest route from Hospital at I" << hospital
         << " to accident location I" << accident << "...\n";
    vehicles.create("Ambulance", hospital, accident, false, city);
}

void placeFoodDelivery(RoadNetwork &city, VehicleManager &vehicles) {
    cout << "\n--- FOOD DELIVERY SERVICE ---\n";
    int restaurant = selectBuildingIntersection(
        city, "Restaurant", "Select restaurant number: ");
    if (restaurant == -1) return;

    int house = selectBuildingIntersection(
        city, "House", "Select destination house number: ");
    if (house == -1) return;

    cout << "Finding shortest route from Restaurant at I" << restaurant
         << " to House at I" << house << "...\n";
    vehicles.create("DeliveryBike", restaurant, house, false, city);
}

void planRoute(RoadNetwork &city) {
    int source, destination, path[MAX];
    cout << "Enter source and destination intersection IDs: ";
    if (!(cin >> source >> destination)) {
        cin.clear(); cin.ignore(10000, '\n');
        cout << "Invalid input.\n";
        return;
    }
    int n = city.shortestPath(source, destination, path);
    if (n == 0) {
        cout << "No route exists or invalid intersection.\n";
        return;
    }
    double distance = 0;
    cout << "Shortest route: ";
    for (int i = 0; i < n; i++) {
        if (i) {
            cout << " -> ";
            for (const auto &road : city.adj[path[i - 1]])
                if (road.first == path[i]) { distance += road.second; break; }
        }
        cout << "I" << path[i];
    }
    cout << "\nTotal distance: " << distance << " metres\n";
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
    CityManagement management;

    cout << "Virtual City Simulator initialized.\n";

    while (true) {
        cout << "\n====== VIRTUAL CITY SIMULATOR ======\n"
             << "1. Display road network\n"
             << "2. Add intersection\n"
             << "3. Add road\n"
             << "4. Add building\n"
             << "5. Display buildings\n"
             << "6. Display population\n"
             << "7. Create vehicle\n"
             << "8. Advance simulation\n"
             << "9. Display status\n"
             << "10. Water and electricity distribution\n"
             << "11. Update water/electricity supply\n"
             << "12. Display city budget\n"
             << "13. Allocate city budget\n"
             << "14. Enhanced traffic visualization\n"
             << "15. Plan shortest route (Dijkstra)\n"
             << "16. City dashboard\n"
             << "17. Ambulance emergency service (Hospital -> Accident)\n"
             << "18. Food delivery service (Restaurant -> House)\n"
             << "0. Exit\n"
             << "Choice: ";

        int choice;

        if (!(cin >> choice)) {
            if (cin.eof())
                break;

            cin.clear();
            cin.ignore(10000, '\n');
            cout << "Invalid input.\n";
            continue;
        }

        if (choice == 0) {
            cout << "Exiting simulator.\n";
            break;
        }

        else if (choice == 1) {
            city.displayNetwork();
        }

        else if (choice == 2) {
            int id = city.addIntersection();

            if (id == -1)
                cout << "Intersection limit reached.\n";
            else
                cout << "Created I" << id << "\n";
        }

        else if (choice == 3) {
            int a, b;
            double length;

            cout << "Enter start, end and length: ";

            if (!(cin >> a >> b >> length)) {
                cin.clear();
                cin.ignore(10000, '\n');
                cout << "Invalid input.\n";
                continue;
            }

            if (city.addRoad(a, b, length))
                cout << "Road added.\n";
            else
                cout << "Invalid road or duplicate road.\n";
        }

        else if (choice == 4) {
            string id, type;
            int intersection, population = 0;

            cout << "Enter building ID and type: ";
            cin >> id >> type;

            cout << "Enter intersection ID: ";
            cin >> intersection;

            if (type == "House") {
                cout << "Enter population: ";
                cin >> population;
            }

            if (city.addBuilding(id, type,
                                 intersection, population))
                cout << "Building added.\n";
            else
                cout << "Invalid building details.\n";
        }

        else if (choice == 5) {
            city.displayBuildings();
        }

        else if (choice == 6) {
            city.displayPopulation();
        }

        else if (choice == 7) {
            string type;
            char parkedChoice;
            int start, destination = -1;

            cout << "Vehicle type (Car/Ambulance/DeliveryBike): ";
            cin >> type;

            cout << "Is it parked? (y/n): ";
            cin >> parkedChoice;

            bool parked = parkedChoice == 'y' ||
                          parkedChoice == 'Y';

            if (parked) {
                cout << "Enter parking intersection: ";
                cin >> start;
            } else {
                cout << "Enter start and destination: ";
                cin >> start >> destination;
            }

            vehicles.create(type, start, destination,
                            parked, city);
        }

        else if (choice == 8) {
            int seconds;

            cout << "Advance simulation by seconds: ";

            if (!(cin >> seconds)) {
                cin.clear();
                cin.ignore(10000, '\n');
                cout << "Invalid input.\n";
                continue;
            }

            if (seconds < 0 || seconds > 3600)
                cout << "Enter between 0 and 3600.\n";
            else {
                vehicles.advance(city, seconds);
                management.updateConsumption(city, seconds);
                cout << "Utility consumption updated.\n";
            }
        }

        else if (choice == 9) {
            vehicles.displayStatus();
        }

        else if (choice == 10) {
            management.displayUtilities(city);
        }
        else if (choice == 11) {
            double water, electricity;
            cout << "Enter water supply (litres/day) and electricity supply (kWh/day): ";
            if (!(cin >> water >> electricity)) {
                cin.clear(); cin.ignore(10000, '\n');
                cout << "Invalid input.\n";
                continue;
            }
            management.setSupply(water, electricity);
        }
        else if (choice == 12) {
            management.displayBudget();
        }
        else if (choice == 13) {
            string department;
            double amount;
            cout << "Enter department (Roads/Water/Electricity/Healthcare/Traffic): ";
            cin >> department;
            cout << "Enter amount to allocate: ";
            if (!(cin >> amount)) {
                cin.clear(); cin.ignore(10000, '\n');
                cout << "Invalid input.\n";
                continue;
            }
            management.allocateBudget(department, amount);
        }
        else if (choice == 14) {
            displayTrafficVisualization(city, vehicles);
        }
        else if (choice == 15) {
            planRoute(city);
        }
        else if (choice == 16) {
            cout << "\n========== CITY DASHBOARD ==========\n";
            city.displayNetwork();
            city.displayBuildings();
            city.displayPopulation();
            vehicles.displayStatus();
            management.displayUtilities(city);
            management.displayBudget();
            displayTrafficVisualization(city, vehicles);
        }
        else if (choice == 17) {
            requestAmbulance(city, vehicles);
        }
        else if (choice == 18) {
            placeFoodDelivery(city, vehicles);
        }
        else {
            cout << "Invalid option.\n";
        }
    }

    return 0;
}

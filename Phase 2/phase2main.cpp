#include <iostream>
#include <string>
#include <vector>
#include <utility>
#include <queue>
#include <functional>
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
};

class RoadNetwork {
public:
    vector<pair<int, double>> adj[MAX];
    int intersections;
    Building buildings[MAX];
    int buildingCount;

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
        return true;
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
                     << road.second << " m) ";
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

            for (int i = 0; i < count; i++) {
                Vehicle &v = vehicles[i];

                if (v.parked || v.completed)
                    continue;

                int next = v.route[v.nextIndex];
                // Find the road length from the current intersection to next.
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

                double remaining = length - v.distance;
                double movement = v.speed;

                if (movement >= remaining) {
                    v.totalDistance += remaining;
                    v.distance = 0;
                    v.current = next;
                    v.nextIndex++;

                    cout << "V" << v.id
                         << " reached I" << next
                         << " at " << currentTime
                         << " seconds.\n";

                    if (v.current == v.destination ||
                        v.nextIndex >= v.routeSize) {
                        v.completed = true;

                        cout << "V" << v.id
                             << " journey completed.\n";
                    }
                } else {
                    v.distance += movement;
                    v.totalDistance += movement;
                }
            }
        }

        cout << "Simulation advanced by "
             << seconds << " seconds.\n";
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
            } else {
                cout << "MOVING from I" << v.current
                     << " to I" << v.route[v.nextIndex];
                moving++;
            }

            cout << "\nDistance travelled: "
                 << v.totalDistance << " m";

            if (!v.parked && !v.completed)
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
            else
                vehicles.advance(city, seconds);
        }

        else if (choice == 9) {
            vehicles.displayStatus();
        }

        else {
            cout << "Invalid option.\n";
        }
    }

    return 0;
}

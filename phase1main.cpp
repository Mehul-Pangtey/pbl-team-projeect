#include <iostream>
#include <vector>
#include <string>
#include <utility>

using namespace std;

// Represents a building located at an intersection
class Building {
public:
    string buildingID;
    string type;
    int population;  // Relevant only for houses

    Building(string id, string t, int p = 0) {
        buildingID = id;
        type = t;
        population = (type == "House") ? p : 0;
    }
};

// Represents the road network and its buildings
class RoadNetwork {
private:
    // Each edge stores {neighbouring intersection, distance}
    vector<vector<pair<int, int>>> graph;

    // buildings[i] stores all buildings at intersection i
    vector<vector<Building>> buildings;

    bool validIntersection(int id) const {
        return id >= 0 && id < (int)graph.size();
    }

public:
    // Initialize a city with n intersections
    RoadNetwork(int n = 0) {
        graph.resize(n);
        buildings.resize(n);
    }

    // Add a new intersection
    int addIntersection() {
        graph.push_back({});
        buildings.push_back({});

        int id = (int)graph.size() - 1;

        cout << "Intersection I" << id
             << " created successfully.\n";

        return id;
    }

    // Add a two-way road
    void addRoad(int start, int end, int distance) {
        if (!validIntersection(start) ||
            !validIntersection(end)) {
            cout << "Invalid intersection ID!\n";
            return;
        }

        if (start == end || distance <= 0) {
            cout << "Invalid road or distance!\n";
            return;
        }

        // Prevent duplicate roads
        for (const auto &road : graph[start]) {
            if (road.first == end) {
                cout << "Road already exists!\n";
                return;
            }
        }

        // Store the road in both directions
        graph[start].push_back({end, distance});
        graph[end].push_back({start, distance});

        cout << "Road added: I" << start
             << " <-> I" << end
             << ", distance = " << distance << " km\n";
    }

    // Add a building at an existing intersection
    void addBuilding(int intersectionID,
                     string buildingID,
                     string type,
                     int population = 0) {

        if (!validIntersection(intersectionID)) {
            cout << "Invalid intersection ID!\n";
            return;
        }

        if (type != "House" &&
            type != "Hospital" &&
            type != "Restaurant") {
            cout << "Invalid building type!\n";
            return;
        }

        if (population < 0) {
            cout << "Population cannot be negative!\n";
            return;
        }

        // Population applies only to houses
        if (type != "House") {
            population = 0;
        }

        // Ensure building IDs are unique
        for (const auto &list : buildings) {
            for (const auto &b : list) {
                if (b.buildingID == buildingID) {
                    cout << "Building ID already exists!\n";
                    return;
                }
            }
        }

        buildings[intersectionID].emplace_back(
            buildingID, type, population
        );

        cout << type << " added at I"
             << intersectionID << ".\n";
    }

    // Display the road network
    void displayRoadNetwork() const {
        cout << "\n========== ROAD NETWORK ==========\n";

        for (int i = 0; i < (int)graph.size(); i++) {
            cout << "I" << i << " -> ";

            if (graph[i].empty()) {
                cout << "No connected roads";
            }

            for (const auto &road : graph[i]) {
                cout << "(I" << road.first
                     << ", " << road.second << " km) ";
            }

            cout << '\n';
        }
    }

    // Display buildings at each intersection
    void displayBuildings() const {
        cout << "\n========== CITY BUILDINGS ==========\n";

        for (int i = 0; i < (int)buildings.size(); i++) {
            cout << "\nIntersection I" << i << ":\n";

            if (buildings[i].empty()) {
                cout << "  No buildings\n";
                continue;
            }

            for (const auto &b : buildings[i]) {
                cout << "  ID: " << b.buildingID
                     << " | Type: " << b.type;

                if (b.type == "House") {
                    cout << " | Residents: " << b.population;
                }

                cout << '\n';
            }
        }
    }

    // Calculate residential population
    int getTotalPopulation() const {
        int total = 0;

        for (const auto &list : buildings) {
            for (const auto &b : list) {
                if (b.type == "House") {
                    total += b.population;
                }
            }
        }

        return total;
    }

    int getIntersectionCount() const {
        return (int)graph.size();
    }
};

int main() {
    RoadNetwork city(5);

    int choice;

    do {
        cout << "\n====== VIRTUAL CITY SIMULATOR ======\n";
        cout << "1. Add intersection\n";
        cout << "2. Add road\n";
        cout << "3. Add building\n";
        cout << "4. Display road network\n";
        cout << "5. Display buildings\n";
        cout << "6. Show total population\n";
        cout << "7. Show number of intersections\n";
        cout << "0. Exit\n";
        cout << "Enter your choice: ";

        if (!(cin >> choice)) {
            cout << "Invalid input!\n";
            break;
        }

        int start, end, distance, population;
        string buildingID, type;

        switch (choice) {
            case 1:
                city.addIntersection();
                break;

            case 2:
                cout << "Start intersection ID: ";
                cin >> start;

                cout << "End intersection ID: ";
                cin >> end;

                cout << "Road distance in km: ";
                cin >> distance;

                city.addRoad(start, end, distance);
                break;

            case 3:
                cout << "Intersection ID: ";
                cin >> start;

                cout << "Building ID: ";
                cin >> buildingID;

                cout << "Type (House/Hospital/Restaurant): ";
                cin >> type;

                population = 0;

                if (type == "House") {
                    cout << "Number of residents: ";
                    cin >> population;
                }

                city.addBuilding(
                    start, buildingID, type, population
                );
                break;

            case 4:
                city.displayRoadNetwork();
                break;

            case 5:
                city.displayBuildings();
                break;

            case 6:
                cout << "Total residential population: "
                     << city.getTotalPopulation() << '\n';
                break;

            case 7:
                cout << "Total intersections: "
                     << city.getIntersectionCount() << '\n';
                break;

            case 0:
                cout << "Exiting Virtual City Simulator.\n";
                break;

            default:
                cout << "Invalid choice. Try again.\n";
        }

    } while (choice != 0);

    return 0;
}

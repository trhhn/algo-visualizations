import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class Dijkstra {

    /** A directed, weighted edge: the (u, v) pair lives implicitly in the adjacency list slot for u. */
    static class Edge {
        final String to;
        final double weight;
        Edge(String to, double weight) {
            this.to = to;
            this.weight = weight;
        }
    }

    /** Graph.Vertices and Graph.Distance(u, v) from the pseudocode. */
    static class Graph {
        final Set<String> vertices = new LinkedHashSet<>();
        final Map<String, List<Edge>> adjacency = new HashMap<>();

        void addVertex(String v) {
            vertices.add(v);
            adjacency.putIfAbsent(v, new ArrayList<>());
        }

        void addEdge(String u, String v, double weight) {
            addVertex(u);
            addVertex(v);
            adjacency.get(u).add(new Edge(v, weight));
        }

        void addUndirectedEdge(String u, String v, double weight) {
            addEdge(u, v, weight);
            addEdge(v, u, weight);
        }

        /** Graph.Vertices */
        Set<String> vertices() {
            return vertices;
        }

        /** The vertices v such that edge (u, v) is in Graph. */
        List<String> neighbors(String u) {
            List<String> ns = new ArrayList<>();
            for (Edge e : adjacency.get(u)) ns.add(e.to);
            return ns;
        }

        /** Graph.Distance(u, v) */
        double distance(String u, String v) {
            for (Edge e : adjacency.get(u)) {
                if (e.to.equals(v)) return e.weight;
            }
            return Double.POSITIVE_INFINITY;
        }
    }

    /** dist[] and prev[] as returned by Dijkstra(Graph, source). */
    static class Result {
        final Map<String, Double> dist;
        final Map<String, String> prev;
        Result(Map<String, Double> dist, Map<String, String> prev) {
            this.dist = dist;
            this.prev = prev;
        }
    }

    // function Dijkstra(Graph, source):
    static Result dijkstra(Graph graph, String source) {
        Map<String, Double> dist = new HashMap<>();
        Map<String, String> prev = new HashMap<>();
        List<String> Q = new ArrayList<>();

        for (String v : graph.vertices()) {
            dist.put(v, Double.POSITIVE_INFINITY);
            prev.put(v, null);       // UNDEFINED
            Q.add(v);
        }
        dist.put(source, 0.0);

        while (!Q.isEmpty()) {
            // u <- vertex in Q with minimum dist[u]
            String u = Q.get(0);
            for (String candidate : Q) {
                if (dist.get(candidate) < dist.get(u)) {
                    u = candidate;
                }
            }
            Q.remove(u);

            // for each edge (u, v) in Graph:
            for (String v : graph.neighbors(u)) {
                double alt = dist.get(u) + graph.distance(u, v);
                if (alt < dist.get(v)) {
                    dist.put(v, alt);
                    prev.put(v, u);
                }
            }
        }

        return new Result(dist, prev);
    }

    static List<String> shortestPath(Result result, String source, String target) {
        Deque<String> S = new ArrayDeque<>();   // S <- empty sequence
        String u = target;                      // u <- target
        if (result.prev.get(u) != null || u.equals(source)) {   // Proceed if the vertex is reachable
            while (u != null) {                  // Construct shortest path with stack S
                S.push(u);                       // Push the vertex onto the stack
                u = result.prev.get(u);          // Traverse from target to source
            }
        }
        List<String> path = new ArrayList<>();
        while (!S.isEmpty()) path.add(S.pop());
        return path;
    }

    public static void main(String[] args) {
        Graph graph = new Graph();
        graph.addUndirectedEdge("A", "B", 7);
        graph.addUndirectedEdge("A", "C", 9);
        graph.addUndirectedEdge("A", "F", 14);
        graph.addUndirectedEdge("B", "C", 10);
        graph.addUndirectedEdge("B", "D", 15);
        graph.addUndirectedEdge("C", "D", 11);
        graph.addUndirectedEdge("C", "F", 2);
        graph.addUndirectedEdge("D", "E", 6);
        graph.addUndirectedEdge("E", "F", 9);

        String source = "A";
        Result result = dijkstra(graph, source);

        for (String v : graph.vertices()) {
            System.out.println("dist[" + v + "] = " + result.dist.get(v)
                    + ", path = " + shortestPath(result, source, v));
        }
    }
}

type GraphStruct = Record<string, string[]>;

export class Graph {
  private _graph: GraphStruct;

  constructor(graph: GraphStruct = {}) {
    this._graph = graph;
  }

  getGraph(): GraphStruct {
    return this._graph;
  }

  addEdge(fromNode: string, toNode: string): Graph {
    let clonedGraph = Graph._deepClone(this._graph);
    clonedGraph = Graph._addNode(clonedGraph, fromNode);
    clonedGraph = Graph._addNode(clonedGraph, toNode);

    if (!this._hasEdge(fromNode, toNode)) {
      clonedGraph[fromNode] = [...clonedGraph[fromNode], toNode];
    }

    return new Graph(clonedGraph);
  }

  deleteNodeAndExclusivelyReachableNodes(nodeToRemove: string): Graph {
    const clonedGraph = Graph._deepClone(this._graph);
    const cleanedGraph = this._removeNodeAndEdges(clonedGraph, nodeToRemove);
    const sourceNodes = this._retrieveSources();

    const nodesVisited = sourceNodes.reduce(
      (nodesVisited, sourceNode) => Graph._dfs(cleanedGraph, sourceNode, nodesVisited),
      new Set<string>()
    );

    const updatedGraph: GraphStruct = {};
    nodesVisited.forEach((node: string) => {
      updatedGraph[node] = cleanedGraph[node];
    });

    return new Graph(updatedGraph);
  }

  listNodes(): string[] {
    return Object.keys(this._graph);
  }

  diffNodes(graph: Graph): string[] {
    const clonedGraph = Graph._deepClone(this._graph);

    graph.listNodes().forEach((node) => {
      delete clonedGraph[node];
    });

    return Object.keys(clonedGraph);
  }

  dependenciesOf(node: string): string[] {
    if (!Graph._hasNode(this._graph, node)) throw new Error('Node does not exists!');

    return [...this._graph[node]];
  }

  dependsOn(nodeDep: string): string[] {
    return this.listNodes().filter((currNode) => this._graph[currNode].some((currNodeDep) => currNodeDep === nodeDep));
  }

  private static _deepClone(graph: GraphStruct): GraphStruct {
    return JSON.parse(JSON.stringify(graph));
  }

  private static _hasNode(graph: GraphStruct, node: string): boolean {
    // eslint-disable-next-line no-prototype-builtins
    return graph.hasOwnProperty(node);
  }

  private static _addNode(graph: GraphStruct, node: string): GraphStruct {
    if (!Graph._hasNode(graph, node)) {
      graph[node] = [];
    }

    return graph;
  }

  private _hasEdge(fromNode: string, toNode: string): boolean {
    const edges = this._graph[fromNode];
    return Boolean(edges?.some((edge) => edge === toNode));
  }

  private _removeNodeAndEdges(graph: GraphStruct, nodeToRemove: string): GraphStruct {
    return Object.keys(graph).reduce((acc, node) => {
      if (node === nodeToRemove) return acc;
      acc[node] = graph[node].filter((adjNode) => adjNode !== nodeToRemove);
      return acc;
    }, {} as GraphStruct);
  }

  private _retrieveSources(): string[] {
    const nodes = Object.keys(this._graph);

    const inDegree = nodes.reduce((acc, node) => {
      if (typeof acc[node] !== 'number') acc[node] = 0;

      this._graph[node].forEach((adjNode) => {
        acc[adjNode] = (acc[adjNode] || 0) + 1;
      });

      return acc;
    }, {} as Record<string, number>);

    return nodes.filter((node) => inDegree[node] === 0);
  }

  private static _dfs(cleanedGraph: GraphStruct, node: string, nodesVisited: Set<string>): Set<string> {
    if (!cleanedGraph[node] || nodesVisited.has(node)) return nodesVisited;
    nodesVisited.add(node);
    cleanedGraph[node].forEach((adjNode) => {
      Graph._dfs(cleanedGraph, adjNode, nodesVisited);
    });

    return nodesVisited;
  }
}

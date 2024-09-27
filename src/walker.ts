import path from 'node:path';
import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import { Graph } from './graph.js';

export type RemovedRefactorInfo = {
  toRefactor: Record<string, string[]>;
  toExclude: string[];
};

export class Walker {
  private readonly _entrypointBasePath: string;
  private readonly _projDir: string;
  private readonly _project: Project;

  constructor(
    private readonly _workDir: string,
    private readonly _tsConfigPath: string,
    private readonly _entrypointPattern: string,
    private readonly _excludeNodeModules: boolean,
  ) {
    const absTsConfigPath = this._toAbsPath(this._tsConfigPath);
    const absEntrypointPattern = this._toAbsPath(this._entrypointPattern);
    this._projDir = path.join(path.dirname(absTsConfigPath), '/');
    this._entrypointBasePath = path.relative(this._projDir, absEntrypointPattern);
    this._project = new Project({ tsConfigFilePath: absTsConfigPath });
  }

  getGraph(): Graph {
    let graph = new Graph();
    let previousGraph = graph;

    const entrypoints = this._project.getSourceFiles(this._entrypointBasePath).map((s) => s.getFilePath());

    entrypoints.forEach((entrypoint) => {
      const filePath = path.relative(this._projDir, entrypoint);
      graph = this._processFile(graph, filePath);
    });

    let extraPaths = this._getNextPaths(graph, previousGraph);

    while (extraPaths.length > 0) {
      previousGraph = graph;

      extraPaths.forEach((extraPath) => {
        graph = this._processFile(graph, extraPath);
      });

      extraPaths = this._getNextPaths(graph, previousGraph);
    }

    return graph;
  }

  getGraphAfterDeleted(filePaths: string[]): RemovedRefactorInfo {
    const fixedFilePaths = filePaths.map((filePath) => path.relative(this._projDir, filePath));
    const previousGraph = this.getGraph();
    const graph = fixedFilePaths
      .reduce((acc, filePath) => acc.deleteNodeAndExclusivelyReachableNodes(filePath), previousGraph);
    const toRefactor = fixedFilePaths.reduce((acc, filePath) => {
      acc[filePath] = previousGraph.dependsOn(filePath);
      return acc;
    }, {} as Record<string, string[]>);
    const removedNodes = previousGraph.diffNodes(graph);
    const setToExclude = filePaths
      .map((filePath) => path.relative(this._projDir, filePath))
      .concat(removedNodes)
      .reduce((acc, path) => acc.add(path), new Set<string>());

    return {
      toRefactor: toRefactor,
      toExclude: [...setToExclude.keys()],
    };
  }

  private _toAbsPath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.join(this._workDir, filePath)
  }

  private _processFile(graph: Graph, filePath: string): Graph {
    const sourceFile = this._project.getSourceFile(filePath);
    if (typeof sourceFile === 'undefined') return graph;
    const importsPath = this._getImports(sourceFile);
    return importsPath.reduce((acc, importPath) => acc.addEdge(filePath, importPath), graph);
  }

  private _getImports(sourceFile: SourceFile): string[] {
    return this._getStaticImports(sourceFile).concat(this._getDynamicImports(sourceFile));
  }

  private _getStaticImports(sourceFile: SourceFile): string[] {
    const staticImports = sourceFile
      .getReferencedSourceFiles()
      .map((ref) => {
        try {
          return path.relative(this._projDir, ref.getFilePath());
        } catch(_error) {
          return null;
        }
      })
      .filter((path) => path !== null);

    return this._excludeNodeModules
      ? staticImports.filter((filePath) => !filePath.startsWith('node_modules'))
      : staticImports;
  }

  private _getDynamicImports(sourceFile: SourceFile): string[] {
    const dynImports = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((expr) => expr.getChildrenOfKind(SyntaxKind.ImportKeyword).length)
      .map((expr) => {
        try {
          const arg = expr.getArguments()[0];
          const filePath = arg.getSymbol()?.getDeclarations()[0]?.getSourceFile()?.getFilePath() || '';
          return path.relative(this._projDir, filePath);
        } catch(_error) {
          return '';
        }
      });

    return this._excludeNodeModules
      ? dynImports.filter((filePath) => !filePath.startsWith('node_modules'))
      : dynImports;
  }

  private _getNextPaths(graph: Graph, previousGraph: Graph): string[] {
    return graph
      .diffNodes(previousGraph)
      .filter((filePath) => filePath.startsWith('src'));
  }
}

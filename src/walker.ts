// eslint-disable-next-line @typescript-eslint/no-var-requires
import path from 'path';
import { Project, SourceFile } from 'ts-morph';
import { Graph } from './graph';

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
    const removedNodes = previousGraph.diffNodes(graph);
    const refactors = fixedFilePaths.reduce((acc, filePath) => {
      acc[filePath] = previousGraph.dependsOn(filePath);
      return acc;
    }, {} as Record<string, string[]>);

    return {
      toRefactor: refactors,
      toExclude: removedNodes,
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
    const allImports = sourceFile
    .getImportDeclarations()
    .map((impDecl, _index) => {
      try {
        const childSourceFile = impDecl.getModuleSpecifierSourceFile();
        if (typeof childSourceFile === 'undefined') return '';
        const childFilePath = childSourceFile.getFilePath();
        return path.relative(this._projDir, childFilePath);
      } catch (_error) {
        return '';
      }
    });

    return this._excludeNodeModules
      ? allImports.filter((filePath) => filePath.startsWith('src'))
      : allImports;
  }

  private _getNextPaths(graph: Graph, previousGraph: Graph): string[] {
    return graph
      .diffNodes(previousGraph)
      .filter((filePath) => filePath.startsWith('src'));
  }
}

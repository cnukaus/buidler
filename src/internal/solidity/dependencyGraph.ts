import { getImports } from "./imports";
import { ResolvedFile, Resolver } from "./resolver";

export class DependencyGraph {
  public static async createFromResolvedFiles(
    resolver: Resolver,
    resolvedFiles: ResolvedFile[]
  ) {
    const graph = new DependencyGraph();

    for (const resolvedFile of resolvedFiles) {
      if (!graph.dependenciesPerFile.has(resolvedFile)) {
        await graph.addDependenciesFrom(resolver, resolvedFile);
      }
    }

    return graph;
  }
  public readonly dependenciesPerFile = new Map<
    ResolvedFile,
    Set<ResolvedFile>
  >();

  private constructor() {}

  public getResolvedFiles(): ResolvedFile[] {
    return Array.from(this.dependenciesPerFile.keys());
  }

  private async addDependenciesFrom(resolver: Resolver, file: ResolvedFile) {
    const dependencies = new Set();
    this.dependenciesPerFile.set(file, dependencies);

    const imports = await getImports(file.content);

    for (const imp of imports) {
      const dependency = await resolver.resolveImport(file, imp);
      dependencies.add(dependency);

      if (!this.dependenciesPerFile.has(dependency)) {
        await this.addDependenciesFrom(resolver, dependency);
      }
    }
  }
}

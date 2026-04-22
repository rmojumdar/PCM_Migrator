import { allObjects, objectRegistry } from './objects/registry';

export function getOrderedObjects(selected: string[]): { ordered: string[]; autoIncluded: string[] } {
  const required = new Set(selected);

  function addDeps(apiName: string) {
    const node = objectRegistry.get(apiName);
    if (!node) return;
    for (const dep of node.dependsOn) {
      if (!required.has(dep)) {
        required.add(dep);
        addDeps(dep);
      }
    }
  }

  for (const name of selected) addDeps(name);

  const autoIncluded = [...required].filter((n) => !selected.includes(n));

  // Topological sort using Kahn's algorithm
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const name of required) {
    inDegree.set(name, 0);
    adj.set(name, []);
  }

  for (const name of required) {
    const node = objectRegistry.get(name)!;
    for (const dep of node.dependsOn) {
      if (required.has(dep)) {
        adj.get(dep)!.push(name);
        inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
      }
    }
  }

  const queue = [...inDegree.entries()].filter(([, v]) => v === 0).map(([k]) => k);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    ordered.push(curr);
    for (const neighbor of adj.get(curr) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return { ordered, autoIncluded };
}

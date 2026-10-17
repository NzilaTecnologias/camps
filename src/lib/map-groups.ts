/** Distância em píxeis abaixo da qual dois marcadores se juntam num grupo. */
export const GROUP_RADIUS_PX = 40;

/**
 * Junta os pontos que, no zoom atual, ficariam uns em cima dos outros no ecrã.
 * `project` dá a posição em píxeis de cada ponto nesse zoom.
 */
export function groupByScreenDistance<T>(points: T[], project: (point: T) => { x: number; y: number }): T[][] {
  const groups: { x: number; y: number; points: T[] }[] = [];
  for (const point of points) {
    const { x, y } = project(point);
    const near = groups.find((group) => Math.hypot(group.x - x, group.y - y) < GROUP_RADIUS_PX);
    if (near) near.points.push(point);
    else groups.push({ x, y, points: [point] });
  }
  return groups.map((group) => group.points);
}

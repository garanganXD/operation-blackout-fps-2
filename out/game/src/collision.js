// collision.js — circle-vs-AABB helpers shared by the player and bots.
// Colliders are 2D boxes {minX,minZ,maxX,maxZ} (height handled separately by
// line-of-sight raycasts, since nothing here needs to jump or climb).

// True if a circle of radius r centered at (x,z) overlaps any collider.
export function blocked(colliders, x, z, r) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const cx = x < c.minX ? c.minX : x > c.maxX ? c.maxX : x;
    const cz = z < c.minZ ? c.minZ : z > c.maxZ ? c.maxZ : z;
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

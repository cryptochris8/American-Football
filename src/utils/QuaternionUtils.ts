/**
 * Quaternion Utility Functions for Football Physics
 * Used for proper football spiral rotation and orientation
 */

export type Quat = { x: number; y: number; z: number; w: number };
export type Vec3 = { x: number; y: number; z: number };

// Spiral rotation config
export const SPIRAL_CONFIG = {
  rotationsPerSecond: 8, // How fast the football spins (8 rotations/sec = nice visible spiral)
  radiansPerSecond: 8 * Math.PI * 2, // ~50 rad/sec
};

// End-over-end rotation for field goals
export const KICK_ROTATION_CONFIG = {
  rotationsPerSecond: 4, // Slower tumble for kicked balls
  radiansPerSecond: 4 * Math.PI * 2,
};

/**
 * Creates a quaternion that aligns the +X axis with a direction vector.
 * The football model's nose points along +X, so this orients the nose toward the velocity.
 */
export function createAlignmentQuaternion(direction: Vec3): Quat {
  // Normalize direction
  const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
  if (len < 0.0001) {
    return { x: 0, y: 0, z: 0, w: 1 }; // Identity if no direction
  }

  const dx = direction.x / len;
  const dy = direction.y / len;
  const dz = direction.z / len;

  // We want to rotate +X (1, 0, 0) to (dx, dy, dz)
  // Using the half-vector method: q = normalize(1 + dot, cross)
  // A = (1, 0, 0), B = (dx, dy, dz)
  // dot = A·B = dx
  // cross = A×B = (0, -dz, dy)

  const dot = dx;

  // Handle the case where direction is opposite to +X (dot ≈ -1)
  if (dot < -0.9999) {
    // 180° rotation around Y axis
    return { x: 0, y: 1, z: 0, w: 0 };
  }

  // q = (w: 1 + dot, x: 0, y: -dz, z: dy) then normalize
  let qw = 1 + dot;
  let qx = 0;
  let qy = -dz;
  let qz = dy;

  // Normalize
  const qlen = Math.sqrt(qw * qw + qx * qx + qy * qy + qz * qz);
  qw /= qlen;
  qx /= qlen;
  qy /= qlen;
  qz /= qlen;

  return { x: qx, y: qy, z: qz, w: qw };
}

/**
 * Creates a quaternion for rotation around an axis by an angle.
 */
export function createAxisAngleQuaternion(axis: Vec3, angle: number): Quat {
  // Normalize axis
  const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
  if (len < 0.0001) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  const ax = axis.x / len;
  const ay = axis.y / len;
  const az = axis.z / len;

  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);

  return {
    x: ax * s,
    y: ay * s,
    z: az * s,
    w: Math.cos(halfAngle),
  };
}

/**
 * Multiplies two quaternions: result = a * b
 */
export function multiplyQuaternions(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/**
 * Apply spiral rotation to a football based on its velocity
 * For thrown passes - rotates around the direction of travel
 */
export function applySpiralRotation(
  entity: any,
  velocity: Vec3,
  spiralAngle: number
): void {
  // Get current velocity direction for alignment
  const alignQuat = createAlignmentQuaternion(velocity);

  // Create spiral rotation around the X axis (nose of football)
  const spiralQuat = createAxisAngleQuaternion({ x: 1, y: 0, z: 0 }, spiralAngle);

  // Combine: first align to velocity, then apply spiral
  const finalQuat = multiplyQuaternions(alignQuat, spiralQuat);

  // Apply to entity
  entity.setRotation(finalQuat);
}

/**
 * Apply end-over-end rotation to a football for field goal kicks
 * Rotates around the Z axis (side-to-side tumble)
 */
export function applyKickRotation(
  entity: any,
  velocity: Vec3,
  tumbleAngle: number
): void {
  // Align to velocity first
  const alignQuat = createAlignmentQuaternion(velocity);

  // Create end-over-end rotation around the Z axis
  const tumbleQuat = createAxisAngleQuaternion({ x: 0, y: 0, z: 1 }, tumbleAngle);

  // Combine: first align to velocity, then apply tumble
  const finalQuat = multiplyQuaternions(alignQuat, tumbleQuat);

  // Apply to entity
  entity.setRotation(finalQuat);
}

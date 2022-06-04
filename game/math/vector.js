// Vector Support
class Vector3 {
  constructor(x = 0, y = x, z = x) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    if (!y) {
      this.x = x;
      this.y = x.y;
      this.z = x.z;
    } else {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  normalize() {
    const mag = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    this.x /= mag;
    this.y /= mag;
    this.z /= mag;  
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
  }

  mult(m) {
    this.x *= m;
    this.y *= m;
    this.z *= m;
  }
}

// Exports
export { Vector3 }
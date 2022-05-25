// Noise Functions used by the game for various purposes
// ===========================================================================
const noiseProfile = {
    generator: undefined,
    octaves: 4,
    fallout: 0.5,
    seed: undefined
}

let seedHash;
function hash() {
    let seed = Math.random() * 2100000000 | 0
    let PRIME32_2 = 1883677709
    let PRIME32_3 = 2034071983
    let PRIME32_4 = 668265263
    let PRIME32_5 = 374761393

    seedHash = function(s) {
        seed = s | 0
    }

    return function(x, y) {
        let h32 = 0

        h32 = seed + PRIME32_5 | 0
        h32 += 8

        h32 += Math.imul(x, PRIME32_3)
        h32 = Math.imul(h32 << 17 | h32 >> 32 - 17, PRIME32_4)
        h32 += Math.imul(y, PRIME32_3)
        h32 = Math.imul(h32 << 17 | h32 >> 32 - 17, PRIME32_4)

        h32 ^= h32 >> 15
        h32 *= PRIME32_2
        h32 ^= h32 >> 13
        h32 *= PRIME32_3
        h32 ^= h32 >> 16

        return h32 / 2147483647
    }
}

function Marsaglia(i1, i2) {
    // from http://www.math.uni-bielefeld.de/~sillke/ALGORITHMS/random/marsaglia-c
    let z = (i1 | 0) || 362436069,
        w = i2 || hash(521288629, z) * 2147483647 | 0

    let nextInt = function() {
        z = 36969 * (z & 65535) + (z >>> 16) & 0xFFFFFFFF
        w = 18000 * (w & 65535) + (w >>> 16) & 0xFFFFFFFF
        return ((z & 0xFFFF) << 16 | w & 0xFFFF) & 0xFFFFFFFF
    }

    this.nextDouble = function() {
        let i = nextInt() / 4294967296
        return i < 0 ? 1 + i : i
    }

    this.nextInt = nextInt
} // Processing.JS Thing

// Copied and modified from https://github.com/blindman67/SimplexNoiseJS
function openSimplexNoise(clientSeed) {
    const SQ4 = 2;
    const toNums = function(s) {
        return s.split(",").map(function(s) {
            return new Uint8Array(s.split("").map(function(v) {
                return Number(v)
            }))
        })
    }
    const decode = function(m, r, s) {
        return new Int8Array(s.split("").map(function(v) {
            return parseInt(v, r) + m
        }))
    }
    const toNumsB32 = function(s) {
        return s.split(",").map(function(s) {
            return parseInt(s, 32)
        })
    }
    const NORM_3D = 1.0 / 206.0
    const SQUISH_3D = 1 / 3
    const STRETCH_3D = -1 / 6
    let base3D = toNums("0000110010101001,2110210120113111,110010101001211021012011")
    const gradients3D = decode(-11, 23, "0ff7mf7fmmfffmfffm07f70f77mm7ff0ff7m0f77m77f0mf7fm7ff0077707770m77f07f70")
    let lookupPairs3D = function() {
        return new Uint16Array(toNumsB32("0,2,1,1,2,2,5,1,6,0,7,0,10,2,12,2,41,1,45,1,50,5,51,5,g6,0,g7,0,h2,4,h6,4,k5,3,k7,3,l0,5,l1,5,l2,4,l5,3,l6,4,l7,3,l8,d,l9,d,la,c,ld,e,le,c,lf,e,m8,k,ma,i,p9,l,pd,n,q8,k,q9,l,15e,j,15f,m,16a,i,16e,j,19d,n,19f,m,1a8,f,1a9,h,1aa,f,1ad,h,1ae,g,1af,g,1ag,b,1ah,a,1ai,b,1al,a,1am,9,1an,9,1bg,b,1bi,b,1eh,a,1el,a,1fg,8,1fh,8,1qm,9,1qn,9,1ri,7,1rm,7,1ul,6,1un,6,1vg,8,1vh,8,1vi,7,1vl,6,1vm,7,1vn,6"))
    }
    let p3D = decode(-1, 5, "112011210110211120110121102132212220132122202131222022243214231243124213241324123222113311221213131221123113311112202311112022311112220342223113342223311342223131322023113322023311320223113320223131322203311322203131")
    const setOf = function(count) {
        let a = [],
            i = 0;
        while (i < count) {
            a.push(i++)
        }
        return a
    }
    const doFor = function(count, cb) {
        let i = 0;
        while (i < count && cb(i++) !== true) {}
    }

    function shuffleSeed(seed, count) {
        seed = seed * 1664525 + 1013904223 | 0
        count -= 1
        return count > 0 ? shuffleSeed(seed, count) : seed
    }
    const types = {
        _3D: {
            base: base3D,
            squish: SQUISH_3D,
            dimensions: 3,
            pD: p3D,
            lookup: lookupPairs3D,
        }
    }

    function createContribution(type, baseSet, index) {
        let i = 0
        const multiplier = baseSet[index++]
        const c = {
            next: undefined
        }
        while (i < type.dimensions) {
            const axis = ("xyzw")[i]
            c[axis + "sb"] = baseSet[index + i]
            c["d" + axis] = -baseSet[index + i++] - multiplier * type.squish
        }
        return c
    }

    function createLookupPairs(lookupArray, contributions) {
        let i
        const a = lookupArray()
        const res = new Map()
        for (i = 0; i < a.length; i += 2) {
            res.set(a[i], contributions[a[i + 1]]);
        }
        return res
    }

    function createContributionArray(type) {
        const conts = []
        const d = type.dimensions
        const baseStep = d * d
        let k, i = 0
        while (i < type.pD.length) {
            const baseSet = type.base[type.pD[i]]
            let previous, current
            k = 0
            do {
                current = createContribution(type, baseSet, k)
                if (!previous) {
                    conts[i / baseStep] = current;
                } else {
                    previous.next = current;
                }
                previous = current
                k += d + 1
            } while (k < baseSet.length)

            current.next = createContribution(type, type.pD, i + 1)
            if (d >= 3) {
                current.next.next = createContribution(type, type.pD, i + d + 2)
            }
            if (d === 4) {
                current.next.next.next = createContribution(type, type.pD, i + 11)
            }
            i += baseStep
        }
        const result = [conts, createLookupPairs(type.lookup, conts)]
        type.base = undefined
        type.lookup = undefined
        return result
    }

    let temp = createContributionArray(types._3D)
    const contributions3D = temp[0],
        lookup3D = temp[1]
    const perm = new Uint8Array(256)
    const perm3D = new Uint8Array(256)
    const source = new Uint8Array(setOf(256))
    let seed = shuffleSeed(clientSeed, 3)
    doFor(256, function(i) {
        i = 255 - i
        seed = shuffleSeed(seed, 1)
        let r = (seed + 31) % (i + 1)
        r += r < 0 ? i + 1 : 0
        perm[i] = source[r]
        perm3D[i] = (perm[i] % 24) * 3
        source[r] = source[i]
    })
    base3D = undefined
    lookupPairs3D = undefined
    p3D = undefined

    return function(x, y, z) {
        const pD = perm3D
        const p = perm
        const g = gradients3D
        const stretchOffset = (x + y + z) * STRETCH_3D
        const xs = x + stretchOffset,
            ys = y + stretchOffset,
            zs = z + stretchOffset
        const xsb = Math.floor(xs),
            ysb = Math.floor(ys),
            zsb = Math.floor(zs)
        const squishOffset = (xsb + ysb + zsb) * SQUISH_3D
        const dx0 = x - (xsb + squishOffset),
            dy0 = y - (ysb + squishOffset),
            dz0 = z - (zsb + squishOffset)
        const xins = xs - xsb,
            yins = ys - ysb,
            zins = zs - zsb
        const inSum = xins + yins + zins
        let c = lookup3D.get(
            (yins - zins + 1) |
            ((xins - yins + 1) << 1) |
            ((xins - zins + 1) << 2) |
            (inSum << 3) |
            ((inSum + zins) << 5) |
            ((inSum + yins) << 7) |
            ((inSum + xins) << 9)
        )
        let i, value = 0
        while (c !== undefined) {
            const dx = dx0 + c.dx,
                dy = dy0 + c.dy,
                dz = dz0 + c.dz
            let attn = 2 - dx * dx - dy * dy - dz * dz
            if (attn > 0) {
                i = pD[(((p[(xsb + c.xsb) & 0xFF] + (ysb + c.ysb)) & 0xFF) + (zsb + c.zsb)) & 0xFF]
                attn *= attn
                value += attn * attn * (g[i++] * dx + g[i++] * dy + g[i] * dz)
            }
            c = c.next
        }
        return value * NORM_3D + 0.5
    }
}

function PerlinNoise(seed) {
    let rnd = seed !== undefined ? new Marsaglia(seed) : Marsaglia.createRandomized()
    let i, j
    // http://www.noisemachine.com/talk1/17b.html
    // http://mrl.nyu.edu/~perlin/noise/
    // generate permutation
    let perm = new Uint8Array(512)
    for (i = 0; i < 256; i++) {
        perm[i] = i
    }

    for (i = 0; i < 256; i++) {
        let t = perm[j = rnd.nextInt() & 0xFF];
        perm[j] = perm[i];
        perm[i] = t
    }
    // copy to avoid taking mod in perm[0]
    for (i = 0; i < 256; i++) {
        perm[i + 256] = perm[i]
    }

    function grad3d(i, x, y, z) {
        let h = i & 15; // convert into 12 gradient directions
        let u = h < 8 ? x : y,
            v = h < 4 ? y : h === 12 || h === 14 ? x : z
        return (!(h & 1) ? u : -u) + (!(h & 2) ? v : -v)
    }

    function grad2d(i, x, y) {
        let v = !(i & 1) ? x : y
        return !(i & 2) ? -v : v
    }

    function grad1d(i, x) {
        return !(i & 1) ? -x : x
    }

    function lerp(t, a, b) {
        return a + t * (b - a)
    }

    this.noise3d = function(x, y, z) {
        let X = Math.floor(x) & 255,
            Y = Math.floor(y) & 255,
            Z = Math.floor(z) & 255
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z)
        let fx = (3 - 2 * x) * x * x,
            fy = (3 - 2 * y) * y * y,
            fz = (3 - 2 * z) * z * z
        let p0 = perm[X] + Y,
            p00 = perm[p0] + Z,
            p01 = perm[p0 + 1] + Z,
            p1 = perm[X + 1] + Y,
            p10 = perm[p1] + Z,
            p11 = perm[p1 + 1] + Z
        return lerp(fz,
            lerp(fy, lerp(fx, grad3d(perm[p00], x, y, z), grad3d(perm[p10], x - 1, y, z)),
                lerp(fx, grad3d(perm[p01], x, y - 1, z), grad3d(perm[p11], x - 1, y - 1, z))),
            lerp(fy, lerp(fx, grad3d(perm[p00 + 1], x, y, z - 1), grad3d(perm[p10 + 1], x - 1, y, z - 1)),
                lerp(fx, grad3d(perm[p01 + 1], x, y - 1, z - 1), grad3d(perm[p11 + 1], x - 1, y - 1, z - 1))))
    }

    this.noise2d = function(x, y) {
        let X = Math.floor(x) & 255,
            Y = Math.floor(y) & 255
        x -= Math.floor(x);
        y -= Math.floor(y)
        let fx = (3 - 2 * x) * x * x,
            fy = (3 - 2 * y) * y * y
        let p0 = perm[X] + Y,
            p1 = perm[X + 1] + Y
        return lerp(fy,
            lerp(fx, grad2d(perm[p0], x, y), grad2d(perm[p1], x - 1, y)),
            lerp(fx, grad2d(perm[p0 + 1], x, y - 1), grad2d(perm[p1 + 1], x - 1, y - 1)))
    }

    this.noise1d = function(x) {
        let X = Math.floor(x) & 255
        x -= Math.floor(x)
        let fx = (3 - 2 * x) * x * x
        return lerp(fx, grad1d(perm[X], x), grad1d(perm[X + 1], x - 1))
    }
}

const noiseSeed = function(seed) {
    noiseProfile.seed = seed
    noiseProfile.generator = new PerlinNoise(noiseProfile.seed)
}

const noise = function(x, y, z) {
    const generator = noiseProfile.generator
    let effect = 1,
        k = 1,
        sum = 0
    for (let i = 0; i < noiseProfile.octaves; ++i) {
        effect *= noiseProfile.fallout
        switch (arguments.length) {
            case 1:
                sum += effect * (1 + generator.noise1d(k * x)) / 2;
                break
            case 2:
                sum += effect * (1 + generator.noise2d(k * x, k * y)) / 2;
                break
            case 3:
                sum += effect * (1 + generator.noise3d(k * x, k * y, k * z)) / 2;
                break
        }
        k *= 2
    }
    return sum
}

// Exports
export { Marsaglia, openSimplexNoise, seedHash, noiseSeed, noise, hash, PerlinNoise }
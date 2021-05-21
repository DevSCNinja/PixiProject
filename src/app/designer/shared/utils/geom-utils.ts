export class GeomUtils {
    // may return unrealiable results on edges (based on https://github.com/substack/point-in-polygon)
    static pointInsideRing(point: number[], ring: number[][]) {
        let x: number = point[0];
        let y: number = point[1];

        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            let xi = ring[i][0];
            let yi = ring[i][1];
            let xj = ring[j][0];
            let yj = ring[j][1];

            let intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
            if (intersect) {
                inside = !inside;
            }
        }

        return inside;
    }

    // set pointsToCheck to Number.POSITIVE_INFINITY for maximum accuracy
    static getParentEnclosingRings(ring: number[][], possibleParentRings: number[][][], pointsToCheck: number = 1) {
        let parents: number[][][] = [];

        possibleParentRings.forEach((ppr) => {
            if (ppr !== ring) {
                let inside: boolean = true;
                let i: number = Math.min(ring.length, pointsToCheck);
                while (i > 0) {
                    i--;
                    if (!GeomUtils.pointInsideRing(ring[i], ppr)) {
                        inside = false;
                        break;
                    }
                }
                if (inside) {
                    parents.push(ppr);
                }
            }
        });

        return parents;
    }
}

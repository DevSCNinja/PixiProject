import * as PIXI from 'pixi.js';

export class SuperGraphics extends PIXI.Graphics {
    static BASE_64 = {
        A: 0,
        B: 1,
        C: 2,
        D: 3,
        E: 4,
        F: 5,
        G: 6,
        H: 7,
        I: 8,
        J: 9,
        K: 10,
        L: 11,
        M: 12,
        N: 13,
        O: 14,
        P: 15,
        Q: 16,
        R: 17,
        S: 18,
        T: 19,
        U: 20,
        V: 21,
        W: 22,
        X: 23,
        Y: 24,
        Z: 25,
        a: 26,
        b: 27,
        c: 28,
        d: 29,
        e: 30,
        f: 31,
        g: 32,
        h: 33,
        i: 34,
        j: 35,
        k: 36,
        l: 37,
        m: 38,
        n: 39,
        o: 40,
        p: 41,
        q: 42,
        r: 43,
        s: 44,
        t: 45,
        u: 46,
        v: 47,
        w: 48,
        x: 49,
        y: 50,
        z: 51,
        '0': 52,
        '1': 53,
        '2': 54,
        '3': 55,
        '4': 56,
        '5': 57,
        '6': 58,
        '7': 59,
        '8': 60,
        '9': 61,
        '+': 62,
        '/': 63
    };

    constructor() {
        super();
    }

    drawDashedPolygon(
        points: PIXI.Point[],
        offsetPercentage: number,
        x: number,
        y: number,
        rotation: number,
        dash: number,
        gap: number,
        closeFigure: boolean = true
    ): SuperGraphics {
        let g: SuperGraphics = this;

        let i: number,
            p1: PIXI.Point,
            p2: PIXI.Point,
            dashLeft: number = 0,
            gapLeft: number = 0;

        if (offsetPercentage > 0) {
            let progressOffset: number = (dash + gap) * offsetPercentage;
            if (progressOffset < dash) dashLeft = dash - progressOffset;
            else gapLeft = gap - (progressOffset - dash);
        }

        let rotatedPolygons = [];

        let cosAngle: number = Math.cos(rotation);
        let sinAngle: number = Math.sin(rotation);
        for (i = 0; i < points.length; i++) {
            let p: any = { x: points[i].x, y: points[i].y };
            let dx = p.x;
            let dy = p.y;
            p.x = dx * cosAngle - dy * sinAngle;
            p.y = dx * sinAngle + dy * cosAngle;
            rotatedPolygons.push(p);
        }

        for (i = 0; i < rotatedPolygons.length; i++) {
            p1 = rotatedPolygons[i];
            if (i === rotatedPolygons.length - 1) {
                if (!closeFigure) {
                    return;
                }
                p2 = rotatedPolygons[0];
            } else {
                p2 = rotatedPolygons[i + 1];
            }
            let dx: number = p2.x - p1.x;
            let dy: number = p2.y - p1.y;
            let len: number = Math.sqrt(dx * dx + dy * dy);
            let normal: any = { x: dx / len, y: dy / len };
            let progressOnLine: number = 0;
            g.moveTo(x + p1.x + gapLeft * normal.x, y + p1.y + gapLeft * normal.y);

            while (progressOnLine <= len) {
                progressOnLine += gapLeft;
                if (dashLeft > 0) progressOnLine += dashLeft;
                else progressOnLine += dash;
                if (progressOnLine > len) {
                    dashLeft = progressOnLine - len;
                    progressOnLine = len;
                } else {
                    dashLeft = 0;
                }
                g.lineTo(x + p1.x + progressOnLine * normal.x, y + p1.y + progressOnLine * normal.y);
                progressOnLine += gap;
                if (progressOnLine > len && dashLeft == 0) {
                    gapLeft = progressOnLine - len;
                } else {
                    gapLeft = 0;
                    g.moveTo(x + p1.x + progressOnLine * normal.x, y + p1.y + progressOnLine * normal.y);
                }
            }
        }

        return g;
    }

    // inspired by EaselJS compact shapes, use Adobe Animate CC to generate compact shapes

    decodePath(str: string): SuperGraphics {
        let g: SuperGraphics = this;
        let instructions = [g.moveTo, g.lineTo, g.quadraticCurveTo, g.bezierCurveTo, g.closePath];
        let paramCount = [2, 2, 4, 6, 0];
        let i = 0,
            l = str.length;
        let params = [];
        let x = 0,
            y = 0;
        let base64 = SuperGraphics.BASE_64;

        while (i < l) {
            let c = str.charAt(i);
            let n = base64[c];
            let fi = n >> 3; // highest order bits 1-3 code for operation.
            let f = instructions[fi];
            // check that we have a valid instruction & that the unused bits are empty:
            if (!f || n & 3) {
                throw 'bad path data (@' + i + '): ' + c;
            }
            let pl = paramCount[fi];
            if (!fi) {
                x = y = 0;
            } // move operations reset the position.
            params.length = 0;
            i++;
            let charCount = ((n >> 2) & 1) + 2; // 4th header bit indicates number size for this operation.
            for (var p = 0; p < pl; p++) {
                var num = base64[str.charAt(i)];
                var sign = num >> 5 ? -1 : 1;
                num = ((num & 31) << 6) | base64[str.charAt(i + 1)];
                if (charCount == 3) {
                    num = (num << 6) | base64[str.charAt(i + 2)];
                }
                num = (sign * num) / 10;
                if (p % 2) {
                    x = num += x;
                } else {
                    y = num += y;
                }
                params[p] = num;
                i += charCount;
            }
            f.apply(g, params);
        }
        return g;
    }
}

import * as PIXI from 'pixi.js';

export class SelectionTool extends PIXI.Container {
    // set to true when you need to add extra objects to a current selection or unselect selected objects (e.g. when SHIFT is pressed)
    selectExtra: boolean = false;

    preciseDetection: boolean = true;

    selectedChildren: PIXI.Container[] = [];
    // temporary selected children (selection process hasn't ended yet)
    tmpSelectedChildren: PIXI.Container[] = [];

    rect: PIXI.Graphics;

    x0: number;

    y0: number;

    x1: number;

    y1: number;

    private isOn: boolean;

    // container  - object where selection is happening, usually called 'stage'
    constructor(
        public container: PIXI.Container,
        public onSelectStartCallback: Function,
        public onSelectChangeCallback: Function,
        public onSelectCompleteCallback: Function
    ) {
        super();

        this.selectionEnabled = true;

        this.rect = new PIXI.Graphics();
        this.addChild(this.rect);
    }

    set selectionEnabled(value: boolean) {
        if (this.isOn == value) {
            return;
        }

        if (value) {
            this.container.on('pointerdown', this.onSelectStart);
        } else {
            this.container.off('pointerdown', this.onSelectStart);
        }

        this.container.interactive = value;

        this.isOn = value;
    }

    get selectionEnabled(): boolean {
        return this.isOn;
    }

    onSelectStart = (e: PIXI.InteractionEvent) => {
        this.x1 = this.x0 = e.data.global.x;
        this.y1 = this.y0 = e.data.global.y;

        this.container.on('pointermove', this.onSelectMove).on('pointerup', this.onSelectEnd).on('pointerupoutside', this.onSelectEnd);

        this.onSelectStartCallback();
    };

    onSelectEnd = (e?: PIXI.InteractionEvent) => {
        this.clearSelection();

        this.findSelectedChildren();

        this.container.off('pointermove', this.onSelectMove).off('pointerup', this.onSelectEnd).off('pointerupoutside', this.onSelectEnd);

        this.onSelectCompleteCallback();
    };

    onSelectMove = (e: PIXI.InteractionEvent) => {
        if (this.rect) {
            this.rect.clear();

            this.x1 = e.data.global.x;
            this.y1 = e.data.global.y;

            this.rect.lineStyle(1, 0x339955, 1);
            this.rect.drawRect(this.x0, this.y0, this.x1 - this.x0, this.y1 - this.y0);

            this.tmpSelectedChildren = this.selectExtra ? this.selectedChildren.concat() : [];

            this.findSelectedChildren(true);

            this.onSelectChangeCallback();
        }
    };

    clearSelection() {
        if (this.rect) {
            this.rect.clear();
        }

        if (!this.selectExtra) {
            this.selectedChildren = [];
        }
    }

    findSelectedChildren = (temporary: boolean = false) => {
        const left: number = Math.min(this.x0, this.x1),
            top: number = Math.min(this.y0, this.y1),
            right: number = Math.max(this.x0, this.x1),
            bottom: number = Math.max(this.y0, this.y1),
            maxSide: number = Math.max(right - left, bottom - top);

        const sRect: PIXI.Rectangle = new PIXI.Rectangle(left, top, right - left, bottom - top),
            sPoly: number[] = [left, top, right, top, right, bottom, left, bottom];

        let smallTargets: PIXI.Container[] = [];

        for (let c of this.container.children) {
            if (c instanceof SelectionTool || !(c instanceof PIXI.Container) || !c.interactive) {
                continue;
            }

            let bounds: PIXI.Rectangle = c.getBounds();
            let con: PIXI.Container = c as PIXI.Container;

            // if the bounds are intersected
            if (this.intersectedRectangles(sRect, bounds)) {
                if (this.preciseDetection) {
                    const points: PIXI.Point[] = [
                        this.fromLocalNormalizedToGlobal(con, 0, 0),
                        this.fromLocalNormalizedToGlobal(con, 1, 0),
                        this.fromLocalNormalizedToGlobal(con, 1, 1),
                        this.fromLocalNormalizedToGlobal(con, 0, 1)
                    ];

                    const poly: number[] = [];
                    for (let p of points) {
                        poly.push(p.x);
                        poly.push(p.y);
                    }

                    if (this.intersectedPolygons(sPoly, poly)) {
                        if (maxSide > 9) {
                            this.addToSelection(con, false, temporary);
                        } else {
                            // too small selection area

                            smallTargets.push(con);
                        }
                    }
                } else {
                    if (maxSide > 9) {
                        this.addToSelection(con, false, temporary);
                    } else {
                        // too small selection area

                        smallTargets.push(con);
                    }
                }
            }
        }

        if (smallTargets.length > 0) {
            let c: PIXI.Container;
            let maxIndex: number = -1;

            for (let s of smallTargets) {
                let index: number = this.container.children.indexOf(s);

                if (index > maxIndex) {
                    c = s;
                }
            }

            this.addToSelection(c, true, temporary);
        }
    };

    // adds
    addToSelection(c: PIXI.Container, unselect: boolean = true, temporary: boolean = false) {
        if (!c) {
            return;
        }

        let arr: PIXI.Container[] = temporary ? this.tmpSelectedChildren : this.selectedChildren;

        if (this.selectExtra) {
            // if already added - unselect

            const i: number = arr.indexOf(c);

            if (i >= 0) {
                // already in the selection
                if (unselect) {
                    arr.splice(i, 1);
                }
            } else {
                arr.push(c);
            }
        } else {
            arr.push(c);
        }
    }

    intersectedRectangles(a: PIXI.Rectangle, b: PIXI.Rectangle) {
        if (
            this.pointInsideRectangle(new PIXI.Point(a.left, a.top), b) ||
            this.pointInsideRectangle(new PIXI.Point(a.right, a.top), b) ||
            this.pointInsideRectangle(new PIXI.Point(a.right, a.bottom), b) ||
            this.pointInsideRectangle(new PIXI.Point(a.left, a.bottom), b)
        ) {
            return true;
        }

        if (
            this.pointInsideRectangle(new PIXI.Point(b.left, b.top), a) ||
            this.pointInsideRectangle(new PIXI.Point(b.right, b.top), a) ||
            this.pointInsideRectangle(new PIXI.Point(b.right, b.bottom), a) ||
            this.pointInsideRectangle(new PIXI.Point(b.left, b.bottom), a)
        ) {
            return true;
        }

        if (
            this.pointInsideRectangleX(new PIXI.Point(a.left, a.top), b) &&
            this.pointInsideRectangleX(new PIXI.Point(a.left, a.bottom), b) &&
            a.top <= b.top &&
            a.bottom >= b.bottom
        ) {
            return true;
        }

        if (
            this.pointInsideRectangleX(new PIXI.Point(b.left, b.top), a) &&
            this.pointInsideRectangleX(new PIXI.Point(b.left, b.bottom), a) &&
            b.top <= a.top &&
            b.bottom >= a.bottom
        ) {
            return true;
        }

        return false;
    }

    pointInsideRectangle(p: PIXI.Point, rect: PIXI.Rectangle) {
        return this.pointInsideRectangleX(p, rect) && this.pointInsideRectangleY(p, rect);
    }

    pointInsideRectangleX(p: PIXI.Point, rect: PIXI.Rectangle) {
        return p.x >= rect.left && p.x <= rect.right;
    }

    pointInsideRectangleY(p: PIXI.Point, rect: PIXI.Rectangle) {
        return p.y >= rect.top && p.y <= rect.bottom;
    }

    fromLocalNormalizedToGlobal(obj: PIXI.Container, x: number, y: number) {
        let p: PIXI.Point = new PIXI.Point();
        const originalWidth: number = Math.abs(obj.width / obj.scale.x);
        const originalHeight: number = Math.abs(obj.height / obj.scale.y);
        const shiftX: number = obj.pivot.x / originalWidth;
        const shiftY: number = obj.pivot.y / originalHeight;

        obj.toGlobal(new PIXI.Point(originalWidth * (x - 0.5 + shiftX), originalHeight * (y - 0.5 + shiftY))).copyTo(p);

        return p;
    }

    intersectedPolygons(points1: number[], points2: number[]) {
        let a: number[] = points1;
        let b: number[] = points2;
        let polygons: number[][] = [a, b];
        let minA: number, maxA: number, projected: number, minB: number, maxB: number, j: number;

        for (let i: number = 0; i < polygons.length; i++) {
            let polygon: number[] = polygons[i];

            for (let i1: number = 0; i1 < polygon.length; i1 += 2) {
                let i2: number = (i1 + 2) % polygon.length;
                let normal: any = {
                    x: polygon[i2 + 1] - polygon[i1 + 1],
                    y: polygon[i1] - polygon[i2]
                };
                minA = maxA = null;

                for (j = 0; j < a.length; j += 2) {
                    projected = normal.x * a[j] + normal.y * a[j + 1];
                    if (minA === null || projected < minA) {
                        minA = projected;
                    }
                    if (maxA === null || projected > maxA) {
                        maxA = projected;
                    }
                }

                minB = maxB = null;

                for (j = 0; j < b.length; j += 2) {
                    projected = normal.x * b[j] + normal.y * b[j + 1];
                    if (minB === null || projected < minB) {
                        minB = projected;
                    }
                    if (maxB === null || projected > maxB) {
                        maxB = projected;
                    }
                }

                if (maxA < minB || maxB < minA) {
                    return false;
                }
            }
        }

        return true;
    }
}

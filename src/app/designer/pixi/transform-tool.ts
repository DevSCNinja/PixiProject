import * as PIXI from 'pixi.js';
import { SuperGraphics } from './super-graphics';

// Transform Tool

interface Draggable extends PIXI.Container {
    dragging: boolean;

    data: PIXI.InteractionData;

    // shift from the anchor point to a click point
    shiftX: number;

    shiftY: number;

    lastX: number;

    lastY: number;

    type?: string;
}

export interface Transformable extends PIXI.Container {
    // registration point needed for relative scaling or rotation (should not to be confused with pivot and position)
    regPoint?: PIXI.Point;
}

export class TransformTool extends PIXI.Container {
    static EVENT_ADD: string = 'eventAddTr';

    static EVENT_BEFORE_REMOVE: string = 'eventBeforeRemoveTr';

    static EVENT_REMOVE: string = 'eventRemoveTr';

    static EVENT_TRANSFORM: string = 'eventTransform';

    static EVENT_TRANSFORM_BEFORE_START: string = 'eventTransformBeforeStart';

    static EVENT_TRANSFORM_END: string = 'eventTransformEnd';

    static EVENT_REDRAW: string = 'eventRedraw';

    static EVENT_OPTIONS: string = 'eventOptions';

    static EVENT_DELETE: string = 'eventDelete';

    blockCornerInteraction: boolean = false;

    angleStep: number = 1.5; // in degrees

    cornerSide: number = 12;

    padding: PIXI.Point = new PIXI.Point(12, 12);

    typeOfTransformable: string = 'general';

    iconLib: any = {
        /*example:
        'rotate':'rotate.svg',
        'delete':'trash.svg',
        'options':'options.svg'
        */
    };

    // to owerwrite
    cornerLib: { [typeOfTransformable: string]: string[] } = {
        text: ['rotate', 'delete', 'options'],
        group: ['rotate', 'delete', 'options'],
        ruler: ['rotate', 'scaleX'],
        default: ['rotate', 'delete', 'scaleX', 'scale', 'scaleY', 'options']
    };

    colors: number[] = [0x661166, 0xffffff];

    graphicsLib: any = {};

    lastPageX: number = 0;

    lastPageY: number = 0;

    // List of tranformable objects
    list: Transformable[] = [];

    // positions of the transformable objects in the box's coords (normalized)
    originalMatrices: PIXI.Matrix[] = [];

    // draggable corners
    corners: Draggable[] = [];
    // container for the corners, draggable itself
    box: Draggable;

    boxBg: PIXI.Graphics;

    originalBoxWidth: number;

    originalBoxHeight: number;

    originalBoxX: number;

    originalBoxY: number;

    border: SuperGraphics;

    borderPoints: PIXI.Point[] = [];

    outlines: SuperGraphics;

    // If onlyOne is true - only one transformable object successfully added.
    // In that case the box will always have the same transform.matrix as the only transformable
    // If onlyOne is false the box will its own matrix, initially set as (1,0,0,1,0,0,1) and all the transformables'
    // matrices will be calculated as multiplication of the current box matrix and their initial matrices
    private onlyOne: boolean;

    private defaultMatrix: PIXI.Matrix = new PIXI.Matrix();

    private defaultCornerHitArea: PIXI.Rectangle = new PIXI.Rectangle(
        -this.cornerSide * 1.2,
        -this.cornerSide * 1.2,
        1.2 * 2 * this.cornerSide,
        1.2 * 2 * this.cornerSide
    );

    private blockBox: boolean = false;

    private minScale: PIXI.Point = new PIXI.Point(0.01, 0.01);

    constructor(public container: PIXI.Container) {
        super();

        this.box = new PIXI.Container() as Draggable;
        this.boxBg = new PIXI.Graphics();
        this.box.addChild(this.boxBg);

        this.border = new SuperGraphics();
        this.outlines = new SuperGraphics();
    }

    // [null] won't be added
    addTransformables(objects: Transformable[]) {
        if (!objects || objects.length === 0) {
            return;
        }

        let added: boolean = false;
        objects.forEach((item) => {
            added = this.addTransformable(item) ? true : added;
        });

        if (!added) {
            return;
        }

        this.typeOfTransformable = this.getTypeOfTransformable(this.list);

        if (this.list.length === 0) {
            return;
        }

        this.addBox();
        this.addBorder();
        this.addOutlines();
        this.addCorners();

        // remember original positions
        this.originalMatrices = [];

        for (let item of this.list) {
            let m: PIXI.Matrix = item.transform.worldTransform.clone();

            if (this.onlyOne) {
                //
            } else {
                m.translate(-this.originalBoxX, -this.originalBoxY);

                let p: PIXI.Point = new PIXI.Point().copyFrom(item.pivot);

                // if has pivots
                m.tx += p.x * m.a + p.y * m.c;
                m.ty += p.x * m.b + p.y * m.d;
            }

            this.originalMatrices.push(m);
        }

        this.followBox();

        this.emit(TransformTool.EVENT_ADD);
    }

    removeAllTransformables = () => {
        this.emit(TransformTool.EVENT_BEFORE_REMOVE);

        while (this.list.length > 0) {
            this.removeTranformable(this.list[this.list.length - 1]);
        }

        this.removeCorners();
        this.removeOutlines();
        this.removeBorder();
        this.removeBox();

        this.typeOfTransformable = this.getTypeOfTransformable(this.list);

        this.emit(TransformTool.EVENT_REMOVE);
    };

    // redraws the transform tool
    // call it when internal size of a transformable has been changed by itself (without a help of this transform tool)
    redraw(updTransformables: boolean = true) {
        let isVisible: boolean = this.box.parent ? true : false;
        if (!isVisible) {
            return;
        }
        // redraw the box
        this.drawBox(updTransformables);
        // redraw other elements without firing the transform event to avoid looping
        this.followBox(false, updTransformables);

        this.emit(TransformTool.EVENT_REDRAW);
    }

    // to override
    getTypeOfTransformable(list: PIXI.Container[]): string {
        return this.list.length > 1 ? 'group' : 'general';
    }

    getCornerPosition(type: string) {
        let p: PIXI.Point = new PIXI.Point();
        let c: Draggable = this.corners.find((corner) => corner.type === type);
        if (c) {
            p.copyFrom(c.position);
        }

        return p;
    }

    get isDragging() {
        return this.box.dragging || this.corners.find((elem) => elem.dragging) ? true : false;
    }

    set blockBoxInteraction(value: boolean) {
        this.blockBox = value;

        if (this.blockBox) {
            this.box.cursor = null;
        } else {
            this.box.cursor = 'move';
        }

        this.box.interactive = !value;
    }

    get blockBoxInteraction(): boolean {
        return this.blockBox;
    }

    private fromBoxLocalNormalizedToGlobal(x: number, y: number, includePadding: boolean = true) {
        let p: PIXI.Point = new PIXI.Point();

        if (includePadding) {
            // unlike addPadding() may support skew in the future
            let padx: number = Math.sign(x - 0.5) * this.padding.x;
            let pady: number = Math.sign(y - 0.5) * this.padding.y;
            x += padx / this.originalBoxWidth / this.box.scale.x;
            y += pady / this.originalBoxHeight / this.box.scale.y;
        }
        this.box.toGlobal(new PIXI.Point(this.originalBoxWidth * (x - 0.5), this.originalBoxHeight * (y - 0.5))).copyTo(p);
        return p;
    }

    private fromLocalNormalizedToGlobal(obj: PIXI.Container, x: number, y: number) {
        let p: PIXI.Point = new PIXI.Point();

        const originalWidth: number = Math.abs(obj.width / obj.scale.x);
        const originalHeight: number = Math.abs(obj.height / obj.scale.y);
        const shiftX: number = obj.pivot.x / originalWidth;
        const shiftY: number = obj.pivot.y / originalHeight;

        obj.toGlobal(new PIXI.Point(originalWidth * (x - 0.5 + shiftX), originalHeight * (y - 0.5 + shiftY))).copyTo(p);

        return p;
    }

    // can be used in fromBoxLocalNormalizedToGlobal too
    private addPadding(x: number, y: number, point: PIXI.Point) {
        let p: PIXI.Point = new PIXI.Point();

        let padx: number = Math.sign(x - 0.5) * this.padding.x;
        let pady: number = Math.sign(y - 0.5) * this.padding.y;

        let diagonal: number = Math.sqrt(padx * padx + pady * pady);
        let ang: number = Math.atan2(pady, padx) + this.box.rotation;

        p.x = point.x + Math.cos(ang) * diagonal;
        p.y = point.y + Math.sin(ang) * diagonal;

        return p;
    }

    private subtractPadding(x: number, y: number, point: PIXI.Point) {
        return this.addPadding(1 - x, 1 - y, point);
    }

    private getRestrictedScaleX(value: number) {
        return Math.max(this.minScale.x * this.container.scale.x, value);
    }

    private getRestrictedScaleY(value: number) {
        return Math.max(this.minScale.y * this.container.scale.y, value);
    }

    private addTransformable = (obj: Transformable): boolean => {
        if (obj === this) {
            return false;
        }

        if (!obj) {
            return false;
        }

        if (this.list.indexOf(obj) >= 0) {
            return false;
        }

        if (!obj.interactive) {
            return false;
        }

        this.list.push(obj);

        return true;
    };

    private removeTranformable = (obj: Transformable) => {
        if (!obj) {
            return;
        }

        let i = this.list.indexOf(obj);
        if (i === -1) {
            return;
        }

        this.list.splice(i, 1);
    };

    private addBox() {
        if (this.box.parent) {
            return;
        }

        this.drawBox();

        if (this.list.length === 0) {
            return;
        }

        this.box.interactive = !this.blockBoxInteraction;
        this.box.buttonMode = true;

        if (!this.blockBoxInteraction) {
            this.box.cursor = 'move';
        }

        this.box.dragging = false;
        this.box.data = null;
        this.box.shiftX = 0;
        this.box.shiftY = 0;

        this.box.on('pointerdown', this.onDragStart);

        this.addChildAt(this.box, 0);
    }

    drawBox(updTransformables: boolean = true) {
        this.boxBg.clear();

        if (this.list.length === 0) {
            return;
        }

        this.onlyOne = this.list.length === 1;

        let x0: number = Number.POSITIVE_INFINITY,
            y0: number = Number.POSITIVE_INFINITY,
            x1: number = Number.NEGATIVE_INFINITY,
            y1: number = Number.NEGATIVE_INFINITY;

        for (let item of this.list) {
            let bounds: PIXI.Rectangle = item.getBounds();

            x0 = Math.min(x0, bounds.left);
            y0 = Math.min(y0, bounds.top);
            x1 = Math.max(x1, bounds.right);
            y1 = Math.max(y1, bounds.bottom);
        }

        let w: number;
        let h: number;

        if (this.onlyOne) {
            let item: Transformable = this.list[0];

            // save item's matrix
            let m: PIXI.Matrix = item.transform.worldTransform.clone();
            let p: PIXI.Point = new PIXI.Point().copyFrom(item.pivot);

            // if has pivots
            m.tx += p.x * m.a + p.y * m.c;
            m.ty += p.x * m.b + p.y * m.d;

            // apply item's saved matrix to the box, but do not use negative scales cause there is a issue with them in PIXI
            this.box.transform.setFromMatrix(m);

            // reset item's matrix
            if (updTransformables) {
                item.transform.setFromMatrix(this.defaultMatrix);
            }

            // get width and height without transformation
            w = this.originalBoxWidth = Math.abs(item.width);
            h = this.originalBoxHeight = Math.abs(item.height);
        } else {
            w = this.originalBoxWidth = x1 - x0;
            h = this.originalBoxHeight = y1 - y0;

            this.box.x = this.originalBoxX = (x0 + x1) / 2;
            this.box.y = this.originalBoxY = (y0 + y1) / 2;
        }

        const alpha: number = 0.0;
        this.boxBg
            .beginFill(0x66cc36, alpha)
            .drawRect(-w / 2, -h / 2, w, h)
            .endFill();

        if (alpha === 0) {
            this.boxBg.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
        }
    }

    private removeBox() {
        if (!this.box.parent) {
            return;
        }

        this.box.transform.setFromMatrix(this.defaultMatrix);

        this.box
            .off('pointerdown', this.onDragStart)
            .off('pointermove', this.onDragMove)
            .off('pointerup', this.onDragEnd)
            .off('pointerupoutside', this.onDragEnd);

        this.removeChild(this.box);
    }

    private addCorners() {
        if (!this.box.parent) {
            console.warn('Add the box before adding the corners');
            return;
        }

        if (this.corners.length > 0) {
            return;
        }

        let cornerNames: string[] = this.cornerLib[this.typeOfTransformable];

        if (!cornerNames) {
            cornerNames = this.cornerLib.default;
        }

        for (let n of cornerNames) {
            this.addCorner(n);
        }
    }

    private removeCorners() {
        if (this.corners.length === 0) {
            return;
        }

        for (let c of this.corners) {
            if (c) {
                c.off('pointerdown', this.onCornerDragStart);
                c.off('pointermove', this.onCornerDragMove)
                    .off('pointerup', this.onCornerDragEnd)
                    .off('pointerupoutside', this.onCornerDragEnd);

                if (c.parent) {
                    c.parent.removeChild(c);
                }

                c = null;
            }
        }

        this.corners = [];
    }

    private addBorder() {
        if (!this.box.parent) {
            console.warn('Add the box before adding the border');
            return;
        }

        this.drawBorder();

        this.addChild(this.border);
    }

    private removeBorder() {
        if (!this.border.parent) {
            return;
        }

        this.borderPoints = [];

        this.border.parent.removeChild(this.border);
    }

    drawBorder(
        detectBorder: boolean = true,
        offsetPercentage: number = 1,
        x: number = 0,
        y: number = 0,
        rotation: number = 0,
        dash: number = 7,
        gap: number = 7
    ) {
        if (detectBorder) {
            this.borderPoints = [
                this.fromBoxLocalNormalizedToGlobal(0, 0),
                this.fromBoxLocalNormalizedToGlobal(1, 0),
                this.fromBoxLocalNormalizedToGlobal(1, 1),
                this.fromBoxLocalNormalizedToGlobal(0, 1)
            ];
        }

        if (this.borderPoints.length === 0) {
            return;
        }

        this.border.clear().lineStyle(2, this.colors[0]);

        this.border.drawDashedPolygon(this.borderPoints, offsetPercentage, x, y, rotation, dash, gap);
    }

    private addOutlines() {
        if (this.outlines.parent) {
            return;
        }

        this.drawOutlines();

        this.addChild(this.outlines);
    }

    private removeOutlines() {
        if (!this.outlines.parent) {
            return;
        }

        this.outlines.parent.removeChild(this.outlines);
    }

    drawOutlines(items?: PIXI.Container[]) {
        if (!items) {
            items = this.list;
        } else {
            // draw outlines for some external arbitary objects
            this.addOutlines();
        }
        this.outlines.clear().lineStyle(2, this.colors[0]);
        //.lineStyle(2, 0x7E7E5E)

        for (let item of items) {
            let p: PIXI.Point[] = [
                this.fromLocalNormalizedToGlobal(item, 0, 0),
                this.fromLocalNormalizedToGlobal(item, 1, 0),
                this.fromLocalNormalizedToGlobal(item, 1, 1),
                this.fromLocalNormalizedToGlobal(item, 0, 1)
            ];

            this.outlines.moveTo(p[0].x, p[0].y);
            this.outlines.lineTo(p[1].x, p[1].y);
            this.outlines.lineTo(p[2].x, p[2].y);
            this.outlines.lineTo(p[3].x, p[3].y);
            this.outlines.lineTo(p[0].x, p[0].y);
        }
    }

    private addCorner(type: string) {
        let corner: Draggable = new PIXI.Container() as Draggable;

        corner.addChild(this.getCornerGraphics(type));
        if (['rotate', 'delete', 'options'].indexOf(type) >= 0) {
            corner.buttonMode = true;
        }
        corner.hitArea = this.defaultCornerHitArea;
        corner.type = type;
        corner.interactive = true;
        corner.dragging = false;
        corner.data = null;
        corner.alpha = 1;

        corner.on('pointerdown', this.onCornerDragStart);

        this.corners.push(corner);

        this.addChild(corner);
    }

    getCornerGraphics(type: string) {
        if (this.graphicsLib[type]) {
            // use cached graphics
            return this.graphicsLib[type];
        }

        // draw graphics
        let bg: SuperGraphics = new SuperGraphics();

        bg.beginFill(this.colors[0], 1);

        const side: number = this.cornerSide;

        switch (type) {
            case 'scale':
                bg.drawRect(-side, -0.5 * side, 2 * side, side).endFill();

                bg.beginFill(this.colors[1]);
                bg.decodePath(
                    'AA4AgQgDgDAAgDIAAgMIhpAAIAAAMQgBADgCADQAAAAgBAAQAAABgBAAQAAAAgBAAQAAAAgBAAQgBAAAAAAQgBAAgBAAQAAAAgBgBQAAAAgBAAIgbgbQAAgBAAgBQgBAAAAgBQAAAAAAgBQgBAAAAgBQAAgCACgCIAbgaQABgBAAAAQABgBAAAAQABAAABAAQAAAAABAAQABAAAAAAQABAAAAAAQABAAAAABQABAAAAABQABAAAAABQABAAAAABQAAAAAAABQABAAAAABIAAAOIBpAAIAAgOQAAgBABAAQAAgBAAAAQAAgBABAAQAAgBABAAQAAgBABAAQAAgBABAAQAAAAABAAQAAAAABAAQADAAACACIAbAaQACACAAACQAAABgBAAQAAABAAAAQAAABgBAAQAAABAAABIgbAbQgCABgDAAQgBAAAAAAQgBAAAAAAQgBAAAAgBQgBAAAAAAg'
                );
                bg.endFill();
                bg.rotation = Math.PI / 4;

                break;

            case 'scaleX':
                bg.drawRect(-side, -0.5 * side, 2 * side, side).endFill();

                bg.beginFill(this.colors[1]);
                bg.decodePath(
                    'AA4AgQgDgDAAgDIAAgMIhpAAIAAAMQgBADgCADQAAAAgBAAQAAABgBAAQAAAAgBAAQAAAAgBAAQgBAAAAAAQgBAAgBAAQAAAAgBgBQAAAAgBAAIgbgbQAAgBAAgBQgBAAAAgBQAAAAAAgBQgBAAAAgBQAAgCACgCIAbgaQABgBAAAAQABgBAAAAQABAAABAAQAAAAABAAQABAAAAAAQABAAAAAAQABAAAAABQABAAAAABQABAAAAABQABAAAAABQAAAAAAABQABAAAAABIAAAOIBpAAIAAgOQAAgBABAAQAAgBAAAAQAAgBABAAQAAgBABAAQAAgBABAAQAAgBABAAQAAAAABAAQAAAAABAAQADAAACACIAbAaQACACAAACQAAABgBAAQAAABAAAAQAAABgBAAQAAABAAABIgbAbQgCABgDAAQgBAAAAAAQgBAAAAAAQgBAAAAgBQgBAAAAAAg'
                );
                bg.endFill();

                break;

            case 'scaleX2':
                bg.drawRect(-side, -0.5 * side, 2 * side, side).endFill();

                bg.beginFill(this.colors[1]);
                bg.decodePath(
                    'AA4AgQgDgDAAgDIAAgMIhpAAIAAAMQgBADgCADQAAAAgBAAQAAABgBAAQAAAAgBAAQAAAAgBAAQgBAAAAAAQgBAAgBAAQAAAAgBgBQAAAAgBAAIgbgbQAAgBAAgBQgBAAAAgBQAAAAAAgBQgBAAAAgBQAAgCACgCIAbgaQABgBAAAAQABgBAAAAQABAAABAAQAAAAABAAQABAAAAAAQABAAAAAAQABAAAAABQABAAAAABQABAAAAABQABAAAAABQAAAAAAABQABAAAAABIAAAOIBpAAIAAgOQAAgBABAAQAAgBAAAAQAAgBABAAQAAgBABAAQAAgBABAAQAAgBABAAQAAAAABAAQAAAAABAAQADAAACACIAbAaQACACAAACQAAABgBAAQAAABAAAAQAAABgBAAQAAABAAABIgbAbQgCABgDAAQgBAAAAAAQgBAAAAAAQgBAAAAgBQgBAAAAAAg'
                );
                bg.endFill();

                break;

            case 'scaleY':
                bg.drawRect(-0.5 * side, -side, side, 2 * side).endFill();

                bg.beginFill(this.colors[1]);
                bg.decodePath(
                    'AgEBbIgbgaQgCgCAAgDQAAgBABAAQAAgBAAAAQAAgBABAAQAAgBAAgBQADgBADAAIAMAAIAAhrIgMAAQgDAAgDgBQAAgBAAgBQgBAAAAgBQAAAAAAgBQgBAAAAgBQAAgDACgCIAbgaQABgBABAAQAAgBABAAQAAAAABAAQAAAAAAAAQADAAACACIAaAaQADACAAADQAAABgBAAQAAABAAAAQAAABgBAAQAAABgBABQAAAAgBAAQAAABgBAAQAAAAgBAAQAAAAgBAAIgOAAIAABrIAOAAQABAAAAAAQABAAAAAAQABAAAAABQABAAAAAAQABABAAABQABAAAAABQAAAAAAABQABAAAAABQAAADgDACIgaAaQgCACgDAAQAAAAAAAAQgBAAAAAAQgBAAAAgBQgBAAgBgBg'
                );
                bg.endFill();

                break;

            case 'scaleY2':
                bg.drawRect(-0.5 * side, -side, side, 2 * side).endFill();

                bg.beginFill(this.colors[1]);
                bg.decodePath(
                    'AgEBbIgbgaQgCgCAAgDQAAgBABAAQAAgBAAAAQAAgBABAAQAAgBAAgBQADgBADAAIAMAAIAAhrIgMAAQgDAAgDgBQAAgBAAgBQgBAAAAgBQAAAAAAgBQgBAAAAgBQAAgDACgCIAbgaQABgBABAAQAAgBABAAQAAAAABAAQAAAAAAAAQADAAACACIAaAaQADACAAADQAAABgBAAQAAABAAAAQAAABgBAAQAAABgBABQAAAAgBAAQAAABgBAAQAAAAgBAAQAAAAgBAAIgOAAIAABrIAOAAQABAAAAAAQABAAAAAAQABAAAAABQABAAAAAAQABABAAABQABAAAAABQAAAAAAABQABAAAAABQAAADgDACIgaAaQgCACgDAAQAAAAAAAAQgBAAAAAAQgBAAAAgBQgBAAgBgBg'
                );
                bg.endFill();

                break;

            case 'rotate':
                bg.drawCircle(0, 0, Math.floor(side * 1.2)).endFill();

                bg.beginFill(this.colors[1]);
                bg.decodePath(
                    'AghBJQgQgIgLgOIgBgDIABgBIAOgPIADgBIACABQAHALALAFQAMAGALAAQALAAAKgFQAKgEAHgHQAHgIAEgJQAFgLAAgKQAAgKgFgKQgEgKgHgHQgHgHgKgFQgKgDgLAAQgJgBgKAEQgJAEgHAGIAOAPQADAEgCAEQgCADgDAAIgwAAQAAAAgBAAQAAAAgBAAQAAAAgBgBQgBAAAAAAQgBgBAAgBQAAAAgBgBQAAAAAAgBQAAAAAAgBIAAgvQAAgFAEgBQAEgCADAEIAOANQALgKAOgHQAOgFAPAAQAQAAAPAGQAPAGALALQALALAGAPQAGAPAAAPQAAAQgGAPQgGAPgLALQgLAKgPAHQgPAGgQAAQgRAAgQgHg'
                );
                bg.endFill();

                break;

            case 'delete':
                bg.drawCircle(0, 0, Math.floor(side * 1.2)).endFill();

                bg.lineStyle(3, this.colors[1]).moveTo(-5.5, -5.5).lineTo(5.5, 5.5).moveTo(5.5, -5.5).lineTo(-5.5, 5.5);

                break;

            case 'options':
                bg.drawCircle(0, 0, Math.floor(side * 1.2)).endFill();

                bg.beginFill(this.colors[1], 1).drawCircle(-6, 0, 2).drawCircle(0, 0, 2).drawCircle(6, 0, 2).endFill();

                break;
        }

        // cache graphics
        this.graphicsLib[type] = bg;

        return bg;
    }

    private onDragStart = (e: PIXI.InteractionEvent) => {
        if (this.blockBoxInteraction) {
            return;
        }

        this.emit(TransformTool.EVENT_TRANSFORM_BEFORE_START);

        const obj: Draggable = e.currentTarget as Draggable;

        if (obj.dragging) {
            this.onDragEnd(e);
            return;
        }

        // store a reference to the data
        // the reason for this is because of multitouch
        // we want to track the movement of this particular touch
        obj.data = e.data;
        obj.dragging = true;
        obj.shiftX = obj.x - e.data.global.x;
        obj.shiftY = obj.y - e.data.global.y;
        obj.lastX = obj.x;
        obj.lastY = obj.y;
        this.lastPageX = NaN;
        this.lastPageY = NaN;

        obj.on('pointermove', this.onDragMove).on('pointerup', this.onDragEnd).on('pointerupoutside', this.onDragEnd);
    };

    private onDragEnd = (e: PIXI.InteractionEvent) => {
        const obj: Draggable = e.currentTarget as Draggable;

        obj.dragging = false;
        obj.data = null;

        obj.off('pointermove', this.onDragMove).off('pointerup', this.onDragEnd).off('pointerupoutside', this.onDragEnd);

        this.emit(TransformTool.EVENT_TRANSFORM_END);
    };

    private onDragMove = (e: PIXI.InteractionEvent) => {
        const obj: Draggable = e.currentTarget as Draggable;

        if (obj && obj.dragging) {
            const newPosition = obj.data.getLocalPosition(obj.parent);

            obj.x = newPosition.x + obj.shiftX;
            obj.y = newPosition.y + obj.shiftY;

            this.followBox();
        }

        let oe: MouseEvent | TouchEvent | PointerEvent = e.data.originalEvent;
        if (oe) {
            if (oe.type.indexOf('touch') >= 0) {
                let touch = (oe as TouchEvent).touches[0];
                this.lastPageX = touch.pageX;
                this.lastPageY = touch.pageY;
            } else {
                this.lastPageX = (oe as PointerEvent).pageX;
                this.lastPageY = (oe as PointerEvent).pageY;
            }
        }
    };

    // use it to transform the transformables externally (e.g. keyboard arrow keys to move them)
    translate(dx: number, dy: number, emit: boolean = true) {
        if (this.blockBoxInteraction || this.list.length === 0) {
            return;
        }
        // emulate dragging
        // start
        if (emit) {
            this.emit(TransformTool.EVENT_TRANSFORM_BEFORE_START);
        }
        // move
        this.box.x += dx;
        this.box.y += dy;
        this.followBox(emit);
        // end
        if (emit) {
            this.emit(TransformTool.EVENT_TRANSFORM_END);
        }
    }

    // apply transformation of the box to the corners, the items, the border etc.
    followBox = (emit: boolean = true, updTransformables: boolean = true) => {
        let newPosition: PIXI.Point, newRotation: number, newCursor: string;

        for (let c of this.corners) {
            newPosition = null;
            newRotation = NaN;
            newCursor = null;

            switch (c.type) {
                case 'rotate':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(0, 0);

                    break;

                case 'delete':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(1, 0);

                    break;

                case 'scaleX':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(1, 0.5);
                    newRotation = this.box.rotation;
                    newCursor = this.angToCursor(this.box.rotation);

                    break;

                case 'scaleX2':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(0, 0.5);
                    newRotation = this.box.rotation;
                    newCursor = this.angToCursor(this.box.rotation);

                    break;

                case 'scale':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(1, 1);
                    newRotation = this.box.rotation;
                    newCursor = this.angToCursor(this.box.rotation + Math.PI / 4);

                    break;

                case 'scaleY':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(0.5, 1);
                    newRotation = this.box.rotation;
                    newCursor = this.angToCursor(this.box.rotation + Math.PI / 2);

                    break;

                case 'scaleY2':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(0.5, 0);
                    newRotation = this.box.rotation;
                    newCursor = this.angToCursor(this.box.rotation + Math.PI / 2);

                    break;

                case 'options':
                    newPosition = this.fromBoxLocalNormalizedToGlobal(0, 1);

                    break;

                default:
            }

            if (newPosition) {
                c.position.set(newPosition.x, newPosition.y);
                c.lastX = newPosition.x;
                c.lastY = newPosition.y;
            }
            if (!isNaN(newRotation)) {
                c.rotation = newRotation;
            }
            if (newCursor) {
                c.cursor = newCursor;
            }
        }

        if (updTransformables && this.list.length > 0) {
            let pm0: PIXI.Matrix = this.box.transform.worldTransform;
            // from the world to the container
            pm0 = this.container.worldTransform.clone().invert().append(pm0);

            if (this.onlyOne) {
                let item: Transformable = this.list[0];

                item.transform.setFromMatrix(pm0);
            } else {
                this.list.forEach((item, i) => {
                    // original matrix of the item
                    let mo: PIXI.Matrix = this.originalMatrices[i];

                    // new matrix of the item
                    let m: PIXI.Matrix = mo.clone();

                    // matrix of the box
                    let pm: PIXI.Matrix = pm0.clone();

                    item.transform.setFromMatrix(m.prepend(pm));
                });
            }
        }

        this.drawOutlines();

        this.drawBorder();

        if (emit) {
            this.emit(TransformTool.EVENT_TRANSFORM);
        }
    };

    private angToCursor(ang: number): string {
        // only positive
        ang = ang < 0 ? 2 * Math.PI + ang : ang;
        ang = PIXI.RAD_TO_DEG * ang;

        const halfSector: number = 22.5; //  degrees
        if (ang < halfSector) {
            return 'ew-resize';
        }

        if (ang < 3 * halfSector) {
            return 'nwse-resize';
        }

        if (ang < 5 * halfSector) {
            return 'ns-resize';
        }

        if (ang < 7 * halfSector) {
            return 'nesw-resize';
        }

        if (ang < 9 * halfSector) {
            return 'ew-resize';
        }

        if (ang < 11 * halfSector) {
            return 'nwse-resize';
        }

        if (ang < 13 * halfSector) {
            return 'ns-resize';
        }

        if (ang < 15 * halfSector) {
            return 'nesw-resize';
        }

        return 'ew-resize';
    }

    private onCornerDragStart = (e: PIXI.InteractionEvent) => {
        if (this.blockCornerInteraction) {
            return;
        }

        this.emit(TransformTool.EVENT_TRANSFORM_BEFORE_START);

        const obj: Draggable = e.currentTarget as Draggable;

        this.lastPageX = NaN;
        this.lastPageY = NaN;

        if (obj.dragging) {
            this.onCornerDragEnd(e);
            return;
        }

        if (obj.type === 'options') {
            this.emit(TransformTool.EVENT_OPTIONS, e);
        } else {
            if (obj.type === 'delete') {
                this.emit(TransformTool.EVENT_DELETE, e);
            } else {
                // store a reference to the data
                // the reason for this is because of multitouch
                // we want to track the movement of this particular touch
                obj.data = e.data;
                obj.alpha = 0.25;
                obj.dragging = true;
                obj.shiftX = obj.x - e.data.global.x;
                obj.shiftY = obj.y - e.data.global.y;
                obj.lastX = obj.x;
                obj.lastY = obj.y;

                obj.on('pointermove', this.onCornerDragMove)
                    .on('pointerup', this.onCornerDragEnd)
                    .on('pointerupoutside', this.onCornerDragEnd);
            }
        }
    };

    private onCornerDragEnd = (e: PIXI.InteractionEvent) => {
        const obj: Draggable = e.currentTarget as Draggable;

        obj.alpha = 1;
        obj.dragging = false;
        obj.data = null;

        obj.off('pointermove', this.onCornerDragMove).off('pointerup', this.onCornerDragEnd).off('pointerupoutside', this.onCornerDragEnd);

        this.emit(TransformTool.EVENT_TRANSFORM_END);
    };

    private onCornerDragMove = (e: PIXI.InteractionEvent) => {
        const obj: Draggable = e.currentTarget as Draggable;

        if (obj && obj.dragging) {
            const newPosition = obj.data.getLocalPosition(obj.parent);

            obj.x = newPosition.x + obj.shiftX;
            obj.y = newPosition.y + obj.shiftY;

            this.followCorner(obj);
        }
    };

    // follow the corner after it was dragged
    // TODO: better logics may be needed when corner.type === 'scale' and minScale.x !== minScale.y
    private followCorner = (corner: Draggable) => {
        let diagonalAngle: number, dx: number, dy: number, ang: number, delta: number, newScale: number;
        let reg: PIXI.Point = this.onlyOne ? this.list[0].regPoint : null;
        let cornerPos: PIXI.Point; // box's corner position

        switch (corner.type) {
            case 'scale':
                cornerPos = this.subtractPadding(1, 1, corner.position);

                diagonalAngle = Math.atan2(this.box.height, this.box.width);

                const diagonal: number = Math.sqrt(Math.pow(this.box.width * 0.5, 2) + Math.pow(this.box.height * 0.5, 2));

                dx = cornerPos.x - this.box.x;
                dy = cornerPos.y - this.box.y;

                const teta: number = diagonalAngle + this.box.rotation - Math.atan2(dy, dx);
                const newDiagonal: number = Math.cos(teta) * Math.sqrt(dx * dx + dy * dy);

                const sc: number = newDiagonal / diagonal;

                this.box.scale.set(this.getRestrictedScaleX(sc * this.box.scale.x), this.getRestrictedScaleY(sc * this.box.scale.y));

                break;

            case 'scaleX':
                cornerPos = this.subtractPadding(1, 0.5, corner.position);

                dx = cornerPos.x - this.box.x;
                dy = cornerPos.y - this.box.y;

                ang = Math.atan2(dy, dx) - this.box.rotation;

                delta = Math.cos(ang) * Math.sqrt(dx * dx + dy * dy);

                if (reg) {
                    // very minimal registration point support (enhancement is welcome)
                    delta = (delta + this.box.width / 2) / 2;

                    newScale = this.getRestrictedScaleX((2 * delta) / this.originalBoxWidth);

                    dx = (newScale - this.box.scale.x) * (this.originalBoxWidth / 2);
                    this.box.x += dx * Math.cos(this.box.rotation);
                    this.box.y += dx * Math.sin(this.box.rotation);
                } else {
                    newScale = this.getRestrictedScaleX((2 * delta) / this.originalBoxWidth);
                }

                this.box.scale.x = newScale;

                break;

            case 'scaleX2':
                cornerPos = this.subtractPadding(0, 0.5, corner.position);

                dx = cornerPos.x - this.box.x;
                dy = cornerPos.y - this.box.y;

                ang = Math.atan2(dy, dx) - this.box.rotation - Math.PI;

                delta = Math.cos(ang) * Math.sqrt(dx * dx + dy * dy);

                this.box.scale.x = this.getRestrictedScaleX((2 * delta) / this.originalBoxWidth);

                break;

            case 'scaleY':
                cornerPos = this.subtractPadding(0.5, 1, corner.position);

                dx = cornerPos.x - this.box.x;
                dy = cornerPos.y - this.box.y;

                ang = Math.atan2(dy, dx) - this.box.rotation - Math.PI / 2;

                delta = Math.cos(ang) * Math.sqrt(dx * dx + dy * dy);

                this.box.scale.y = this.getRestrictedScaleY((2 * delta) / this.originalBoxHeight);

                break;

            case 'scaleY2':
                cornerPos = this.subtractPadding(0.5, 0, corner.position);

                dx = cornerPos.x - this.box.x;
                dy = cornerPos.y - this.box.y;

                ang = Math.atan2(dy, dx) - this.box.rotation + Math.PI / 2;

                delta = Math.cos(ang) * Math.sqrt(dx * dx + dy * dy);

                this.box.scale.y = this.getRestrictedScaleY((2 * delta) / this.originalBoxHeight);

                break;

            case 'rotate':
                cornerPos = this.subtractPadding(0, 0, corner.position);

                diagonalAngle = Math.atan2(-this.box.height, -this.box.width);

                dx = cornerPos.x - this.box.x;
                dy = cornerPos.y - this.box.y;

                ang = Math.atan2(dy, dx);

                let step: number = PIXI.DEG_TO_RAD * this.angleStep;
                this.box.rotation = Math.round((ang - diagonalAngle) / step) * step;

                break;

            default:
        }

        this.followBox();
    };

    setMinScale(x: number, y: number) {
        this.minScale.x = x;
        this.minScale.y = y;

        this.box.scale.set(this.getRestrictedScaleX(this.box.scale.x), this.getRestrictedScaleY(this.box.scale.y));

        this.followBox();
    }

    getMinScale() {
        return this.minScale;
    }
}

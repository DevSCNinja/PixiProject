import * as PIXI from 'pixi.js';
// wrapper for a complex transformable object consisting of few objects transformed inidividually,
// allows to work with negative scales (flip vertically or horizontally)

export class MultiCase extends PIXI.Container {
    objs: PIXI.Container[] = [];

    flippedH: boolean = false;

    flippedV: boolean = false;

    constructor() {
        super();
    }

    add(objects: PIXI.Container[]) {
        if (!objects) {
            return;
        }

        this.remove();

        for (let object of objects) {
            this.objs.push(object);

            if (!object) {
                continue;
            }

            this.addChild(object);
        }
    }

    remove() {
        if (this.objs) {
            for (let object of this.objs) {
                if (!object) {
                    continue;
                }

                this.removeChild(object);
            }

            this.objs = [];
            this.flippedH = false;
            this.flippedV = false;
        }
    }

    flipH() {
        if (this.objs) {
            for (let object of this.objs) {
                if (!object) {
                    continue;
                }

                object.scale.x = -object.scale.x;
            }

            this.flippedH = !this.flippedH;
        }
    }

    flipV() {
        if (this.objs) {
            for (let object of this.objs) {
                if (!object) {
                    continue;
                }

                object.scale.y = -object.scale.y;
            }

            this.flippedV = !this.flippedV;
        }
    }

    // to specify/override
    redraw(...args: any[]) {}
}

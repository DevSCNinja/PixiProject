import * as PIXI from 'pixi.js';
import { SuperGraphics } from './super-graphics';

export class Ruler extends PIXI.Container {
    rect: PIXI.Graphics;

    markup: PIXI.Container;

    markupMask: PIXI.Graphics;

    texts: PIXI.Text[] = [];

    box: PIXI.Container;

    regPoint: PIXI.Point = new PIXI.Point(0, 0); // needed to scale Ruler relatively to this point via Transform Tool

    constructor(
        lengthInch: number = 51,
        ppi: number = 32,
        w: number = 300,
        h: number = 30,
        x0: number = 0,
        sc: number = 1,
        inchesToShowText: number = 6,
        showFootText: boolean = true,
        showZero: boolean = false
    ) {
        super();

        w *= sc;
        h *= sc;
        x0 *= sc;

        this.box = new PIXI.Container();

        this.rect = new PIXI.Graphics();
        this.rect
            .beginFill(0x5f9f9f) //0x999999
            .drawRect(x0, -h / 2, w, h)
            .endFill();

        this.box.addChild(this.rect);

        this.markupMask = new PIXI.Graphics();
        this.markupMask
            .beginFill(0x999999, 1)
            .drawRect(x0, -h / 2, w, h)
            .endFill();

        this.box.addChild(this.markupMask);

        this.markup = new PIXI.Container();

        const lengthPx: number = lengthInch * ppi;
        const points: PIXI.Point[] = [new PIXI.Point(x0, 0), new PIXI.Point(x0 + lengthPx, 0)];
        const dash: number = 1 * sc;
        const step0: number = ppi;
        const step1: number = ppi * 6;
        const step2: number = ppi * 12;

        let gr: SuperGraphics = new SuperGraphics();
        gr.lineStyle(8 * sc, 0xf6f6f6);
        gr.drawDashedPolygon(points, 0, step0, -12 * sc, 0, dash, step0 - dash, false); // small dashes (inch)
        gr.lineStyle(12 * sc, 0xf6f6f6);
        gr.drawDashedPolygon(points, 0, step1, -12 * sc, 0, dash, step1 - dash, false); //  medium dashes (6 inches)
        gr.lineStyle(17 * sc, 0xffffff);
        gr.drawDashedPolygon(points, 0, step2, -12 * sc, 0, dash, step2 - dash, false); // big dashes (foot)
        gr.lineStyle(1 * sc, 0xee0028) // red mark about Zero
            .beginFill(0xee0028)
            .drawRect(x0, -h / 2, 2 * sc, 15 * sc)
            .endFill();

        this.markup.addChild(gr);

        for (let i: number = 0; i < lengthInch; i += inchesToShowText) {
            if (!showZero && i === 0) {
                continue;
            }
            let isFoot: boolean = showFootText && i % 12 === 0;
            let fs: number = showFootText ? (isFoot ? 15 * sc : 12 * sc) : 14 * sc;
            let num: number = isFoot ? i / 12 : i;
            let t: PIXI.Text = new PIXI.Text(num.toString() + (i === 0 ? '' : isFoot ? "'" : '"'), {
                fontFamily: 'Arial',
                fontSize: fs,
                fontWeight: isFoot ? 'bold' : 'normal',
                fill: i === 0 ? 0xee0028 : showFootText ? (isFoot ? 0xffffff : 0xf2f2f2) : 0xffffff,
                align: 'center'
            });
            t.x = i * ppi - Math.floor(i > 0 ? (num >= 10 ? fs / 2 : fs / 4) : -1 * sc);
            t.y = isFoot ? -2 * sc : -5 * sc;
            this.texts.push(t);
            this.markup.addChild(t);
        }

        this.markup.mask = this.markupMask;

        this.box.addChild(this.markup);

        this.addChild(this.box);
    }

    redraw() {
        this.markup.scale.x = 1 / this.scale.x;
    }
}

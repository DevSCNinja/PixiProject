import * as PIXI from 'pixi.js';
import { FillMaskFilter } from './fill-mask-filter';

// wrapper over FillMaskFilter for easier usage
export class FillFilter extends PIXI.Filter {
    fillTexture: PIXI.Texture;

    textureScale: number = 1;

    private filterFillMask: FillMaskFilter;

    constructor() {
        super();

        this.filterFillMask = new FillMaskFilter();
        this.byAlpha = true;
        this.byColor = false;
        this.inverseAlpha = false;
        this.inverseColor = false;
    }

    apply(filterManager: PIXI.systems.FilterSystem, input: PIXI.RenderTexture, output: PIXI.RenderTexture, clearMode: PIXI.CLEAR_MODES) {
        let m: PIXI.Matrix = new PIXI.Matrix();
        m.scale(input.width / (this.fillTexture.width * this.textureScale), input.height / (this.fillTexture.height * this.textureScale));
        this.filterFillMask.uniforms.fillMap = this.fillTexture;
        this.filterFillMask.uniforms.fillMatrix = m;
        filterManager.applyFilter(this.filterFillMask, input, output, clearMode);
    }

    set byColor(value: boolean) {
        this.filterFillMask.uniforms.byColor = value;
    }

    get byColor() {
        return this.filterFillMask.uniforms.byColor;
    }

    set byAlpha(value: boolean) {
        this.filterFillMask.uniforms.byAlpha = value;
    }

    get byAlpha() {
        return this.filterFillMask.uniforms.byAlpha;
    }

    set inverseColor(value: boolean) {
        this.filterFillMask.uniforms.inverseColor = value;
    }

    get inverseColor() {
        return this.filterFillMask.uniforms.inverseColor;
    }

    set inverseAlpha(value: boolean) {
        this.filterFillMask.uniforms.inverseAlpha = value;
    }

    get inverseAlpha() {
        return this.filterFillMask.uniforms.inverseAlpha;
    }
}

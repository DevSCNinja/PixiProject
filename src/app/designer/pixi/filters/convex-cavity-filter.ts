import * as PIXI from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { FillMaskFilter } from './fill-mask-filter';

export class ConvexCavityFilter extends PIXI.Filter {
    blackIsCavity: boolean = true;

    cavityEnabled: boolean = true;
    // texture's size must be power of 2, e.g. 256x512 (unless PIXI version is 5.2.0 or higher and WebGL2 supported by a browser)
    cavityTexture: PIXI.Texture;

    convexEnabled: boolean = false;
    // texture's size must be power of 2, e.g. 256x512 (unless PIXI version is 5.2.0 or higher and WebGL2 supported by a browser)
    convexTexture: PIXI.Texture;
    // used to show only shadows created by the convex
    convexIsTransparent: boolean = false;
    // shadows created by convexes
    shadowsEnabled: boolean = false;
    // shadows created on the edges (where pixels' alpha <1.0)
    outerShadowsEnabled: boolean = true;

    textureScale: number = 1;

    filterNegativeAlpha: PIXI.filters.ColorMatrixFilter;

    filterShadow: DropShadowFilter;

    filterMask: FillMaskFilter;

    filterCombine: PIXI.Filter;

    private borderBlack: PIXI.Graphics;

    private bbw: number = 2;

    private combineShaderFrag: string = `
    precision highp float;
    
    varying vec2 vTextureCoord;
    
    uniform sampler2D uSampler;
    uniform sampler2D upperMap;
    void main() {
        vec4 a = texture2D(upperMap, vTextureCoord);
        vec4 b = texture2D(uSampler, vTextureCoord);
        
        //vec4 res = vec4(a.rgb + b.rgb*(1.0 - a.a), a.a + b.a*(1.0 - a.a));
        vec4 res = a + b*(1.0 - a.a);

        gl_FragColor = res;
    }`;

    constructor() {
        super();

        /* how Color Matrix is applied:
        redResult   = (a[0]  * srcR) + (a[1]  * srcG) + (a[2]  * srcB) + (a[3]  * srcA) + a[4]
        greenResult = (a[5]  * srcR) + (a[6]  * srcG) + (a[7]  * srcB) + (a[8]  * srcA) + a[9]
        blueResult  = (a[10] * srcR) + (a[11] * srcG) + (a[12] * srcB) + (a[13] * srcA) + a[14]
        alphaResult = (a[15] * srcR) + (a[16] * srcG) + (a[17] * srcB) + (a[18] * srcA) + a[19]
        more info here https://help.adobe.com/en_US/FlashPlatform/reference/actionscript/3/flash/filters/ColorMatrixFilter.html
        */
        this.filterNegativeAlpha = new PIXI.filters.ColorMatrixFilter();
        this.filterNegativeAlpha.matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 1];
        // init all uniforms otherwise they may be baked
        this.filterMask = new FillMaskFilter();

        this.filterCombine = new PIXI.Filter(null, this.combineShaderFrag);
        // TODO: distance, blur probably should depend on scene scale
        this.filterShadow = new DropShadowFilter({
            rotation: 90,
            blur: 0.25,
            distance: 2,
            alpha: 0.8,
            quality: 2
        });
    }

    apply(filterManager: PIXI.systems.FilterSystem, input: PIXI.RenderTexture, output: PIXI.RenderTexture, clearMode: PIXI.CLEAR_MODES) {
        // intermediate buffer(s) (input, output can be used as intermediate buffers too)
        let rts: PIXI.RenderTexture[] = [];
        let rt: PIXI.RenderTexture;
        let tmp: PIXI.RenderTexture;

        if (this.cavityEnabled) {
            // extra border needed for perfect inner shadows on the edges
            /*if (this.bbw > 0) {
                this.borderBlack = new PIXI.Graphics();
                this.borderBlack
                    .beginFill(0x000000, 1)
                    .drawRect(0, 0, input.width + this.bbw * 2, input.height + this.bbw * 2)
                    .beginHole()
                    .drawRect(this.bbw, this.bbw, input.width, input.height)
                    .endHole()
                    .endFill();
            }*/

            let m: PIXI.Matrix = new PIXI.Matrix();
            m.scale(
                input.width / (this.cavityTexture.width * this.textureScale),
                input.height / (this.cavityTexture.height * this.textureScale)
            );
            this.filterMask.uniforms.fillMatrix = m;
            this.filterMask.uniforms.fillMap = this.cavityTexture;
            this.filterMask.uniforms.byAlpha = false;
            this.filterMask.uniforms.byColor = true;
            this.filterMask.uniforms.inverseAlpha = false;
            this.filterMask.uniforms.inverseColor = this.blackIsCavity;

            if (this.convexEnabled || this.outerShadowsEnabled) {
                rt = filterManager.getFilterTexture();
                rts.push(rt);
                this.filterMask.apply(filterManager, input, rt, PIXI.CLEAR_MODES.CLEAR);
            } else {
                this.filterMask.apply(filterManager, input, output, clearMode);
            }
        }

        let lastBuffer: PIXI.RenderTexture;

        if (this.outerShadowsEnabled) {
            rt = filterManager.getFilterTexture();
            rts.push(rt);

            // create an extra buffer
            tmp = filterManager.getFilterTexture();
            this.filterNegativeAlpha.apply(filterManager, input, tmp, PIXI.CLEAR_MODES.CLEAR);
            this.filterShadow.shadowOnly = true;
            this.filterShadow.apply(filterManager, tmp, rt, PIXI.CLEAR_MODES.CLEAR);

            lastBuffer = rt;
        }

        if (this.convexEnabled) {
            let m: PIXI.Matrix = new PIXI.Matrix();
            m.scale(
                input.width / (this.convexTexture.width * this.textureScale),
                input.height / (this.convexTexture.height * this.textureScale)
            );
            this.filterMask.uniforms.fillMatrix = m;
            this.filterMask.uniforms.fillMap = this.convexTexture;
            this.filterMask.uniforms.byAlpha = false;
            this.filterMask.uniforms.byColor = true;
            this.filterMask.uniforms.inverseAlpha = false;
            this.filterMask.uniforms.inverseColor = !this.blackIsCavity;

            if (this.outerShadowsEnabled || this.shadowsEnabled || this.cavityEnabled) {
                rt = filterManager.getFilterTexture();
                rts.push(rt);

                let buff0: PIXI.RenderTexture = this.convexIsTransparent ? rt : tmp;
                let buff1: PIXI.RenderTexture = this.convexIsTransparent ? tmp : rt;
                if (this.shadowsEnabled) {
                    this.filterMask.apply(filterManager, input, buff0, PIXI.CLEAR_MODES.CLEAR);
                    this.filterShadow.shadowOnly = false;
                    this.filterShadow.apply(filterManager, buff0, buff1, PIXI.CLEAR_MODES.CLEAR);
                } else {
                    this.filterMask.apply(filterManager, input, buff1, PIXI.CLEAR_MODES.CLEAR);
                }

                if (this.convexIsTransparent) {
                    this.filterMask.uniforms.fillMatrix = new PIXI.Matrix();
                    this.filterMask.uniforms.fillMap = buff1;
                    this.filterMask.uniforms.byAlpha = false;
                    this.filterMask.uniforms.byColor = true;
                    this.filterMask.uniforms.inverseAlpha = false;
                    this.filterMask.uniforms.inverseColor = this.blackIsCavity;
                    this.filterMask.apply(filterManager, input, buff0, PIXI.CLEAR_MODES.CLEAR);
                }

                lastBuffer = rt;
            } else {
                this.filterMask.apply(filterManager, input, output, clearMode);
            }
        } else {
            // no convex, no shadows
            this.shadowsEnabled = false;
        }

        // combine everything
        if (rts.length > 1) {
            // one more extra buffer needed
            rt = filterManager.getFilterTexture();

            for (let i: number = 0; i < rts.length - 1; i++) {
                let filter: PIXI.Filter = this.filterCombine;
                filter.uniforms.upperMap = rts[i + 1];
                if (i % 2 === 0) {
                    lastBuffer = rt;
                    if (i === 0) {
                        filter.apply(filterManager, rts[i], lastBuffer, PIXI.CLEAR_MODES.NO);
                    } else {
                        filter.apply(filterManager, rts[0], lastBuffer, PIXI.CLEAR_MODES.NO);
                    }
                } else {
                    lastBuffer = rts[0];
                    filter.apply(filterManager, rt, lastBuffer, PIXI.CLEAR_MODES.NO);
                }
            }
        }

        // cut off the shadows
        if (this.outerShadowsEnabled || this.shadowsEnabled) {
            this.filterMask.uniforms.fillMatrix = new PIXI.Matrix();
            this.filterMask.uniforms.fillMap = lastBuffer;
            this.filterMask.uniforms.byAlpha = true;
            this.filterMask.uniforms.byColor = false;
            this.filterMask.uniforms.inverseAlpha = false;
            this.filterMask.uniforms.inverseColor = this.blackIsCavity;

            this.filterMask.apply(filterManager, input, output, clearMode);
        }

        // free the render texture(s) (to avoid memory leaks)
        rts.forEach((renderTexture) => {
            filterManager.returnFilterTexture(renderTexture);
        });
        if (rt) {
            filterManager.returnFilterTexture(rt);
        }
        if (tmp) {
            filterManager.returnFilterTexture(tmp);
        }
    }

    set shadowColor(hex: number) {
        this.filterShadow.color = hex;
    }

    get shadowColor(): number {
        return this.filterShadow.color;
    }

    set shadowAlpha(alpha: number) {
        this.filterShadow.alpha = alpha;
    }

    get shadowAlpha(): number {
        return this.filterShadow.alpha;
    }

    set shadowDistance(distance: number) {
        this.filterShadow.distance = distance;
    }

    get shadowDistance(): number {
        return this.filterShadow.distance;
    }
}

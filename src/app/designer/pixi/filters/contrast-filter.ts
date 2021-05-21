import * as PIXI from 'pixi.js';

export class ContrastFilter extends PIXI.Filter {
    private filterContrast: PIXI.Filter;

    private contrastShaderFrag: string = `
    varying vec2 vTextureCoord;
    uniform float contrast;
    uniform vec3 anchor;
    uniform sampler2D uSampler;

    void main(void)
    {
        vec4 t = texture2D(uSampler, vTextureCoord);
        
        vec4 res = vec4(anchor.rgb + (t.rgb - anchor.rgb)*contrast, t.a);

        gl_FragColor = res;
    }`;

    constructor() {
        super();

        this.filterContrast = new PIXI.Filter(null, this.contrastShaderFrag);
        this.anchor = [0.5, 0.5, 0.5];
    }

    apply(filterManager: PIXI.systems.FilterSystem, input: PIXI.RenderTexture, output: PIXI.RenderTexture, clearMode: PIXI.CLEAR_MODES) {
        filterManager.applyFilter(this.filterContrast, input, output, clearMode);
    }

    set anchor(rgb: number[]) {
        this.filterContrast.uniforms.anchor = rgb;
    }

    get anchor() {
        return this.filterContrast.uniforms.anchor;
    }

    set contrast(value: number) {
        this.filterContrast.uniforms.contrast = value;
    }

    get contrast(): number {
        return this.filterContrast.uniforms.contrast;
    }
}

import * as PIXI from 'pixi.js';

export class HardLightFilter extends PIXI.Filter {
    textureScale: number = 1;

    baseMatrix: PIXI.Matrix = new PIXI.Matrix();

    private filterHL: PIXI.Filter;

    private hlShaderVert: string = `
    attribute vec2 aVertexPosition;
    attribute vec2 aTextureCoord;
    
    uniform mat3 projectionMatrix;
    uniform mat3 baseMatrix;

    varying vec2 vTextureCoord;
    varying vec2 vBaseCoord;
   
    void main(void)
    {
        gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    
        vTextureCoord = aTextureCoord;
        vBaseCoord = ( baseMatrix * vec3( aTextureCoord, 1.0)).xy;
    }`;

    private hlShaderFrag: string = `
    varying vec2 vTextureCoord;
    varying vec2 vBaseCoord;
    uniform sampler2D uSampler;
    uniform sampler2D baseMap;

    float blendHL(float blend, float base) {
        return blend<0.5?(2.0*blend*base):(1.0-2.0*(1.0-blend)*(1.0-base));
    }

    void main(void)
    {
        vec4 blend = texture2D(uSampler, vTextureCoord);
        vec4 base = texture2D(baseMap, vBaseCoord);
        
        if(blend.a == 0.0){
            gl_FragColor = vec4(0.0,0.0,0.0,0.0);
            return;
        }
        vec4 res = vec4(blendHL(blend.r/blend.a, base.r), blendHL(blend.g/blend.a, base.g), blendHL(blend.b/blend.a, base.b), 1.0);
        res*= blend.a*base.a;

        gl_FragColor = res;
    }`;

    constructor() {
        super();

        this.filterHL = new PIXI.Filter(this.hlShaderVert, this.hlShaderFrag);
    }

    apply(filterManager: PIXI.systems.FilterSystem, input: PIXI.RenderTexture, output: PIXI.RenderTexture, clearMode: PIXI.CLEAR_MODES) {
        this.baseMatrix.set(
            input.width / (this.baseMap.width * this.textureScale),
            0,
            0,
            input.height / (this.baseMap.height * this.textureScale),
            0,
            0
        );
        this.filterHL.uniforms.baseMatrix = this.baseMatrix;
        filterManager.applyFilter(this.filterHL, input, output, clearMode);
    }

    set baseMap(texture: PIXI.Texture) {
        this.filterHL.uniforms.baseMap = texture;
    }

    get baseMap() {
        return this.filterHL.uniforms.baseMap;
    }
}

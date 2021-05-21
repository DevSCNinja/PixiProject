import * as PIXI from 'pixi.js';

export class FillMaskFilter extends PIXI.Filter {
    constructor() {
        const maskShaderVert: string = `
        attribute vec2 aVertexPosition;
        attribute vec2 aTextureCoord;
        
        uniform mat3 projectionMatrix;
        uniform mat3 fillMatrix;

        varying vec2 vTextureCoord;
        varying vec2 vFillCoord;
    
        void main(void)
        {
            gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
        
            vTextureCoord = aTextureCoord;
            vFillCoord = ( fillMatrix * vec3( aTextureCoord, 1.0)  ).xy;
        }`;

        const maskShaderFrag: string = `
        precision highp float;
        
        varying vec2 vTextureCoord;
        varying vec2 vFillCoord;
        
        uniform sampler2D uSampler;
        uniform sampler2D fillMap;

        uniform float byAlpha;
        uniform float byColor;
        uniform float inverseAlpha; 
        uniform float inverseColor;
        void main() {
            vec4 tMask = texture2D(uSampler, vTextureCoord);
            vec4 tFill = texture2D(fillMap, vFillCoord);

            if(byColor > 0.0){
                if(inverseColor > 0.0){
                    tMask.r = 1.0 - tMask.r; // or tMask.a*(1.0 - tMask.r/tMask.a);
                }
                // tMask always has premultiplied alpha, so there is no need to multiply tFill by tMask's alpha channel 
                tFill *= tMask.r;
            }

            if(byAlpha > 0.0){
                if(inverseAlpha > 0.0){
                    tMask.a = 1.0 - tMask.a;
                }

                if(tMask.a < tFill.a){
                    tFill.rgb*= tMask.a/tFill.a;
                    tFill.a = tMask.a;
                }
                //tFill.rgb *= tMask.a;
                //tFill.a = min(tFill.a,tMask.a); 
            }

            
            
            gl_FragColor = tFill;
        }`;
        super(maskShaderVert, maskShaderFrag);
        //this.uniforms.fillMap = null
        //this.uniforms.fillMatrix = new PIXI.Matrix()
        this.uniforms.byAlpha = 0.0;
        this.uniforms.byColor = 1.0;
        this.uniforms.inverseAlpha = 0.0;
        this.uniforms.inverseColor = 0.0;
    }
}

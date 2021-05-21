import * as PIXI from 'pixi.js';
// 4-point gradient filter immitating lighting

export class GradientLightingFilter extends PIXI.Filter {
    constructor() {
        const gradShaderVert: string = `
        attribute vec2 aVertexPosition;
        attribute vec2 aTextureCoord;
        
        uniform mat3 projectionMatrix;

        varying vec2 vTextureCoord;
    
        void main(void)
        {
            gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
        
            vTextureCoord = aTextureCoord;
        }`;

        const gradShaderFrag: string = `
        precision highp float;
        
        varying vec2 vTextureCoord;
        
        uniform sampler2D uSampler;
        uniform vec4 color0;
        uniform vec4 color1;
        uniform vec4 color2;
        uniform vec4 color3;
        uniform float c0pos;
        uniform float c1pos;
        uniform float c2pos;
        uniform float c3pos;
        uniform float minReflection;
        uniform float reflectionCoef;
        uniform float avgBrightness;
        void main() {
            vec4 texture = texture2D(uSampler, vTextureCoord);
        
            vec4 colorA;
            vec4 colorB ;
            float mixValue;
            float dist = vTextureCoord.y - c3pos;  
            if(dist >= 0.0){
                colorA = color3;
                colorB = color3;
                mixValue = 1.0;
            }else{
                dist = vTextureCoord.y - c2pos;
                if(dist >= 0.0){
                    colorA = color2;
                    colorB = color3;
                    mixValue = dist/(c3pos - c2pos);
                }else{
                    dist = vTextureCoord.y - c1pos;
                    if(dist >= 0.0){
                        colorA = color1;
                        colorB = color2;
                        mixValue = dist/(c2pos - c1pos);
                    }else{
                        dist = vTextureCoord.y - c0pos;
                        if(dist >= 0.0){
                            colorA = color0;
                            colorB = color1;
                            mixValue = dist/(c1pos - c0pos);
                        }else{
                            colorA = color0;
                            colorB = color0;
                            mixValue = 0.0;
                        }
                    }
                }
            }
        
            vec4 color = mix(colorA,colorB,clamp(mixValue, 0.0, 1.0));
            
            // light reflection based on initial color brightness and transmitted values
            float lightReflection = color.a*clamp(reflectionCoef*(texture.r*0.299 + texture.g*0.587 + texture.b*0.114), minReflection, 1.0); 

            color.rgb = (color.rgb - vec3(avgBrightness))*lightReflection;

            gl_FragColor = vec4(clamp(texture.rgb/texture.a + color.rgb, 0.0, 1.0), texture.a);
        }`;
        super(gradShaderVert, gradShaderFrag);
        // negative values for colors can be used too (e.g. to create a more intensive shadow);
        // use c3pos = 0.0 and color3 = [r, g, b ,a] to quickly assign a solid color
        this.uniforms.color0 = [1.0, 0.0, 0.0, 1.0];
        this.uniforms.color1 = [0.0, 1.0, 0.0, 1.0];
        this.uniforms.color2 = [0.0, 0.0, 1.0, 1.0];
        this.uniforms.color3 = [0.0, 0.0, 0.0, 1.0];
        this.uniforms.c0pos = 0.0;
        this.uniforms.c1pos = 0.33;
        this.uniforms.c2pos = 0.66;
        this.uniforms.c3pos = 1.0;
        this.uniforms.minReflection = 0.2;
        this.uniforms.reflectionCoef = 0.5;
        this.uniforms.avgBrightness = 0.5;
    }
}

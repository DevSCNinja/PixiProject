import * as PIXI from 'pixi.js';
export class TextureUtils {
    static getTexture(url: string) {
        return new Promise<PIXI.Texture>((resolve, reject) => {
            let texture: PIXI.Texture = PIXI.Texture.from(url);

            if (!texture.baseTexture.valid) {
                texture.once('update', () => {
                    resolve(texture);
                });
            } else {
                resolve(texture);
            }
        });
    }
}

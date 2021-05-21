import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TreeNode } from 'primeng/api';
import * as PIXI from 'pixi.js';
import * as _ from 'lodash';
import { BackgroundModel, DesignBackground, NodeService, DesignData, DesignDataCategory } from '../models/main';
import { CanvasUtils } from '../utils/canvas-utils';
import { MeasurementService } from './measurement.service';
import { ConfigService } from './config.service';

@Injectable({
    providedIn: 'root'
})
export class BackgroundService implements NodeService {
    static readonly BACKGROUND_TYPE_STANDARD: string = 'standard';

    protected static readonly DEFAULT_BACKGROUND_MODEL: BackgroundModel = {
        type: 'background',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        id: '0',
        monX: 0,
        monY: 0,
        pxPerFoot: MeasurementService.inchToPx(12),
        imagePath: null,
        showGrass: true
    };

    static readonly MODEL_UNIT_PROPS: string[] = ['x', 'y', 'width', 'height', 'monX', 'monY'];

    protected static readonly DEFAULT_BACKGROUND_DATA: DesignData = {
        type: '',
        thumbnail: '',
        fullImage: '',
        monumentX: 0,
        monumentY: 0,
        pixelsPerFoot: MeasurementService.inchToPx(12),
        id: '-1',
        name: '',
        showGrass: true
    };

    static readonly WHITE_BACKGROUND_DATA: DesignData = {
        type: '',
        thumbnail: 'monuvision-assets/images/thumbnail/thumb_white_bg.png',
        fullImage: '',
        monumentX: 0,
        monumentY: 0,
        pixelsPerFoot: 0,
        id: '0',
        title: 'White',
        name: 'White'
    };

    static readonly DATA_UNIT_PROPS: string[] = ['monumentX', 'monumentY'];

    // only 1 category, so hardcode it
    private stadardTypeCategory0: DesignDataCategory = {
        name: null,
        type: BackgroundService.BACKGROUND_TYPE_STANDARD,
        catID: null
    };

    private categoryTrees: { [type: string]: TreeNode[] } = {
        standard: [
            {
                label: 'Default',
                data: this.stadardTypeCategory0
            }
        ]
    };

    recentBackgroundImages: DesignData[] = [];

    maxRecent: number = 100;

    private readonly childrenPropName: string = 'children';

    constructor(private config: ConfigService, private http: HttpClient) {}

    init() {
        //this.getCategoriesTree(true)
    }

    static createBackgroundModel() {
        let m: BackgroundModel = _.cloneDeep(BackgroundService.DEFAULT_BACKGROUND_MODEL);
        m = MeasurementService.convertPropsToUnit(
            m,
            BackgroundService.MODEL_UNIT_PROPS,
            MeasurementService.CURRENT_UNIT,
            MeasurementService.INCH
        );
        return m;
    }

    static createBackgroundData(sampleData: DesignData = BackgroundService.DEFAULT_BACKGROUND_DATA) {
        let data: DesignData = _.cloneDeep(sampleData);
        data = MeasurementService.convertPropsToUnit(
            data,
            BackgroundService.DATA_UNIT_PROPS,
            MeasurementService.CURRENT_UNIT,
            MeasurementService.INCH
        );
        return data;
    }

    addDataToRecent(data: DesignData, recentArr: DesignData[]) {
        let index: number = recentArr.findIndex((element) => element.fullImage === data.fullImage);

        if (index >= 0) {
            let similarData: DesignData = recentArr.splice(index, 1)[0];
            if (!data.thumbnail) {
                data.thumbnail = similarData.thumbnail;
            }
        }
        if (!data.thumbnail) {
            // generate a thumbnail
            let img: HTMLImageElement = new Image();
            img.src = data.fullImage;
            img.onload = () => {
                data.thumbnail = CanvasUtils.generateThumbnail(img, 0, 0, img.width, img.height, 50, 50, true, '#ffffff');
            };
        }

        recentArr.unshift(data);

        if (recentArr.length > this.maxRecent) {
            recentArr.splice(this.maxRecent);
        }
    }

    copyDataToModel(data: DesignData, m: BackgroundModel) {
        m.imagePath = this.config.getAssetFullURL(data.fullImage, true);
        m.thumbnail = this.config.getAssetFullURL(data.thumbnail, true);

        m.id = data.id;
        m.monX = data.monumentX;
        m.monY = data.monumentY;
        m.pxPerFoot = data.pixelsPerFoot;
        m.name = data.name;
        m.showGrass = data.showGrass;
    }

    copyModelToData(m: BackgroundModel, data: DesignData) {
        data.fullImage = this.config.getAssetShortURL(m.imagePath);
        if (m.thumbnail) {
            data.thumbnail = this.config.getAssetShortURL(m.thumbnail);
        }

        data.id = m.id;
        data.monumentX = m.monX;
        data.monumentY = m.monY;
        data.pixelsPerFoot = m.pxPerFoot;
        data.title = data.name = m.name;
        data.showGrass = m.showGrass;
    }

    createBackground(m?: BackgroundModel, cb?: Function, addToRecent: boolean = true, minRatio: number = NaN): DesignBackground {
        if (!m) {
            m = _.cloneDeep(BackgroundService.DEFAULT_BACKGROUND_MODEL); // copy
        }

        if (addToRecent) {
            let data: DesignData = BackgroundService.createBackgroundData();
            this.copyModelToData(m, data);
            this.addDataToRecent(data, this.recentBackgroundImages);
        }

        if (!m.imagePath) {
            // no bg
            if (typeof cb === 'function') {
                cb(null);
            }

            return;
        }

        let url: string = m.imagePath;

        // load a texture
        let texture: PIXI.Texture = PIXI.Texture.from(m.imagePath);

        let db: DesignBackground = (minRatio > 0 ? new PIXI.Container() : new PIXI.Sprite()) as DesignBackground;

        db.model = m;
        db.updateModel = (flag: string = 'default') => {
            this.updateBackgroundModel(db, db.model, flag);
        };
        db.bgTexture = texture;
        db.interactive = false;

        let onTextureLoadComplete: Function = () => {
            if (minRatio > 0) {
                let ratio: number = texture.width / texture.height;
                let sprites: PIXI.Sprite[] = [];

                const len: number = minRatio > 0 && minRatio > ratio ? 1 + 2 * Math.ceil((0.5 * (minRatio - ratio)) / ratio) : 1;

                for (let i = 0; i < len; i++) {
                    let sprite = (sprites[i] = new PIXI.Sprite());
                    if (url) {
                        sprite.texture = texture;
                    }

                    sprite.anchor.set(0.5);

                    let pos: number;
                    if (i % 2 === 0) {
                        pos = 0.5 * i;
                    } else {
                        pos = -0.5 * (i + 1);
                    }
                    sprite.x = pos * texture.width;

                    if (Math.abs(pos) % 2 === 1) {
                        sprite.scale.x = -1;
                    }

                    db.addChild(sprite);
                }
            } else {
                if (url) {
                    db.texture = texture;
                }
                db.anchor.set(0.5);
            }

            if (typeof cb === 'function') {
                cb(db);
            }
        };

        if (url && !texture.baseTexture.valid) {
            texture.once('update', onTextureLoadComplete);
        } else {
            onTextureLoadComplete();
        }

        return db;
    }

    private updateBackgroundModel(item: DesignBackground, m: BackgroundModel, flag: string) {}

    getFiles(searchContext: TreeNode | string, noCache: boolean = false, types?: string[]): Promise<void | DesignData[]> {
        let spStr: string = '';
        let sp: URLSearchParams = new URLSearchParams();
        if (typeof searchContext === 'string') {
            searchContext = searchContext.trim();

            sp.append('keyword', searchContext);
        }

        if (!searchContext) {
            return Promise.reject('Invalid search query');
        }

        if (noCache) {
            sp.append('random', String(Math.random() * 10000));
        }
        spStr = sp.toString();
        let suffix: string = 'backgrounds' + (spStr ? '?' + spStr : '');

        let urls: string[] = [];
        let baseUrl: string = this.config.apiURL;
        if (typeof searchContext === 'string') {
            return Promise.reject('Search in backgrounds is not supported by API');
        } else {
            urls.push(baseUrl + suffix);
        }

        let promises: Promise<any>[] = [];

        urls.forEach((url) => {
            promises.push(
                this.http
                    .get<any>(url, { responseType: 'json' })
                    .toPromise()
            );
        });

        return Promise.all(promises).then((results) => {
            let arr: DesignData[] = [];

            let whiteImage: DesignData = BackgroundService.createBackgroundData(BackgroundService.WHITE_BACKGROUND_DATA);
            arr.push(whiteImage);

            results.forEach((res) => {
                if (res) {
                    let resArr: any[] = res instanceof Array ? res : [res];
                    resArr.forEach((element) => {
                        arr.push(this.parseFileResponse(element));
                    });
                }
            });

            return arr;
        });
    }

    protected parseFileResponse(element: any) {
        let image: DesignData = BackgroundService.createBackgroundData();
        image.title = String(element.name); // TODO: deprecate 'title' property, cause title === name
        image.name = String(element.name);
        image.type = String(element.type); // deprecated
        image.id = String(element.id);
        image.fullImage = String(element.image); // TODO: deprecate 'fullImage' property, use 'image'
        image.thumbnail = String(element.thumbnail || element.image);
        image.pixelsPerFoot = parseFloat(element.pixels_per_foot);
        image.monumentX = parseFloat(element.monument_x);
        image.monumentY = parseFloat(element.monument_y);
        image.showGrass = Boolean(element.show_grass);

        return image;
    }

    getCategoriesTree(noCache: boolean = false, types?: string[]): Promise<TreeNode[]> {
        return Promise.resolve(this.categoryTrees[BackgroundService.BACKGROUND_TYPE_STANDARD]);
    }

    getFile(id: string) {
        let url: string = this.config.apiURL + 'backgrounds/' + id;
        return this.http
            .get<DesignData>(url)
            .toPromise()
            .then((res) => this.parseFileResponse(res));
    }
}

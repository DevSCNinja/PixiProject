import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import * as _ from 'lodash';
import { TreeNode } from 'primeng/api';
import { UserService } from './user.service';
import { ConfigService } from './config.service';
import {
    DesignData,
    DesignDataCategory,
    ArtModel,
    DesignArt,
    Case,
    ColorItem,
    NodeService,
    PixelData,
    NodeServicePageFilesResponse
} from '../models/main';
import { DataUtils } from '../utils/data-utils';
import { MultiCase } from '../../pixi/multi-case';
import { AssetService } from './asset.service';
import { HardLightFilter } from '../../pixi/filters/hard-light-filter';
import { ConvexCavityFilter } from '../../pixi/filters/convex-cavity-filter';
import { ContrastFilter } from '../../pixi/filters/contrast-filter';
import { MeasurementService } from './measurement.service';
import { CanvasUtils } from '../utils/canvas-utils';
import { StrUtils } from '../utils/str-utils';

@Injectable({
    providedIn: 'root'
})
export class ArtService implements NodeService {
    static readonly ART_TYPE_COMPONENT: string = 'component';

    static readonly ART_TYPE_PANEL: string = 'panel';

    static readonly ART_TYPE_VASE: string = 'vase';

    static readonly ART_TYPES: string[] = [ArtService.ART_TYPE_COMPONENT, ArtService.ART_TYPE_PANEL, ArtService.ART_TYPE_VASE];
    // the legacy app supported only 3 initial styles (frost + inverted, frost, keep color)
    // maybe more styles needed (keep color + inverted, no frost + inverted, no frost)

    static readonly STYLE_INVERTED: string = 'Inverted Texture';

    static readonly STYLE_TEXTURED: string = 'Frosted Appearance';

    static readonly STYLE_SIMPLE: string = 'Keep Color';

    static readonly NOT_AN_ETCHING: string = 'not an etching';

    static readonly LASER_ETCHED_PORT: string = 'Laser Etched Portrait';

    static readonly LASER_ETCHED_PORT_DOUBLE: string = 'Laser Etched Portrait Double';

    static readonly HAND_ETCHED_PORT: string = 'Hand Etched Portrait';

    static readonly HAND_ETCHED_PORT_DOUBLE: string = 'Hand Etched Portrait Double';

    static readonly LASER_ETCHED_SPOT: string = 'Laser Etched Spot or Corner Design';

    static readonly HAND_ETCHED_SPOT: string = 'Hand Etched Spot or Corner Design';

    static readonly LASER_ETCHED_STAN: string = 'Laser Etched Standard Scene';

    static readonly HAND_ETCHED_CUST: string = 'Hand Etched Custom Scene';

    static readonly PREMIUM_METAL_PRICE: string = 'premium metal';

    static readonly ECONOMY_METAL_PRICE: string = 'economy metal';

    static readonly SQUARE_GRANITE_PRICE: string = 'square granite';

    static readonly TURNED_GRANITE_PRICE: string = 'turned granite';

    static readonly DEFAULT_ART_MODEL: ArtModel = {
        type: 'art',
        artType: 'component', // component, panel, vase
        x: 5,
        y: 5,
        width: 10,
        height: 10,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        compID: '12345', // presents for all the types
        name: 'Rose ',
        imageFile: 'monuvision-assets/images/rose071.gif',
        inverted: false,
        drawSimple: false,
        etching: ArtService.NOT_AN_ETCHING,
        frostingVisible: true,
        sinkage: 'gray',
        flipped: false,
        minWidth: 10,
        minHeight: 20,
        lockDimensions: false,
        lowerBitmapFill: AssetService.DEFAULT_BITMAP_FILL_ID,
        // for vases
        inchWidth: NaN,
        inchHeight: NaN,
        color: null,
        priceType: null
    };

    static readonly MODEL_UNIT_PROPS: string[] = ['x', 'y', 'width', 'height', 'depth', 'minWidth', 'minHeight'];

    static readonly DEFAULT_ART_DATA: DesignData = {
        type: ArtService.ART_TYPE_COMPONENT,
        style: ArtService.STYLE_TEXTURED,
        nid: '',
        title: '',
        image: '',
        thumbnail: '',
        leftBorder: 0,
        bottomBorder: 0,
        rightBorder: 0,
        topBorder: 0,
        minimumHeight: 0,
        minimumWidth: 0,
        etching: '',
        lockDimensions: '',
        width: 0,
        height: 0
    };

    static readonly DATA_UNIT_PROPS: string[] = [
        /*'leftBorder',
        'bottomBorder',
        'rightBorder',
        'topBorder',*/
        'minimumHeight',
        'minimumWidth',
        'width',
        'height'
    ];

    renderer: PIXI.Renderer;

    container: PIXI.Container;

    filterGrayscale: any;

    filterNegative: any;

    shadowDistanceInch: number = 0.13333;

    recentArtImages: DesignData[] = [];

    recentArtVaseImages: DesignData[] = [];

    maxRecent: number = 10;

    private categoryTrees: { [type: string]: TreeNode[] } = {};

    private readonly childrenPropName: string = 'children';

    constructor(private config: ConfigService, private http: HttpClient, private us: UserService, private as: AssetService) {}

    init() {
        this.getCategoriesTree(true);
        // fill with default data just to have empty slots
        for (let i = 0; i < this.maxRecent; i++) {
            this.recentArtImages[i] = ArtService.createArtData();
        }
    }

    static createArtModel(sampleModel: ArtModel = ArtService.DEFAULT_ART_MODEL) {
        let m: ArtModel = _.cloneDeep(sampleModel);
        m.lowerBitmapFill = AssetService.DEFAULT_BITMAP_FILL_ID;
        m = MeasurementService.convertPropsToUnit(m, ArtService.MODEL_UNIT_PROPS, MeasurementService.CURRENT_UNIT, MeasurementService.INCH);
        return m;
    }

    static createArtData() {
        let data: DesignData = _.cloneDeep(ArtService.DEFAULT_ART_DATA);
        data = MeasurementService.convertPropsToUnit(
            data,
            ArtService.DATA_UNIT_PROPS,
            MeasurementService.CURRENT_UNIT,
            MeasurementService.INCH
        );
        return data;
    }

    copyDataToModel(data: DesignData, m: ArtModel) {
        m.artType = data.type;
        m.compID = data.nid;
        m.name = data.title;
        m.imageFile = this.config.getAssetFullURL(data.image, true);
        m.thumbnailFile = this.config.getAssetFullURL(data.thumbnail, true);

        m.leftBorder = data.leftBorder;
        m.bottomBorder = data.bottomBorder;
        m.rightBorder = data.rightBorder;
        m.topBorder = data.topBorder;
        // restriction (inches)
        m.minWidth = data.minimumWidth;
        m.minHeight = data.minimumHeight;

        m.inchWidth = data.width;
        m.inchHeight = data.height;

        let ld: string = data.lockDimensions.trim().toLowerCase();
        m.lockDimensions = ld === 'on' || ld === 'true' || ld === 'yes' || ld === '1' ? true : false;
        if (data.type === ArtService.ART_TYPE_VASE) {
            m.frostingVisible = false;
        }
        m.inverted = data.style === ArtService.STYLE_INVERTED;
        m.drawSimple = data.style === ArtService.STYLE_SIMPLE;
        m.priceType = data.priceType;
        m.etching = data.etching;
    }

    copyModelToData(m: ArtModel, data: DesignData) {
        data.type = m.artType;
        data.nid = m.compID;
        data.title = m.name;
        data.image = this.config.getAssetShortURL(m.imageFile);
        if (m.thumbnailFile) {
            data.thumbnail = this.config.getAssetShortURL(m.thumbnailFile);
        }
        data.leftBorder = m.leftBorder;
        data.bottomBorder = m.bottomBorder;
        data.rightBorder = m.rightBorder;
        data.topBorder = m.topBorder;
        // restriction (inches)
        data.minimumWidth = m.minWidth;
        data.minimumHeight = m.minHeight;

        data.width = m.inchWidth;
        data.height = m.inchHeight;

        data.lockDimensions = m.lockDimensions ? 'on' : 'off';
        if (m.inverted) {
            data.style = ArtService.STYLE_INVERTED;
        }
        if (m.drawSimple) {
            data.style = ArtService.STYLE_SIMPLE;
        }
        data.priceType = m.priceType;
        data.etching = m.etching;
    }

    addDataToRecent(data: DesignData, recentArr: DesignData[], removeSame: boolean = true, targetIndex: number = -1) {
        let allowedTypes: string[] = ArtService.ART_TYPES;
        if (allowedTypes.indexOf(data.type) === -1) {
            console.warn('Invalid Data Type: ' + data.type + '. Expected ' + allowedTypes.join(','));
            return;
        }

        if (removeSame) {
            let index: number = recentArr.findIndex((element) => element.image === data.image);

            if (index >= 0) {
                let similarData: DesignData = recentArr.splice(index, 1)[0];
                if (!data.thumbnail) {
                    data.thumbnail = similarData.thumbnail;
                }
            }
        }

        if (!data.thumbnail) {
            // generate a thumbnail
            let img: HTMLImageElement = new Image();
            img.src = data.image;
            img.onload = () => {
                data.thumbnail = CanvasUtils.generateThumbnail(img, 0, 0, img.width, img.height, 50, 50, true, '#ffffff');
            };
        }

        if (targetIndex >= 0) {
            recentArr[targetIndex] = data;
        } else {
            recentArr.unshift(data);

            if (recentArr.length > this.maxRecent) {
                recentArr.splice(this.maxRecent);
            }
        }
    }

    createArt(m?: ArtModel, cb?: Function, addToRecent: boolean = false): DesignArt {
        if (!m) {
            m = ArtService.createArtModel();
        }

        if (addToRecent) {
            let data: DesignData = ArtService.createArtData();
            this.copyModelToData(m, data);
            this.addDataToRecent(data, this.recentArtImages);
        }

        let sprite: PIXI.Sprite | PIXI.Mesh;
        let c: MultiCase = new MultiCase();
        let url: string = m.imageFile;

        c.x = MeasurementService.unitToPx(m.x);
        c.y = MeasurementService.unitToPx(m.y);
        c.rotation = m.rotation;

        let da: DesignArt = c as DesignArt;
        da.model = m;
        da.updateModel = (flag: string = 'default') => {
            this.updateArtModel(da, da.model, flag);
        };
        da.interactive = true;
        if (da.model.artType === ArtService.ART_TYPE_PANEL) {
            (da as any).regPoint = new PIXI.Point(0, 0.5); // needed to scale relatively to this point via Transform Tool
        }

        // effects
        this.setArtEffect(da, 'frostingVisible', m.frostingVisible);

        // load a texture
        let texture: PIXI.Texture = PIXI.Texture.from(m.imageFile);

        let onTextureLoadComplete: Function = () => {
            let imageData: ImageData = this.as.getImageData(texture.baseTexture);
            let keepBackground: boolean = m.artType !== ArtService.ART_TYPE_COMPONENT; // can arrive from the same model property in the future
            if (!keepBackground) {
                // flood fill the white background (users accidentally added a lot of images with white bg, so we need to remove it)

                let targetPoints: number[][] = [
                    [0, 0],
                    [texture.width - 1, 0],
                    [texture.width - 1, texture.height - 1],
                    [0, texture.height - 1]
                ];
                let fillColor: number[] = [255, 0, 0, 0];
                // allowed deviation from the color of the start point (target point) to continue fill, 0 - 1020 (unlike photosop where it is 0 - 255)
                let threshold: number = 180;

                let colorToReplace: number[] = [255, 255, 255, 255];
                // allowed deviation from colorToReplace to start fill, 0 - 1020
                let replaceThreshold: number = 15;

                let fillHappened: boolean = CanvasUtils.smartFloodFill(
                    imageData,
                    targetPoints,
                    fillColor,
                    threshold,
                    colorToReplace,
                    replaceThreshold
                );
                if (fillHappened) {
                    texture = PIXI.Texture.from(CanvasUtils.createCanvasFromImageData(imageData));
                }
            }
            // if the user will control background removal settings, pixel data can't be associated with the url of the texture anymore
            this.as.savePixelData(texture, url, false, imageData.data);

            let hasBorder: boolean = m.leftBorder > 0 || m.bottomBorder > 0 || m.rightBorder > 0 || m.topBorder > 0;
            if (!hasBorder) {
                // allow mipmapping for big enough textures (for small textures it may produce too much blur)
                if (texture.width >= 32 && texture.height >= 32) {
                    texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
                } else {
                    texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
                }

                // Sprite
                sprite = new PIXI.Sprite(texture);
                sprite.pivot.x = sprite.width / 2;
                sprite.pivot.y = sprite.height / 2;
            } else {
                texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF; // must be off otherwise some artifacts (blur or lines) may appear

                // Mesh (for specific uv mapping - when scale of panel's border is being preserved
                // (hard to do with filters for rotated objects))
                let w: number = texture.width / 2;
                let h: number = texture.height / 2;
                // quad's geometry
                let geometry: PIXI.Geometry = new PIXI.Geometry()
                    .addAttribute(
                        'aVertexPosition', // the attribute name
                        [-w, -h, w, -h, w, h, -w, h],
                        2
                    ) // the size of the attribute
                    .addAttribute(
                        'aUvs', // the attribute name
                        [0, 0, 1, 0, 1, 1, 0, 1],
                        2
                    ) // the size of the attribute
                    .addIndex([0, 1, 2, 0, 2, 3]);

                // create a frame border shader
                let shader: PIXI.Shader = PIXI.Shader.from(this.as.defaultVertexSrc, this.as.frameBorderFragmentSrc, {
                    uSampler2: texture,
                    left: m.leftBorder / texture.width,
                    right: m.rightBorder / texture.width,
                    top: m.topBorder / texture.height,
                    bottom: m.bottomBorder / texture.height,
                    scaleX: 1.0,
                    scaleY: 1.0
                });

                sprite = new PIXI.Mesh(geometry, shader as any);
            }

            // adjust the legacy panel with borders
            if (m.tmpAdjustScale) {
                if (m.leftBorder >= 0 && m.bottomBorder >= 0 && m.rightBorder >= 0 && m.topBorder >= 0) {
                    m.scaleX *= (texture.width - m.leftBorder - m.rightBorder) / texture.width;
                    m.scaleY *= (texture.height - m.topBorder - m.bottomBorder) / texture.height;
                }
            }
            if (m.hasOwnProperty('tmpAdjustScale')) {
                delete m.tmpAdjustScale;
            }

            c.add([sprite]);

            m.textureWidth = MeasurementService.pxToUnit(texture.width);
            m.textureHeight = MeasurementService.pxToUnit(texture.height);

            if (m.inchWidth > 0 && m.inchHeight > 0) {
                // apply values manually set in the admin panel
                m.scaleX = m.inchWidth / m.textureWidth;
                m.scaleY = m.inchHeight / m.textureHeight;
            } else if (m.lockDimensions && m.minWidth > 0 && m.minHeight > 0) {
                m.scaleX = m.minWidth / m.textureWidth;
                m.scaleY = m.minHeight / m.textureHeight;
            }

            m.width = Math.abs(m.scaleX * m.textureWidth);
            m.height = Math.abs(m.scaleY * m.textureHeight);

            // negative scales forbidden for Case, only for the obj inside
            c.scale.x = Math.abs(m.scaleX);
            c.scale.y = Math.abs(m.scaleY);

            if (m.flipped) {
                c.flipH();
            }

            if (typeof cb === 'function') {
                cb(da);
            }
        };

        if (!texture.baseTexture.valid) {
            texture.once('update', onTextureLoadComplete);
        } else {
            onTextureLoadComplete();
        }

        return da;
    }

    setArtEffect(da: DesignArt, effect: string, value: boolean) {
        if (!da.model.hasOwnProperty(effect)) {
            return;
        }
        da.model[effect] = value;

        // apply filters
        this.updateArtFilters(da);
    }

    updateArtFilters(da: DesignArt) {
        let child: PIXI.DisplayObject = da.children.length > 0 ? da.getChildAt(0) : null;
        if (child && child instanceof PIXI.Mesh) {
            child.shader.uniforms.scaleX = da.scale.x;
            child.shader.uniforms.scaleY = da.scale.y;
        }

        if (da.model.drawSimple) {
            da.filters = [];

            if (da.model.inverted) {
                da.filters.push(this.filterNegative);
            }
            return;
        }

        if (da.model.artType === ArtService.ART_TYPE_VASE) {
            let hlFilter: HardLightFilter;
            if (da.filters) {
                hlFilter = da.filters.find((element) => element instanceof HardLightFilter) as HardLightFilter;
            }
            if (!hlFilter) {
                hlFilter = new HardLightFilter();
                da.filters = [/*this.filterGrayscale, */ hlFilter];
            }

            let fillSrc: string = this.getBitmapFill(da.model).url;

            hlFilter.baseMap = PIXI.Texture.from(fillSrc);
            hlFilter.textureScale = this.container.scale.x * MeasurementService.SCALE;

            return;
        }

        let lowerFillID: string = da.model.lowerBitmapFill;
        if (!this.as.bitmapFills[lowerFillID]) {
            return;
        }
        let sColor: ColorItem = this.as.sinkageColors[da.model.sinkage];
        let ccFilter: ConvexCavityFilter;
        if (da.filters) {
            ccFilter = da.filters.find((element) => element instanceof ConvexCavityFilter) as ConvexCavityFilter;
        }
        if (!ccFilter) {
            ccFilter = new ConvexCavityFilter();
        }
        let contrastFilter: ContrastFilter;
        if (da.filters) {
            contrastFilter = da.filters.find((element) => element instanceof ContrastFilter) as ContrastFilter;
        }
        if (!contrastFilter) {
            contrastFilter = new ContrastFilter();
        }

        let applyHL: boolean = false; // false, cause the legacy app had a hard light filter, but the smart contrast filter looks better
        let hlFilter: HardLightFilter;
        if (applyHL) {
            if (da.filters) {
                hlFilter = da.filters.find((element) => element instanceof HardLightFilter) as HardLightFilter;
            }
            if (!hlFilter) {
                hlFilter = new HardLightFilter();
            }
        }

        ccFilter.blackIsCavity = !da.model.inverted;
        ccFilter.cavityEnabled = true;
        ccFilter.cavityTexture = sColor.getRT();
        ccFilter.convexEnabled = true;
        ccFilter.outerShadowsEnabled = true;
        ccFilter.shadowsEnabled = true;
        ccFilter.shadowColor = sColor.shadowHex;
        ccFilter.shadowAlpha = sColor.shadowAlpha;
        ccFilter.textureScale = this.container.scale.x * MeasurementService.SCALE;
        ccFilter.shadowDistance = Math.round(this.container.scale.x * MeasurementService.inchToPx(this.shadowDistanceInch) * 10) / 10;

        if (da.model.frostingVisible) {
            ccFilter.convexTexture = PIXI.Texture.from(this.as.bitmapFills[lowerFillID + 's'].url);
            ccFilter.convexIsTransparent = false;
            if (hlFilter) {
                hlFilter.baseMap = PIXI.Texture.from(this.as.bitmapFills[lowerFillID].url); // +6??
            }
        } else {
            // 1st way - better image overlays, worse fit to some of the monument's fills
            ccFilter.convexTexture = PIXI.Texture.from(this.as.bitmapFills[lowerFillID].url);
            ccFilter.convexIsTransparent = false;
            if (hlFilter) {
                hlFilter.baseMap = PIXI.Texture.from(this.as.bitmapFills[lowerFillID].url);
            }

            /* // 2nd way - worse overall
            ccFilter.convexTexture = PIXI.Texture.from(this.as.bitmapFills[bitmapFillID].url); // any fully opaque texture should be fine here
            ccFilter.convexIsTransparent = true;
            */
        }

        // apply smart contrast (increase contrast in a way that the final image (after all the filters) will be less transparent)
        let pd: PixelData = this.as.getPixelData(da.model.imageFile);
        if (!pd) {
            pd = {
                id: null,
                minBrightness: 0,
                maxBrightness: 1
            };
        }

        let scale: number = (ccFilter.blackIsCavity ? pd.maxBrightness : 1.0 - pd.minBrightness) / (pd.maxBrightness - pd.minBrightness);
        let anchor: number[] = [0, 0, 0]; // anchors for r,g,b
        anchor.fill(ccFilter.blackIsCavity ? pd.maxBrightness : pd.minBrightness, 0, 3);

        contrastFilter.anchor = anchor;
        contrastFilter.contrast = scale;

        /* the grayscale filter needed cause masking used in the ccFilter relies only on R channel,
        thus it may produce bad results for images containing no red */
        da.filters = [this.filterGrayscale, contrastFilter, ccFilter];

        if (hlFilter) {
            hlFilter.textureScale = this.container.scale.x * MeasurementService.SCALE;
            da.filters.push(hlFilter);
        }
    }

    setArtColor(da: DesignArt, colorID: string) {
        da.model.color = colorID;
        this.updateArtFilters(da);
    }

    setArtSinkageColor(da: DesignArt, sinkageColorID: string) {
        da.model.sinkage = sinkageColorID;
        this.updateArtFilters(da);
    }

    getBitmapFill(m: ArtModel) {
        return this.as.bitmapFills[m.color + (m.frostingVisible ? 's' : '')];
    }

    private updateArtModel(item: DesignArt, m: ArtModel, flag: string) {
        m.x = MeasurementService.pxToUnit(item.x);
        m.y = MeasurementService.pxToUnit(item.y);
        m.flipped = (item as Case).flippedH ? true : false;
        m.scaleX = item.scale.x;
        m.scaleY = item.scale.y;
        m.width = Math.abs(m.scaleX * m.textureWidth);
        m.height = Math.abs(m.scaleY * m.textureHeight);
        m.rotation = item.rotation;
    }

    getFiles(
        searchContext: TreeNode | string,
        noCache: boolean = false,
        types: string[] = [ArtService.ART_TYPE_COMPONENT],
        page: number = NaN,
        itemsPerPage: number = NaN,
        categoryID: string = ''
    ): Promise<void | DesignData[] | NodeServicePageFilesResponse> {
        let test: boolean = this.config.testMode.includes('arts');
        let pagination: boolean = !isNaN(page) && !isNaN(itemsPerPage);

        let spStr: string = '';
        let sp: URLSearchParams = new URLSearchParams();
        if (typeof searchContext === 'string') {
            searchContext = searchContext.trim();

            sp.append('keyword', searchContext);
        }

        if (!searchContext) {
            return Promise.reject('Invalid search query');
        }

        if (pagination) {
            sp.append('page', String(page));
        }

        if (noCache) {
            sp.append('random', String(Math.random() * 10000));
        }
        spStr = sp.toString();
        let suffix: string = spStr ? '?' + spStr : '';

        let urls: string[] = [];
        let baseUrl: string = this.config.apiURL;

        if (test) {
            if (typeof searchContext === 'string') {
                urls.push(this.config.assetsURL + 'test/arts_search_page' + (pagination ? page : 's') + '.json');
            } else {
                urls.push(this.config.assetsURL + 'test/arts_page' + (pagination ? page : 's') + '.json');
            }
        } else {
            if (typeof searchContext === 'string') {
                if (types.indexOf(ArtService.ART_TYPE_VASE) >= 0) {
                    return Promise.reject('Search in Vases is not supported by API');
                }
                // common search for components & panels
                urls.push(baseUrl + ArtService.ART_TYPE_COMPONENT + 's/search' + suffix);
            } else {
                let categories: DesignDataCategory[] = DataUtils.findAllInTree([searchContext], this.childrenPropName, (element) => {
                    return !element.children;
                }).map((element) => element.data);

                categories.forEach((category) => {
                    let s: string = 's';
                    urls.push(
                        baseUrl +
                            category.type +
                            s +
                            (category.type === ArtService.ART_TYPE_VASE ? '/type/' : '/category/') +
                            category.catID +
                            '/' +
                            suffix
                    );
                });
            }
        }

        if (urls.length > 1 && pagination) {
            return Promise.reject("Pagination can't be provided for multiple requests.");
        }

        let promises: Promise<any>[] = [];

        urls.forEach((url) => {
            promises.push(
                this.http
                    .get<any>(url, { responseType: 'json' })
                    .toPromise()
            );
        });

        return Promise.all(promises)
            .then((results) => {
                let arr: DesignData[] = [];
                let total: number = 0;
                let responseHasPagination: boolean = false;
                results.forEach((res, index) => {
                    if (res) {
                        let type: string = types[index];

                        total = Number(res.total);
                        responseHasPagination = total >= 0;

                        for (let t of ArtService.ART_TYPES) {
                            let prop: string = t + 's';
                            if (res.hasOwnProperty(prop)) {
                                type = t; // can be omitted
                                // correct result
                                res = res[prop];
                                break;
                            }
                        }

                        let resArr: any[] = res instanceof Array ? res : [res];
                        resArr.forEach((element) => {
                            if (element.class) {
                                // combined response (a components-panels search)
                                type = element.class;
                            }
                            arr.push(this.parseFileResponse(element, type));
                        });
                    }
                });

                if (pagination && responseHasPagination) {
                    return { total, page, value: arr };
                }

                return arr;
            })
            .then((result) => {
                if (test) {
                    return new Promise((resolve) =>
                        setTimeout(() => {
                            resolve(result);
                        }, 2500)
                    );
                } else {
                    return result;
                }
            });
    }

    protected parseFileResponse(element: any, type: string) {
        let image: DesignData = ArtService.createArtData();
        image.type = type;
        image.style = element.style;
        image.nid = String(element.id);
        image.title = element.name;
        image.image = element.image;
        image.thumbnail = element.thumbnail;
        image.leftBorder = element.left_border | element.left_border_width;
        image.bottomBorder = element.bottom_border | element.bottom_border_height;
        image.rightBorder = element.right_border | element.right_border_width;
        image.topBorder = element.top_border | element.top_border_height;
        image.minimumWidth = element.minimum_width | element.min_width;
        image.minimumHeight = element.minimum_height | element.min_height;
        image.width = element.width;
        image.height = element.height;
        image.etching = element.etching;
        image.lockDimensions =
            element.locked_dimensions || element.lock_dimensions ? 'on' : type === ArtService.ART_TYPE_VASE ? 'on' : 'off';

        if (!image.thumbnail) {
            console.warn('no thumbnail for art, type:', type, ', id:', image.nid);
            image.thumbnail = 'monuvision-assets/images/no_image.jpg';
        }

        return image;
    }

    getCategoriesTree(noCache: boolean = false, artTypes: string[] = ArtService.ART_TYPES): Promise<TreeNode[]> {
        for (let type of artTypes) {
            let empty: boolean = this.categoryTrees[type] ? this.categoryTrees[type].length === 0 : true;
            if (empty) {
                noCache = true;

                break;
            }
        }

        if (noCache) {
            return this.getCategories(noCache, artTypes).then((categories) => {
                let tree: TreeNode[] = [];

                Object.keys(categories).forEach((type) => {
                    this.categoryTrees[type] = [];
                    categories[type].forEach((c) => {
                        this.createCategoryTreeNode(this.categoryTrees[type], c);
                    });

                    // delete temporary root parent nodes that was created by their children, but do not present in the received data
                    // (e.g. there is no 'Laser Etching by Monuvision' when calling from localhost)
                    for (let i: number = 0; i < this.categoryTrees[type].length; i++) {
                        let element: TreeNode = this.categoryTrees[type][i];
                        if (element.label === 'Parent' && !element.data.name) {
                            this.categoryTrees[type].splice(i, 1);
                            i--;
                        }
                    }

                    DataUtils.sortTree(this.categoryTrees[type], this.childrenPropName, this.compareNodes);

                    tree = tree.concat(this.categoryTrees[type]);
                });

                return tree;
            });
        } else {
            let tree: TreeNode[] = [];

            for (let type of artTypes) {
                tree = tree.concat(this.categoryTrees[type]);
            }

            return Promise.resolve(tree);
        }
    }

    private createCategoryTreeNode(tree: TreeNode[], c: DesignDataCategory) {
        // means that this node was created by some of its children
        let exists: boolean = true;

        let node: TreeNode = DataUtils.findInTree(
            tree,
            'children',
            (element: TreeNode) => element.data.catID === c.catID && element.data.type === c.type
        );

        if (!node) {
            exists = false;
            node = {};
        }

        node.label = c.name ? c.name.replace('&amp;', '&') : c.name;
        node.data = _.cloneDeep(c);

        if (!c.parentID || c.parentID === '0') {
            // has no parent
            if (!exists) {
                tree.push(node);
            }
        } else {
            // has a parent

            if (exists && node.children) {
                // temporarily was added to the root, but should be placed inside its own parent
                let nodeRootIndex: number = tree.indexOf(node);

                if (nodeRootIndex >= 0) {
                    tree.splice(nodeRootIndex, 1);
                }
            }

            let parent: TreeNode = DataUtils.findInTree(
                tree,
                this.childrenPropName,
                (element: TreeNode) => element.data.catID === c.parentID && element.data.type === c.type
            );
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(node);
            } else {
                // no parent node created yet, so create it
                parent = {
                    label: 'Parent', // temporary name
                    data: {
                        name: null,
                        type: c.type,
                        catID: c.parentID
                    }
                };
                parent.children = [];
                parent.children.push(node);

                // temporarily add to the root level
                tree.push(parent);
            }
            parent.expandedIcon = 'fa fa-folder-open';
            parent.collapsedIcon = 'fa fa-folder';
        }
    }
    // loads categories and sub-categories
    private getCategories(
        noCache: boolean = false,
        artTypes: string[] = ArtService.ART_TYPES
    ): Promise<{ [type: string]: DesignDataCategory[] }> {
        let suffix: string = noCache ? '?random=' + Math.random() * 10000 : '';
        let promises: Promise<any>[] = [];
        // flat structure
        let categories: { [type: string]: DesignDataCategory[] } = {};

        // TODO: add companies' images
        artTypes.forEach((type) => {
            promises.push(
                this.http
                    .get<any>(this.config.apiURL + (type === ArtService.ART_TYPE_VASE ? 'vases/types' : 'categories/' + type) + suffix, {
                        responseType: 'json'
                    })
                    .toPromise()
            );
        });

        return Promise.all(promises).then((results) => {
            results.forEach((res, index) => {
                let type: string = artTypes[index];

                if (!categories[type]) {
                    categories[type] = [];
                }

                if (res) {
                    let resArr: any[] = res instanceof Array ? res : [res];

                    if (type === ArtService.ART_TYPE_VASE) {
                        // API returns {'1':'name1', '2':'name2'}
                        Object.keys(resArr[0]).forEach((key) => {
                            let c: DesignDataCategory;
                            c = {
                                name: resArr[0][key],
                                type: type,
                                catID: String(key),
                                parentID: '0'
                            };
                            categories[type].push(c);
                        });
                    } else {
                        categories[type] = resArr.map((element) => {
                            let c: DesignDataCategory;

                            c = {
                                name: element.name,
                                type: type,
                                catID: String(element.id),
                                parentID: StrUtils.numberToString(element.parent_id),
                                sortVal: parseInt(element.sort),
                                description: element.description
                            };

                            if (type === ArtService.ART_TYPE_PANEL) {
                                if (!c.parentID || c.parentID === '0' || c.parentID === 'null') {
                                    c.parentID = type + 'Root';
                                }
                            }

                            return c;
                        });
                    }
                }

                if (type === ArtService.ART_TYPE_PANEL) {
                    // add very root (wrapping parent) category for panels
                    let veryRootCategory: DesignDataCategory = {
                        name: 'Panels',
                        type: type,
                        catID: type + 'Root',
                        parentID: null,
                        sortVal: NaN,
                        description: null
                    };

                    categories[type].push(veryRootCategory);
                }
            });

            return categories;
        });
    }

    private compareNodes(a: TreeNode, b: TreeNode) {
        if (a.data.sortVal > b.data.sortVal) {
            return 1;
        } else {
            if (a.data.sortVal < b.data.sortVal) {
                return -1;
            }

            return a.label.localeCompare(b.label); // 0
        }
    }

    getFile(id: string, type: string = ArtService.ART_TYPE_COMPONENT) {
        let url: string = this.config.apiURL + type + 's/' + id;
        return this.http
            .get<any>(url)
            .toPromise()
            .then((res) => this.parseFileResponse(res, type));
    }
}

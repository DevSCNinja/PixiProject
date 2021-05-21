import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TreeNode } from 'primeng/api';
import * as PIXI from 'pixi.js';
import * as _ from 'lodash';
import * as polyClip from 'polygon-clipping';
import * as potrace from 'potrace';
import { pathDataToPolys } from 'svg-path-to-polygons';
import {
    ShapeModel,
    DesignShape,
    BitmapFillItem,
    Case,
    DesignSubShape,
    DesignData,
    DesignDataCategory,
    PolishItem,
    Area,
    NodeService,
    PixelData,
    NodeServicePageFilesResponse
} from '../models/main';
import { MultiCase } from '../../pixi/multi-case';
import { SuperGraphics } from '../../pixi/super-graphics';
import { DataUtils } from '../utils/data-utils';
import { HardLightFilter } from '../../pixi/filters/hard-light-filter';
import { MeasurementService } from './measurement.service';
import { ConfigService } from './config.service';
import { UserService } from './user.service';
import { AssetService } from './asset.service';
import { GradientLightingFilter } from '../../pixi/filters/gradient-filter';
import { StrUtils } from '../utils/str-utils';
import { FillFilter } from '../../pixi/filters/fill-filter';

@Injectable({
    providedIn: 'root'
})
export class ShapeService implements NodeService {
    // common tablet types:
    static readonly SHAPE_TYPE_TRADITIONAL: string = 'traditional';

    static readonly SHAPE_TYPE_CUSTOM: string = 'custom';

    static readonly SHAPE_TYPE_MARKER: string = 'marker'; // includes flat, bevel, slant markers

    static readonly SHAPE_TYPES: string[] = [
        ShapeService.SHAPE_TYPE_TRADITIONAL,
        ShapeService.SHAPE_TYPE_CUSTOM,
        ShapeService.SHAPE_TYPE_MARKER
    ];
    // detailed tablet types:
    static readonly SHAPE_TYPE_FLAT_MARKER: string = 'flat marker';

    static readonly SHAPE_TYPE_BEVEL_MARKER: string = 'bevel marker';

    static readonly SHAPE_TYPE_SLANT_MARKER: string = 'slant marker';

    static readonly SHAPE_MARKER_DETAILED_TYPES: string[] = [
        ShapeService.SHAPE_TYPE_FLAT_MARKER,
        ShapeService.SHAPE_TYPE_BEVEL_MARKER,
        ShapeService.SHAPE_TYPE_SLANT_MARKER
    ];
    // base types:
    static readonly SHAPE_TYPE_BASE: string = '';
    // detailed base types:
    static readonly SHAPE_TYPE_BASE_COMMON: string = 'base common';

    static readonly SHAPE_TYPE_BASE_BEVEL_MARKER: string = 'base bevel marker';

    static readonly SHAPE_TYPE_BASE_NONE: string = 'base none';

    static readonly SHAPE_BASE_DETAILED_TYPES: string[] = [
        ShapeService.SHAPE_TYPE_BASE_COMMON,
        ShapeService.SHAPE_TYPE_BASE_BEVEL_MARKER,
        ShapeService.SHAPE_TYPE_BASE_NONE
    ];

    static readonly SERP_ID: string = '1';

    static readonly EXAG_SERP_ID: string = '2';

    static readonly STRAIGHT_ID: string = '3';

    static readonly OVAL_ID: string = '4';

    static readonly HALF_SERP_RIGHT_ID: string = '5';

    static readonly HALF_SERP_LEFT_ID: string = '6';

    static readonly FLAT_ID: string = '17';

    static readonly BEVEL_ID: string = '18';

    static readonly SLANT_SERP_ID: string = '19';

    static readonly SLANT_STRAIGHT_ID: string = '21';

    static readonly SLANT_OVAL_ID: string = '22';

    static readonly WESTERN_SERP_SLANT_ID: string = '20';

    static readonly WESTERN_OVAL_SLANT_ID: string = '23';

    static readonly WESTERN_STRAIGHT_SLANT_ID: string = '24';

    static readonly NO_BASE_ID: string = '0';

    static readonly STANDARD_BASE_ID: string = '101';

    static readonly LAWN_MARKER_BASE_ID: string = '103';

    static readonly STANDARD_BASE_OLD_ID: string = '102';

    static readonly EFFECT_PITCH: string = 'pitch';

    static readonly EFFECT_FROST: string = 'frost';

    static readonly POLISH_PT: PolishItem = { name: 'PT', id: '1' };

    static readonly POLISH_P2: PolishItem = { name: 'P2', id: '2' };

    static readonly POLISH_P3: PolishItem = { name: 'P3', id: '3' };

    static readonly POLISH_P5: PolishItem = { name: 'P5', id: '5' };

    static readonly POLISH_MGN: PolishItem = { name: 'MGN', id: '6' };

    static readonly POLISH_PFT: PolishItem = { name: 'PFT', id: '7' };

    static readonly POLISH_POL_FACE: PolishItem = { name: 'Pol Face', id: '7' }; // a clone of POLISH_PFT but with other name // similar to P2

    static readonly POLISH_POL_TOP: PolishItem = { name: 'Pol Top', id: '8' }; // similar to P3

    static readonly POLISH_CUSTOM: PolishItem = { name: 'Custom', id: '9' };

    static readonly POLISHES_DEFAULT: PolishItem[] = [ShapeService.POLISH_P2, ShapeService.POLISH_P3, ShapeService.POLISH_P5];

    static readonly POLISHES_BASE: PolishItem[] = [ShapeService.POLISH_PT, ShapeService.POLISH_P5, ShapeService.POLISH_MGN];

    static readonly POLISHES_SLANT: PolishItem[] = [ShapeService.POLISH_POL_FACE, ShapeService.POLISH_POL_TOP, ShapeService.POLISH_P5];
    // price pattern
    static readonly DATA_PATTERN_DEFAULT: string = '';

    static readonly DATA_PATTERN_NO_PRICE: string = 'Do not price this shape';

    static readonly NO_PATTERN_CHARGE: number = 0;

    static DEFAULT_SHAPE_COLOR_ID: string = '0'; // will be rewritten

    // TODO: find out why size saved in pixels, not in inches
    protected static readonly DEFAULT_SHAPE_MODEL: ShapeModel = {
        type: 'shape',
        x: 0,
        y: 0,
        width: 4,
        height: 4,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        color: ShapeService.DEFAULT_SHAPE_COLOR_ID,
        shape: 'star',
        polish: ShapeService.POLISH_P5.id,
        depth: 8
    };

    static readonly MODEL_UNIT_PROPS: string[] = ['x', 'y', 'width', 'height', 'depth'];

    protected static readonly DEFAULT_SHAPE_DATA: DesignData = {
        type: ShapeService.SHAPE_TYPE_TRADITIONAL,
        style: '', // TODO: remove this prop if not used
        nid: '',
        title: '',
        thumbnail: '',
        darkStone: '',
        lightStone: '',
        additionalLayer: '',
        additionalLayerStaticImage: '',
        pattern: ShapeService.DATA_PATTERN_DEFAULT,
        lockDimensions: '',
        width: 36,
        height: 24,
        depth: 8,
        baseWidth: 48,
        baseHeight: 8,
        baseDepth: 14
    };

    static readonly DATA_UNIT_PROPS: string[] = ['width', 'height', 'depth', 'baseWidth', 'baseHeight', 'baseDepth'];

    renderer: PIXI.Renderer;

    container: PIXI.Container;

    filterWhite: PIXI.filters.ColorMatrixFilter;

    selectedShape: DesignShape;

    minShapeWidthInch: number = 0;

    minShapeHeightInch: number = 3;

    extraAreaShapeSizeInch: number = 100;

    recentShapeImages: DesignData[] = [];

    recentCustomShapeImages: DesignData[] = [];

    recentFlatMarkerImages: DesignData[] = [];

    maxRecent: number = 100;

    private categoryTrees: { [type: string]: TreeNode[] } = {};

    private readonly childrenPropName: string = 'children';
    // cached outlines of raster shapes (Custom Shapes)
    private polygonsLib: { [type: string]: polyClip.Polygon[] } = {};

    constructor(
        private config: ConfigService,
        private ngZone: NgZone,
        private http: HttpClient,
        private us: UserService,
        private as: AssetService
    ) {}

    init() {
        this.getCategoriesTree(true);
    }

    static createShapeModel() {
        let m: ShapeModel = _.cloneDeep(ShapeService.DEFAULT_SHAPE_MODEL);
        m = MeasurementService.convertPropsToUnit(
            m,
            ShapeService.MODEL_UNIT_PROPS,
            MeasurementService.CURRENT_UNIT,
            MeasurementService.INCH
        );
        return m;
    }

    static createShapeData() {
        let data: DesignData = _.cloneDeep(ShapeService.DEFAULT_SHAPE_DATA);
        data = MeasurementService.convertPropsToUnit(
            data,
            ShapeService.DATA_UNIT_PROPS,
            MeasurementService.CURRENT_UNIT,
            MeasurementService.INCH
        );
        return data;
    }

    static convertDatalUnit(data: DesignData, currentUnit: string, targetUnit: string) {
        if (currentUnit === targetUnit) {
            return data;
        }
        let props: string[] = ['x', 'y', 'width', 'height', 'depth'];
        props.forEach((p) => {
            if (data.hasOwnProperty(p)) {
                data[p] = MeasurementService.convertToUnit(data[p], currentUnit, targetUnit);
            } else {
                console.warn('Model has no property "' + p + '"');
            }
        });

        return data;
    }

    static isBaseShape(dsOrModel: DesignShape | ShapeModel) {
        let m: ShapeModel = (dsOrModel as DesignShape).model ? (dsOrModel as DesignShape).model : (dsOrModel as ShapeModel);
        return m.shape.indexOf('base') >= 0;
    }

    static isCustomShape(dsOrModel: DesignShape | ShapeModel) {
        let m: ShapeModel = (dsOrModel as DesignShape).model ? (dsOrModel as DesignShape).model : (dsOrModel as ShapeModel);
        return m.lightImage || m.darkImage || m.additionalLayer ? true : false;
    }

    shapeContainsPoint(ds: DesignShape, globalPoint: PIXI.IPoint, lightImageArea: boolean = false) {
        if (ds.alphaChannelPixels) {
            if (ds.children.length > 0) {
                let sprite: PIXI.Sprite = ds.getChildAt(0) as PIXI.Sprite;
                if (sprite && ds.alphaChannelPixels) {
                    let tw: number = sprite.texture.width;
                    let th: number = sprite.texture.height;
                    let localPoint: PIXI.IPoint = sprite.toLocal(globalPoint);

                    localPoint.x += tw * sprite.anchor.x;
                    localPoint.y += th * sprite.anchor.y;
                    if (localPoint.x >= 0 && localPoint.x <= tw && localPoint.y >= 0 && localPoint.y <= th) {
                        let xCoord: number = Math.floor(localPoint.x);
                        let yCoord: number = Math.floor(localPoint.y);

                        let index: number = yCoord * tw + xCoord;

                        let alphaValue: number = ds.alphaChannelPixels[index];

                        if (lightImageArea) {
                            return alphaValue === 127 ? ds : null;
                        } else {
                            return alphaValue > 0 ? ds : null;
                        }
                    } else {
                        return null;
                    }
                }
            }

            if (this.renderer.plugins.interaction.hitTest(globalPoint, ds)) {
                return ds;
            }
        } else {
            if (this.renderer.plugins.interaction.hitTest(globalPoint, ds)) {
                return ds;
            }
        }

        return null;
    }

    copyDataToModel(data: DesignData, m: ShapeModel, isBase: boolean = false) {
        m.shapeType = data.type;
        m.shape = isBase ? 'base' + (this.viewedFromTop(data.nid) ? 'TV' : '') : data.nid;
        m.thumbnail = this.config.getAssetFullURL(data.thumbnail, true);
        if (data.lightStone) {
            m.lightImage = this.config.getAssetFullURL(data.lightStone, true);
        }
        if (data.darkStone) {
            m.darkImage = this.config.getAssetFullURL(data.darkStone, true);
        }
        if (data.additionalLayer) {
            m.additionalLayer = this.config.getAssetFullURL(data.additionalLayer, true);
        }

        m.name = data.title;
        m.patternCharge = parseInt(data.pattern.substr(data.pattern.length - 1)); // TODO:upd pricing
        // TODO: size should be saved in px not inches (or not?)
        m.width = isBase ? data.baseWidth : data.width;
        m.height = isBase ? data.baseHeight : data.height;
        m.depth = isBase ? data.baseDepth : data.depth;
        m.polish = this.getDefaultPolish(m).id;
        m.color = ShapeService.DEFAULT_SHAPE_COLOR_ID;
        m.additionalLayerStatic = Boolean(
            data.additionalLayerStaticImage
                .trim()
                .toLowerCase()
                .search(/(static|1|on|true|yes)/) >= 0
        );

        let ld: string = data.lockDimensions.trim().toLowerCase();
        m.lockDimensions = !isBase && (ld === 'on' || ld === 'true' || ld === 'yes' || ld === '1') ? true : false;
    }

    copyModelToData(m: ShapeModel, data: DesignData, isBase: boolean = false) {
        data.type = m.shapeType;
        data.nid = isBase ? (this.viewedFromTop(m.shape) ? ShapeService.FLAT_ID : ShapeService.SERP_ID) : m.shape;
        data.thumbnail = this.config.getAssetShortURL(m.thumbnail);
        if (m.lightImage) {
            data.lightStone = this.config.getAssetShortURL(m.lightImage);
        }
        if (m.darkImage) {
            data.darkStone = this.config.getAssetShortURL(m.darkImage);
        }
        if (m.additionalLayer) {
            data.additionalLayer = this.config.getAssetShortURL(m.additionalLayer);
        }

        data.title = m.name;
        data.pattern = m.patternCharge.toString();

        if (isBase) {
            data.baseWidth = m.width;
            data.baseHeight = m.height;
            data.baseDepth = m.depth;
        } else {
            data.width = m.width;
            data.height = m.height;
            data.depth = m.depth;
        }
        data.additionalLayerStaticImage = m.additionalLayerStatic ? 'on' : 'off';
        data.lockDimensions = m.lockDimensions ? 'on' : 'off';
    }

    // creates a simple shape or complex shape (containing sub shapes)
    createShape(m?: ShapeModel, cb?: Function): DesignShape {
        if (!m) {
            m = ShapeService.createShapeModel();
        }

        let isCustomShape: boolean = ShapeService.isCustomShape(m);
        let isBase: boolean = ShapeService.isBaseShape(m);
        let templateModels: ShapeModel[];
        let polishesStoredSeparately: boolean = true;
        let texturesLoaded: number = 0;
        let texturesToLoad: number = 0;

        if (isCustomShape) {
            templateModels = [];
            // don't change the order
            let names: string[] = ['darkImage', 'lightImage', 'additionalLayer'];
            names.forEach((n) => {
                if (!m[n]) {
                    return;
                }
                let isAdditionalLayer: boolean = n === 'additionalLayer';
                if (isAdditionalLayer && !m.additionalLayer) {
                    return;
                }
                let isStatic: boolean = isAdditionalLayer && m.additionalLayerStatic;
                let tm: ShapeModel = {
                    type: 'shape',
                    name: n,
                    x: 0,
                    y: 0,
                    width: m.width,
                    height: m.height,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    shape: 'rect',
                    place: 'c',
                    pitch: n === 'lightImage' || (isAdditionalLayer && !isStatic),
                    roughRock: isAdditionalLayer && !isStatic,
                    image: m[n],
                    imageIsStatic: isStatic
                };
                templateModels.push(tm);
            });

            texturesToLoad = templateModels.length;
        } else {
            templateModels = this.as.complexShapes[m.shape + 'P' + m.polish];
            if (!templateModels) {
                polishesStoredSeparately = false;
                templateModels = this.as.complexShapes[m.shape];
            }
            if (!templateModels) {
                // simple shape
                templateModels = [_.cloneDeep(ShapeService.DEFAULT_SHAPE_MODEL)];
                templateModels[0].shape = m.shape;
                if (!templateModels) {
                    console.warn('Cannot find this shape:', m.shape);
                    return;
                }
            }
        }

        let shapes: (SuperGraphics | PIXI.Container)[] = [];
        let textures: PIXI.Texture[] = [];
        let paths: string[] = [];
        let initialScales: { x: number; y: number }[] = [];
        let areas: Area[] = isBase ? null : [];
        let c: MultiCase;
        let rxRough: RegExp = new RegExp('rough', 'i');
        let min: { [place: string]: number } = {
            t: Number.NEGATIVE_INFINITY,
            b: Number.NEGATIVE_INFINITY,
            l: Number.NEGATIVE_INFINITY,
            r: Number.NEGATIVE_INFINITY
        };

        c = new MultiCase();

        if (areas) {
            let len: number = m.lightImage ? 4 : 2;
            for (let i: number = 0; i < len; i++) {
                let a: Area = isCustomShape ? new PIXI.Sprite() : (new PIXI.Container() as PIXI.Sprite);
                // remove from hit detection
                a.interactive = false;
                (a as PIXI.Container).interactiveChildren = false;

                a.objectsAffected = [];
                a.owner = c as DesignShape;
                areas[i] = a;
            }
        }

        c.redraw = (updFill: boolean = false) => {
            let areas: Area[] = (c as DesignShape).areas;
            let areaChildIndex: number = 0;

            c.objs.forEach((obj, index) => {
                if (!obj) {
                    return;
                }

                let tm: ShapeModel = (obj as DesignSubShape).model;
                if (updFill) {
                    let fillSrc: string = this.getBitmapFill(tm).url;
                    textures[index] = PIXI.Texture.from(fillSrc);
                }

                let sc: any = initialScales[index];

                let flippedH: boolean = Math.sign(sc.x) !== Math.sign(obj.scale.x);
                obj.scale.x = (sc.x / (obj.pivot.x !== 0 ? c.scale.x : 1)) * (c.flippedH ? -1 : 1);
                if (flippedH !== c.flippedH) {
                    obj.x *= -1;
                }

                let flippedV: boolean = Math.sign(sc.y) !== Math.sign(obj.scale.y);
                obj.scale.y = (sc.y / (obj.pivot.y !== 0 ? c.scale.y : 1)) * (c.flippedV ? -1 : 1);
                if (flippedV !== c.flippedV) {
                    obj.y *= -1;
                }

                let scX: number = MeasurementService.SCALE / (obj.scale.x * c.scale.x);
                let scY: number = MeasurementService.SCALE / (obj.scale.y * c.scale.y);
                // add translation deltas to make the fill look seamless
                let dx: number = 0; // calculate dx too if the complex shape is not symmetric horizontally
                let dy: number = (-c.scale.y * obj.y) / sc.y + obj.pivot.y;

                if (tm.image) {
                    // no actions needed
                } else {
                    let s: SuperGraphics = obj as SuperGraphics;
                    s.clear();
                    s.beginTextureFill({
                        texture: textures[index],
                        color: 0xffffff,
                        alpha: 1.0,
                        matrix: new PIXI.Matrix(scX, 0, 0, scY, dx, dy)
                    });
                    s.decodePath(paths[index]).endFill();

                    if (areas && (!this.isLightened(tm) || ShapeService.isCustomShape(c as DesignShape))) {
                        areas.forEach((a) => {
                            let areaChild: PIXI.DisplayObject = (a as PIXI.Container).getChildAt(areaChildIndex);
                            if (areaChild) {
                                areaChild.scale.x = obj.scale.x;
                                areaChild.scale.y = obj.scale.y;
                            }
                        });
                        areaChildIndex++;
                    }
                }
            });

            let localBounds: PIXI.Rectangle = c.getLocalBounds();

            c.pivot.x = localBounds.width / 2 + localBounds.x; // cause it's asymmetrical horizontally sometime
            c.pivot.y = localBounds.height / 2 + localBounds.y; // cause it's asymmetrical vertically

            if (areas) {
                // depends on MultiCase's transformation, but it hasn't been updated yet, so update it
                if (c.parent) {
                    c.updateTransform();
                }

                areas.forEach((a) => {
                    a.transform.setFromMatrix(c.transform.localTransform);

                    if (ShapeService.isCustomShape(c as DesignShape)) {
                        if (c.flippedH) {
                            a.scale.x *= -1;
                        }
                        if (c.flippedV) {
                            a.scale.y *= -1;
                        }
                    }
                });
            }
        };

        // simplify flipH function, flipping is happening in redraw function
        c.flipH = () => {
            if (c.objs) {
                c.flippedH = !c.flippedH;
            }
        };

        c.on('added', () => {
            c.redraw();
            this.updateShapeFilters(ds);
        });

        let ds: DesignShape = c as DesignShape;
        ds.model = m;
        ds.updateModel = (flag: string = 'default') => {
            this.updateShapeModel(ds, ds.model, flag);
        };
        ds.interactive = true;

        let setupCase: Function = () => {
            Object.keys(min).forEach((place) => {
                if (!isFinite(min[place])) {
                    min[place] = 0;
                }
            });

            m.minWidth = min.l + min.r;
            m.minHeight = min.t + min.b;

            m.scaleX = ((m.width - m.minWidth) / m.coreWidth) * (m.scaleX > 0 ? 1 : -1);
            m.scaleY = ((m.height - m.minHeight) / m.coreHeight) * (m.scaleY > 0 ? 1 : -1);

            c.add(shapes);

            c.x = MeasurementService.unitToPx(m.x);
            c.y = MeasurementService.unitToPx(m.y);
            c.scale.x = Math.abs(m.scaleX); // negative scales forbidden for Case, only for the obj inside
            c.scale.y = m.scaleY;
            c.rotation = m.rotation;

            if (m.scaleX < 0) {
                c.flipH();
            }

            if (areas) {
                ds.areas = areas;
            }

            if (c.parent) {
                c.redraw();
                this.updateShapeFilters(ds);
            }

            if (typeof cb === 'function') {
                this.ngZone.run(() => {
                    cb(ds);
                });
            }
        };

        templateModels.forEach((model, index) => {
            if (!model) {
                return;
            }

            let tm: ShapeModel = _.cloneDeep(model);
            let isRough: boolean = tm.shape.search(rxRough) >= 0; // || tm.roughRock;

            if (!polishesStoredSeparately) {
                // all shapes stored together (for different polish values),
                // so skip unused shapes
                if (m.polish === '2' || m.polish === '7') {
                    if (tm.place !== 'c' && tm.shape !== 'rect' && !isRough) {
                        // skip a flat edge
                        return;
                    }
                } else {
                    if (m.polish === '3' || m.polish === '8') {
                        if (tm.place === 't') {
                            if (isRough) {
                                // skip a rough shape
                                return;
                            }
                        } else {
                            if (tm.place !== 'c' && tm.shape !== 'rect' && !isRough) {
                                // skip a flat edge
                                return;
                            }
                        }
                    } else {
                        if (m.polish === '5') {
                            if (tm.roughRock) {
                                // make a front face look different (for slant markers only at the moment)
                                tm.roughRock = false;
                                tm.gradient = true;
                                tm.gradientOptions = {
                                    color0: [1.0, 1.0, 1.0, 0.7],
                                    color1: [1.0, 1.0, 1.0, 0.0],
                                    color2: [1.0, 1.0, 1.0, 0.0],
                                    color3: [1.0, 1.0, 1.0, 0.0],
                                    c0pos: 0.0,
                                    c1pos: 0.5,
                                    c2pos: 0.75,
                                    c3pos: 1.0,
                                    minReflection: 0.1,
                                    reflectionCoef: 0.5
                                };
                            }

                            if (isRough) {
                                // skip a rough shape

                                return;
                            }
                        }
                    }
                }
            }

            tm.shapeType = m.type;
            tm.color = m.color;

            if (!tm.image) {
                // for non-custom shapes
                tm.x *= MeasurementService.SCALE;
                tm.y *= MeasurementService.SCALE;
                tm.scaleX *= MeasurementService.SCALE;
                tm.scaleY *= MeasurementService.SCALE;
                tm.pivotX *= MeasurementService.SCALE;
                tm.pivotY *= MeasurementService.SCALE;
            }

            let shape: SuperGraphics | PIXI.Container = null;

            // get a texture
            let fillSrc: string = this.getBitmapFill(tm).url;
            let texture: PIXI.Texture = PIXI.Texture.from(fillSrc);

            if (!texture) {
                console.warn("texture doesn't exist:", fillSrc);

                return;
            }

            // add gradient for some shapes
            if (tm.gradient || (tm.place !== 'c' && tm.pitch) || tm.roughRock) {
                if (tm.pitch || tm.roughRock) {
                    // rough surfaces
                    tm.gradient = true;
                    tm.gradientOptions = {
                        color0: [1.0, 1.0, 1.0, 1.0],
                        color1: [1.0, 1.0, 1.0, 0.0],
                        color2: [0.0, 0.0, 0.0, 0.0],
                        color3: [0.0, 0.0, 0.0, 0.45],
                        c0pos: 0.0,
                        c1pos: 0.45,
                        c2pos: 0.55,
                        c3pos: 1.0,
                        minReflection: 0.0,
                        reflectionCoef: 0.6
                    };
                } else {
                    if (!tm.gradientOptions) {
                        // smooth surfaces
                        // assign a solid color
                        tm.gradient = true;
                        tm.gradientOptions = {
                            color3: [1.0, 1.0, 1.0, 1.0],
                            c3pos: 0.0,
                            minReflection: 0.6,
                            reflectionCoef: 0.8
                        };
                    }
                }
            }

            let matrix: PIXI.Matrix = new PIXI.Matrix(MeasurementService.SCALE / tm.scaleX, 0, 0, MeasurementService.SCALE / tm.scaleY);
            let path: string = '';
            let sw: number;
            let sh: number;
            if (tm.image) {
                // custom shape
                // a simple image with a filter
                sw = MeasurementService.unitToPx(tm.width);
                sh = MeasurementService.unitToPx(tm.height);
                shape = new PIXI.Sprite();

                //(shape as PIXI.Sprite).interactive = true; // to allow proper hitTest

                // sub shapes also have their own models
                (shape as DesignSubShape).model = tm;

                let url: string = tm.image;
                let t: PIXI.Texture = PIXI.Texture.from(tm.image);
                let onTextureLoadComplete: Function = () => {
                    texturesLoaded++;

                    (shape as PIXI.Sprite).texture = t;

                    // extract pixels (call it immediately after texture assignment, because of an issue https://github.com/pixijs/pixi.js/issues/6054)
                    let arr: Uint8Array = this.renderer.extract.pixels(shape);
                    if (arr) {
                        // rgba array (its size is texture.width*texture.height*4)
                        let pixels: Uint8Array = (c as DesignShape).alphaChannelPixels;
                        if (!pixels) {
                            pixels = (c as DesignShape).alphaChannelPixels = new Uint8Array(arr.length / 4);
                        }
                        let k: number = 0;
                        // since we don't really use intermediate alpha values but only 0 and > 0 for hit detection
                        // mark the pixels by converting alpha values > 0 to alpha 128 for lightImage and to 255 for others (darkImage, additionalLayer)
                        // so we know which area was clicked
                        let nonZeroValueMark: number = url === m.darkImage ? 255 : url === m.lightImage ? 127 : 63;
                        for (let i: number = 0; i < arr.length; i += 4) {
                            let alpha: number = arr[i + 3]; // 0 - 255
                            let currentValue: number = pixels[k];
                            // mark pixels
                            pixels[k] = alpha > 0 ? nonZeroValueMark : isNaN(currentValue) ? 0 : currentValue;
                            k++;
                        }
                    }

                    (shape as PIXI.Sprite).anchor.set(0.5);
                    shape.width = sw;
                    shape.height = sh;

                    // remember data for redraw()
                    shapes[index] = shape;
                    textures[index] = texture;
                    //paths[index] = path;
                    initialScales[index] = { x: shape.scale.x, y: shape.scale.y };

                    if (areas && (tm.image === m.darkImage || tm.image === m.lightImage)) {
                        let areaIndex0: number = tm.image === m.darkImage ? 0 : 2;
                        // cause R channel used for masking turn a texture to a white texture
                        let tmpSprite: PIXI.Sprite = PIXI.Sprite.from(tm.image);
                        tmpSprite.width = sw;
                        tmpSprite.height = sh;
                        tmpSprite.filters = [this.filterWhite];
                        // add to a temporary container to resize the final texture
                        let tmpContainer: PIXI.Container = new PIXI.Container();
                        tmpContainer.addChild(tmpSprite);
                        let whiteTexture: PIXI.Texture = this.renderer.generateTexture(tmpContainer, PIXI.SCALE_MODES.LINEAR, 1);

                        (areas[areaIndex0] as PIXI.Sprite).anchor.set(0.5);
                        (areas[areaIndex0] as PIXI.Sprite).texture = whiteTexture;

                        // add some extra space at the bottom for the second area (used when no base under the design shape)
                        let extraShape: SuperGraphics = new SuperGraphics();
                        let esw: number = MeasurementService.inchToPx(this.extraAreaShapeSizeInch);
                        let esh: number = esw;
                        extraShape.beginFill(0xffccff, 1.0).drawRect(0, 0, esw, esh).endFill();
                        extraShape.y = sh;
                        // align objects,
                        // negative x may not work out
                        if (sw > esw) {
                            extraShape.x = 0.5 * (sw - esw);
                        } else {
                            tmpSprite.x = 0.5 * (esw - sw);
                        }

                        tmpContainer.addChild(extraShape);
                        whiteTexture = this.renderer.generateTexture(tmpContainer, PIXI.SCALE_MODES.LINEAR, 1);

                        (areas[areaIndex0 + 1] as PIXI.Sprite).anchor.set(0.5, (0.5 * sh) / (sh + esh));
                        (areas[areaIndex0 + 1] as PIXI.Sprite).texture = whiteTexture;
                    }

                    if (texturesLoaded >= texturesToLoad) {
                        m.coreWidth = Math.abs(MeasurementService.pxToUnit(Math.abs(sw * tm.scaleX)));
                        m.coreHeight = Math.abs(MeasurementService.pxToUnit(Math.abs(sh * tm.scaleY)));

                        setupCase();
                    }
                };

                if (!t.baseTexture.valid) {
                    t.once('update', onTextureLoadComplete);
                } else {
                    onTextureLoadComplete();
                }
            } else {
                // traditional shape, marker
                shape = new SuperGraphics();
                (shape as SuperGraphics).beginTextureFill({ texture, color: 0xffffff, alpha: 1.0, matrix });
                path = this.as.paths[tm.shape];
                (shape as SuperGraphics).decodePath(path).endFill();

                sw = shape.width;
                sh = shape.height;

                // the first (central) shape is used for measurement
                if (index === 0) {
                    m.coreWidth = Math.abs(MeasurementService.pxToUnit(Math.abs(sw * tm.scaleX)));
                    m.coreHeight = Math.abs(MeasurementService.pxToUnit(Math.abs(sh * tm.scaleY)));
                }

                if (tm.place) {
                    let isFrontFace: boolean = !this.isLightened(tm) || tm.shape === 'rect';
                    let w: number = sw * (tm.scaleX > 0 ? 1 : -1);
                    let h: number = sh * (tm.scaleY > 0 ? 1 : -1);
                    let fixedSize: number;
                    if (tm.place.indexOf('t') >= 0) {
                        shape.pivot.y = h / 2;
                        fixedSize = MeasurementService.pxToUnit(Math.abs(sh * tm.scaleY));
                        if (fixedSize > min['t'] && isFrontFace) {
                            min['t'] = fixedSize;
                        }
                    } else {
                        if (tm.place.indexOf('b') >= 0) {
                            shape.pivot.y = -h / 2;
                            fixedSize = MeasurementService.pxToUnit(Math.abs(sh * tm.scaleY));
                            if (fixedSize > min['b'] && isFrontFace) {
                                min['b'] = fixedSize;
                            }
                        }
                    }

                    if (tm.place.indexOf('l') >= 0) {
                        shape.pivot.x = w / 2;
                        fixedSize = MeasurementService.pxToUnit(Math.abs(sw * tm.scaleX));
                        if (fixedSize > min['l'] && isFrontFace) {
                            min['l'] = fixedSize;
                        }
                    } else {
                        if (tm.place.indexOf('r') >= 0) {
                            shape.pivot.x = -w / 2;
                            fixedSize = MeasurementService.pxToUnit(Math.abs(sw * tm.scaleX));
                            if (fixedSize > min['r'] && isFrontFace) {
                                min['r'] = fixedSize;
                            }
                        }
                    }
                }

                // TODO: need to remove/or improve pivot support in ShapeModel
                if (tm.pivotX) {
                    shape.pivot.x += tm.pivotX * (tm.scaleX > 0 ? 1 : -1) * templateModels[0].scaleX;
                }
                if (tm.pivotY) {
                    shape.pivot.y += tm.pivotY * (tm.scaleY > 0 ? 1 : -1) * templateModels[0].scaleY;
                }

                shape.x = tm.x * templateModels[0].scaleX;
                shape.y = tm.y * templateModels[0].scaleY;

                // only for SuperGraphics, cause for Sprite scale depends on width/height which are set after the texture has been loaded
                shape.scale.x = tm.scaleX;
                shape.scale.y = tm.scaleY;

                // sub shapes also have their own models
                (shape as DesignSubShape).model = tm;
                // remember data for redraw()
                shapes.push(shape);
                textures.push(texture);
                paths.push(path);
                initialScales.push({ x: shape.scale.x, y: shape.scale.y });

                if (areas && !this.isLightened(tm)) {
                    areas.forEach((a) => {
                        let areaShape: SuperGraphics = new SuperGraphics();

                        areaShape.beginFill(0xccffff, 1.0);
                        areaShape.decodePath(path).endFill();
                        areaShape.x = shape.x;
                        areaShape.y = shape.y;
                        areaShape.pivot.x = shape.pivot.x;
                        areaShape.pivot.y = shape.pivot.y;
                        areaShape.scale.x = shape.scale.x;
                        areaShape.scale.y = shape.scale.y;

                        (a as PIXI.Container).addChild(areaShape);
                    });
                }
            }
        });

        if (!isCustomShape) {
            if (areas) {
                // add some extra space at the bottom for the second area (used when no base under the design shape)
                let extraShape: SuperGraphics = new SuperGraphics();
                let esw: number = MeasurementService.inchToPx(this.extraAreaShapeSizeInch);
                let esh: number = esw;
                extraShape
                    .beginFill(0xffcccc, 1.0)
                    .drawRect(-esw / 2, 0, esw, esh)
                    .endFill();
                extraShape.y = 500 * templateModels[0].scaleY * MeasurementService.SCALE;
                (areas[1] as PIXI.Container).addChild(extraShape);
            }

            setupCase();
        }

        return ds;
    }

    isLightened(m: ShapeModel) {
        return m.pitch || m.frost || m.gradient;
    }

    private updateShapeModel(item: DesignShape, m: ShapeModel, flag: string) {
        if (isNaN(m.coreWidth) || isNaN(m.coreHeight)) {
            // TODO: find out why sometime coreWidth and coreHeight aren't set (custom shapes)
            console.warn('core size is NaN for', m.shape);
            return;
        }
        m.x = MeasurementService.pxToUnit(item.x);
        m.y = MeasurementService.pxToUnit(item.y);

        m.width = m.coreWidth * item.scale.x + m.minWidth;
        m.height = m.coreHeight * item.scale.y + m.minHeight;

        m.scaleX = item.scale.x * ((item as Case).flippedH ? -1 : 1);
        m.scaleY = item.scale.y;
        m.rotation = item.rotation;
    }

    updateShapeFilters(ds: DesignShape) {
        let m: ShapeModel = ds.model;
        ds.objs.forEach((shape, index) => {
            let tm: ShapeModel = (shape as DesignSubShape).model;
            let fillSrc: string = null;
            if (tm.image) {
                if (!tm.imageIsStatic) {
                    let hlFilter: HardLightFilter;
                    let bucketFilter: FillFilter;
                    if (shape.filters) {
                        hlFilter = shape.filters.find((element) => element instanceof HardLightFilter) as HardLightFilter;
                        bucketFilter = shape.filters.find((element) => element instanceof FillFilter) as FillFilter;
                    }
                    if (!hlFilter) {
                        hlFilter = new HardLightFilter();
                        shape.filters = [hlFilter];
                    }

                    let bitmapFillID: string = this.getBitmapFill(tm).id;
                    let fillSrc: string = this.as.bitmapFills[bitmapFillID].url;
                    let colorSrc: string = this.as.bitmapFills[tm.color + 'p'].url;

                    hlFilter.baseMap = PIXI.Texture.from(tm.roughRock ? colorSrc : fillSrc);
                    hlFilter.textureScale = this.container.scale.x * MeasurementService.SCALE;

                    if (tm.roughRock) {
                        if (!bucketFilter) {
                            bucketFilter = new FillFilter();

                            shape.filters.unshift(bucketFilter);
                        }

                        bucketFilter.textureScale = this.container.scale.x * MeasurementService.SCALE;
                        bucketFilter.fillTexture = PIXI.Texture.from(fillSrc);
                    }

                    shape.alpha = 1; //tm.roughRock ? 0.55 : 1;
                    shape.filters = tm.roughRock ? [bucketFilter, hlFilter] : [hlFilter];
                }
            } else {
                if (!shape.filters) {
                    shape.filters = [];
                }
                if (tm.roughRock) {
                    let tmPrev: ShapeModel = (ds.objs[index - 1] as DesignSubShape).model;

                    let hlFilter: HardLightFilter;
                    if (shape.filters) {
                        hlFilter = shape.filters.find((element) => element instanceof HardLightFilter) as HardLightFilter;
                    }
                    if (!hlFilter) {
                        hlFilter = new HardLightFilter();
                        shape.filters = [hlFilter];
                    }

                    let ignorePrevEffects: boolean = false;
                    if (ignorePrevEffects) {
                        tmPrev = _.cloneDeep(tmPrev);
                        tm.color = m.color;
                    }

                    let bitmapFillID: string = this.getBitmapFill(tmPrev).id;
                    fillSrc = this.as.bitmapFills[bitmapFillID].url;
                    hlFilter.baseMap = PIXI.Texture.from(fillSrc);
                    hlFilter.textureScale = this.container.scale.x * MeasurementService.SCALE;

                    shape.alpha = 1; //ignorePrevEffects ? 0.5 : 0.55;
                    shape.filters = [hlFilter];
                }
                if (tm.gradient) {
                    let grFilter: GradientLightingFilter;
                    if (shape.filters) {
                        grFilter = shape.filters.find((element) => element instanceof GradientLightingFilter) as GradientLightingFilter;
                    }
                    if (!grFilter) {
                        grFilter = new GradientLightingFilter();
                        // set basic uniforms
                        if (tm.gradientOptions) {
                            for (let prop in tm.gradientOptions) {
                                grFilter.uniforms[prop] = tm.gradientOptions[prop];
                            }
                        }

                        shape.filters.push(grFilter);
                    }

                    // set extra uniforms
                    if (!fillSrc) {
                        let bitmapFillID: string = this.getBitmapFill(tm).id;
                        fillSrc = this.as.bitmapFills[bitmapFillID].url;
                    }
                    let pd: PixelData = this.as.getPixelData(fillSrc);
                    if (pd) {
                        grFilter.uniforms.avgBrightness = pd.avgBrightness;
                    } else {
                        if (this.config.testMode.indexOf('color') >= 0) {
                            console.warn('no pixel data for:', fillSrc);
                        }
                    }

                    // correct positions (scaling), cause texture is converted to a power of 2 texture
                    // TODO: improve scale calculation if gradient is scaled wrong on edge values (127.66, 255.42, 512.4333 etc)
                    // TODO: important - scale can be found as inputSize.xy/outputFrame.zw in fragment shader
                    let h: number = Math.ceil(Math.abs((shape.height / shape.scale.y) * shape.transform.worldTransform.d)); // visible height e.g. 480px on your screen
                    let hPow2: number = Math.pow(2, Math.ceil(Math.log2(h))); // 480 -> 512
                    let sc: number = h / hPow2;
                    for (let i = 0; i < 4; i++) {
                        let prop: string = 'c' + i + 'pos';
                        grFilter.uniforms[prop] = tm.gradientOptions[prop] * sc;
                    }
                }
            }
        });
    }
    // used to draw outlines
    async getPolygons(ds: DesignShape, container: PIXI.Container) {
        let polygons: polyClip.Polygon[] = [];
        for (let shape of ds.objs) {
            let tm: ShapeModel = (shape as DesignSubShape).model;
            if (tm.image) {
                let imagePolygons: polyClip.Polygon[] = await this.getImagePolygons(tm.image);

                if (imagePolygons && imagePolygons.length > 0) {
                    let sprite: PIXI.Sprite = shape as PIXI.Sprite;
                    let tx: number = -sprite.texture.width * sprite.anchor.x;
                    let ty: number = -sprite.texture.height * sprite.anchor.y;
                    imagePolygons = imagePolygons
                        .filter((elem) => elem && elem.length > 0)
                        .map((poly) =>
                            poly.map((ring) =>
                                ring
                                    .map((pair) => {
                                        return { x: pair[0] + tx, y: pair[1] + ty };
                                    })
                                    .map((elem) => container.toLocal(shape.toGlobal(elem)))
                                    .map((elem) => [elem.x, elem.y])
                            )
                        );
                    polygons = polygons.concat(imagePolygons);
                }
            } else {
                let ring: polyClip.Ring = (shape as SuperGraphics).geometry['points']
                    .map((elem, index, array) => {
                        return index % 2 === 0 ? { x: elem, y: array[index + 1] } : null;
                    })
                    .filter((elem) => elem)
                    .map((elem) => container.toLocal(shape.toGlobal(elem)))
                    .map((elem) => [elem.x, elem.y]);

                if (ring && ring.length > 0) {
                    // at the moment all the shapes have 1 polygon with 1 ring
                    polygons.push([ring]);
                }
            }
        }

        return polygons;
    }

    private async getImagePolygons(src: string) {
        return new Promise<polyClip.Polygon[]>((resolve) => {
            // get from cache
            if (this.polygonsLib[src]) {
                resolve(this.polygonsLib[src]);
                return;
            }

            let polygons: polyClip.Polygon[] = [];

            // to avoid concurrent loadings with PIXI's loader (can be omitted)
            if (!PIXI.utils.TextureCache[src]) {
                resolve(polygons);
                return;
            }

            // to avoid concurrent loading with Potrace, add something to the cache (can be omitted)
            this.polygonsLib[src] = polygons;

            // info about Potrace - http://potrace.sourceforge.net/potracelib.pdf
            // TODO: Potrace should return only outlines on a border between alpha 1.0 and alpha 0.0, but
            // currently it may return outlines between colors with alpha 1.0 both that's why we need big
            // turdSize value or/and union of the polygons below. Because of the union there will be no outline
            // for a hole in the monument (e.g. Custom Shapes -> Juvenille -> MV Rocking Horse 001)
            let trace: potrace.Potrace = new potrace.Potrace();
            trace.setParameters({
                turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
                turdSize: 100, // dispeckle, 0 - Infinity, default: 2
                alphaMax: 0, // smoothiness, useful range of this parameter is from 0.0 (polygon) to 1.3334 (no corners), default: 1.0
                optCurve: false,
                optTolerance: 0.2,
                threshold: 254,
                blackOnWhite: true,
                color: 'black',
                background: potrace.Potrace.COLOR_TRANSPARENT
            });

            trace.loadImage(src, (err) => {
                if (err) {
                    console.warn(err);
                    resolve(polygons);
                    return;
                }
                let strSVG = trace.getSVG();
                // add stroke
                strSVG = strSVG.replace('none', 'red');
                // remove fill
                //.replace('black', 'none');

                let elem: HTMLDivElement = document.createElement('div');
                elem.innerHTML = strSVG;
                let svg: SVGElement = elem.children.item(0) as SVGElement;
                let path: SVGGeometryElement | SVGPathElement = svg.children.item(0) as SVGGeometryElement;

                if (this.config.testMode.indexOf('svg') >= 0) {
                    document.body.appendChild(elem);
                }
                try {
                    let rings: polyClip.Ring[] = pathDataToPolys(path.getAttribute('d'), { tolerance: 1, decimals: 8 });
                    // unite rings
                    if (rings && rings.length > 0) {
                        // convert rings to 1-ring polygons (to perform union)
                        let oneRingPolygons: polyClip.Polygon[] = rings.map((elem) => [elem]);

                        polygons = polyClip.union(oneRingPolygons);
                    }
                } catch (err) {
                    console.warn(err);
                } finally {
                    // save to cache
                    if (this.polygonsLib[src] && this.polygonsLib[src].length > 0) {
                        console.warn('cache already contains', src);
                    }
                    this.polygonsLib[src] = polygons;

                    resolve(polygons);
                }
            });
        });
    }

    setShapeColor(ds?: DesignShape, color?: string) {
        if (!ds) {
            ds = this.selectedShape;
        }
        let m: ShapeModel = ds.model;
        m.color = color;
        ds.objs.forEach((shape) => {
            let tm: ShapeModel = (shape as DesignSubShape).model;
            if (tm) {
                tm.color = color;
            }
        });

        ds.redraw(true);
        this.updateShapeFilters(ds);
    }

    getDefaultPolish(m: ShapeModel) {
        let polishes: PolishItem[] = this.getAvailablePolishes(m);

        return !ShapeService.isBaseShape(m) &&
            polishes[0].id !== ShapeService.POLISH_POL_FACE.id &&
            polishes.indexOf(ShapeService.POLISH_P5) >= 0
            ? ShapeService.POLISH_P5
            : polishes[0];
    }

    getAvailablePolishes(dsOrModel?: DesignShape | ShapeModel) {
        if (!dsOrModel && !this.selectedShape) {
            return [];
        }

        let m: ShapeModel = dsOrModel
            ? (dsOrModel as DesignShape).model
                ? (dsOrModel as DesignShape).model
                : (dsOrModel as ShapeModel)
            : this.selectedShape.model;

        if (ShapeService.isBaseShape(m)) {
            return ShapeService.POLISHES_BASE.concat();
        }

        if (m.shapeType === ShapeService.SHAPE_TYPE_MARKER) {
            if (m.shape === ShapeService.FLAT_ID || m.shape === ShapeService.BEVEL_ID) {
                // Flat Marker or Bevel Marker
                return [ShapeService.POLISH_PFT];
            } else {
                return ShapeService.POLISHES_SLANT.concat();
            }
        }

        return ShapeService.POLISHES_DEFAULT.concat();
    }

    setShapePolish(ds?: DesignShape, polish?: string) {
        if (!ds) {
            ds = this.selectedShape;
        }
        let newModel: ShapeModel = _.cloneDeep(ds.model);
        newModel.polish = polish;
        // a quick fix of MGN negative scale bug (TODO: need to set min shape width and height)
        if (polish === ShapeService.POLISH_MGN.id) {
            if (newModel.height < 2) {
                newModel.height = 2;
            }
        }

        let newDs: DesignShape = this.createShape(newModel);
        // replace the old shape by the new one
        if (this.selectedShape === ds) {
            this.selectedShape = newDs;
        }
        let parent: PIXI.Container = ds.parent;
        if (parent) {
            let i: number = ds.parent.children.indexOf(ds);
            parent.removeChildAt(i);
            parent.addChildAt(newDs, i);
        }

        return newDs;
    }

    viewedFromTop(modelOrShapeID: ShapeModel | string) {
        let shapeID: string = typeof modelOrShapeID === 'string' ? modelOrShapeID : (modelOrShapeID as ShapeModel).shape;
        if (shapeID === ShapeService.FLAT_ID || shapeID === ShapeService.BEVEL_ID || shapeID === 'baseTV') {
            // Flat Marker or Bevel Marker
            return true;
        } else {
            return false;
        }
    }

    baseAllowed(m: ShapeModel) {
        if (m.shape === ShapeService.FLAT_ID) {
            // Flat Marker
            return false;
        } else {
            return true;
        }
    }

    subBaseAllowed(m: ShapeModel) {
        if (m.shape === ShapeService.FLAT_ID || m.shape === ShapeService.BEVEL_ID) {
            // Flat Marker or Bevel Marker
            return false;
        } else {
            return true;
        }
    }

    getTabletAlias(m: ShapeModel) {
        let alias: string;
        switch (this.getDetailedType(m, false)) {
            case ShapeService.SHAPE_TYPE_FLAT_MARKER:
            case ShapeService.SHAPE_TYPE_BEVEL_MARKER:
                alias = 'Marker';
                break;
            case ShapeService.SHAPE_TYPE_SLANT_MARKER:
                alias = 'Slant';
                break;
            default:
                alias = 'Tablet';
        }

        return alias;
    }

    getTypeFromDetailedType(detailedType: string) {
        if (ShapeService.SHAPE_MARKER_DETAILED_TYPES.indexOf(detailedType) >= 0) {
            return ShapeService.SHAPE_TYPE_MARKER;
        }

        if (ShapeService.SHAPE_BASE_DETAILED_TYPES.indexOf(detailedType) >= 0) {
            return ShapeService.SHAPE_TYPE_BASE;
        }

        return detailedType;
    }

    getDetailedType(m: ShapeModel, isBase: boolean) {
        if (isBase) {
            if (m.shape === ShapeService.FLAT_ID) {
                return ShapeService.SHAPE_TYPE_BASE_NONE;
            }

            if (m.shape === ShapeService.BEVEL_ID || m.shape === 'baseTV') {
                return ShapeService.SHAPE_TYPE_BASE_BEVEL_MARKER;
            }

            return ShapeService.SHAPE_TYPE_BASE_COMMON;
        }

        if (m.shape === ShapeService.FLAT_ID) {
            return ShapeService.SHAPE_TYPE_FLAT_MARKER;
        }

        if (m.shape === ShapeService.BEVEL_ID) {
            return ShapeService.SHAPE_TYPE_BEVEL_MARKER;
        }

        let idNum: number = parseInt(m.shape);
        if (idNum >= 19 && idNum <= 24) {
            return ShapeService.SHAPE_TYPE_SLANT_MARKER;
        }

        if (ShapeService.isCustomShape(m)) {
            return ShapeService.SHAPE_TYPE_CUSTOM;
        }

        return ShapeService.SHAPE_TYPE_TRADITIONAL;
    }

    getBitmapFill(tm: ShapeModel): BitmapFillItem {
        let bf: BitmapFillItem;

        if (tm.roughRock) {
            bf = this.as.bitmapFills['roughRock'];
        } else {
            let id: string = tm.color;
            // 'remove effects' from the fill
            id.replace(/a-z/i, '');

            // get a fill with an effect (if specified in the model)
            if (tm.pitch) {
                id += 'p';
            } else {
                if (tm.frost) {
                    id += 's';
                }
            }
            bf = this.as.bitmapFills[id];
        }

        return bf;
    }

    setShapeWidth(ds: DesignShape, valueUnit: number) {
        let m: ShapeModel = ds.model;
        ds.scale.x = (valueUnit - m.minWidth) / m.coreWidth;
        ds.redraw();
        ds.updateModel('movement');
    }

    setShapeHeight(ds: DesignShape, valueUnit: number) {
        let m: ShapeModel = ds.model;
        ds.scale.y = (valueUnit - m.minHeight) / m.coreHeight;
        ds.redraw();
        ds.updateModel('movement');
    }

    getShapeWeight(ds?: DesignShape) {
        if (!ds) {
            ds = this.selectedShape;
        }
        let cubicFeet: number = (ds.model.width * ds.model.depth * ds.model.height) / 1728;
        let poundsPerCubicFoot: number = 200;
        return cubicFeet * poundsPerCubicFoot;
    }

    getFiles(
        searchContext: TreeNode | string,
        noCache: boolean = false,
        types: string[] = [ShapeService.SHAPE_TYPE_TRADITIONAL],
        page: number = NaN,
        itemsPerPage: number = NaN
    ): Promise<void | DesignData[] | NodeServicePageFilesResponse> {
        let test: boolean = this.config.testMode.includes('shapes');
        let pagination: boolean = !isNaN(page) && !isNaN(itemsPerPage);

        let spStr: string = '';
        let sp: URLSearchParams = new URLSearchParams();
        if (typeof searchContext === 'string') {
            searchContext = searchContext.trim();

            sp.append('keyword', searchContext);
        }

        if (pagination) {
            sp.append('page', String(page));
        }

        if (!searchContext) {
            return Promise.reject('Invalid search query');
        }

        if (noCache) {
            sp.append('random', String(Math.random() * 10000));
        }
        spStr = sp.toString();
        let suffix: string = spStr ? '?' + spStr : '';

        let urls: string[] = [];
        let baseUrl: string = this.config.apiURL + 'shapes/';

        if (test) {
            if (typeof searchContext === 'string') {
                urls.push(this.config.assetsURL + 'test/shapes_search_page' + (pagination ? page : 's') + '.json');
            } else {
                urls.push(this.config.assetsURL + 'test/shapes_page' + (pagination ? page : 's') + '.json');
            }
        } else {
            if (typeof searchContext === 'string') {
                urls.push(baseUrl + 'search' + suffix);
            } else {
                let categories: DesignDataCategory[] = DataUtils.findAllInTree([searchContext], this.childrenPropName, (element) => {
                    return !element.children;
                }).map((element) => element.data);

                categories.forEach((category) => {
                    let url: string = baseUrl + category.catID + '/' + suffix;
                    urls.push(url);
                });
            }
        }
        // searching allowed for custom shapes only
        let type: string = typeof searchContext === 'string' ? ShapeService.SHAPE_TYPE_CUSTOM : types[0]; // types length always equals 1 for shapes except when searching

        if (type == ShapeService.SHAPE_TYPE_TRADITIONAL) {
            // hardcoded data
            let arr: DesignData[] = [];
            let titles: string[] = ['Serp', 'Exaggerated Serp', 'Straight', 'Oval', 'Half Serp Right', 'Half Serp Left'];
            let thumbs: string[] = ['serp', 'ex_serp', 'straight', 'oval', 'half_serp_right', 'half_serp_left'];
            for (let i: number = 0; i < titles.length; i++) {
                let data: DesignData = ShapeService.createShapeData();
                data.type = type;
                data.nid = String(i + 1);
                data.title = titles[i];
                data.thumbnail = 'monuvision-assets/images/thumbnail/thumb_' + thumbs[i] + '.jpg';
                arr.push(data);
            }
            return Promise.resolve(arr);
        }

        if (type == ShapeService.SHAPE_TYPE_MARKER) {
            // hardcoded data
            let arr: DesignData[] = [];
            let titles: string[] = [
                'Flat Marker',
                'Bevel Marker',
                'Slant Straight',
                'Slant Serp',
                'Slant Oval',
                'Western Slant Straight',
                'Western Slant Serp',
                'Western Slant Oval'
            ];
            let thumbs: string[] = [
                'flat_marker',
                'bevel_marker',
                'slant_straight',
                'slant_serp',
                'slant_oval',
                'w_slant_straight',
                'w_slant_serp',
                'w_slant_oval'
            ];
            let size: number[][] = [
                [36, 12, 4],
                [24, 12, 6],
                [30, 18, 10],
                [30, 18, 10],
                [30, 18, 10],
                [30, 18, 10],
                [30, 18, 10],
                [30, 18, 10]
            ];
            for (let i: number = 0; i < titles.length; i++) {
                let data: DesignData = ShapeService.createShapeData();
                data.type = type;
                data.nid = String(i + 17);
                data.title = titles[i];
                data.thumbnail = 'monuvision-assets/images/thumbnail/thumb_' + thumbs[i] + '.jpg';
                data.width = size[i][0];
                data.height = size[i][1];
                data.depth = size[i][2];
                data.baseWidth = i === 1 ? 48 : 36;
                data.baseHeight = i === 1 ? 14 : 6;
                data.baseDepth = i === 1 ? 8 : 14;
                //data.baseDepth = 0; // don't create base
                arr.push(data);
            }
            return Promise.resolve(arr);
        }

        if (urls.length > 1 && pagination) {
            return Promise.reject("Pagination can't be provided for multiple requests.");
        }

        // remote data
        let promises: Promise<any>[] = [];

        urls.forEach((url) => {
            promises.push(this.http.get<any>(url, { responseType: 'json' }).toPromise());
        });

        return Promise.all(promises).then((results) => {
            let arr: DesignData[] = [];
            let total: number = 0;
            let responseHasPagination: boolean = false;

            results.forEach((res) => {
                if (res) {
                    total = Number(res.total);
                    responseHasPagination = total >= 0;
                    // correct result
                    let prop: string = 'shapes';
                    if (res.hasOwnProperty(prop)) {
                        res = res[prop];
                    }
                    let resArr: any[] = res instanceof Array ? res : [res];
                    // TODO: not sure why it needs to be reversed
                    // so remove it if needed
                    resArr.reverse();

                    resArr.forEach((element) => {
                        arr.push(this.parseFileResponse(element, type));
                    });
                }
            });

            if (pagination && responseHasPagination) {
                return { total, page, value: arr };
            }

            return arr;
        });
    }

    // used for Custom Shapes only at the moment
    protected parseFileResponse(element: any, type: string) {
        let image: DesignData = ShapeService.createShapeData();
        // TODO: probably rename old properties (nid -> id, title -> name)
        image.type = type;
        image.nid = String(element.id);
        image.title = element.name;
        image.thumbnail = element.thumbnail;
        image.width = element.width;
        image.height = element.height;
        image.depth = element.depth;
        image.baseWidth = element.base_width;
        image.baseHeight = element.base_height;
        image.baseDepth = element.base_depth;
        image.darkStone = element.dark_stone;
        image.lightStone = element.light_stone;
        image.additionalLayer = element.additional_layer;
        image.additionalLayerStaticImage = element.keep_static ? 'on' : 'off';
        image.pattern = element.pattern;
        image.lockDimensions = element.locked_dimensions || element.lock_dimensions ? 'on' : 'off';

        if (!image.thumbnail) {
            console.warn('no thumbnail for shape, type:', type, ', id:', image.nid);
            image.thumbnail = 'monuvision-assets/images/no_image.jpg';
        }

        return image;
    }

    getCategoriesTree(noCache: boolean = false, shapeTypes: string[] = ShapeService.SHAPE_TYPES): Promise<TreeNode[]> {
        for (let type of shapeTypes) {
            let empty: boolean = this.categoryTrees[type] ? this.categoryTrees[type].length === 0 : true;
            if (empty) {
                noCache = true;

                break;
            }
        }

        if (noCache) {
            return this.getCategories(noCache, shapeTypes).then((categories) => {
                let tree: TreeNode[] = [];

                Object.keys(categories).forEach((type) => {
                    this.categoryTrees[type] = [];

                    categories[type].forEach((c) => {
                        this.createCategoryTreeNode(this.categoryTrees[type], c);
                    });

                    // delete temporary root parent nodes that was created by their children, but do not present in the xml
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

            for (let type of shapeTypes) {
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

        node.label = c.name.replace('&amp;', '&');
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
        shapeTypes: string[] = ShapeService.SHAPE_TYPES
    ): Promise<{ [type: string]: DesignDataCategory[] }> {
        let suffix: string = noCache ? '?random=' + Math.random() * 10000 : '';
        let promises: Promise<any>[] = [];
        // flat structure
        let categories: { [type: string]: DesignDataCategory[] } = {};

        shapeTypes.forEach((type) => {
            if (type === ShapeService.SHAPE_TYPE_TRADITIONAL || type === ShapeService.SHAPE_TYPE_MARKER) {
                promises.push(Promise.resolve(null));
            } else {
                // custom shapes
                promises.push(this.http.get<any>(this.config.apiURL + 'categories/shape' + suffix).toPromise());
            }
        });

        return Promise.all(promises).then((results) => {
            results.forEach((res, index) => {
                let type: string = shapeTypes[index];

                if (!categories[type]) {
                    categories[type] = [];
                }

                if (res) {
                    let resArr: any[] = res instanceof Array ? res : [res];
                    categories[type] = resArr.map((element) => {
                        let c: DesignDataCategory = {
                            name: element.name,
                            type: type,
                            catID: String(element.id),
                            parentID: StrUtils.numberToString(element.parent_id),
                            sortVal: element.sort ? parseInt(element.sort) : 0,
                            description: element.description,
                            private: Boolean(
                                String(element.private)
                                    .trim()
                                    .toLowerCase()
                                    .match(/^(1|on|true|yes)$/)
                            )
                        };

                        if (!c.parentID || c.parentID === '0') {
                            c.parentID = type + 'Root';
                        }

                        return c;
                    });
                }

                // add very root (wrapping parent) category
                let veryRootCategory: DesignDataCategory = {
                    name: this.getCategoryName(type),
                    type: type,
                    catID: type + 'Root',
                    parentID: null,
                    sortVal: NaN,
                    description: null
                };

                categories[type].push(veryRootCategory);
            });

            return categories;
        });
    }

    private getCategoryName(shapeType: string) {
        return ['Traditional', 'Custom', 'Marker'][ShapeService.SHAPE_TYPES.indexOf(shapeType)];
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

    getFile(id: string, type: string = ShapeService.SHAPE_TYPE_CUSTOM) {
        let url: string = this.config.apiURL + 'shape/' + id;
        return this.http
            .get<any>(url)
            .toPromise()
            .then((res) => this.parseFileResponse(res, type));
    }
}

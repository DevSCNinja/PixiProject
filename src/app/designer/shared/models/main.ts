import * as PIXI from 'pixi.js';
import { MultiCase } from '../../pixi/multi-case';
import { TextInput } from '../../pixi/text-input';
import { Ruler } from '../../pixi/ruler';
import { SuperGraphics } from '../../pixi/super-graphics';
import { TreeNode } from 'primeng/api';

interface Asset {
    url: string; // id
    name?: string; // name that will be used to name a layer
    type?: string; // type for faster accessing (usually for default assets)
    value?: any; // generated visual object, associated with this asset
    format?: string; // .png, .hdr etc.
    thumbnail?: string; // url or base64 string
    tags?: string[]; // for searching
    isDefault?: boolean; // not added by a user
    date?: string; // format YYYY/MM/DD
}

// category or subcategory
interface DesignDataCategory {
    name: string;
    type: string;
    catID: string;
    parentID?: string;
    sortVal?: number;
    description?: string;
    private?: boolean;
}

interface DesignDataColor {
    name: string;
    type: string;
    id: string;
    darkImage: string;
    lightImage: string;
    pitchingImage: string;
    thumbnail: string;
    sortVal?: number;
}
// a very common template (aka 'file', 'image', 'data') used to generate a scene, art, shape (or few shapes (tablet + base)) and other
// TODO: replace it by ArtModel, ShapeModel etc. and probably completely remove (or only use it in the library component)
interface DesignData {
    type: string;
    thumbnail: string;
    data?: any;
    style?: string;
    nid?: string;
    title?: string;
    image?: string;
    leftBorder?: number;
    bottomBorder?: number;
    rightBorder?: number;
    topBorder?: number;
    minimumHeight?: number;
    minimumWidth?: number;
    etching?: string;
    lockDimensions?: string;
    width?: number;
    height?: number;
    depth?: number;
    darkStone?: string;
    lightStone?: string;
    additionalLayer?: string;
    pattern?: string;
    priceType?: string;
    baseDepth?: number;
    baseWidth?: number;
    baseHeight?: number;
    additionalLayerStaticImage?: string;
    lockedDimensions?: string;
    fullImage?: string;
    monumentX?: number;
    monumentY?: number;
    pixelsPerFoot?: number;
    id?: string;
    name?: string;
    deleteEnabled?: boolean;
    showGrass?: boolean;
    unit?: string; // not used at the moment (suppose it's always 'inch')
    model?: SceneModel | SceneItemModel; // can contain whole model, so again consider removing DesignData interface
}

interface ShaderAsset {
    name: string;
    frag: string;
}

interface PixelData {
    id: string;
    maxBrightness?: number;
    minBrightness?: number;
    avgBrightness?: number;
}

interface BitmapFillItem {
    url: string;
    id: string;
    name: string;
    thumbnail?: string; // url or base64 string
    sortVal?: number;
    brightness?: number;
}

interface ColorItem {
    id: string;
    name: string;
    hex: number;
    alpha?: number;
    shadowHex?: number;
    shadowAlpha?: number;
    getRT?: () => PIXI.RenderTexture;
    brightness?: number;
}

interface FontItem {
    url: string;
    id: number;
    format?: string; // e.g. woff
    fontFamily?: string; // e.g. Arial-CNVS123
    fontFamilyAlias?: string; // e.g. Arial
    capHeight?: number;
    baseline?: number;
    xHeight?: number;
    descent?: number;
    bottom?: number;
    ascent?: number;
    tittle?: number;
    top?: number;
    fontWeight?: string | number;
    fontSize?: string | number;
    scale?: number;
    lineScale?: number;
    dropdownScale?: number;
    sizes?: { label: string; value: number }[];
    useCaps?: boolean;
    sandedCenter?: boolean;
    sortVal?: number;
    hidden?: boolean;
    originalFontItem?: FontItem;
    blob?: boolean;
}

interface PolishItem {
    id: string;
    name: string;
}

interface Anchor {
    target: DesignItem;
    dx: number;
    dy: number;
}
interface Area extends PIXI.DisplayObject {
    objectsAffected?: any[];
    owner?: DesignItem;
}

interface Case {
    redraw: Function;
    flipH: Function;
    flipV: Function;
    flippedH: boolean;
    flippedV: boolean;
}
interface DesignItem extends PIXI.Container {
    model: SceneItemModel;
    updateModel: Function;
    anchorObject?: Anchor;
    anchoredItems?: DesignItem[];
}

interface DesignArt extends MultiCase {
    model: ArtModel;
    updateModel: Function;
}

interface DesignShape extends MultiCase {
    model: ShapeModel;
    updateModel: Function;
    areas?: Area[]; // masks for art (usual and extended (with no bottom))
    alphaChannelPixels?: Uint8Array;
}

interface DesignSubShape extends SuperGraphics {
    model: ShapeModel;
}

interface DesignText extends TextInput {
    model: TextModel;
    updateModel: Function;
}

interface DesignBackground extends PIXI.Sprite {
    model: BackgroundModel;
    updateModel: Function;
    bgTexture: PIXI.Texture;
}

interface DesignRuler extends Ruler {
    model: RulerModel;
    updateModel: Function;
}

interface DesignGrid extends PIXI.TilingSprite {
    model: GridModel;
    updateModel: Function;
}
interface Scene extends PIXI.Container {
    model: SceneModel;
    updateModel: Function;
}
// global model containing the whole scene
interface SceneModel {
    // ruler and grid models are not saved at the moment, but it can be easy added if needed
    items: (SceneItemModel | ArtModel | TextModel | ShapeModel | BackgroundModel | RulerModel | GridModel)[];
    id?: string;
    image?: string;
    thumbnail?: string;
    appVersion?: string;
    hash?: string;
    name?: string;
    date?: string; // ISO 8601 format
    unit?: string; // 'px', 'inch' etc.
    pxPerUnit?: { [type: string]: number }; // may help to convert 'px' unit to real world units like 'inch' on the back-end
}

// base interface
interface SceneItemModel {
    type: string;
    id?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    pivotX?: number;
    pivotY?: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    unit?: string; // not used at the moment (suppose it's always 'inch')
}

interface ArtModel extends SceneItemModel {
    artType: string;
    compID: string;
    name: string;
    imageFile: string;
    thumbnailFile?: string;
    inverted: boolean;
    drawSimple: boolean;
    etching: string;
    frostingVisible: boolean;
    sinkage: string;
    flipped: boolean; // TODO: deprecate this property, use just negative scaleX
    leftBorder?: number;
    bottomBorder?: number;
    rightBorder?: number;
    topBorder?: number;
    minWidth: number;
    minHeight: number;
    textureWidth?: number;
    textureHeight?: number;
    lockDimensions: boolean;
    lowerBitmapFill: string;
    inchWidth?: number;
    inchHeight?: number;
    color?: string;
    priceType?: string;
    // temp vars (make sure you delete them before saving the model)
    tmpAdjustScale?: boolean;
}

interface TextModel extends SceneItemModel {
    string: string;
    font: string;
    size: string;
    lineSpacing: string;
    spacing: number;
    bold: boolean;
    vCut: boolean;
    polish: boolean;
    frost: boolean;
    outline: boolean;
    justify: number;
    shapeEnabled: boolean;
    shapeAdjust: number;
    sinkage: string;
    lowerBitmapFill: string;
    numLetters?: number;
}

interface ShapeModel extends SceneItemModel {
    shape: string; // id
    shapeType?: string;
    name?: string;
    color?: string; // id
    depth?: number;
    polish?: string;
    place?: string; // mandatory for sub shapes
    pitch?: boolean;
    frost?: boolean;
    roughRock?: boolean;
    minWidth?: number;
    minHeight?: number;
    coreWidth?: number;
    coreHeight?: number;
    patternCharge?: number;
    thumbnail?: string;
    image?: string;
    imageIsStatic?: boolean; // same as Keep Color
    lightImage?: string;
    darkImage?: string;
    additionalLayer?: string;
    additionalLayerStatic?: boolean;
    lockDimensions?: boolean;
    gradient?: boolean;
    gradientOptions?: any;
    lowerShapesInStack?: number; // used to detect sub shapes in a vertical stack (z-axis)
}

interface BackgroundModel extends SceneItemModel {
    id: string;
    // (monX, monY) - a point in bg sprite's coordinate system
    monX: number;
    monY: number;
    // describes zoom value
    pxPerFoot: number;
    imagePath: string;
    thumbnail?: string;
    name?: string;
    showGrass?: boolean;
}

interface RulerModel extends SceneItemModel {
    inch: boolean;
}

interface GridModel extends SceneItemModel {
    inch: boolean;
}

interface PriceModel {
    label?: string;
    value: number;
    wholesaleValue: number;
    materialNames: string[];
}
interface Order {
    name: string;
    email: string;
    family: string;
    tel: string;
    ship: string;
    message: string;
    priceRetail?: string;
    priceWholesale?: string;
    design?: SceneModel;
}

// old xml based model (used in the legacy Flash app)
interface LegacySceneModel {
    design?: {
        area?: {
            piece?: LegacyPieceModel;
        };
    };
    monument?: {
        tablet?: LegacyStoneModel | LegacyStoneModel[];
        base?: LegacyStoneModel | LegacyStoneModel[];
    };
    background?: string | LegacyBackgroundModel;
}

interface BasicLegacyModel {
    type?: string;
    subType?: string;
    sort?: number;
}

interface LegacyPieceModel extends BasicLegacyModel {
    $?: {
        type?: string;
    };
    compID?: string;
    x?: string;
    y?: string;
    sX?: string;
    sY?: string;
    r?: string;
    piece?: LegacyPieceModel | LegacyPieceModel[];
}

interface LegacyPieceArtModel extends LegacyPieceModel {
    inverted?: string;
    drawSimple?: string;
    etching?: string;
    frostingVisible?: string;
    sinkage?: string;
    flipped?: string;
    color?: string;
    resizeRect?: string;
    minWidth?: string;
    minHeight?: string;
    name?: string;
    imageFile?: string;
}
interface LegacyPieceTextModel extends LegacyPieceModel {
    string?: string;
    font?: string;
    size?: string;
    lineSpacing?: string;
    spacing?: string;
    bold?: string;
    polish?: string;
    frost?: string;
    outline?: string;
    justify?: string;
    shapeEnabled?: string;
    shapeAdjust?: string;
    sinkage?: string;
}
interface LegacyStoneModel extends BasicLegacyModel {
    shape?: string;
    id?: string;
    lightImage?: string;
    darkImage?: string;
    width?: string;
    height?: string;
    depth?: string;
    polish?: string;
    pattern?: string;
    flipped?: string;
    color?: string;
    hidden?: string;
    posX?: string;
    posY?: string; // added for convenience
}

interface LegacyBackgroundModel extends BasicLegacyModel {
    id?: string;
    monX?: string;
    monY?: string;
    pixPerFoot?: string;
    imagePath?: string;
}

interface NodeService {
    getFiles(
        searchContext: TreeNode | string,
        noCache: boolean,
        types: string[],
        page?: number,
        itemsPerPage?: number,
        categoryID?: string
    ): Promise<void | DesignData[] | NodeServicePageFilesResponse>;
    getCategoriesTree(noCache: boolean, types: string[]): Promise<TreeNode[]>;
    removeFile?(data: DesignData): Promise<any>;
    saveFile?(data: DesignData, name: string, id?: string, categoryID?: string): Promise<any>;
    getSameFileNameID?(name: string, categoryID: string): Promise<string>;
}
interface NodeServicePageFilesResponse {
    total: number;
    page: number;
    value: DesignData[];
}

interface DataEvent {
    type: string;
    data: any;
}

export {
    Asset,
    DesignDataCategory,
    DesignDataColor,
    DesignData,
    ShaderAsset,
    PixelData,
    BitmapFillItem,
    ColorItem,
    FontItem,
    PolishItem,
    Anchor,
    Area,
    Case,
    DesignItem,
    DesignArt,
    DesignText,
    DesignShape,
    DesignSubShape,
    DesignBackground,
    DesignRuler,
    DesignGrid,
    Scene,
    SceneModel,
    SceneItemModel,
    ArtModel,
    TextModel,
    ShapeModel,
    BackgroundModel,
    RulerModel,
    GridModel,
    PriceModel,
    Order,
    LegacySceneModel,
    LegacyPieceModel,
    LegacyPieceArtModel,
    LegacyPieceTextModel,
    LegacyStoneModel,
    LegacyBackgroundModel,
    NodeService,
    NodeServicePageFilesResponse,
    DataEvent
};

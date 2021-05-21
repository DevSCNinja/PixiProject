import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MessageService, TreeNode } from 'primeng/api';
import * as PIXI from 'pixi.js';
import * as _ from 'lodash';
import * as xml2js from 'xml2js';
import * as semver from 'semver';
import {
    DesignDataCategory,
    DesignData,
    NodeService,
    Scene,
    SceneModel,
    BackgroundModel,
    LegacySceneModel,
    LegacyPieceModel,
    LegacyStoneModel,
    LegacyBackgroundModel,
    ArtModel,
    LegacyPieceArtModel,
    LegacyPieceTextModel,
    TextModel,
    ShapeModel,
    FontItem,
    NodeServicePageFilesResponse
} from '../models/main';
import { DataUtils } from '../utils/data-utils';
import { CanvasUtils } from '../utils/canvas-utils';
import { TransformTool } from '../../pixi/transform-tool';
import { ConfigService } from './config.service';
import { MeasurementService } from './measurement.service';
import { ArtService } from './art.service';
import { ShapeService } from './shape.service';
import { BackgroundService } from './background.service';
import { TextService } from './text.service';
import { StrUtils } from '../utils/str-utils';
import { AssetService } from './asset.service';

@Injectable({
    providedIn: 'root'
})
export class SceneService implements NodeService {
    static readonly SCENE_TYPE_STANDARD: string = 'standard';

    protected static readonly DEFAULT_SCENE_MODEL: SceneModel = {
        id: '',
        thumbnail: '',
        image: '',
        appVersion: '0.0.0',
        hash: '00000000',
        name: '',
        items: [],
        date: '1970-01-01T00:00:00.000Z',
        unit: MeasurementService.DEFAULT_UNIT,
        pxPerUnit: MeasurementService.PIXELS_PER_UNIT
    };

    protected static readonly DEFAULT_SCENE_DATA: DesignData = {
        title: '',
        type: '',
        id: '',
        thumbnail: ''
    };

    scene: Scene;

    modelsBehind: SceneModel[] = [];

    modelsAhead: SceneModel[] = [];

    container: PIXI.Container;

    tt: TransformTool;

    recentSceneImages: DesignData[] = [];

    maxRecent: number = 10;

    maxModelsToRemember: number = 30;

    replaceMissingIDs: boolean = true;

    replaceLegacyMissingIDs: boolean = true;

    private categoryTrees: { [type: string]: TreeNode[] } = {};

    private readonly childrenPropName: string = 'children';

    constructor(
        private config: ConfigService,
        private http: HttpClient,
        private as: AssetService,
        private artService: ArtService,
        private textService: TextService,
        private shapeService: ShapeService,
        private bgService: BackgroundService,
        private msgService: MessageService
    ) {}

    init() {
        //this.getCategoriesTree(true);
        // fill with some data just to have empty slots
        for (let i = 0; i < this.maxRecent; i++) {
            this.recentSceneImages[i] = SceneService.createSceneData();
        }
    }

    static createSceneModel() {
        let m: SceneModel = _.cloneDeep(SceneService.DEFAULT_SCENE_MODEL);
        m.unit = MeasurementService.CURRENT_UNIT;
        return m;
    }

    static createSceneData() {
        return _.cloneDeep(SceneService.DEFAULT_SCENE_DATA);
    }

    copyDataToModel(data: DesignData, m: SceneModel) {
        // temp model needed to preserve original reference to the model (you can't clone directly)
        let tmpModel: SceneModel = _.cloneDeep(data.model as SceneModel);

        Object.keys(tmpModel).forEach((key) => {
            m[key] = tmpModel[key];
        });

        m.id = data.id;
        m.thumbnail = data.thumbnail;
        m.image = data.image; // Note. The image is missing in the data for the API v1 (but may present in the model)
        m.name = data.title;
    }

    copyModelToData(m: SceneModel, data: DesignData) {
        data.model = _.cloneDeep(m);

        data.id = m.id;
        data.thumbnail = m.thumbnail;
        data.image = m.image;
        data.title = m.name;
    }

    addDataToRecent(data: DesignData, recentArr: DesignData[]) {
        let index: number = recentArr.findIndex((element) => element.thumbnail === data.thumbnail);

        if (index >= 0) {
            let similarData: DesignData = recentArr.splice(index, 1)[0];
            if (!data.thumbnail) {
                data.thumbnail = similarData.thumbnail;
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

        recentArr.unshift(data);

        if (recentArr.length > this.maxRecent) {
            recentArr.splice(this.maxRecent);
        }
    }

    removeDataFromRecent(data: DesignData, recentArr: DesignData[]) {
        let index: number = recentArr.findIndex((element) => element.thumbnail === data.thumbnail);

        if (index >= 0) {
            recentArr.splice(index, 1);
        }
    }

    rememberModel(m: SceneModel) {
        m = _.cloneDeep(m);

        if (this.modelsBehind[0] && this.modelsBehind[0].hash === m.hash) {
            // same model
            return;
        }

        this.modelsBehind.unshift(m);
        if (this.modelsBehind.length > this.maxModelsToRemember) {
            this.modelsBehind.splice(this.maxModelsToRemember);
        }
    }

    undoModel() {
        let m: SceneModel = this.modelsBehind[1];
        if (m) {
            m = _.cloneDeep(m);

            let m0: SceneModel = this.modelsBehind[0];
            m0 = _.cloneDeep(m0);
            this.modelsAhead.unshift(m0);
            if (this.modelsAhead.length > this.maxModelsToRemember) {
                this.modelsAhead.splice(this.maxModelsToRemember);
            }

            this.modelsBehind.splice(0, 2); // delete 2, not just 1, cause the second model will be pushed to the models behind soon
        }

        return m;
    }

    redoModel() {
        let m: SceneModel = this.modelsAhead[0];
        if (m) {
            m = _.cloneDeep(m);

            this.modelsAhead.splice(0, 1);
        }

        return m;
    }

    clearUndoModels() {
        this.modelsBehind = [];
    }

    clearRedoModels() {
        this.modelsAhead = [];
    }

    // returns lightweight files with thumbnails and ids mainly,
    // use loadFile() to load a scene (design)
    getFiles(
        searchContext: TreeNode | string,
        noCache: boolean = false,
        types: string[] = [SceneService.SCENE_TYPE_STANDARD],
        page: number = NaN,
        itemsPerPage: number = NaN,
        categoryID: string = ''
    ): Promise<void | DesignData[] | NodeServicePageFilesResponse> {
        let test: boolean = this.config.testMode.includes('scenes');
        let pagination: boolean = !isNaN(page) && !isNaN(itemsPerPage);
        let spStr: string = '';
        let sp: URLSearchParams = new URLSearchParams();
        if (typeof searchContext === 'string') {
            searchContext = searchContext.trim();
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
                urls.push(this.config.assetsURL + 'test/scenes_search_page' + (pagination ? page : 's') + '.json');
            } else {
                urls.push(this.config.assetsURL + 'test/scenes_page' + (pagination ? page : 's') + '.json');
            }
        } else {
            if (typeof searchContext === 'string') {
                urls.push(baseUrl + 'designs/search' + (categoryID ? '/' + categoryID : '') + suffix);
            } else {
                let categories: DesignDataCategory[] = DataUtils.findAllInTree([searchContext], this.childrenPropName, (element) => {
                    return !element.children;
                }).map((element) => element.data);

                categories.forEach((category) => {
                    urls.push(baseUrl + 'designs/folder/' + category.catID + suffix);
                });
            }
        }

        // length is always 1 at the moment
        let promises: Promise<any>[] = [];

        urls.forEach((url) => {
            promises.push(
                typeof searchContext === 'string' && !this.config.testMode.includes('scenes')
                    ? this.http.post(url, { keyword: searchContext, page }, { responseType: 'json' }).toPromise()
                    : this.http
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
                        total = Number(res.total);
                        responseHasPagination = total >= 0;
                        // correct result
                        let prop: string = 'designs';
                        if (res.hasOwnProperty(prop)) {
                            res = res[prop];
                        }
                        let resArr: any[] = res instanceof Array ? res : [res];

                        resArr.forEach((element) => {
                            let image: DesignData = SceneService.createSceneData();
                            image.id = String(element.id);
                            image.title = element.name + (test ? categoryID : '');
                            image.thumbnail = element.thumbnail;
                            image.deleteEnabled = true; // TODO: important! determine if deletion is enabled

                            arr.push(image);
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

    getCategoriesTree(noCache: boolean = false, types: string[] = [SceneService.SCENE_TYPE_STANDARD]): Promise<TreeNode[]> {
        for (let type of types) {
            let empty: boolean = this.categoryTrees[type] ? this.categoryTrees[type].length === 0 : true;
            if (empty) {
                noCache = true;

                break;
            }
        }

        if (noCache) {
            return this.getCategories(noCache, types).then((categories) => {
                let tree: TreeNode[] = [];

                Object.keys(categories).forEach((type) => {
                    this.categoryTrees[type] = [];
                    categories[type].forEach((c) => {
                        this.createCategoryTreeNode(this.categoryTrees[type], c);
                    });

                    // delete temporary root parent nodes that was created by their children, but do not present in the xml
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

            for (let type of types) {
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
        types: string[] = [SceneService.SCENE_TYPE_STANDARD]
    ): Promise<{ [type: string]: DesignDataCategory[] }> {
        let suffix: string = noCache ? '?random=' + Math.random() * 10000 : '';
        let promises: Promise<any>[] = [];
        // flat structure
        let categories: { [type: string]: DesignDataCategory[] } = {};

        types.forEach((type) => {
            promises.push(
                this.http
                    .get<any>(this.config.apiURL + 'designs/folders' + suffix, { responseType: 'json' })
                    .toPromise()
            );
        });

        return Promise.all(promises).then((results) => {
            results.forEach((res, index) => {
                let type: string = types[index];

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
                            parentID: StrUtils.numberToString(element.parent | element.parent_id),
                            sortVal: element.sort ? parseInt(element.sort) : 0,
                            description: element.description,
                            private: Boolean(
                                String(element.private)
                                    .trim()
                                    .toLowerCase()
                                    .match(/^(1|on|true|yes)$/)
                            )
                        };

                        return c;
                    });
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
    // check if there is a file with the same name and return its id
    async getSameFileNameID(name: string, categoryID: string) {
        let spStr: string = '';
        let sp: URLSearchParams = new URLSearchParams();
        if (name) {
            sp.append('name', name);
        }

        if (categoryID) {
            sp.append('folder_id', categoryID);
        }
        spStr = sp.toString();
        let suffix: string = spStr ? '?' + spStr : '';

        let resID: string;

        if (this.config.testMode.includes('scenes')) {
            resID = await new Promise((resolve) =>
                setTimeout(() => {
                    resolve('1234');
                }, 2500)
            );

            return resID;
        }

        resID = await this.http
            .get<{ exists: boolean; id: number }>(this.config.apiURL + 'designs/check' + suffix, { responseType: 'json' })
            .toPromise()
            .then((res) => {
                if (res && res.id > 0) {
                    return String(res.id);
                } else {
                    return null;
                }
            });

        return resID;
    }

    // similar to getFile() in other services
    async loadFile(data: DesignData) {
        let testJSON: boolean = this.config.testMode.indexOf('json') >= 0;
        let testXML: boolean = !testJSON && this.config.testMode.indexOf('xml') >= 0;
        let url: string = testJSON
            ? this.config.assetsURL + 'test/scene07.json'
            : testXML
            ? this.config.assetsURL + 'test/old_scene04.xml'
            : this.config.apiURL + 'designs/' + data.id;
        let responseType: any = testXML ? ('text' as 'json') : 'json';
        const obj = await this.http
            .get<any>(url, { responseType })
            .toPromise()
            .then((res) => {
                if (res) {
                    if (res.design) {
                        res = res.design; // design can be xml or json
                    }
                    if (typeof res === 'string') {
                        if ((res as string).substr(0, 1) === '<') {
                            return xml2js.parseStringPromise(res, { explicitArray: false });
                        } else {
                            return JSON.parse(res);
                        }
                    }
                }
                // res is null or object
                return res;
            });

        data.model = await this.modernizeModel(obj);
        return data;
    }

    removeFile(file: DesignData) {
        // sending null to delete (probably DELETE method should be used)
        let url: string = this.config.apiURL + 'design/' + file.id;
        return this.http
            .post<any>(url, { design: null })
            .toPromise();
    }

    // transmit id to update the existing record,
    // transmit no id to create a new record
    saveFile(file: DesignData, name: string = '', id: string = '', categoryID: string = '', addToRecent: boolean = true) {
        let m: SceneModel = file.model as SceneModel; // copy of this.scene.model

        // set name
        if (name) {
            file.title = name;
            this.scene.model.name = name; // also belongs to the context
        }

        if (id) {
            file.id = id;
        }

        if (addToRecent) {
            this.addDataToRecent(file, this.recentSceneImages);
        }

        this.copyDataToModel(file, m);
        let url: string = this.config.apiURL + 'designs/' + id;
        const body: any = { design: m, folderID: Number(categoryID) };
        return this.http.post<any>(url, body).toPromise();
    }

    // modernizes a scene data format if needed
    async modernizeModel(obj: any) {
        let newModel: SceneModel;
        if (obj) {
            if (obj.appVersion) {
                // modernize older versions
                newModel = this.modernizeContemporaryModel(obj);
                if (this.replaceMissingIDs) {
                    await this.replaceMissingIDsInModel(newModel);
                }
            } else {
                // modernize the very old scene format
                newModel = await this.modernizeLegacyModel(obj.data);
                if (this.replaceLegacyMissingIDs) {
                    await this.replaceMissingIDsInModel(newModel);
                }
            }
        }

        return newModel;
    }
    // migration to the newest SceneModel depending on scene's appVersion
    // (delete some props, add some new props, modify incorrect ones)
    protected modernizeContemporaryModel(old: SceneModel) {
        if (semver.valid(old.appVersion) && semver.lt(old.appVersion, '0.2.10')) {
            // fix incorrect shapeType (in a legacy model resaved as contemporary model till January 13, 2021)
            if (old.items) {
                old.items.forEach((model) => {
                    if (model && model.type === 'shape') {
                        let shapeModel: ShapeModel = model as ShapeModel;
                        let isBase: boolean = ShapeService.isBaseShape(shapeModel);
                        let detailedType: string = this.shapeService.getDetailedType(shapeModel, isBase);
                        let shapeType: string = this.shapeService.getTypeFromDetailedType(detailedType);
                        if (shapeType !== shapeModel.shapeType) {
                            console.log('shapeType:', shapeModel.shapeType, '-->', shapeType);
                            shapeModel.shapeType = shapeType;
                        }
                    }
                });
            }
        }

        let newModel: SceneModel = old; // direct assignment may need to be avoided in the future

        return newModel;
    }

    protected async modernizeLegacyModel(old: LegacySceneModel) {
        let newModel: SceneModel = SceneService.createSceneModel();
        newModel.unit = MeasurementService.INCH; // may be not 'inch' in the future (then pay attention to units conversion, especially for text and art)
        let unitCoef: number = MeasurementService.SCALE / MeasurementService.PIXELS_PER_UNIT[newModel.unit];

        let promises: Promise<any>[] = [];
        let items: (LegacyPieceModel | LegacyStoneModel | LegacyBackgroundModel)[] = this.getLegacyModelArrangedItems(old);
        let x0: number = 0;
        let y0: number = 0;
        let getBasesUnder = (shape: LegacyStoneModel, checkY: boolean = false) => {
            // retrieve x and width from the model not from the object, otherwise it can badly affect Pixi's hitTest (may be a bug)
            let x: number = parseFloat(shape.posX);
            let y: number = parseFloat(shape.posY);
            if (isNaN(y)) {
                y = 0;
            }
            let w: number = parseFloat(shape.width);
            let bases: LegacyStoneModel[] = [];
            for (let item of items) {
                if (item.subType === 'base') {
                    let base: LegacyStoneModel = item as LegacyStoneModel;
                    if (
                        base !== shape &&
                        Math.abs(parseFloat(base.posX) - x) < 0.5 * (parseFloat(base.width) + w) &&
                        (!checkY || (checkY && parseFloat(base.posY) > y))
                    ) {
                        bases.push(base);
                    }
                }
            }

            return bases;
        };

        items.forEach((item, index) => {
            switch (item.type) {
                case 'art':
                    let pi: LegacyPieceArtModel = item as LegacyPieceArtModel;

                    let artModel: ArtModel = ArtService.createArtModel();
                    newModel.items[index] = artModel;
                    // uploaded images have compID === '0'
                    let isUploaded: boolean = pi.hasOwnProperty('compID') && !(parseInt(pi.compID) > 0);

                    let parseArt: (data: DesignData, uploaded: boolean) => ArtModel = (data: DesignData, uploaded: boolean) => {
                        if (data && data.nid) {
                            this.artService.copyDataToModel(data, artModel);
                        }
                        artModel.rotation = (parseFloat(pi.r) * Math.PI) / 180;
                        artModel.x = parseFloat(pi.x) * unitCoef;
                        artModel.y = parseFloat(pi.y) * unitCoef;
                        artModel.scaleX = parseFloat(pi.sX) * MeasurementService.SCALE; // ! may work only for inch units
                        artModel.scaleY = parseFloat(pi.sY) * MeasurementService.SCALE; // ! may work only for inch units
                        artModel.inverted = pi.inverted === 'true';
                        artModel.drawSimple = pi.drawSimple === 'true';
                        artModel.etching = pi.etching;
                        artModel.frostingVisible = pi.frostingVisible === 'true';
                        artModel.sinkage = pi.sinkage;
                        artModel.flipped = pi.flipped === 'true';
                        artModel.color = pi.color;
                        if (pi.resizeRect) {
                            let borders: number[] = pi.resizeRect.split(',').map((elem) => parseFloat(elem));
                            if (borders && borders.length >= 4) {
                                artModel.leftBorder = borders[0];
                                artModel.bottomBorder = borders[3];
                                artModel.rightBorder = borders[2];
                                artModel.topBorder = borders[1];
                                // mark the model (needs scale adjustment after the texture is loaded)
                                artModel.tmpAdjustScale = true;
                            }
                        }

                        if (uploaded) {
                            artModel.minWidth = parseFloat(pi.minWidth);
                            artModel.minHeight = parseFloat(pi.minHeight);
                            artModel.name = pi.name;
                            artModel.imageFile =
                                this.config.testMode.indexOf('xml') >= 0 ? 'monuvision-assets/images/tiger.png' : pi.imageFile;
                        }

                        return artModel;
                    };

                    if (isUploaded) {
                        let data: DesignData = ArtService.createArtData();
                        data.nid = '0';
                        parseArt(data, true);
                    } else {
                        promises.push(
                            this.artService.getFile(pi.compID, pi.subType).then((res) => {
                                return parseArt(res, false);
                            })
                        );
                    }

                    break;

                case 'text':
                    let ti: LegacyPieceTextModel = item as LegacyPieceTextModel;

                    let textModel: TextModel = TextService.createTextModel();
                    newModel.items[index] = textModel;

                    if (ti && ti.string) {
                        textModel.rotation = (parseFloat(ti.r) * Math.PI) / 180;
                        textModel.x = parseFloat(ti.x) * unitCoef;
                        textModel.y = parseFloat(ti.y) * unitCoef;
                        textModel.scaleX = parseFloat(ti.sX);
                        textModel.scaleY = parseFloat(ti.sY);
                        textModel.string = ti.string.replace(/~\^#/g, '\n');
                        textModel.font = ti.font;
                        textModel.size = ti.size;
                        textModel.lineSpacing = ti.lineSpacing;
                        textModel.spacing = parseFloat(ti.spacing);
                        textModel.bold = ti.bold === 'true';
                        textModel.polish = ti.polish === 'true';
                        textModel.frost = ti.frost === 'true';
                        textModel.outline = ti.outline === 'true';
                        textModel.justify = parseInt(ti.justify);
                        textModel.shapeEnabled = ti.shapeEnabled === 'true';
                        textModel.shapeAdjust = parseFloat(ti.shapeAdjust);
                        textModel.sinkage = ti.sinkage;
                    }

                    break;

                case 'shape':
                    let si: LegacyStoneModel = item as LegacyStoneModel;

                    let shapeModel: ShapeModel = ShapeService.createShapeModel();
                    newModel.items[index] = shapeModel;

                    // correct positions (cause the pieces' positions are relative to the top center of the first tablet (if it exists)
                    if (si.subType === 'tablet') {
                        if (index === 0) {
                            let basesH: number = getBasesUnder(si)
                                .map((elem) => parseFloat(elem.height))
                                .reduce((total, current) => total + current, 0);

                            x0 = parseFloat(si.posX);
                            y0 = parseFloat(si.height) + basesH; // ground level
                        }
                    } else {
                        si.posY = String(-index * 0.0001); // shift slightly for proper order of stacking
                    }

                    let parseShape: (data?: DesignData) => ShapeModel = (data: DesignData) => {
                        if (data && data.nid) {
                            this.shapeService.copyDataToModel(data, shapeModel);
                        }
                        let basesH: number = getBasesUnder(si, si.subType === 'base')
                            .map((elem) => parseFloat(elem.height))
                            .reduce((total, current) => total + current, 0);
                        let isBase: boolean = si.subType === 'base';

                        shapeModel.scaleX *= si.flipped === 'true' ? -1 : 1;
                        shapeModel.x = (parseFloat(si.posX) - x0) * unitCoef;
                        shapeModel.y = (y0 - 0.5 * parseFloat(si.height) - basesH) * unitCoef;
                        shapeModel.width = parseFloat(si.width) * unitCoef;
                        shapeModel.height = parseFloat(si.height) * unitCoef;
                        shapeModel.depth = parseFloat(si.depth) * unitCoef;
                        shapeModel.color = si.color;
                        shapeModel.polish = si.polish;
                        shapeModel.shape = isBase ? 'base' + (si.shape === '103' ? 'TV' : '') : si.shape;
                        let detailedType: string = this.shapeService.getDetailedType(shapeModel, isBase);
                        shapeModel.shapeType = this.shapeService.getTypeFromDetailedType(detailedType);

                        return shapeModel;
                    };

                    if (si.shape.toLowerCase() === 'custom') {
                        promises.push(
                            this.shapeService.getFile(si.id, ShapeService.SHAPE_TYPE_CUSTOM).then((res) => {
                                return parseShape(res);
                            })
                        );
                    } else {
                        parseShape();
                    }

                    break;

                case 'background':
                    let bgModel: BackgroundModel = BackgroundService.createBackgroundModel();
                    newModel.items[index] = bgModel;

                    let bgID: string = (item as LegacyBackgroundModel).id;
                    bgModel.id = bgID;
                    if (!this.replaceLegacyMissingIDs) {
                        promises.push(
                            // load the specified background
                            this.bgService.getFile(bgID).then((data) => {
                                if (data && data.id) {
                                    this.bgService.copyDataToModel(data, bgModel);
                                }
                            })
                        );
                    }

                    break;
            }
        });

        await Promise.all(promises).catch((err) => {
            this.msgService.add({ severity: 'error', summary: "Can't load remote data", detail: err.message ? err.message : '' });
        });

        // remove empty items
        for (let item in newModel.items) {
            if (!item) {
                console.warn('Empty item in scene items');
                newModel.items = newModel.items.filter((elem) => elem);
                break;
            }
        }

        return newModel;
    }

    protected async replaceMissingIDsInModel(scene: SceneModel) {
        if (!scene.items) {
            console.warn('No items in model');

            return true;
        }

        let promises: Promise<any>[] = [];

        let materialIDs: string[] = [];
        let fontIDs: number[] = [];

        scene.items.forEach((item, index) => {
            switch (item.type) {
                case 'art':
                    let artModel: ArtModel = item as ArtModel;

                    if (this.replaceLegacyMissingIDs) {
                        if (artModel.color && !this.as.bitmapFills[artModel.color]) {
                            let originalID: string = artModel.color;

                            artModel.color = AssetService.DEFAULT_BITMAP_FILL_ID;

                            let id: string = artModel.color;
                            materialIDs.push(originalID, id);
                        }
                    }

                    break;

                case 'text':
                    let textModel: TextModel = item as TextModel;
                    textModel.font = textModel.font
                        .split('|')
                        .map((elem) => {
                            let arr: string[] = elem.split(',');
                            let id: number = parseInt(arr[1]);
                            if (!this.textService.fonts.find((elem) => elem.id == id)) {
                                let originalID: number = id;
                                let defaultFont: FontItem = this.textService.fonts.find((elem) => !elem.hidden);
                                id = defaultFont.id;

                                fontIDs.push(originalID, id);
                            }
                            return arr[0] + ',' + id;
                        })
                        .join('|');

                    break;

                case 'shape':
                    let shapeModel: ShapeModel = item as ShapeModel;

                    if (!this.as.bitmapFills[shapeModel.color]) {
                        let originalID: string = shapeModel.color;

                        shapeModel.color = AssetService.DEFAULT_BITMAP_FILL_ID;

                        let id: string = shapeModel.color;
                        materialIDs.push(originalID, id);
                    }

                    break;

                case 'background':
                    let bgModel: BackgroundModel = item as BackgroundModel;

                    let bgID: string = bgModel.id;
                    promises.push(
                        this.bgService
                            .getCategoriesTree()
                            .then((res) => this.bgService.getFiles(res[0]))
                            .then((res) => {
                                if (res) {
                                    // find among allowed backgrounds
                                    let data: DesignData = res.find((elem) => elem && elem.id === bgID);
                                    if (!data) {
                                        // choose the first non white bg
                                        data = res[Math.min(1, res.length - 1)];
                                        this.msgService.add({
                                            severity: 'warn',
                                            summary: 'Warning',
                                            detail: `Background with ID:${bgID} wasn't found and was replaced.`,
                                            life: 10000
                                        });
                                    }
                                    // apply
                                    if (data && data.id) {
                                        this.bgService.copyDataToModel(data, bgModel);
                                    }
                                }

                                return res;
                            })
                    );

                    break;
            }
        });

        if (materialIDs.length > 0) {
            let str: string = materialIDs.filter((elem, index) => index % 2 == 0).join(',\n');
            let strReplace: string = this.as.bitmapFills[materialIDs[1]].name;
            let text: string =
                materialIDs.length === 2
                    ? `Material with ID: ${str} wasn't found and was replaced by "${strReplace}".`
                    : `Materials with IDs: ${str} weren't found and were replaced by "${strReplace}".`;
            this.msgService.add({
                severity: 'warn',
                summary: 'Warning',
                detail: text,
                life: 10000
            });
        }

        if (fontIDs.length > 0) {
            let str: string = fontIDs.filter((elem, index) => index % 2 == 0).join(',\n');
            let defaultFont: FontItem = this.textService.fonts.find((elem) => elem.id === fontIDs[1]);
            let strReplace: string = defaultFont.fontFamilyAlias || defaultFont.fontFamily;
            let text: string =
                fontIDs.length === 2
                    ? `Font with ID: ${str} wasn't found and was replaced by "${strReplace}".`
                    : `Fonts with IDs: ${str} weren't found and were replaced by "${strReplace}".`;
            this.msgService.add({
                severity: 'warn',
                summary: 'Warning',
                detail: text,
                life: 10000
            });
        }

        await Promise.all(promises).catch((err) => {
            this.msgService.add({ severity: 'error', summary: "Can't load remote data", detail: err.message ? err.message : '' });
        });

        return true;
    }

    // returns a sorted array of slightly decorated items
    protected getLegacyModelArrangedItems(old: LegacySceneModel) {
        let items: (LegacyPieceModel | LegacyStoneModel | LegacyBackgroundModel)[] = [];

        if (old.monument) {
            if (old.monument.tablet) {
                let tablet: LegacyStoneModel | LegacyStoneModel[] = old.monument.tablet;
                let tablets: LegacyStoneModel[] = tablet instanceof Array ? tablet : [tablet];
                tablets.forEach((item) => {
                    item.subType = 'tablet';
                    item.type = 'shape';
                });
                items = items.concat(tablets);
            }
            if (old.monument.base) {
                let base: LegacyStoneModel | LegacyStoneModel[] = old.monument.base;
                let bases: LegacyStoneModel[] = base instanceof Array ? base : [base];
                bases.forEach((item) => {
                    item.subType = 'base';
                    item.type = 'shape';
                });
                items = items.concat(bases);
            }
        }
        if (old.design && old.design.area && old.design.area.piece && old.design.area.piece.piece) {
            let piece: LegacyPieceModel | LegacyPieceModel[] = old.design.area.piece.piece;
            let pieces: LegacyPieceModel[] = piece instanceof Array ? piece : [piece];
            pieces = pieces.filter((elem) => elem && typeof elem !== 'string'); // filter incorrect items, e.g. "null"
            pieces.forEach((item) => {
                let t: string = item.$.type.toLowerCase().replace('printed ', '');
                if (t === 'text') {
                    item.subType = t;
                    item.type = t;
                    item.sort = 2;
                } else {
                    item.subType = t; // component, vase, panel
                    item.type = 'art';
                    item.sort = t === 'vase' ? 1 : 0;
                }
            });
            // for the old designer text was on top, then vases, then components and panels
            pieces.sort((a, b) => a.sort - b.sort);
            items = items.concat(pieces);
        }
        if (old.background && typeof old.background !== 'string') {
            old.background.type = 'background';
            items = items.concat(old.background);
        }

        return items;
    }
}

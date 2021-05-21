import { Injectable, ElementRef, NgZone, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpResponse, HttpParams } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import * as KeyboardManager from 'keyboardjs';
import * as Stats from 'stats.js';
import hashSum from 'hash-sum';
import * as _ from 'lodash';
import * as polyClip from 'polygon-clipping';
import { FileSaverService } from 'ngx-filesaver';
import { ReflectionFilter } from '@pixi/filter-reflection';
import { OutlineFilter } from '@pixi/filter-outline';
import { GlowFilter } from '@pixi/filter-glow';
import { MultiCase } from '../../pixi/multi-case';
import { Ruler } from '../../pixi/ruler';
import { TransformTool, Transformable } from '../../pixi/transform-tool';
import { SelectionTool } from '../../pixi/selection-tool';
import { TextInput } from '../../pixi/text-input';
import { SuperGraphics } from '../../pixi/super-graphics';
import MultiStyleText, { TextStyleSet } from '../../pixi/multi-style-text';
import { CanvasUtils } from '../utils/canvas-utils';
import { StrUtils } from '../utils/str-utils';
import {
    BitmapFillItem,
    ColorItem,
    FontItem,
    Case,
    DesignItem,
    DesignArt,
    DesignText,
    DesignShape,
    DesignRuler,
    SceneModel,
    SceneItemModel,
    ArtModel,
    TextModel,
    ShapeModel,
    RulerModel,
    DataEvent,
    DesignData,
    PolishItem,
    Anchor,
    Area,
    DesignGrid,
    GridModel,
    DesignBackground,
    BackgroundModel,
    Scene,
    PriceModel
} from '../models/main';
import { ArtService } from './art.service';
import { AssetService } from './asset.service';
import { ConfigService } from './config.service';
import { MeasurementService } from './measurement.service';
import { ShapeService } from './shape.service';
import { TextService, TextServiceEventType } from './text.service';
import { UserService } from './user.service';
import { BackgroundService } from './background.service';
import { SceneService } from './scene.service';
import { PriceService } from './price.service';
import { TextureUtils } from '../../pixi/utils/texture-utils';
import { MessageService } from 'primeng/api';
import { ExportService } from './export.service';
import { UIService } from './ui.service';
import { ColorUtils } from '../utils/color-utils';

export class DesignServiceEventType {
    static EVENT_INIT_COMPLETE: string = 'eInitComplete';

    static EVENT_LOAD_COMPLETE: string = 'eLoadComplete';

    static EVENT_RESIZE: string = 'eResize';

    static EVENT_RESIZE_REQUEST: string = 'eResizeRequest';

    static EVENT_ZOOM: string = 'eZoom';

    static EVENT_ZOOM_COMPLETE: string = 'eZoomComplete';

    static EVENT_PHYSICS_COMPLETE: string = 'ePhysicsComplete';

    static EVENT_TRANSFORM_TOOL_ADD: string = 'eTTAdd';

    static EVENT_TRANSFORM_TOOL_ADD_TEXT: string = 'eTTAddText';

    static EVENT_TRANSFORM_TOOL_BEFORE_REMOVE: string = 'eTTBeforeRemove';

    static EVENT_TRANSFORM_TOOL_REMOVE: string = 'eTTRemove';

    static EVENT_TRANSFORM_TOOL_TRANSFORM: string = 'eTTTransform';

    static EVENT_TRANSFORM_TOOL_TRANSFORM_END: string = 'eTTTransformEnd';

    static EVENT_TRANSFORM_TOOL_REDRAW: string = 'eTTRedraw';

    static EVENT_TRANSFORM_TOOL_OPTIONS: string = 'eTTOptions';

    static EVENT_TRANSFORM_TOOL_OPTIONS_APPLY: string = 'eTTOptionsApply';

    static EVENT_TRANSFORM_TOOL_DELETE: string = 'eTTDelete';
}

@Injectable({
    providedIn: 'root'
})
export class DesignService extends EventEmitter<any> {
    renderer: PIXI.Renderer;

    stage: PIXI.Container;
    // container for design items and some helpers, children's order from highest to lowest:
    // ruler, grid, outlineContainer, ...design items (e.g. art, text, shape), maskContainer
    container: PIXI.Container;
    // container for masks (needed to overcome some hitTest issues)
    maskContainer: PIXI.Container;
    // container for outlines (cause usage of an OutlineFilter for this purpose breaks antialiasing)
    outlineContainer: PIXI.Container;

    tt: TransformTool;

    st: SelectionTool;

    ruler: DesignRuler;

    grid: DesignGrid;

    background: DesignBackground;

    backgroundMasked: DesignBackground; // same as the background, but just masked by the grass

    backgroundMasked2: DesignBackground; // same as the background, but just masked by the grass 2 and semi-transparent

    grass: SuperGraphics;

    grass2: SuperGraphics;

    filterReflection: ReflectionFilter;

    filterWhite: PIXI.filters.ColorMatrixFilter;

    filterNegative: PIXI.filters.ColorMatrixFilter;

    filterGrayscale: PIXI.filters.ColorMatrixFilter;

    // canvas dimensions
    cW: number = 600;

    cH: number = 400;

    lastCW: number = this.cW;

    lastCH: number = this.cH;

    containerMarginsDefault: number[] = [100, 50, 50, 50];

    minFontSizeInch: number = 0.875;

    minContainerScale: number = 0.05;

    maxContainerScale: number = 1;
    // to make the background always fill the canvas even if it is too wide
    minBackgroundRatio: number = 3.5;

    baseShapeOverlayDY: number = Math.round(MeasurementService.inchToPx(0.466));

    sinkageIsGlobal: boolean = false; // REMOVE

    sinkageGlobalColorID: string; // REMOVE

    typeofTransformable: string = 'general';

    autoZoom: boolean = true;

    physics: boolean = true;

    waitingForZoom: boolean = false;

    artSlotsTooltipText: string = 'Drag artwork here to save for later.';

    dragging: boolean = false;

    draggedData: DesignData;

    leftSlotsAfterDragStart: boolean = false;

    removeLastDraggedData: boolean = false;

    dragID: string;

    isSelecting: boolean = false;

    trTimeoutIds: any = {};

    trIntervalIds: any = {};

    timeoutIds: any = {};

    touchY0: number = NaN;

    timeoutIdZoom: any;
    // debugging and stats
    stats: Stats;

    animationTicks: number = 0;

    comparePosCoef: number = 10000; // anything from 1000 to 100000000

    isPointerDown: boolean = false;

    preloaderTexts: string[] = [];

    arrowsPressed: number = 0;
    // false for better performance
    readonly emitMoveEventsImmediately: boolean = false;

    constructor(
        private config: ConfigService,
        public ngZone: NgZone,
        private http: HttpClient,
        private ss: SceneService,
        private artService: ArtService,
        private textService: TextService,
        private shapeService: ShapeService,
        private bgService: BackgroundService,
        private as: AssetService,
        private us: UserService,
        private ui: UIService,
        private ms: MeasurementService,
        private ps: PriceService,
        private es: ExportService,
        private fileSaver: FileSaverService,
        private msgService: MessageService
    ) {
        super();
    }

    init(view: ElementRef) {
        let promises: Promise<void>[] = [];

        // renderer

        // prefer webGl2, though there is a bug in chromium for some non-apple mobile devices (https://bugs.chromium.org/p/chromium/issues/detail?id=934823)
        PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL2;

        this.renderer = new PIXI.Renderer({
            width: this.cW,
            height: this.cH,
            antialias: true,
            view: view.nativeElement,
            backgroundColor: 0xffffff,
            resolution: 1
        });
        this.renderer.plugins.interaction.useSystemTicker = false;

        // containers

        this.outlineContainer = new PIXI.Container();
        this.maskContainer = new PIXI.Container();
        this.container = new PIXI.Container();
        this.container.hitArea = new PIXI.Rectangle(-1000000000, -1000000000, 2000000000, 2000000000);
        this.stage = new PIXI.Container();
        this.stage.addChild(this.container);
        if (!this.config.isDesktop) {
            view.nativeElement.addEventListener('touchstart', this.onPointerDown, true);
            view.nativeElement.addEventListener('touchend', this.onPointerUp, true);
        }

        let windowRatio: number = window ? window.innerWidth / window.innerHeight : 1.5;
        this.minBackgroundRatio = windowRatio > 2.5 ? 4.5 : 3.5;

        // transform tool

        this.tt = new TransformTool(this.container);
        this.tt.iconLib = {
            rotate: this.as.icons.replay.url,
            delete: this.as.icons.trash.url,
            options: this.as.icons.ellipsisH.url
        };
        this.tt.cornerLib = {
            text: ['rotate', 'delete', 'options'],
            artLockedDimensions: ['rotate', 'delete', 'options'],
            artPanel: ['rotate', 'delete', 'scaleX', 'scale', 'scaleY', 'scaleY2', 'options'],
            artVase: ['delete', 'options'],
            artVaseLockedDimensions: ['delete', 'scaleX', 'scaleX2', 'scale', 'scaleY', 'scaleY2', 'options'],
            shape: ['delete', 'scaleX', 'scaleX2', 'scale', 'scaleY', 'scaleY2', 'options'],
            shapeLockedDimensions: ['delete', 'options'],
            group: ['delete', 'options'],
            groupArt: ['rotate', 'delete', 'options'],
            groupShape: ['delete', 'options'],
            groupText: ['rotate', 'delete', 'options'],
            groupWithoutShape: ['rotate', 'delete', 'options'],
            ruler: ['rotate', 'scaleX'],
            default: ['rotate', 'delete', 'scaleX', 'scaleX2', 'scale', 'scaleY', 'scaleY2', 'options']
        };
        this.tt.getTypeOfTransformable = this.getTypeOfTransformable;
        this.tt.on(TransformTool.EVENT_ADD, this.onTransformAdd);
        this.tt.on(TransformTool.EVENT_BEFORE_REMOVE, this.onTransformBeforeRemove);
        this.tt.on(TransformTool.EVENT_REMOVE, this.onTransformRemove);
        this.tt.on(TransformTool.EVENT_TRANSFORM, this.onTransform);
        this.tt.on(TransformTool.EVENT_TRANSFORM_BEFORE_START, this.onTransformBeforeStart);
        this.tt.on(TransformTool.EVENT_TRANSFORM_END, this.onTransformEnd);
        this.tt.on(TransformTool.EVENT_REDRAW, this.onTransformRedraw);
        this.tt.on(TransformTool.EVENT_OPTIONS, this.onTransformOptions);
        this.tt.on(TransformTool.EVENT_DELETE, this.onTransformDelete);
        this.stage.addChild(this.tt);

        // select tool

        // container must have the defined hitArea to make the selection tool work
        this.st = new SelectionTool(this.container, this.onSelectStart, this.onSelectChange, this.onSelectComplete);
        this.stage.addChild(this.st);

        // filters

        this.filterWhite = new PIXI.filters.ColorMatrixFilter();
        // fully white
        this.filterWhite.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
        // 3x brightness (better for custom shapes with dark edges than a filter with maximum brightness (fully white))
        // this.filterWhite.matrix = [3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1, 0];

        this.filterNegative = new PIXI.filters.ColorMatrixFilter();
        this.filterNegative.negative(false);

        // this grayscale filter with a custom matrix provides noticeably better results than .greyscale(0.33) or .desaturate() method
        this.filterGrayscale = new PIXI.filters.ColorMatrixFilter();
        this.filterGrayscale.matrix = [0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0];

        // resize

        this.doResize();

        // can be omitted (used just to fill the background)
        this.animate(false);

        // init internal services
        // ui
        this.preloaderTexts.push('Loading theme...');
        promises.push(
            this.ui.init().then((res) => {
                this.preloaderTexts = this.preloaderTexts.filter((elem) => elem !== 'Loading theme...');
            })
        );

        // user
        this.us.init();

        // export
        this.es.ds = this;
        this.es.renderer = this.renderer;
        this.es.stage = this.stage;
        this.es.container = this.container;
        this.es.tt = this.tt;
        this.es.st = this.st;
        this.es.init();

        // scene
        this.ss.container = this.container;
        this.ss.tt = this.tt;
        this.ss.scene = this.stage as Scene;
        this.ss.init();

        // asset
        this.as.renderer = this.renderer;
        this.as.es = this.es;
        this.preloaderTexts.push('Loading materials...');
        promises.push(
            this.as.init().then((res) => {
                this.preloaderTexts = this.preloaderTexts.filter((elem) => elem !== 'Loading materials...');
            })
        );

        // bg
        this.bgService.init();

        // art
        this.artService.renderer = this.renderer;
        this.artService.container = this.container;
        this.artService.filterGrayscale = this.filterGrayscale;
        this.artService.filterNegative = this.filterNegative;
        this.artService.init();

        // text
        this.textService.subscribe((e: any) => {
            switch (e.type) {
                case TextServiceEventType.EVENT_TEXT_EDIT_START:
                case TextServiceEventType.EVENT_TEXT_INPUT:
                    this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_TRANSFORM);
                    break;
                case TextServiceEventType.EVENT_TEXT_EDIT_STOP:
                    this.updateAnchorsAndMasks();
                    this.doAutoZoomDelayed();
                    this.remember();
                    break;
            }
        });
        this.textService.container = this.container;
        this.textService.tt = this.tt;
        this.preloaderTexts.unshift('Loading fonts...');
        promises.push(
            this.textService.init().then((res) => {
                this.preloaderTexts = this.preloaderTexts.filter((elem) => elem !== 'Loading fonts...');
            })
        );

        // shape
        this.shapeService.renderer = this.renderer;
        this.shapeService.container = this.container;
        this.shapeService.filterWhite = this.filterWhite;
        this.shapeService.init();

        Promise.all(promises)
            .then(() => {
                ShapeService.DEFAULT_SHAPE_COLOR_ID = AssetService.DEFAULT_BITMAP_FILL_ID;
                this.tt.colors = [this.ui.primaryColor ? ColorUtils.string2hex(this.ui.primaryColor) : 0x999999, 0xefefef];
                // start the machine
                this.ui.blockUIPreloader = false;
                this.animateFnBind();
                this.emitDataEvent(DesignServiceEventType.EVENT_INIT_COMPLETE);
            })
            .catch((err) => {
                console.warn("Can't initialise the design service");
            })
            .finally(() => {
                this.createScene(null, this.initKeyboardControls, false);
                if (this.config.testMode.indexOf('xml') >= 0 || this.config.testMode.indexOf('json') >= 0) {
                    setTimeout(() => {
                        this.addScene(SceneService.createSceneData());
                    }, 500);
                }
            });
    }

    get preloaderText() {
        if (!this.preloaderTexts || this.preloaderTexts.length === 0) {
            return 'Loading...';
        }
        return this.preloaderTexts[0];
    }

    protected initKeyboardControls = () => {
        KeyboardManager.bind('delete', null, (e) => {
            // trigger ngZone's Change Detection
            this.ngZone.run(() => {
                this.onTransformDelete();
            });
        });
        KeyboardManager.bind(
            'up',
            (e) => {
                this.onKeyArrowPress(e, 0, -1);
            },
            (e) => {
                this.onKeyArrowRelease(e, 0, -1);
            }
        );
        KeyboardManager.bind(
            'down',
            (e) => {
                this.onKeyArrowPress(e, 0, 1);
            },
            (e) => {
                this.onKeyArrowRelease(e, 0, 1);
            }
        );
        KeyboardManager.bind(
            'left',
            (e) => {
                this.onKeyArrowPress(e, -1, 0);
            },
            (e) => {
                this.onKeyArrowRelease(e, -1, 0);
            }
        );
        KeyboardManager.bind(
            'right',
            (e) => {
                this.onKeyArrowPress(e, 1, 0);
            },
            (e) => {
                this.onKeyArrowRelease(e, 1, 0);
            }
        );
        KeyboardManager.bind(
            'shift',
            (e) => {
                this.tt.blockBoxInteraction = true;
                this.tt.blockCornerInteraction = true;
                this.st.selectExtra = true;

                // Prevent keydown repeat (when holding key)
                e.preventRepeat();

                e.preventDefault();
            },
            (e) => {
                this.tt.blockBoxInteraction = false;
                this.tt.blockCornerInteraction = false;
                this.st.selectExtra = false;
            }
        );
        KeyboardManager.bind(
            'ctrl',
            (e) => {
                this.tt.angleStep = 15;

                // Prevent keydown repeat (when holding key)
                e.preventRepeat();
            },
            (e) => {
                this.tt.angleStep = 1.5;
            }
        );
        KeyboardManager.bind(
            'ctrl + z',
            (e) => {
                this.ngZone.run(() => {
                    this.undo();

                    e.preventDefault();
                });
            },
            (e) => {
                e.preventDefault();
            }
        );
        KeyboardManager.bind(
            'ctrl + y',
            (e) => {
                this.ngZone.run(() => {
                    this.redo();

                    e.preventDefault();
                });
            },
            (e) => {
                e.preventDefault();
            }
        );
        KeyboardManager.bind('alt + shift > i', (e) => {
            this.toggleStats();

            e.preventDefault();
        });
        KeyboardManager.bind('alt + shift > a', (e) => {
            let data: DesignData = ArtService.createArtData();
            data.title = 'Ball';
            data.image = 'monuvision-assets/images/ball.png';

            this.addArt(data);

            e.preventDefault();
        });
        KeyboardManager.bind('alt + shift > p', (e) => {
            let data: DesignData = ArtService.createArtData();
            data.title = 'Tiger';
            data.image = 'monuvision-assets/images/tiger.png';
            data.type = ArtService.ART_TYPE_PANEL;

            this.addArt(data);

            e.preventDefault();
        });
        KeyboardManager.bind('alt + shift > v', (e) => {
            this.msgService.add({ severity: 'info', summary: 'App Version ' + this.config.appVersion, detail: '' });

            e.preventDefault();
        });
        KeyboardManager.bind('alt + shift > m', (e) => {
            console.log(this.ss.scene.model);

            e.preventDefault();
        });
        KeyboardManager.bind('alt + shift > s', (e) => {
            console.log(this.ss.scene);

            e.preventDefault();
        });
    };

    protected onKeyArrowPress(e: any, dx: number, dy: number) {
        this.arrowsPressed++;

        if (!this.tt || this.tt.list.length === 0) {
            return;
        }

        if (!this.emitMoveEventsImmediately && this.arrowsPressed === 1) {
            this.onTransformBeforeStart();
        }

        this.moveTransformables(dx, dy);

        this.addDelayedLoop(
            () => {
                this.moveTransformables(dx, dy);
            },
            1.6,
            e,
            100,
            'a' + String(dx) + String(dy)
        );
        // Prevent keydown repeat (when holding key)
        e.preventRepeat();

        e.preventDefault();
    }

    protected moveTransformables(dx: number, dy: number) {
        if (!this.tt || this.tt.list.length === 0) {
            return;
        }
        this.tt.translate(dx, dy, this.emitMoveEventsImmediately);
        if (!this.emitMoveEventsImmediately) {
            this.onTransform();
        }
    }

    protected onKeyArrowRelease(e: any, dx: number, dy: number) {
        this.arrowsPressed--;

        if (!this.tt || this.tt.list.length === 0) {
            this.removeAllDelayedLoops();

            return;
        }
        this.removeDelayedLoop('a' + String(dx) + String(dy));

        if (!this.emitMoveEventsImmediately && this.arrowsPressed === 0) {
            this.onTransformEnd();
        }

        e.preventDefault();
    }

    toggleStats(): boolean {
        if (!this.stats) {
            this.stats = new Stats();
            this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
            this.stats.dom.style.left = 'auto';
            this.stats.dom.style.right = '0px';
        }

        if (!this.stats.dom.parentElement) {
            document.body.appendChild(this.stats.dom);

            return true;
        } else {
            document.body.removeChild(this.stats.dom);

            return false;
        }
    }

    toggleFilterReflection(): boolean {
        if (!this.stage.filters || this.stage.filters.length === 0) {
            this.filterReflection = new ReflectionFilter({ mirror: false, boundary: 0.0, amplitude: [0, 10], waveLength: [40, 120] });
            this.stage.filters = [this.filterReflection];

            return true;
        } else {
            this.filterReflection = null;
            this.stage.filters = null;

            return false;
        }
    }

    toggleTextDebug(): boolean {
        if (MultiStyleText.debugOptions.spans.enabled) {
            MultiStyleText.debugOptions.spans.enabled = false;
            MultiStyleText.debugOptions.objects.enabled = false;
        } else {
            MultiStyleText.debugOptions.spans.enabled = true;
            MultiStyleText.debugOptions.objects.enabled = true;
        }

        return MultiStyleText.debugOptions.spans.enabled;
    }

    doResize = (forced: boolean = false, detectSize: boolean = true) => {
        if (this.renderer) {
            if (detectSize) {
                this.cW = this.renderer.view.parentElement.offsetWidth;
                this.cH = this.renderer.view.parentElement.offsetHeight;
            }
            if (this.cW < 6000 && this.cH < 6000) {
                if ((forced || this.lastCW !== this.cW || this.lastCH !== this.cH) && !this.es.showExportInfo) {
                    this.renderer.resize(this.cW, this.cH);

                    this.doAutoZoomDelayed();
                    this.updateBackgroundAndGrass(true);
                    this.updateGrid();

                    this.lastCW = this.cW;
                    this.lastCH = this.cH;

                    this.emitDataEvent(DesignServiceEventType.EVENT_RESIZE);
                }
            } else {
                console.warn('canvas size seems too big:', this.cW, this.cH);
                this.cW = this.lastCW;
                this.cH = this.lastCH;
            }
        }
        this.emitDataEvent(DesignServiceEventType.EVENT_RESIZE_REQUEST);
    };

    addScene(data: DesignData, addToRecent: boolean = false) {
        let add: Function = (data: DesignData, cb?: Function) => {
            if (data.model) {
                // TODO: important ! should deprecate model property in data or not?
                // TODO: probably move addToRecent into createScene() (from saveFile() function too)
                if (addToRecent) {
                    this.ss.addDataToRecent(data, this.ss.recentSceneImages);
                }

                let m: SceneModel = SceneService.createSceneModel();

                this.ss.copyDataToModel(data, m);

                this.createScene(m, cb, false);
            }
        };

        if (data.model) {
            add(data);
        } else {
            this.ui.blockUIPreloader = true;
            this.ss
                .loadFile(data)
                .then((result) => {
                    add(result, () => {
                        this.ui.blockUIPreloader = false;
                    });
                })
                .catch((err) => {
                    this.ui.blockUIPreloader = false;
                });
        }
    }

    // too complicated to be inside the scene service
    createScene(m: SceneModel, cb?: Function, addToRecent: boolean = true) {
        this.removeScene();

        this.container.addChild(this.maskContainer);
        this.container.addChild(this.outlineContainer);

        let blankScene: boolean = false;
        if (!m) {
            m = SceneService.createSceneModel();

            blankScene = true;
        }

        MeasurementService.CURRENT_UNIT = m.unit ? m.unit : MeasurementService.DEFAULT_UNIT;

        let centerPoint: PIXI.Point = this.getCenterPoint();
        if (!this.ruler) {
            this.ruler = this.ms.createRuler();
        }
        if (!this.grid) {
            this.grid = this.ms.createGrid();
        }
        // move to center just to allow the grid to be centered initially
        this.container.x = centerPoint.x;
        this.container.y = centerPoint.y;

        this.autoZoom = true;
        this.physics = true;

        let scene: Scene = this.ss.scene; // or this.stage as Scene
        scene.model = m;
        if (!scene.updateModel) {
            scene.updateModel = (flag: string = 'default') => {
                this.updateSceneModel(scene, scene.model, flag);
            };
        }

        let asyncItemsLeft: number = 0;
        let itemsInitialiased: boolean = false;

        let onComplete: Function = () => {
            // all items are loaded
            // updateAnchorsAndMasks() needs to be called 4 times here (3 right here + 1 in applyPhysics()) for proper masking/positioning of an Art
            // because of a Pixi masking bug
            this.ngZone.run(() => {
                this.updateAnchorsAndMasks();
                this.updateAnchorsAndMasks();
                this.applyPhysics(0);
                this.doAutoZoom(true, 0);
                this.updateAnchorsAndMasks();

                this.remember(false);

                if (typeof cb === 'function') {
                    cb(scene);
                }
            });
        };

        let itemsToAdd: DesignItem[] = [];

        let onSceneItemLoadComplete: Function = () => {
            itemsToAdd.forEach((di) => {
                this.container.addChildAt(di, this.getHighestAvailableLevel(di));
            });

            if (itemsInitialiased && asyncItemsLeft <= 0) {
                if (blankScene) {
                    // no items
                    // add tablet and base
                    this.shapeService.getCategoriesTree(false, [ShapeService.SHAPE_TYPE_TRADITIONAL]).then((tree) => {
                        this.shapeService.getFiles(tree[0], false, [ShapeService.SHAPE_TYPE_TRADITIONAL]).then((files) => {
                            this.addShape(files[0], true, true);

                            onComplete();
                        });
                    });
                    // show the white bg in Recent
                    this.bgService.addDataToRecent(
                        BackgroundService.createBackgroundData(BackgroundService.WHITE_BACKGROUND_DATA),
                        this.bgService.recentBackgroundImages
                    );
                } else {
                    onComplete();
                }
            }
        };

        m.items.forEach((sim) => {
            switch (sim.type) {
                case 'art':
                    asyncItemsLeft++;
                    itemsToAdd.push(
                        this.artService.createArt(sim as ArtModel, (da) => {
                            asyncItemsLeft--;
                            onSceneItemLoadComplete();
                        })
                    );

                    break;

                case 'text':
                    itemsToAdd.push(this.textService.createText(sim as TextModel));

                    break;

                case 'shape':
                    asyncItemsLeft++; // custom shapes only created asynchronously
                    itemsToAdd.push(
                        this.shapeService.createShape(sim as ShapeModel, (ds: DesignShape) => {
                            asyncItemsLeft--;
                            onSceneItemLoadComplete();
                        })
                    );

                    break;

                case 'background':
                    this.autoZoom = !(sim as BackgroundModel).imagePath;
                    asyncItemsLeft++;
                    this.createBackgroundAndGrass(sim as BackgroundModel, (db: DesignBackground) => {
                        asyncItemsLeft--;
                        onSceneItemLoadComplete();
                    });

                    break;
            }
        });

        itemsInitialiased = true;

        onSceneItemLoadComplete();
    }

    removeScene() {
        this.killAllTweens();
        this.cancelAutoZoomDelayed();
        this.removeAllDelayedLoops();
        // prevent tweens
        this.autoZoom = false;
        this.physics = false;

        this.showRuler = false;
        this.showGrid = false;

        this.tt.removeAllTransformables();

        this.textService.stopTextEditing(null, false);

        this.removeBackgroundAndGrass();

        while (this.maskContainer.children.length > 0) {
            this.maskContainer.removeChildAt(0);
        }

        while (this.outlineContainer.children.length > 0) {
            this.outlineContainer.removeChildAt(0);
        }

        while (this.container.children.length > 0) {
            this.container.removeChildAt(0);
        }

        this.tt.blockBoxInteraction = false;
        this.tt.blockCornerInteraction = false;
        this.st.selectionEnabled = true;
    }

    updateSceneModel = (item: Scene, m: SceneModel, flag: string) => {
        m.items = [];

        let di: DesignItem;
        for (let i: number = 1; i < this.container.children.length; i++) {
            di = this.container.children[i] as DesignItem;
            if (di.model && di.model.type !== 'ruler' && di.model.type !== 'grid') {
                let sim: SceneItemModel = _.cloneDeep(di.model);

                this.roundNumbersInModel(sim);

                m.items.push(sim);
            }
        }

        if (this.background) {
            di = this.background;
            let sim: SceneItemModel = _.cloneDeep(di.model);

            this.roundNumbersInModel(sim);

            m.items.push(sim);
        }

        m.appVersion = this.config.appVersion;
        m.hash = hashSum(m.items);
        m.date = new Date().toISOString();
    };

    // round numbers because 99.9999% equal scene models will produce different hashes
    roundNumbersInModel(m: any) {
        Object.keys(m).forEach((key) => {
            if (typeof m[key] === 'number') {
                let num: number = m[key];
                if (!isNaN(num)) {
                    m[key] = Math.round(num * 1000000000) / 1000000000;
                }
            }
        });
    }

    remember = (clearRedo: boolean = true) => {
        if (clearRedo) {
            this.ss.clearRedoModels();
        }
        this.ss.scene.updateModel();
        this.ss.rememberModel(this.ss.scene.model);

        this.getPrices();
    };

    undo = () => {
        let m: SceneModel = this.ss.undoModel();
        if (m) {
            this.createScene(m, null, false);
        }
    };

    redo = () => {
        let m: SceneModel = this.ss.redoModel();
        if (m) {
            this.createScene(m, null, false);
        }
    };

    getDesignItems = () => {
        return this.container.children.filter((elem) => elem.hasOwnProperty('model')) as DesignItem[];
    };

    getPrices = (forced: boolean = false) => {
        if (this.ui.displayPricing || forced) {
            return this.whenSceneIsReady().then((result) => {
                return this.ps.getPrices(this.ss.scene.model);
            });
        }

        return Promise.resolve(null);
    };

    getContextColoredItems() {
        // granite vases + shapes
        let items: (DesignShape | DesignArt)[] = (this.getArts([ArtService.ART_TYPE_VASE]).filter(
            (elem) => !elem.model.drawSimple && elem.model.color
        ) as (DesignShape | DesignArt)[])
            .reverse()
            .concat(this.getShapes().reverse());

        if (items.length > 0) {
            let selectedItems: (DesignShape | DesignArt)[] = items.filter((element) => {
                return this.tt.list.indexOf(element) >= 0;
            });

            if (selectedItems.length > 0) {
                items = selectedItems;
            }
        }

        return items;
    }

    getContextSinkageItems() {
        // components and panels + texts
        let items: (DesignText | DesignArt)[] = (this.getArts([ArtService.ART_TYPE_COMPONENT, ArtService.ART_TYPE_PANEL]) as (
            | DesignText
            | DesignArt
        )[])
            .concat(this.getTexts())
            .reverse();

        if (items.length > 0) {
            let selectedItems: (DesignText | DesignArt)[] = items.filter((element) => {
                return this.tt.list.indexOf(element) >= 0;
            });

            if (selectedItems.length > 0) {
                items = selectedItems;
            }
        }

        return items;
    }

    addArt(data: DesignData, addToRecent: boolean = false, x: number = NaN, y: number = NaN, restrictMaxSize: boolean = true) {
        let m: ArtModel;
        if (data.model) {
            // data contains a whole model
            m = ArtService.createArtModel(data.model as ArtModel);
        } else {
            // data contains some properties
            m = ArtService.createArtModel();
            this.artService.copyDataToModel(data, m);

            let centerPoint: PIXI.Point = this.getCenterPoint(MeasurementService.INCH);
            m.x = centerPoint.x;
            m.y = centerPoint.y;

            if (m.artType === ArtService.ART_TYPE_VASE) {
                // choose color of a tablet
                let items: (DesignShape | DesignArt)[] = this.getContextColoredItems();
                m.color = items.length > 0 ? items[0].model.color : AssetService.DEFAULT_BITMAP_FILL_ID;
            } else {
                let items: (DesignText | DesignArt)[] = this.getContextSinkageItems();
                m.sinkage = items.length > 0 ? items[0].model.sinkage : AssetService.DEFAULT_SINKAGE_COLOR_ID;
            }
        }

        if (!isNaN(x) && !isNaN(y)) {
            m.x = MeasurementService.pxToUnit(x);
            m.y = MeasurementService.pxToUnit(y);
        }

        if (!m.imageFile) {
            return;
        }

        this.artService.createArt(
            m,
            (da: DesignArt) => {
                let forcedSize: boolean = da.model.inchWidth > 0 || (da.model.lockDimensions && da.model.minWidth > 0);
                if (restrictMaxSize && !forcedSize) {
                    const maxSizeInch: number = 24; // any suitable value
                    let sc: number = Math.min(maxSizeInch / da.model.textureWidth, maxSizeInch / da.model.textureHeight);
                    if (sc < 1) {
                        da.scale.x = sc;
                        da.scale.y = sc;
                    }

                    da.updateModel();
                }

                this.container.addChildAt(da, this.getRecommenedCreationLevel(da));

                this.tt.removeAllTransformables();
                this.tt.addTransformables([da]);

                this.updateAnchorsAndMasks();
                this.doAutoZoomDelayed();
                this.remember();
            },
            addToRecent
        );
    }

    getArts(types?: string[]) {
        let arts: DesignArt[] = [];

        for (let item of this.container.children) {
            if (item.hasOwnProperty('model') && (item as DesignItem).model.type === 'art') {
                let da: DesignArt = item as DesignArt;
                if (!types || types.indexOf(da.model.artType) >= 0) {
                    arts.push(da);
                }
            }
        }

        return arts;
    }

    addText(startEditing: boolean = true) {
        let m: TextModel = TextService.createTextModel();

        let centerPoint: PIXI.Point = this.getCenterPoint(MeasurementService.INCH);
        m.x = centerPoint.x;
        m.y = centerPoint.y;

        let items: (DesignText | DesignArt)[] = this.getContextSinkageItems();
        m.sinkage = items.length > 0 ? items[0].model.sinkage : AssetService.DEFAULT_SINKAGE_COLOR_ID;

        let dt: DesignText = this.textService.createText(m);

        this.container.addChildAt(dt as PIXI.Container, this.getRecommenedCreationLevel(dt));

        this.tt.removeAllTransformables();
        this.tt.addTransformables([dt]);

        if (startEditing) {
            this.textService.startTextEditing();
        }

        this.updateAnchorsAndMasks();
        this.doAutoZoomDelayed();
        this.remember();
    }

    getTexts() {
        let texts: DesignText[] = [];

        for (let item of this.container.children) {
            if (item.hasOwnProperty('model') && (item as DesignItem).model.type === 'text') {
                let dt: DesignText = (item as DesignItem) as DesignText;
                texts.push(dt);
            }
        }

        return texts;
    }

    // test
    addRandomSimpleShape = () => {
        let m: ShapeModel = ShapeService.createShapeModel();

        m.color = this.as.bitmapFills[Object.keys(this.as.bitmapFills)[Math.floor(Math.random() * 3)]].id;

        m.x = MeasurementService.pxToUnit(Math.floor(Math.random() * this.cW));
        m.y = MeasurementService.pxToUnit(Math.floor(Math.random() * this.cH));
        m.rotation = Math.floor((Math.PI / 8) * (0.5 - Math.random()) * 10000) / 10000;

        this.shapeService.createShape(m, (ds: DesignShape) => {
            this.container.addChildAt(ds, this.getRecommenedCreationLevel(ds));

            this.tt.removeAllTransformables();
            this.tt.addTransformables([ds]);

            this.updateAnchorsAndMasks();
            this.applyPhysics();
            this.doAutoZoomDelayed();
            this.remember();
        });
    };

    addShape = (
        shapeData: DesignData,
        forceNewTablet: boolean = false,
        forceNewBase: boolean = false,
        x: number = NaN,
        y: number = NaN
    ) => {
        let newModel: ShapeModel = ShapeService.createShapeModel();
        this.shapeService.copyDataToModel(shapeData, newModel, false);
        let dTypeNew: string = this.shapeService.getDetailedType(newModel, false);
        let dTypeNewBase: string = this.shapeService.getDetailedType(newModel, true);

        let transitionMap: Map<DesignShape, string[]> = new Map(); // props to copy during transition
        let baseAllowed: boolean = this.shapeService.baseAllowed(newModel);
        let items: PIXI.Container[] = this.tt.list.concat();
        let centerPoint: PIXI.Point = this.getCenterPoint();
        let contextTablets: DesignShape[] = this.getContextTablets();
        let contextBases: DesignShape[] = contextTablets.map((elem) => this.getClosestUnderBase(elem)).filter((elem) => elem);

        // add not selected shapes to the context (because simultaneous presence of some shape types is undesirable)
        let allTablets: DesignShape[] = this.getShapes('tablet');
        allTablets.forEach((tablet) => {
            let dType: string = this.shapeService.getDetailedType(tablet.model, false);
            if (dType !== dTypeNew) {
                if (
                    [dType, dTypeNew].indexOf(ShapeService.SHAPE_TYPE_FLAT_MARKER) >= 0 ||
                    [dType, dTypeNew].indexOf(ShapeService.SHAPE_TYPE_BEVEL_MARKER) >= 0
                ) {
                    contextTablets.push(tablet);
                }
            }
        });
        let allBases: DesignShape[] = this.getShapes('base');
        allBases.forEach((base) => {
            let dTypeBase: string = this.shapeService.getDetailedType(base.model, true);
            if (dTypeBase !== dTypeNewBase) {
                if (
                    [dTypeBase, dTypeNewBase].indexOf(ShapeService.SHAPE_TYPE_BASE_NONE) >= 0 ||
                    [dTypeBase, dTypeNewBase].indexOf(ShapeService.SHAPE_TYPE_BASE_BEVEL_MARKER) >= 0
                ) {
                    contextBases.push(base);
                }
            }
        });

        // remove repeating shapes
        contextTablets = contextTablets.filter((elem, i, a) => a.indexOf(elem) === i);
        contextBases = contextBases.filter((elem, i, a) => a.indexOf(elem) === i);

        // describe transitions between different types of shapes (for replacement)
        contextTablets.forEach((tablet) => {
            let props: string[] = ['color'];
            let dType: string = this.shapeService.getDetailedType(tablet.model, false);

            if (dType === dTypeNew && dTypeNew !== ShapeService.SHAPE_TYPE_CUSTOM) {
                props.push('width', 'height', 'depth');
            }
            transitionMap.set(tablet, props);
        });
        contextBases.forEach((base) => {
            let props: string[] = ['color'];
            let dTypeBase: string = this.shapeService.getDetailedType(base.model, true);

            let tablets: DesignShape[] = this.getTabletsOver(base);
            if (dTypeBase === dTypeNewBase) {
                if (tablets.length > 1) {
                    props.push('skip');
                } else {
                    if (tablets.length === 1) {
                        let dType: string = this.shapeService.getDetailedType(tablets[0].model, false);
                        if (dType === dTypeNew && dTypeNew !== ShapeService.SHAPE_TYPE_CUSTOM) {
                            props.push('skip');
                        }
                    }
                }
            } else {
                if (tablets.length > 1) {
                    // TODO: may be included the case when few bases under placed under one common tablet and similar
                    if ([dTypeBase, dTypeNewBase].indexOf(ShapeService.SHAPE_TYPE_BASE_BEVEL_MARKER) >= 0) {
                        props.push('width');
                    }
                }
            }

            transitionMap.set(base, props);
        });

        if (!isNaN(x)) {
            // place without colliding with existing shapes on stage (drag n drop)
            let bounds: PIXI.Rectangle = this.getShapesLocalBounds(this.container.children as DesignItem[]);
            if (bounds) {
                let shiftInch: number = Math.max(0, shapeData.baseWidth, shapeData.width) / 2 + 4;
                x = centerPoint.x + (x > centerPoint.x ? 1 : -1) * (bounds.width / 2 + MeasurementService.inchToPx(shiftInch));
            }
        }

        let addBases: Function = (cb: Function) => {
            if ((contextTablets.length === 0 && contextBases.length === 0) || forceNewBase) {
                // add a new base
                if (baseAllowed && shapeData.baseWidth > 0 && shapeData.baseHeight > 0 && shapeData.baseDepth > 0) {
                    let m: ShapeModel = ShapeService.createShapeModel();
                    this.shapeService.copyDataToModel(shapeData, m, true);
                    m.shapeType = ShapeService.SHAPE_TYPE_BASE;
                    m.darkImage = '';
                    m.lightImage = '';
                    m.additionalLayer = '';

                    m.x = MeasurementService.pxToUnit(isNaN(x) ? centerPoint.x : x);
                    m.y = MeasurementService.pxToUnit(isNaN(y) ? centerPoint.y + 200 : y);

                    let contextColor: string = contextBases[0]
                        ? contextBases[0].model.color
                        : contextTablets[0]
                        ? contextTablets[0].model.color
                        : null;
                    if (contextColor) {
                        m.color = contextColor;
                    }

                    this.shapeService.createShape(m, (ds: DesignShape) => {
                        this.container.addChildAt(ds, this.getLowestAvailableLevel(ds));

                        cb();
                    });
                } else {
                    cb();
                }
            } else {
                // replace context bases

                this.tt.removeAllTransformables();

                let baseModels: ShapeModel[];
                let isSelected: boolean[];

                // remember some data
                baseModels = [];
                isSelected = [];
                for (let base of contextBases) {
                    baseModels.push(base.model);
                    let i: number = items.indexOf(base);
                    if (i >= 0) {
                        items.splice(i, 1);
                    }
                    isSelected.push(i >= 0);
                }

                // remove old bases
                for (let i = 0; i < contextBases.length; i++) {
                    let base: DesignShape = contextBases[i];
                    let trs: string[] = transitionMap.get(base);
                    if (trs && trs.indexOf('skip') === -1) {
                        this.container.removeChild(base);
                    }
                }

                // create new bases
                let basesToAdd: number = baseModels.length;

                if (basesToAdd === 0) {
                    cb();
                }
                for (let i: number = 0; i < baseModels.length; i++) {
                    let trs: string[] = transitionMap.get(contextBases[i]);
                    if (
                        ((trs && trs.indexOf('skip') === -1) || !trs) &&
                        baseAllowed &&
                        shapeData.baseWidth > 0 &&
                        shapeData.baseHeight > 0 &&
                        shapeData.baseDepth > 0
                    ) {
                        let m: ShapeModel = ShapeService.createShapeModel();
                        this.shapeService.copyDataToModel(shapeData, m, true);
                        m.shapeType = ShapeService.SHAPE_TYPE_BASE;
                        m.darkImage = '';
                        m.lightImage = '';
                        m.additionalLayer = '';

                        let baseModel: ShapeModel = baseModels[i];
                        m.x = baseModel.x;
                        m.y = baseModel.y;

                        if (trs) {
                            trs.forEach((prop) => {
                                m[prop] = baseModel[prop];
                            });
                        }

                        this.shapeService.createShape(m, (ds: DesignShape) => {
                            basesToAdd--;

                            this.container.addChildAt(ds, this.getLowestAvailableLevel(ds));

                            if (isSelected[i]) {
                                items.push(ds);
                            }
                            if (basesToAdd === 0) {
                                cb();
                            }
                        });
                    } else {
                        basesToAdd--;
                        if (basesToAdd === 0) {
                            cb();
                        }
                    }
                }
            }
        };

        if (contextTablets.length === 0 || forceNewTablet) {
            // add a new tablet
            if (shapeData.width > 0 && shapeData.height > 0 && shapeData.depth > 0) {
                let m: ShapeModel = ShapeService.createShapeModel();
                this.shapeService.copyDataToModel(shapeData, m, false);

                m.x = MeasurementService.pxToUnit(isNaN(x) ? centerPoint.x : x);
                m.y = MeasurementService.pxToUnit(isNaN(y) ? centerPoint.y : y);

                let contextColor: string = contextTablets[0]
                    ? contextTablets[0].model.color
                    : contextBases[0]
                    ? contextBases[0].model.color
                    : null;
                if (contextColor) {
                    m.color = contextColor;
                }

                baseAllowed = this.shapeService.baseAllowed(m);

                this.shapeService.createShape(m, (ds: DesignShape) => {
                    this.container.addChildAt(ds, this.getRecommenedCreationLevel(ds));

                    // addBase is synchronous funciton at the moment despite its internal callback function
                    addBases(() => {
                        this.updateAnchorsAndMasks();
                        this.applyPhysics();
                        this.doAutoZoomDelayed();
                        this.remember();
                    });
                });
            } else {
                addBases(() => {
                    this.updateAnchorsAndMasks();
                    this.applyPhysics();
                    this.doAutoZoomDelayed();
                    this.remember();
                });
            }
        } else {
            // replace context tablets

            this.tt.removeAllTransformables();
            // remember some data
            let tabletModels: ShapeModel[] = [];
            let layerIndices: number[] = [];
            let isSelected: boolean[] = [];
            for (let tablet of contextTablets) {
                tabletModels.push(tablet.model);
                layerIndices.push(this.container.children.indexOf(tablet));
                let i: number = items.indexOf(tablet);
                if (i >= 0) {
                    items.splice(i, 1);
                }
                isSelected.push(i >= 0);
            }

            // remove old tablets
            for (let tablet of contextTablets) {
                this.container.removeChild(tablet);
            }

            // create new tablets
            let tabletsToAdd: number = tabletModels.length;
            for (let i: number = 0; i < tabletModels.length; i++) {
                if (shapeData.width > 0 && shapeData.height > 0 && shapeData.depth > 0) {
                    let m: ShapeModel = ShapeService.createShapeModel();
                    this.shapeService.copyDataToModel(shapeData, m, false);

                    let tabletModel: ShapeModel = tabletModels[i];
                    m.x = tabletModel.x;
                    m.y = tabletModel.y;

                    let trs: string[] = transitionMap.get(contextTablets[i]);
                    if (trs) {
                        // copy transition props (usually width, height, depth)
                        trs.forEach((prop) => {
                            m[prop] = tabletModel[prop];
                        });
                    }

                    this.shapeService.createShape(m, (ds: DesignShape) => {
                        tabletsToAdd--;
                        this.container.addChildAt(ds, Math.min(layerIndices[i], this.getRecommenedCreationLevel(ds)));
                        if (isSelected[i]) {
                            items.push(ds);
                        }

                        if (tabletsToAdd === 0) {
                            // all shapes added

                            // addBase is synchronous funciton at the moment despite its internal callback function
                            addBases(() => {
                                items = items.filter((element) => element);
                                this.tt.addTransformables(items);

                                this.updateAnchorsAndMasks();
                                this.applyPhysics();
                                this.doAutoZoomDelayed();
                                this.remember();
                            });
                        }
                    });
                }
            }
        }
    };

    // get 'all', 'tablet' or 'base' shapes
    getShapes(kind: string = 'all') {
        let shapes: DesignShape[] = [];
        let bases: boolean = kind === 'base';

        for (let item of this.container.children) {
            if (item.hasOwnProperty('model') && (item as DesignItem).model.type === 'shape') {
                let ds: DesignShape = item as DesignShape;
                if (kind === 'all' || ShapeService.isBaseShape(ds) === bases) {
                    shapes.push(ds);
                }
            }
        }

        return shapes;
    }

    getShapesOnGround() {
        let shapesOnGround: DesignShape[] = [];
        let shapes: DesignShape[] = this.getShapes();

        if (shapes.length > 0) {
            let sb: PIXI.Rectangle = this.getShapesLocalBounds(shapes);
            let globalGroundY: number = sb.y + sb.height;

            let maxDiff: number = 1 / this.comparePosCoef; // 0

            for (let ds of shapes) {
                let b: PIXI.Rectangle = ds.getBounds();
                // go into container's coordinates
                this.boundsToContainerBounds(b);
                let groundY: number = b.y + b.height;
                if (Math.abs(groundY - globalGroundY) <= maxDiff) {
                    shapesOnGround.push(ds);
                }
            }
        }

        return shapesOnGround;
    }

    getContextTablets(onlySelected: boolean = false) {
        let shapes: DesignShape[] = this.getShapes('tablet');

        if (shapes.length > 0) {
            let selectedShapes: DesignShape[] = shapes.filter((element) => {
                return this.tt.list.indexOf(element) >= 0;
            });

            if (selectedShapes.length > 0 || onlySelected) {
                return selectedShapes;
            }
        }

        return shapes;
    }

    getContextBases(onlySelected: boolean = false) {
        let shapes: DesignShape[] = this.getShapes('base');

        if (shapes.length > 0) {
            let selectedShapes: DesignShape[] = shapes.filter((element) => {
                return this.tt.list.indexOf(element) >= 0;
            });

            if (selectedShapes.length > 0 || onlySelected) {
                return selectedShapes;
            }
        }

        return shapes;
    }

    getClosestUnderBase(ds?: DesignShape) {
        let underBases: DesignShape[] = this.getBasesUnder(ds);
        return underBases[underBases.length - 1];
    }

    removeShapes(shapeIDs: string[]) {
        let items: PIXI.DisplayObject[] = [];
        for (let item of this.container.children) {
            if (item.hasOwnProperty('model') && (item as DesignItem).model.type === 'shape') {
                let p: string = (item as DesignShape).model.shape;

                if (shapeIDs.indexOf(p) >= 0) {
                    items.push(item);
                }
            }
        }

        for (let item of items) {
            this.removeTransformable(item as PIXI.Container);

            this.container.removeChild(item);
        }

        this.updateAnchorsAndMasks();
        this.applyPhysics();
        this.doAutoZoomDelayed();
        this.remember();
    }

    addBackground(data: DesignData) {
        let m: BackgroundModel = BackgroundService.createBackgroundModel();

        this.bgService.copyDataToModel(data, m);

        this.removeBackgroundAndGrass();

        // auto zoom for no bg only (white bg)
        this.autoZoom = !m.imagePath;
        if (!m.imagePath) {
            this.tt.removeAllTransformables();
        }

        this.createBackgroundAndGrass(m, () => {
            this.doAutoZoomDelayed();
            this.remember();
            // select all
            this.tt.removeAllTransformables();
            this.tt.addTransformables(this.container.children.filter((element) => element.hasOwnProperty('model')) as DesignItem[]);
        });
    }

    createBackgroundAndGrass(m: BackgroundModel, cb?: Function) {
        this.bgService.createBackground(
            m,
            (db: DesignBackground) => {
                if (db) {
                    this.background = db;
                    this.stage.addChildAt(this.background, 0);

                    if (this.config.isUploaded(m.imagePath)) {
                        // no grass for an uploaded image
                        this.updateBackgroundAndGrass();
                        this.updateGrid();
                    } else {
                        // create grass
                        if (m.showGrass) {
                            m = _.cloneDeep(m);
                            // sync function (cause the bg image already preloaded)
                            this.bgService.createBackground(m, (db: DesignBackground) => {
                                this.backgroundMasked = db;
                                this.stage.addChildAt(this.backgroundMasked, 2);

                                if (!this.grass) {
                                    this.grass = new SuperGraphics();
                                    this.grass.beginFill(0x6699cc);
                                    this.grass.decodePath(this.as.paths.grass).endFill();
                                }
                                this.stage.addChildAt(this.grass, 3);

                                this.backgroundMasked.mask = this.grass;
                            });
                            // sync
                            this.bgService.createBackground(m, (db: DesignBackground) => {
                                this.backgroundMasked2 = db;
                                this.stage.addChildAt(this.backgroundMasked2, 4);

                                if (!this.grass2) {
                                    this.grass2 = new SuperGraphics();
                                    this.grass2.beginFill(0x6699cc);
                                    this.grass2.decodePath(this.as.paths.grass).endFill();
                                }
                                this.stage.addChildAt(this.grass2, 5);

                                this.backgroundMasked2.mask = this.grass2;
                                this.backgroundMasked2.alpha = 0.5;
                            });
                        }
                        this.updateBackgroundAndGrass();
                        this.updateGrid();
                    }
                }

                if (typeof cb === 'function') {
                    cb();
                }
            },
            true,
            this.minBackgroundRatio
        );
    }

    removeBackgroundAndGrass() {
        if (this.background && this.background.parent) {
            this.background.parent.removeChild(this.background);
            this.background = null;
        }

        if (this.backgroundMasked && this.backgroundMasked.parent) {
            this.backgroundMasked.parent.removeChild(this.backgroundMasked);
            this.backgroundMasked2.parent.removeChild(this.backgroundMasked2);
            if (this.grass && this.grass.parent) {
                this.grass.parent.removeChild(this.grass);
                this.grass2.parent.removeChild(this.grass2);
            }

            this.backgroundMasked = null;
            this.backgroundMasked2 = null;
            this.grass = null;
            this.grass2 = null;
        }
    }

    updateBackgroundAndGrass(preserveMonumentPosition: boolean = false) {
        let updBg: Function = (db: DesignBackground) => {
            let len: number = this.background.children.length || 1;
            let sc: number = Math.max(this.cW / (len * this.background.bgTexture.width), this.cH / this.background.bgTexture.height);

            db.scale.x = sc;
            db.scale.y = sc;

            db.x = this.cW / 2;
            db.y = this.cH - (sc * this.background.bgTexture.height) / 2;
        };

        if (this.background) {
            let mdx: number;
            let mdy: number;
            let sc: number;
            let bounds: PIXI.Rectangle;
            let bottomCenter: PIXI.ObservablePoint;
            if (preserveMonumentPosition) {
                // remember relative position of the monument
                sc = this.background.scale.x;

                bounds = this.getContainerBoundsWithoutGrid(true);
                bottomCenter = new PIXI.Point(bounds.x + bounds.width / 2, bounds.y + bounds.height);

                mdx = (this.background.x - bottomCenter.x) / this.background.scale.x;
                mdy = (this.background.y - bottomCenter.y) / this.background.scale.y;
            }

            updBg(this.background);
            this.background.updateModel(); // same model for the background and the grass

            let monPointGlobal: PIXI.Point = this.stage.toLocal(
                new PIXI.Point(this.background.model.monX, this.background.model.monY),
                this.background
            );

            monPointGlobal.x -= (this.background.bgTexture.width * this.background.scale.x) / 2;
            monPointGlobal.y -= (this.background.bgTexture.height * this.background.scale.y) / 2;

            if (monPointGlobal.x <= 0 || monPointGlobal.y <= 0 || monPointGlobal.x >= this.cW || monPointGlobal.y >= this.cH) {
                // correct wrong bad positioning
                monPointGlobal.x = this.cW / 2;
                monPointGlobal.y = this.cH * 0.85;
            }

            if (this.backgroundMasked) {
                updBg(this.backgroundMasked);
                updBg(this.backgroundMasked2);

                this.grass.scale.set(this.background.scale.x);
                this.grass.x = this.background.x;
                this.grass.y = monPointGlobal.y + this.grass.height * 0.2;

                this.grass2.scale.set(-this.grass.scale.x, this.grass.scale.y);
                this.grass2.x = this.grass.x;
                this.grass2.y = this.grass.y - this.grass.height * 0.05;
            }

            // place container

            let items: PIXI.Container[] = this.tt.list.concat();
            this.tt.removeAllTransformables();

            if (preserveMonumentPosition) {
                // place relatively an exising background
                sc = (this.container.scale.x * this.background.scale.x) / sc;

                this.container.x = this.background.x - mdx * this.background.scale.x - (bottomCenter.x - this.container.x);
                this.container.y = this.background.y - mdy * this.background.scale.y - (bottomCenter.y - this.container.y);
            } else {
                // place relatively a newely added background
                sc = (this.background.model.pxPerFoot / MeasurementService.inchToPx(12)) * this.background.scale.x;
                bounds = this.getContainerBoundsWithoutGrid(true);
                bottomCenter = new PIXI.Point(bounds.x + bounds.width / 2, bounds.y + bounds.height);

                this.container.x += monPointGlobal.x - bottomCenter.x;
                this.container.y += monPointGlobal.y - bottomCenter.y;
            }

            this.scaleContainerRelativelyToPoint(0.5, 1, sc);
            this.tt.addTransformables(items);
        }
    }

    set showRuler(value: boolean) {
        if (!this.ruler) {
            return;
        }

        let show: Function = () => {
            if (value) {
                if (this.ruler.parent) {
                    return;
                }

                let centerPoint: PIXI.Point = this.getCenterPoint();
                this.ruler.x = centerPoint.x;
                this.ruler.y = centerPoint.y;
                this.ruler.updateModel('movement');

                this.container.addChildAt(this.ruler, this.getRecommenedCreationLevel(this.ruler));

                this.tt.removeAllTransformables();
                this.tt.addTransformables([this.ruler]);

                this.doAutoZoomDelayed();
            } else {
                if (!this.ruler.parent) {
                    return;
                }

                this.removeTransformable(this.ruler);

                this.container.removeChild(this.ruler);

                this.doAutoZoomDelayed();
            }
        };

        // don't add while tweening, otherwise the ruler can be resized inproperly
        this.whenSceneIsReady().then((result) => {
            show();
        });
    }

    get showRuler() {
        return this.ruler && this.ruler.parent ? true : false;
    }

    set showGrid(value: boolean) {
        if (!this.grid) {
            return;
        }

        if (value) {
            if (this.grid.parent) {
                return;
            }

            this.container.addChildAt(this.grid, this.getRecommenedCreationLevel(this.grid));

            this.updateGrid();
        } else {
            if (!this.grid.parent) {
                return;
            }

            if (this.grid.interactive) {
                this.removeTransformable(this.grid);
            }

            this.container.removeChild(this.grid);
        }
    }

    get showGrid() {
        return this.grid && this.grid.parent ? true : false;
    }

    removeTransformable(item: PIXI.Container) {
        if (!this.tt) {
            return;
        }

        const index: number = this.tt.list.indexOf(item);

        if (index >= 0) {
            let savedList: any = this.tt.list.concat();

            this.tt.removeAllTransformables();

            savedList.splice(index);

            this.tt.addTransformables(savedList);
        }
    }

    getTypeOfTransformable = (list: PIXI.Container[]) => {
        let type: string;

        if (list.length > 1) {
            let item: PIXI.Container = list[0];

            type = (item as DesignItem).model.type;

            for (let i: number = 1; i < list.length; i++) {
                if ((list[i] as DesignItem).model.type !== type) {
                    type = 'group';
                    break;
                }
            }

            if (type !== 'group') {
                // all the same type
                type = 'group' + type.charAt(0).toUpperCase() + type.substr(1);
            } else {
                // different types
                if (!list.find((element) => (element as DesignItem).model.type === 'shape')) {
                    type = 'groupWithoutShape';
                }
            }
        } else {
            if (list.length === 1) {
                let item: PIXI.Container = list[0];
                let m: ArtModel = (item as DesignArt).model;
                type = m.type;

                if (type === 'art') {
                    if (m.artType === ArtService.ART_TYPE_VASE) {
                        type = m.lockDimensions ? 'artVase' : 'artVaseLockedDimensions';
                    } else {
                        if (m.lockDimensions) {
                            type = 'artLockedDimensions';
                        } else {
                            if (m.artType === ArtService.ART_TYPE_PANEL) {
                                type = 'artPanel';
                            }
                        }
                    }
                } else if (type === 'shape') {
                    if (m.lockDimensions) {
                        type = 'shapeLockedDimensions';
                    }
                }
            } else {
                type = 'general';
            }
        }

        this.typeofTransformable = type;

        return type;
    };

    onPointerDown = (e: Event) => {
        // hide the soft keyboard
        this.renderer.view.focus();

        if (this.isPointerDown && !this.ui.blockUIForGestures) {
            // stop selection and dragging process to enable 2-finger scaling (pinch) on touch devices
            if (this.isSelecting) {
                this.st.onSelectEnd();
                this.st.clearSelection();
            }

            if (this.tt.isDragging) {
                this.tt.removeAllTransformables();
                this.onTransformEnd();
            }

            // allow to use gestures (better to hide the canvas when this popup appears to avoid an issue with laggy gestures in Chromium)
            this.ui.showGesturesPopup();
            return;
        }

        this.isPointerDown = true;
    };

    onPointerUp = () => {
        this.isPointerDown = false;
    };

    onSelectStart = () => {
        // handle a blur event occured when you click canvas
        this.textService.stopTextEditing();

        this.isSelecting = true;
    };

    onSelectChange = () => {
        this.tt.removeAllTransformables();

        this.tt.drawOutlines(this.getFilteredSelection(this.st.tmpSelectedChildren as DesignItem[]));
    };

    onSelectComplete = () => {
        this.tt.removeAllTransformables();

        this.tt.addTransformables(this.getFilteredSelection(this.st.selectedChildren as DesignItem[]));

        this.isSelecting = false;
    };

    getFilteredSelection(selectedItems: DesignItem[]) {
        if (this.autoZoom) {
            // for the white bg only
            let shapes: DesignItem[] = selectedItems.filter(
                (element) => element.hasOwnProperty('model') && (element as DesignItem).model.type === 'shape'
            ) as DesignItem[];
            let notShapes: DesignItem[] = selectedItems.filter(
                (element) => element.hasOwnProperty('model') && (element as DesignItem).model.type !== 'shape'
            ) as DesignItem[];

            if (shapes.length > 0 && notShapes.length > 0) {
                selectedItems = notShapes;
            }
        }

        return selectedItems;
    }

    onTransformAdd = () => {
        this.textService.stopTextEditing();

        let defMinScale: number = 0.0001;
        switch (this.typeofTransformable) {
            case 'art':
                let m: ArtModel = (this.tt.list[0] as DesignArt).model;

                let scX: number = m.minWidth > 0 && m.textureWidth > 0 ? m.minWidth / m.textureWidth : defMinScale;
                let scY: number = m.minHeight > 0 && m.textureHeight > 0 ? m.minHeight / m.textureHeight : defMinScale;

                this.tt.setMinScale(scX, scY);
                break;
            case 'artVase':
            case 'artVaseKeepColor':
                //
                break;
            case 'text':
                this.textService.selectedInput = this.tt.list[0] as DesignText;
                break;
            case 'shape':
                this.shapeService.selectedShape = this.tt.list[0] as DesignShape;
                this.tt.setMinScale(defMinScale, defMinScale);
                break;
        }
        // TODO: add selectedArt for the artService?
        if (this.typeofTransformable !== 'text') {
            this.textService.selectedInput = null;
        }
        if (this.typeofTransformable !== 'shape') {
            this.shapeService.selectedShape = null;
        }

        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_ADD);
    };

    onTransformBeforeRemove = () => {
        if (!this.textService.editableInput) {
            this.textService.selectedInput = null;
        }
        this.shapeService.selectedShape = null;

        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_BEFORE_REMOVE);
    };

    onTransformRemove = () => {
        this.updateAnchorsAndMasks();
        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_REMOVE);
    };

    // TODO: add different types of transform events (rotating, dragging, scaling) for better performance
    // e.g. on dragging no need to call redraw() for a MultiCase instance and redraw the tt's box etc.
    onTransform = () => {
        for (let item of this.tt.list) {
            if (item instanceof Ruler) {
                if (this.tt.list.length === 1) {
                    (item as Ruler).redraw();
                }
            }

            if (item instanceof MultiCase) {
                (item as Case).redraw();
                if (this.tt.list.length === 1) {
                    this.tt.redraw();
                }
            }

            (item as DesignItem).updateModel('movement');
        }

        this.updateAnchorsAndMasks();

        this.drawOutlines(true);

        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_TRANSFORM);
    };

    onTransformBeforeStart = () => {
        this.st.selectionEnabled = false;
    };

    onTransformEnd = () => {
        this.dropFromCanvas();

        this.st.selectionEnabled = true;

        this.applyPhysics();
        this.doAutoZoomDelayed();
        this.remember();
        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_TRANSFORM_END);
    };

    onTransformRedraw = () => {
        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_REDRAW);
    };

    onTransformOptions = (e: any) => {
        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_OPTIONS);
    };

    onTransformDelete = () => {
        this.deleteTransformables(this.tt.list.concat() as DesignItem[]);
    };

    deleteTransformables(deleteItems: DesignItem[]) {
        let items: PIXI.Container[] = this.tt.list.filter((elem) => deleteItems.indexOf(elem as DesignItem) === -1);
        this.tt.removeAllTransformables();

        for (let item of deleteItems) {
            this.container.removeChild(item);
        }

        this.st.selectionEnabled = true;

        this.updateAnchorsAndMasks();
        this.tt.addTransformables(items);
        this.applyPhysics();
        this.doAutoZoomDelayed();
        this.remember();

        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_DELETE);
    }

    copyTransformables = (
        items: PIXI.Container[],
        dx: number = 0,
        dy: number = 0,
        updateTT: boolean = true,
        emit: boolean = true,
        extraModelTransform: (item: DesignItem, m: SceneItemModel) => void = null,
        deleteItems: boolean = false
    ): DesignItem[] => {
        let hasShape: boolean = false;
        let newItems: DesignItem[] = [];

        dx = MeasurementService.pxToUnit(dx);
        dy = MeasurementService.pxToUnit(dy);

        for (let item of items) {
            let newModel: SceneItemModel = null;
            let newItem: DesignItem = null;
            switch ((item as DesignItem).model.type) {
                case 'art':
                    newModel = _.cloneDeep((item as DesignArt).model);
                    newModel.x += dx;
                    newModel.y += dy;

                    if (typeof extraModelTransform === 'function') {
                        extraModelTransform(item as DesignItem, newModel);
                    }

                    newItem = this.artService.createArt(newModel as ArtModel);
                    break;

                case 'text':
                    newModel = _.cloneDeep((item as DesignText).model);
                    newModel.x += dx;
                    newModel.y += dy;

                    if (typeof extraModelTransform === 'function') {
                        extraModelTransform(item as DesignItem, newModel);
                    }

                    newItem = this.textService.createText(newModel as TextModel);
                    break;

                case 'shape':
                    hasShape = true;

                    newModel = _.cloneDeep((item as DesignShape).model);
                    newModel.x += dx;
                    newModel.y += dy;

                    if (typeof extraModelTransform === 'function') {
                        extraModelTransform(item as DesignItem, newModel);
                    }

                    newItem = this.shapeService.createShape(newModel as ShapeModel);
                    break;
            }

            if (newItem) {
                newItems.push(newItem);

                let layerIndex: number = this.container.children.indexOf(item);
                this.container.addChildAt(newItem, layerIndex + 1);
            }
        }

        if (deleteItems) {
            for (let item of items) {
                this.container.removeChild(item);
            }
        }

        if (updateTT && newItems.length > 0) {
            this.tt.removeAllTransformables();

            this.tt.addTransformables(newItems);
        }

        this.updateAnchorsAndMasks();
        if (hasShape) {
            this.applyPhysics();
        }
        this.doAutoZoomDelayed();
        this.remember();

        if (emit) {
            this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_OPTIONS_APPLY);
        }

        return newItems;
    };

    // copies (and shifts if needed)
    copy = (items: PIXI.Container[]) => {
        let shapeBounds: PIXI.Rectangle = this.getShapesLocalBounds(items as DesignItem[]);
        let hasShape: boolean = shapeBounds ? true : false;
        if (hasShape) {
            // at least one shape among the items
            return this.copyTransformables(
                items,
                shapeBounds.width + MeasurementService.inchToPx(6),
                0,
                true,
                true,
                (item: DesignItem, newModel: SceneItemModel) => {
                    let moveOriginalShape: boolean = this.tt.list.length === 1;
                    if (moveOriginalShape) {
                        let originalShape: DesignShape = item as DesignShape;
                        let dx: number = 0.5 * (shapeBounds.width + MeasurementService.inchToPx(6));
                        originalShape.x -= dx;
                        originalShape.redraw();
                        originalShape.updateModel('movement');

                        newModel.x -= MeasurementService.pxToUnit(dx);
                    }
                }
            );
        } else {
            return this.copyTransformables(items, 20, 20);
        }
    };

    flipH = (items: PIXI.Container[]) => {
        this.copyTransformables(
            items,
            0,
            0,
            true,
            true,
            (item: DesignItem, newModel: SceneItemModel) => {
                if (item instanceof MultiCase) {
                    if (newModel.hasOwnProperty('flipped')) {
                        (newModel as ArtModel).flipped = !(newModel as ArtModel).flipped;
                    } else {
                        newModel.scaleX = -newModel.scaleX;
                    }
                }

                newModel.rotation = -item.rotation;
            },
            true
        );
    };

    // mirrors (and shifts if needed)
    mirror = (items: PIXI.Container[]) => {
        let notShapes: PIXI.Container[] = items.filter((element) => (element as DesignItem).model.type !== 'shape');
        let hasShapes: boolean = notShapes.length !== items.length;
        if (hasShapes) {
            let shapeBounds: PIXI.Rectangle = this.getShapesLocalBounds(items as DesignItem[]);

            let moveOriginalShape: boolean = this.tt.list.length === 1;
            let shiftX: number = shapeBounds.width + MeasurementService.inchToPx(6);
            if (moveOriginalShape) {
                shiftX *= 0.5;
            }
            let bounds: PIXI.Rectangle = new PIXI.Rectangle(
                shapeBounds.x - (moveOriginalShape ? shiftX : 0),
                0,
                shapeBounds.width + shiftX,
                0
            );
            this.copyTransformables(items, 0, 0, true, true, (item: DesignItem, newModel: SceneItemModel) => {
                if (moveOriginalShape) {
                    let originalShape: DesignShape = item as DesignShape;
                    originalShape.x -= shiftX;
                    originalShape.redraw();
                    originalShape.updateModel('movement');

                    newModel.x += MeasurementService.pxToUnit(shiftX);
                } else {
                    let dx: number = item.x - bounds.x;
                    newModel.x = MeasurementService.pxToUnit(bounds.x + bounds.width - dx);
                }

                if (item instanceof MultiCase) {
                    if (newModel.hasOwnProperty('flipped')) {
                        (newModel as ArtModel).flipped = !(newModel as ArtModel).flipped;
                    } else {
                        newModel.scaleX = -newModel.scaleX;
                    }
                }

                newModel.rotation = -item.rotation;
            });
        } else {
            this.copyTransformables(items, 0, 0, true, true, (item: DesignItem, newModel: SceneItemModel) => {
                if (item instanceof MultiCase) {
                    if (newModel.hasOwnProperty('flipped')) {
                        if ((newModel as ArtModel).artType !== ArtService.ART_TYPE_VASE) {
                            // flip art (except vases)
                            (newModel as ArtModel).flipped = !(newModel as ArtModel).flipped;
                        }
                    } else {
                        newModel.scaleX = -newModel.scaleX;
                    }
                }

                newModel.rotation = -item.rotation;

                let bounds: PIXI.Rectangle;
                if (item.anchorObject && item.anchorObject.target) {
                    bounds = item.anchorObject.target.getBounds();
                    this.boundsToContainerBounds(bounds);
                } else {
                    bounds = this.getShapesLocalBounds(this.container.children as DesignItem[]);
                    if (!bounds) {
                        bounds = this.getContainerLocalBoundsWithoutGrid();
                    }
                }

                let dx: number = item.x - bounds.x;
                newModel.x = MeasurementService.pxToUnit(bounds.x + bounds.width - dx);
            });
        }
    };

    bringToFront = (e?: any) => {
        let hasShape: boolean = false;
        for (let item of this.tt.list) {
            if (item === this.ruler || item === this.grid) {
                continue;
            }
            this.container.addChildAt(item, this.getHighestAvailableLevel(item as DesignItem));
            if ((item as DesignItem).model.type === 'shape') {
                hasShape = true;
            }
        }
        if (hasShape) {
            this.applyPhysics();
        }
        this.remember();

        this.emitDataEvent(DesignServiceEventType.EVENT_TRANSFORM_TOOL_OPTIONS_APPLY);
    };

    // make sure ruler, grid etc. are always on top and maskContainer and shapes at the bottom
    getHighestAvailableLevel(item: DesignItem) {
        let level: number = 0;

        if (item.model.type === 'shape') {
            level = this.getTypedChildrenLength(item.model.type) + this.getLowestAvailableLevel(item);
        } else {
            level = this.container.children.length - this.getTopChildrenLength(item);
        }

        level = Math.max((item.parent ? -1 : 0) + level, 0);

        return level;
    }

    getRecommenedCreationLevel(item: DesignItem) {
        let level: number = 0;

        let isPanelOrArt: boolean = item.model.type === 'art' && (item as DesignArt).model.artType !== ArtService.ART_TYPE_VASE;
        let texts: DesignText[] = isPanelOrArt ? this.getTexts() : [];
        if (isPanelOrArt && texts.length > 0) {
            level = this.container.children.indexOf(texts[0] as PIXI.Container);

            level = Math.max((item.parent ? -1 : 0) + level, 0);
        } else {
            level = this.getHighestAvailableLevel(item);
        }

        return level;
    }

    getLowestAvailableLevel(item: DesignItem) {
        let level: number = item === this.maskContainer ? 0 : this.maskContainer.parent ? 1 : 0;
        return level;
    }

    // children that always higher than the item
    getTopChildrenLength(item: DesignItem) {
        let topChildren: number = 0;
        let highestToLowest: PIXI.DisplayObject[] = [this.ruler, this.grid];

        for (let child of highestToLowest) {
            if (child && child.parent) {
                topChildren++;
            }
            if (child === item) {
                break;
            }
        }

        return topChildren;
    }

    getTypedChildrenLength(type: string) {
        let typedChildren: PIXI.DisplayObject[] = this.container.children.filter(
            (element) => element.hasOwnProperty('model') && (element as DesignItem).model.type === type
        );

        return typedChildren.length;
    }

    getDefaultChildren() {
        let highestToLowest: PIXI.DisplayObject[] = [this.ruler, this.grid, this.outlineContainer, this.maskContainer];
        return highestToLowest.filter((elem) => elem && elem.parent);
    }

    getNonInteractiveChildren() {
        let highestToLowest: PIXI.DisplayObject[] = [this.grid, this.outlineContainer, this.maskContainer];
        return highestToLowest.filter((elem) => elem && elem.parent);
    }

    onAutoZoomChange(value: boolean) {
        this.autoZoom = value;

        this.doAutoZoom();
    }

    onZoomIn(e: any = null) {
        this.addDelayedLoop(this.zoomIn, 2, e);
    }

    zoomIn = (checkTouchMoves: boolean = false) => {
        if (checkTouchMoves && isNaN(this.touchY0)) {
            return;
        }
        let items: PIXI.Container[] = this.tt.list.concat();
        this.tt.removeAllTransformables();

        let sc: number = this.scaleContainerRelativelyToPoint(0.5, 1, this.container.scale.x + 0.01);

        this.tt.addTransformables(items);

        if (sc === this.maxContainerScale) {
            this.removeDelayedLoop();
        }

        this.updateGrid();
    };

    scaleContainerRelativelyToPoint(xNormalized: number, yNormalized: number, newScale: number) {
        let bounds: PIXI.Rectangle = this.getContainerLocalBoundsWithoutGrid();
        let localPoint: PIXI.Point = new PIXI.Point(bounds.x + bounds.width * xNormalized, bounds.y + bounds.height * yNormalized);
        let globalPoint: PIXI.Point = this.container.toGlobal(localPoint);

        let sc: number = Math.max(this.minContainerScale, Math.min(this.maxContainerScale, newScale));
        this.container.scale.set(sc);

        let newGlobalPoint: PIXI.Point = this.container.toGlobal(localPoint);
        this.container.x -= newGlobalPoint.x - globalPoint.x;
        this.container.y -= newGlobalPoint.y - globalPoint.y;

        return sc;
    }

    onZoomOut(e: any = null) {
        this.addDelayedLoop(this.zoomOut, 2, e);
    }

    zoomOut = (checkTouchMoves: boolean = false) => {
        if (checkTouchMoves && isNaN(this.touchY0)) {
            return;
        }
        let items: PIXI.Container[] = this.tt.list.concat();
        this.tt.removeAllTransformables();

        let sc: number = this.scaleContainerRelativelyToPoint(0.5, 1, this.container.scale.x - 0.01);

        this.tt.addTransformables(items);

        if (sc === this.minContainerScale) {
            this.removeDelayedLoop();
        }

        this.updateGrid();
    };

    getContainerLocalBoundsWithoutGrid() {
        if (this.grid) {
            this.grid.visible = false;
        }

        if (this.outlineContainer) {
            this.outlineContainer.visible = false;
        }

        let bounds: PIXI.Rectangle = this.container.getLocalBounds();

        if (this.grid) {
            this.grid.visible = true;
        }

        if (this.outlineContainer) {
            this.outlineContainer.visible = true;
        }

        return bounds;
    }

    getContainerBoundsWithoutGrid(inStage: boolean = false) {
        if (this.grid) {
            this.grid.visible = false;
        }

        if (this.outlineContainer) {
            this.outlineContainer.visible = false;
        }

        let bounds: PIXI.Rectangle = this.container.getBounds();

        if (inStage) {
            // TODO: in the future use matrix multiplication if stage is rotated
            bounds.x -= this.stage.x;
            bounds.x /= this.stage.scale.x;

            bounds.y -= this.stage.y;
            bounds.y /= this.stage.scale.y;

            bounds.width /= this.stage.scale.x;
            bounds.height /= this.stage.scale.y;
        }

        if (this.grid) {
            this.grid.visible = true;
        }

        if (this.outlineContainer) {
            this.outlineContainer.visible = true;
        }

        return bounds;
    }

    getStageBoundsWithoutGrid() {
        if (this.grid) {
            this.grid.visible = false;
        }

        let bounds: PIXI.Rectangle = this.stage.getBounds();

        if (this.grid) {
            this.grid.visible = true;
        }

        return bounds;
    }

    doAutoZoomDelayed = () => {
        if (!this.autoZoom) {
            return;
        }

        clearTimeout(this.timeoutIdZoom);
        this.waitingForZoom = true;
        this.timeoutIdZoom = setTimeout(() => {
            this.waitingForZoom = false;
            this.doAutoZoom();
        }, 250); // timeout must be bigger than duration of physics' animation
    };

    cancelAutoZoomDelayed() {
        clearTimeout(this.timeoutIdZoom);
        this.waitingForZoom = false;
    }

    doAutoZoom = (forced: boolean = true, duration: number = NaN) => {
        if (!this.autoZoom || this.container.children.length <= 1) {
            return;
        }
        if (forced || (!forced && !gsap.isTweening(this.container))) {
            this.killAutoZoomTweens();
            let bounds: PIXI.Rectangle = this.getContainerLocalBoundsWithoutGrid();
            let freeW: number = this.cW - this.containerMargins[1] - this.containerMargins[3];
            let freeH: number = this.cH - this.containerMargins[0] - this.containerMargins[2];
            let sc: number = Math.min(freeW / bounds.width, freeH / bounds.height, this.maxContainerScale);
            let x: number = this.containerMargins[3] + freeW / 2 - sc * (bounds.x + bounds.width / 2);
            let y: number = this.containerMargins[0] + freeH / 2 - sc * (bounds.y + bounds.height / 2);

            let enoughDifferent: boolean =
                Math.abs(x - this.container.x) >= 1 ||
                Math.abs(y - this.container.y) >= 1 ||
                Math.abs(1 - sc / this.container.scale.x) > 0.005;
            if (enoughDifferent) {
                if (isNaN(duration)) {
                    duration =
                        Math.abs(x - this.container.x) +
                        Math.abs(y - this.container.y) +
                        (bounds.width + bounds.height / 2) * Math.abs(sc - this.container.scale.x);
                    duration = Math.min(0.3, duration / 200);
                    duration = Math.max(0.15, duration);
                }

                this.tt.blockBoxInteraction = true;
                this.tt.blockCornerInteraction = true;
                this.st.selectionEnabled = false;
                let items: PIXI.Container[] = this.tt.list.concat();

                gsap.to(this.container, { duration: duration, x: x, y: y });
                gsap.to(this.container.scale, {
                    duration: duration,
                    x: sc,
                    y: sc,
                    onUpdate: () => {
                        this.tt.redraw(this.tt.list.length === 1); // TODO: improve Transform Tool so we call simply redraw(false)
                        this.emitDataEvent(DesignServiceEventType.EVENT_ZOOM);
                    },
                    onComplete: () => {
                        this.tt.blockBoxInteraction = false;
                        this.tt.blockCornerInteraction = false;
                        this.st.selectionEnabled = true;
                        this.tt.removeAllTransformables();
                        this.tt.addTransformables(items);

                        this.updateGrid();

                        this.emitDataEvent(DesignServiceEventType.EVENT_ZOOM);
                        this.emitDataEvent(DesignServiceEventType.EVENT_ZOOM_COMPLETE);
                    }
                });
            }
        }
    };

    killAutoZoomTweens = () => {
        gsap.killTweensOf(this.container);
        gsap.killTweensOf(this.container.scale);
    };

    killAllTweens = () => {
        gsap.globalTimeline.clear();
    };

    get isTweening() {
        let tweening: boolean = gsap.isTweening(this.container);
        if (!tweening) {
            tweening = this.container.children.find((element) => gsap.isTweening(element)) ? true : false;
        }
        return tweening;
    }

    applyPhysics(duration: number = 0.15) {
        if (!this.physics) {
            return;
        }
        let items: PIXI.Container[] = this.tt.list.concat();
        let shapes: DesignShape[] = [];
        let bases: DesignShape[] = [];
        let bounds: Map<DesignShape, PIXI.Rectangle> = new Map(); // bounds relatively to this.container
        let groundY: Map<DesignShape, number> = new Map();
        let topY: Map<DesignShape, number> = new Map();
        let placed: DesignShape[] = [];
        let groundYMax: number = Number.NEGATIVE_INFINITY; // ground level
        for (let i: number = this.container.children.length - 1; i >= 0; i--) {
            let di: DesignItem = this.container.children[i] as DesignItem;
            if (di.hasOwnProperty('model')) {
                switch (di.model.type) {
                    case 'shape':
                        let ds: DesignShape = di as DesignShape;
                        shapes.push(ds);
                        if (ShapeService.isBaseShape(ds)) {
                            bases.push(ds);
                        }
                        let b: PIXI.Rectangle = ds.getBounds();
                        // go into container's coordinates
                        this.boundsToContainerBounds(b);
                        bounds.set(ds, b);
                        let g: number = b.y + b.height;
                        groundY.set(ds, g);
                        groundYMax = Math.max(groundYMax, g);
                        topY.set(ds, b.y);
                        break;
                }
            }
        }

        let roundForComparison: Function = (value: number) => {
            // don't use Math.floor here (e.g. Math.floor(-0.0000000001) === -1)
            return Math.round(value * this.comparePosCoef);
        };

        let compareGroundYDescending: (a: DesignShape, b: DesignShape) => number = (a: DesignShape, b: DesignShape) => {
            let diff: number = roundForComparison(groundY.get(b) - groundY.get(a));
            if (diff > 0) {
                return 1;
            } else {
                if (diff < 0) {
                    return -1;
                } else {
                    return roundForComparison(topY.get(b) - topY.get(a));
                }
            }
        };

        let compareGroundYDescendingSimple: (a: DesignItem, b: DesignItem) => number = (a: DesignShape, b: DesignShape) => {
            if (!a.model || !b.model || a.model.type !== 'shape' || b.model.type !== 'shape') {
                return 0;
            }
            let aIsBase: boolean = ShapeService.isBaseShape(a.model);
            let bIsBase: boolean = ShapeService.isBaseShape(b.model);
            if (aIsBase && !bIsBase) {
                return -1;
            } else {
                if (!aIsBase && bIsBase) {
                    return 1;
                }
            }
            let diff: number = roundForComparison(groundY.get(b) - groundY.get(a));
            if (diff > 0) {
                return 1;
            } else {
                if (diff < 0) {
                    return -1;
                } else {
                    return 0;
                }
            }
        };

        let compareTopYAscending: (a: DesignShape, b: DesignShape) => number = (a: DesignShape, b: DesignShape) => {
            return roundForComparison(topY.get(a) - topY.get(b));
        };

        bases.sort(compareGroundYDescending);

        let alignShape: (ds: DesignShape, index: number) => void = (ds: DesignShape, index: number) => {
            let isBase: boolean = ShapeService.isBaseShape(ds.model);
            let isTV: boolean = this.shapeService.viewedFromTop(ds.model);
            let b: PIXI.Rectangle = bounds.get(ds);
            let underBases: DesignShape[] = this.getBasesUnder(ds);
            underBases.sort(compareTopYAscending);
            if (isTV && !isBase) {
                underBases.reverse();
            }
            let closestBase: DesignShape = underBases.find((element) => placed.indexOf(element) >= 0);
            let y0: number = ds.y;
            let y1: number;
            if (closestBase) {
                let baseH: number = bounds.get(closestBase).height;
                if (isTV && !isBase) {
                    y1 = groundY.get(closestBase) - b.height * 0.5 - (baseH > b.height ? 0.5 * (baseH - b.height) : 0);
                } else {
                    y1 = groundY.get(closestBase) - b.height * 0.5 - baseH + (isTV ? 0 : this.baseShapeOverlayDY);
                }
            } else {
                y1 = groundYMax - b.height * 0.5;
            }
            ds.y = y1;

            b = ds.getBounds();
            // go into container's coordinates
            this.boundsToContainerBounds(b);
            bounds.set(ds, b);
            let g: number = b.y + b.height;
            groundY.set(ds, g);
            topY.set(ds, b.y);
            // mark as placed
            placed.push(ds);

            // now back to previous values just to perform animations (the model won't be changed)
            ds.y = y0;

            ds.redraw();
            ds.updateModel('movement');

            gsap.to(ds, {
                duration: duration,
                y: y1,
                onUpdate: () => {
                    ds.redraw();
                    ds.updateModel('movement');
                }
            });
        };

        if (shapes.length > 0) {
            this.tt.blockBoxInteraction = true;
            this.tt.blockCornerInteraction = true;
            this.st.selectionEnabled = false;

            shapes.forEach((ds) => {
                gsap.killTweensOf(ds);
            });
        }

        // align bases first
        bases.forEach(alignShape);

        shapes.forEach((ds, index) => {
            if (!ShapeService.isBaseShape(ds)) {
                // align tablets
                alignShape(ds, index);
            }

            ds.model.lowerShapesInStack = this.getBasesUnder(ds, true, true, true).length;

            if (index === shapes.length - 1) {
                // just a delay to call onComplete
                gsap.to(ds, {
                    duration: duration,
                    onUpdate: () => {
                        this.tt.redraw(this.tt.list.length === 1); // TODO: improve Transform Tool so we call simply redraw(false)
                        this.updateAnchorsAndMasks();
                    },
                    onComplete: () => {
                        this.container.children.sort(compareGroundYDescendingSimple);

                        this.tt.blockBoxInteraction = false;
                        this.tt.blockCornerInteraction = false;
                        this.st.selectionEnabled = true;
                        this.tt.removeAllTransformables();
                        this.tt.addTransformables(items);
                        this.emitDataEvent(DesignServiceEventType.EVENT_PHYSICS_COMPLETE);
                    }
                });
            }
        });
    }

    boundsToContainerBounds(b: PIXI.Rectangle) {
        b.x = (-this.container.x + b.x) / this.container.scale.x;
        b.y = (-this.container.y + b.y) / this.container.scale.y;
        b.width /= this.container.scale.x;
        b.height /= this.container.scale.y;
    }

    updateGrid() {
        if (this.grid) {
            let point0: PIXI.Point = this.container.toLocal(new PIXI.Point(0, 0));
            let point1: PIXI.Point = this.container.toLocal(new PIXI.Point(this.cW, this.cH));

            // make grid look stable on zooming
            let foot: number = MeasurementService.inchToPx(12);
            this.grid.x = Math.floor(point0.x / foot) * foot;
            this.grid.y = Math.floor(point0.y / foot) * foot;

            this.grid.width = point1.x - this.grid.x;
            this.grid.height = point1.y - this.grid.y;
        }
    }

    getCenterPoint(unit: string = MeasurementService.PIXEL) {
        let point: PIXI.Point;
        if (this.container.children.length > this.getDefaultChildren().length) {
            let bounds: PIXI.Rectangle = this.getShapesLocalBounds(this.container.children as DesignItem[]);
            if (!bounds) {
                bounds = this.getContainerLocalBoundsWithoutGrid();
            }
            point = new PIXI.Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        } else {
            point = new PIXI.Point(this.cW / 2, this.cH / 2);

            point = this.container.toLocal(point);
        }

        if (unit !== MeasurementService.PIXEL) {
            point.x = MeasurementService.pxToUnit(point.x);
            point.y = MeasurementService.pxToUnit(point.y);
        }

        return point;
    }

    // REMOVE
    setGlobalSinkageColor(sinkageColorID: string) {
        for (let item of this.container.children) {
            let di: DesignItem = item as DesignItem;
            if (di.hasOwnProperty('model')) {
                switch (di.model.type) {
                    case 'art':
                        let da: DesignArt = di as DesignArt;
                        da.model.sinkage = sinkageColorID;
                        this.artService.setArtSinkageColor(da, sinkageColorID);
                        break;
                    case 'text':
                        let dt: DesignText = di as DesignText;
                        dt.model.sinkage = sinkageColorID;
                        this.textService.setTextSinkageColor(dt, sinkageColorID);
                        break;
                }
            }
        }

        this.sinkageGlobalColorID = sinkageColorID;
    }

    updateAnchorsAndMasks = () => {
        let possibleTargets: DesignItem[] = [];
        for (let i: number = this.container.children.length - 1; i >= 0; i--) {
            let di: DesignItem = this.container.children[i] as DesignItem;
            if (di.hasOwnProperty('model')) {
                switch (di.model.type) {
                    case 'shape':
                        let ds: DesignShape = di as DesignShape;
                        possibleTargets.push(ds);
                        break;
                }
            }

            // TODO: improve Transform Tool so we don't need to call updateTransform() here

            di.updateTransform();
        }

        // anchored objects
        for (let item of this.container.children) {
            let di: DesignItem = item as DesignItem;
            if (di.hasOwnProperty('model')) {
                switch (di.model.type) {
                    case 'art':
                    case 'text':
                        // follow an existing target
                        if (di.anchorObject) {
                            if (di.anchorObject.target) {
                                let targetIsMoving: boolean = this.tt.list.indexOf(di.anchorObject.target) >= 0;
                                if (this.tt.list.indexOf(di) === -1 || targetIsMoving) {
                                    di.x = di.anchorObject.target.x - di.anchorObject.dx;
                                    di.y = di.anchorObject.target.y - di.anchorObject.dy;

                                    di.updateModel('movement');
                                } else {
                                    di.anchorObject.dx = di.anchorObject.target.x - di.x;
                                    di.anchorObject.dy = di.anchorObject.target.y - di.y;
                                }

                                if (targetIsMoving) {
                                    break;
                                }
                            } else {
                                // target not found (e.g. has been deleted)
                                di.anchorObject = null;
                            }
                        }

                        let bounds: PIXI.Rectangle = di.getBounds();
                        // use bounds to calculate position, cause (0,0) point is not in the center for texts
                        let position: PIXI.IPoint = new PIXI.Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); //di.toGlobal(new PIXI.Point(0, 0));
                        // find a target to anchor to
                        let diTarget: DesignItem = null;
                        for (let k: number = 0; k < possibleTargets.length; k++) {
                            diTarget = this.shapeService.shapeContainsPoint(possibleTargets[k] as DesignShape, position) as DesignItem;
                            if (diTarget) {
                                break;
                            }
                        }

                        if (diTarget) {
                            let maskAreas: Area[] = (diTarget as DesignShape).areas;
                            let suitableMask: Area = this.getSuitableMaskArea(diTarget as DesignShape, position);

                            let updMask: boolean = false;
                            if (this.tt.list.indexOf(diTarget) === -1 && (!di.anchorObject || di.anchorObject.target !== diTarget)) {
                                let anchor: Anchor;
                                // apply new anchor
                                anchor = {
                                    target: diTarget,
                                    dx: diTarget.x - di.x,
                                    dy: diTarget.y - di.y
                                };
                                di.anchorObject = anchor;

                                updMask = true;
                            }
                            if (maskAreas && di.mask && di.mask !== suitableMask) {
                                // update mask if a base appeared/dissapeared under the target

                                updMask = true;
                            }

                            if (updMask) {
                                this.removeFromMaskArea(di, di.mask as any);

                                if (maskAreas && di.model.type === 'art' && (di as DesignArt).model.artType !== ArtService.ART_TYPE_VASE) {
                                    this.addToMaskArea(di, suitableMask);
                                }
                            }
                        } else {
                            // no target found
                            // remove anchor
                            let anchor: Anchor = di.anchorObject;
                            if (anchor) {
                                di.anchorObject = null;
                            }

                            // remove mask
                            this.removeFromMaskArea(di, di.mask as any);
                        }

                        break;
                }
            }
        }

        // area
        for (let item of this.maskContainer.children) {
            this.updateMaskArea(item as Area);
        }
    };
    // A shape may have 0 areas (e.g. a base), 2 areas (e.g. a traditional tablet or a custom shape without a sanded area (lightImage)),
    // 4 areas (a custom shape with a sanded area)
    getSuitableMaskArea(diTarget: DesignItem, position: PIXI.IPoint) {
        let ds: DesignShape = diTarget as DesignShape;
        let maskAreas: Area[] = ds.areas;
        if (!maskAreas || maskAreas.length === 0) {
            return null;
        }
        let isBaseUnder: boolean = this.getBasesUnder(ds).length > 0;
        let i: number = 0;
        if (ShapeService.isCustomShape(ds)) {
            if (this.shapeService.shapeContainsPoint(ds, position, true)) {
                i += 2;
            }
        }
        if (!isBaseUnder) {
            i++;
        }
        return maskAreas[i];
    }

    addToMaskArea = (di: DesignItem, area: Area) => {
        if (!area) {
            return;
        }
        if (!di.mask || (di.mask as any) !== area) {
            // adding to a container needed for proper mask positioning
            if (!area.parent) {
                this.maskContainer.addChildAt(area, 0);
            }
            di.mask = area as any;
            area.objectsAffected.push(di);
        }
    };

    removeFromMaskArea = (di: DesignItem, area: Area) => {
        if (!area) {
            return;
        }
        if ((di.mask as any) === area && area.objectsAffected) {
            let i: number = area.objectsAffected.indexOf(di);
            if (i >= 0) {
                area.objectsAffected.splice(i, 1);
            }
        }

        di.mask = null;

        // fix a pixi bug (mask gets permanently visible if it is PIXI.Sprite and temporarily in other cases)
        for (let i: number = 0; i < area.objectsAffected.length; i++) {
            let obj: any = area.objectsAffected[i];
            if (obj) {
                obj.mask = area;
            }
        }
    };

    updateMaskArea = (area: Area) => {
        if (!area || !area.objectsAffected) {
            return;
        }

        // remove deleted and empty objects
        for (let i: number = 0; i < area.objectsAffected.length; i++) {
            let obj: any = area.objectsAffected[i];
            if (!obj || !obj.parent) {
                area.objectsAffected.splice(i, 1);
                i--;
            }
        }

        if (area.objectsAffected.length === 0 || !area.owner || !area.owner.parent) {
            if (area.parent) {
                area.parent.removeChild(area);
            }
        }
    };

    getClosestBitmapFillID = (di: DesignItem) => {
        let closestShape: DesignShape = di.anchorObject ? (di.anchorObject.target as DesignShape) : null;
        if (closestShape) {
            return this.shapeService.getBitmapFill(closestShape.model).id;
        } else {
            return ShapeService.DEFAULT_SHAPE_COLOR_ID;
        }
    };

    // when you move text or image it may be needed to change a texture used in their filters
    // call this function periodically (every 0.1 - 1 sec)
    updateBlendingContext = () => {
        for (let item of this.container.children) {
            let di: DesignItem = item as DesignItem;
            if (di.hasOwnProperty('model')) {
                switch (di.model.type) {
                    case 'art':
                        let da: DesignArt = di as DesignArt;
                        da.model.lowerBitmapFill = this.getClosestBitmapFillID(di);
                        this.artService.updateArtFilters(da);
                        break;
                    case 'text':
                        let dt: DesignText = di as DesignText;
                        dt.model.lowerBitmapFill = this.getClosestBitmapFillID(di);
                        this.textService.updateTextFilters(dt);
                        break;
                    case 'shape':
                        let ds: DesignShape = di as DesignShape;
                        // just to update texture's scale
                        this.shapeService.updateShapeFilters(ds);
                        break;
                }
            }
        }

        this.drawOutlines();
    };

    // draws the outline via Graphics, in future in can be replaced by a filter (currently application of any filter removes antialiasing)
    // slow method (10 - 50ms)
    async drawOutlines(clearOnly: boolean = false) {
        if (this.outlineContainer.children.length === 0) {
            this.outlineContainer.addChild(new SuperGraphics());
        }
        let o: SuperGraphics = this.outlineContainer.children[0] as SuperGraphics;

        if (this.tt.isDragging || this.arrowsPressed > 0 || this.isTweening || this.waitingForZoom || clearOnly) {
            o.clear();
            return;
        }

        let shapes: DesignShape[] = this.getShapes();
        let globalPolygon: polyClip.MultiPolygon = [];
        try {
            for (let ds of shapes) {
                // outlines of separate sub-shapes of DesignShape
                let polygons: polyClip.Polygon[] = await this.shapeService.getPolygons(ds, this.container);
                // united outline of DesignShape
                let unitedPolygon: polyClip.MultiPolygon = polyClip.union(polygons);

                globalPolygon = globalPolygon.concat(unitedPolygon);
            }
            // final union of outlines
            globalPolygon = polyClip.union(globalPolygon);
        } catch (err) {
            console.warn('Unable to unite outlines.');
        }

        o.clear();
        o.lineStyle(1 / this.container.scale.x, 0x888888);
        // slow block
        globalPolygon.forEach((polygon) => {
            polygon.forEach((ring, index) => {
                o.drawPolygon(_.flatten(ring));
            });
        });
        o.endFill();
    }

    getBasesUnder(ds: DesignShape, checkY: boolean = false, firstOnly: boolean = false, skipViewedFromTop: boolean = false) {
        // retrieve x and width from the model not from the object, otherwise it can badly affect Pixi's hitTest (may be a bug)
        let x: number = ds.model.x;
        let y: number = ds.model.y;
        let w: number = ds.model.width;
        let bases: DesignShape[] = [];
        if (skipViewedFromTop && this.shapeService.viewedFromTop(ds.model) && ShapeService.isBaseShape(ds)) {
            // if viewed from top bases cannot be stacked vertically by z-axis (no sub shapes)
            return bases;
        }
        for (let item of this.container.children) {
            let di: DesignItem = item as DesignItem;
            if (di.hasOwnProperty('model') && di.model.type === 'shape' && di !== ds && ShapeService.isBaseShape(di as DesignShape)) {
                let base: DesignShape = di as DesignShape;
                if (Math.abs(base.model.x - x) < 0.5 * (base.model.width + w) && (!checkY || (checkY && base.model.y > y))) {
                    bases.push(base);
                    if (firstOnly) {
                        return bases;
                    }
                }
            }
        }

        return bases;
    }

    getTabletsOver(ds: DesignShape, checkY: boolean = false, firstOnly: boolean = false) {
        // retrieve x and width from the model not from the object, otherwise it can badly affect Pixi's hitTest (may be a bug)
        let x: number = ds.model.x;
        let y: number = ds.model.y;
        let w: number = ds.model.width;
        let tablets: DesignShape[] = [];
        for (let item of this.container.children) {
            let di: DesignItem = item as DesignItem;
            if (di.hasOwnProperty('model') && di.model.type === 'shape' && di !== ds && !ShapeService.isBaseShape(di as DesignShape)) {
                let tablet: DesignShape = di as DesignShape;
                if (Math.abs(tablet.model.x - x) < 0.5 * (tablet.model.width + w) && (!checkY || (checkY && tablet.model.y < y))) {
                    tablets.push(tablet);
                    if (firstOnly) {
                        return tablets;
                    }
                }
            }
        }

        return tablets;
    }

    // bounds in the container
    getShapesLocalBounds(items: DesignItem[]) {
        let bounds: PIXI.Rectangle;
        items.forEach((item) => {
            if (item.hasOwnProperty('model') && item.model.type === 'shape') {
                let b: PIXI.Rectangle = item.getBounds();
                this.boundsToContainerBounds(b);
                if (bounds) {
                    if (b.x + b.width > bounds.x + bounds.width) {
                        bounds.width = b.x + b.width - bounds.x;
                    }
                    if (b.y + b.height > bounds.y + bounds.height) {
                        bounds.height = b.y + b.height - bounds.y;
                    }
                    if (b.x < bounds.x) {
                        bounds.width += bounds.x - b.x;
                        bounds.x = b.x;
                    }
                    if (b.y < bounds.y) {
                        bounds.height += bounds.y - b.y;
                        bounds.y = b.y;
                    }
                } else {
                    bounds = b;
                }
            }
        });

        return bounds;
    }

    onDragStart(e: Event, data: DesignData, resetSame: boolean = true, dragID: string = null) {
        this.dragging = true;
        this.leftSlotsAfterDragStart = false;
        this.draggedData = data;
        this.removeLastDraggedData = resetSame;
        this.dragID = dragID;
    }

    onDrop(e: Event, index: number = 0) {
        let type: string = this.getDesignDataType(this.draggedData);
        if (type !== 'art') {
            return;
        }

        // drop to a slot from a library or other slot
        if (this.draggedData) {
            this.clearOldSlot();

            // create a new instance otherwise it may be just a link to a library's data
            this.draggedData = _.cloneDeep(this.draggedData);

            this.artService.addDataToRecent(this.draggedData, this.artService.recentArtImages, false, index);

            this.artSlotsTooltipText = '';
        }
        this.dragging = false;
    }

    onDropToCanvas(e: any) {
        let type: string = this.getDesignDataType(this.draggedData);

        if (this.draggedData) {
            this.clearOldSlot();
            // find position on the canvas
            let c: HTMLCanvasElement = this.renderer.view;
            let point: PIXI.Point = new PIXI.Point(e.clientX - c.offsetLeft + window.scrollX, e.clientY - c.offsetTop + window.scrollY);
            point = this.container.toLocal(point);

            switch (type) {
                case 'art':
                    this.addArt(this.draggedData, false, point.x, point.y, this.dragID === 'lib');
                    break;
                case 'shape':
                    this.addShape(this.draggedData, true, true, point.x, point.y);
                    break;
            }
        }
        this.dragging = false;
    }

    dropFromCanvas() {
        if (this.tt.list.length === 1 && (this.tt.list[0] as DesignItem).model.type === 'art') {
            if (isNaN(this.tt.lastPageX)) {
                return;
            }
            let elem: Element = document.elementFromPoint(this.tt.lastPageX - window.pageXOffset, this.tt.lastPageY - window.pageYOffset);

            if (elem && elem.classList.contains('art-slot')) {
                let i: number = Array.from(elem.parentNode.parentNode.parentNode.children).indexOf(elem.parentElement.parentElement);
                if (isNaN(i) || i === -1) {
                    console.warn("Can't detect slot index");
                    i = 0;
                }
                this.onDropFromCanvas(null, i);
            }
        }
    }
    // can be bound directly to mouseup as well (for desktop only though)
    onDropFromCanvas(e: Event, index: number = 0) {
        // drop to a slot from canvas
        if (this.tt.list.length === 1) {
            let di: DesignItem = this.tt.list[0] as DesignItem;
            if (di.model.type === 'art') {
                let data: DesignData = ArtService.createArtData();
                // copy default properties from model (thumbnail, image etc.)
                this.artService.copyModelToData((di as DesignArt).model, data);
                // copy the whole model to store position, rotation etc.
                data.model = _.cloneDeep((di as DesignArt).model);

                this.draggedData = data;

                this.artService.addDataToRecent(data, this.artService.recentArtImages, false, index);
                // TODO: generate more precise thumbnail and image (with rotation etc.)

                this.onTransformDelete();

                this.artSlotsTooltipText = '';
            }
        }
        this.dragging = false;
        this.leftSlotsAfterDragStart = false; // put it here, cause 'drag start' hasn't fired for the canvas
    }

    onDragEnd(e: Event) {
        if (this.draggedData) {
            // clear the old slot (when drag from a slot to some not droppable area)
            this.clearOldSlot();
        }
        this.dragging = false;
    }

    onDragEndFromCanvas(e?: Event) {
        this.dragging = false;
    }

    clearOldSlot() {
        let lastIndex: number = this.removeLastDraggedData ? this.artService.recentArtImages.indexOf(this.draggedData) : -1;
        if (lastIndex >= 0) {
            this.artService.recentArtImages[lastIndex] = ArtService.createArtData();
        }
    }

    // TO REMOVE ( don't recommend to clear drag data)
    clearDragData(forced: boolean = false) {
        if (this.dragging || forced) {
            this.draggedData = null;
            this.removeLastDraggedData = false;
            this.dragID = null;
        }
    }

    getDesignDataType(data: DesignData) {
        if (data) {
            if (ArtService.ART_TYPES.indexOf(data.type) >= 0) {
                return 'art';
            } else {
                if (ShapeService.SHAPE_TYPES.indexOf(data.type) >= 0) {
                    return 'shape';
                }
            }
        }

        return null;
    }

    colorItemToRGBA(color: ColorItem): string {
        let arr: number[] = PIXI.utils.hex2rgb(color.hex);
        arr = arr.map((element) => element * 255);

        arr.push(color.alpha ? color.alpha : 1);

        return 'rgba(' + arr.join(',') + ')';
    }

    generateDesignItemID() {
        return Math.random() * 100000000;
    }

    getSceneFileToSave() {
        return new Promise<any>((resolve, reject) => {
            const setUpImages: Function = () => {
                // get the scene as an image
                this.es.exportView({ preserveCanvasSize: true }).then(
                    (imageString) => {
                        let img: HTMLImageElement = new Image();
                        img.src = imageString;
                        img.onload = () => {
                            const arbitraryRatio: boolean = false;
                            let ratio: number = arbitraryRatio ? img.width / img.height : this.es.exportRatio;
                            // update thumbnail/image in the current scene
                            this.ss.scene.model.image = CanvasUtils.generateThumbnail(
                                img,
                                arbitraryRatio ? 0 : 0.5 * (img.width - img.height * ratio),
                                0,
                                img.height * ratio,
                                img.height,
                                200 * ratio,
                                200,
                                true,
                                '#ffffff'
                            );
                            this.ss.scene.model.thumbnail = CanvasUtils.generateThumbnail(
                                img,
                                arbitraryRatio ? 0 : 0.5 * (img.width - img.height * ratio),
                                0,
                                img.height * ratio,
                                img.height,
                                75 * ratio,
                                75,
                                true,
                                '#ffffff'
                            );

                            let data: DesignData = SceneService.createSceneData();
                            this.ss.copyModelToData(this.ss.scene.model, data);

                            resolve(data);
                        };
                    },
                    (err) => {
                        reject(err);
                    }
                );
            };

            this.whenSceneIsReady().then((result) => {
                setUpImages();
            });
        });
    }

    // TODO: probably add a manager for queued tasks
    whenSceneIsReady(forceWaiting: boolean = false) {
        if (this.isTweening || forceWaiting) {
            return new Promise<any>((resolve) => {
                const destroy$: Subject<unknown> = new Subject();

                this.pipe(takeUntil(destroy$)).subscribe((e: any) => {
                    switch (e.type) {
                        case DesignServiceEventType.EVENT_PHYSICS_COMPLETE:
                        case DesignServiceEventType.EVENT_ZOOM_COMPLETE:
                            destroy$.next();
                            destroy$.complete();

                            resolve(true);
                            break;
                    }
                });
            });
        } else {
            return Promise.resolve(true);
        }
    }

    get containerMargins() {
        if (this.ui.displayPricing) {
            return [
                this.containerMarginsDefault[0] + 65,
                this.containerMarginsDefault[1],
                this.containerMarginsDefault[2],
                this.containerMarginsDefault[3]
            ];
        } else {
            return this.containerMarginsDefault;
        }
    }

    getCanvasBounds(includeScroll: boolean = true): PIXI.Rectangle {
        let rect: ClientRect | DOMRect = this.renderer.view.getBoundingClientRect();

        let bounds: PIXI.Rectangle;
        if (includeScroll) {
            bounds = new PIXI.Rectangle(rect.left + window.scrollX, rect.top + window.scrollY, rect.width, rect.height);
        } else {
            bounds = new PIXI.Rectangle(rect.left, rect.top, rect.width, rect.height);
        }

        return bounds;
    }

    get isInteracting() {
        return this.tt.isDragging || this.dragging ? true : false;
    }

    addDelayedLoop(func: Function, speed: number = 1, e: any = null, startDelay: number = 350, id: string = 'default') {
        if (e) {
            // to prevent double call of the func() because for touch devices events get fired in the following order:
            // touchstart
            // touchend
            // mousedown
            // mouseup
            if (e.cancelable) {
                e.preventDefault();
            }

            if (e.type === 'touchstart') {
                let touch = e.touches[0];
                this.touchY0 = touch.pageY;
            }
        }

        this.removeDelayedLoop(id);

        this.trTimeoutIds[id] = setTimeout(() => {
            this.trIntervalIds[id] = setInterval(() => {
                func();
            }, 40 / speed);
        }, startDelay);
    }

    removeDelayedLoop(id: string = 'default') {
        clearTimeout(this.trTimeoutIds[id]);
        clearInterval(this.trIntervalIds[id]);

        delete this.trTimeoutIds[id];
        delete this.trIntervalIds[id];
    }

    removeAllDelayedLoops() {
        Object.keys(this.trTimeoutIds).forEach((key) => {
            this.removeDelayedLoop(key);
        });
    }

    onTouchMove(e: any) {
        if (e && e.type === 'touchmove') {
            let touch = e.touches[0];
            if (Math.abs(touch.pageY - this.touchY0) > 12) {
                this.removeDelayedLoop();

                this.touchY0 = NaN;
            }
        }
    }

    // Make sure you exclude it from ngZone's change detection for better performance
    private animateFnBind = () => {
        var t: any = this;
        window.requestAnimationFrame(this.animate.bind(t));
    };

    private animate = (loop: boolean = true) => {
        if (this.stats) {
            this.stats.begin();
        }

        if (this.animationTicks % 30 === 1) {
            this.updateBlendingContext();
        }

        let offsetInterval: number = 1000;
        const d: number = Date.now();
        let pct: number = 1 - ((d % offsetInterval) + 1) / offsetInterval;
        this.tt.drawBorder(false, pct);

        if (this.filterReflection) {
            offsetInterval = 60000;
            pct = 1 - ((d % offsetInterval) + 1) / offsetInterval;
            this.filterReflection.time = pct * 100;
        }

        this.renderer.render(this.stage);

        this.animationTicks++;

        if (this.stats) {
            this.stats.end();
        }

        if (loop) {
            // request another animation frame
            this.animateFnBind();
        }
    };

    private emitDataEvent = (type: string, data: any = null) => {
        let event: DataEvent = { type: type, data: data };

        this.emit(event);
    };
}

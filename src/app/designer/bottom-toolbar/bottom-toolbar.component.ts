import { Component, OnInit, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MenuItem, SelectItem } from 'primeng/api';
import { DesignService, DesignServiceEventType } from '../shared/services/design.service';
import { TextService } from '../shared/services/text.service';
import { PriceService } from '../shared/services/price.service';
import { DesignShape, DesignData, PolishItem, DesignItem, DesignArt, DesignText } from '../shared/models/main';
import { ShapeService } from '../shared/services/shape.service';
import { ConfigService } from '../shared/services/config.service';
import { AssetService } from '../shared/services/asset.service';
import { ArtService } from '../shared/services/art.service';
import { SceneService } from '../shared/services/scene.service';

@Component({
    selector: 'bottom-toolbar',
    templateUrl: './bottom-toolbar.component.html',
    styleUrls: ['./bottom-toolbar.component.scss']
})
export class BottomToolbarComponent implements OnInit {
    sinkageMenuItems: MenuItem[];

    sinkageApplyToAllItem: MenuItem;

    polishes: WeakMap<DesignShape, SelectItem[]> = new WeakMap();

    basesAllowed: boolean = true;

    subBasesAllowed: boolean = true;

    showPolishTip: boolean = false;

    hoverImage: DesignData;

    visibleSlots: number = 5;

    firstVisibleSlotIndex: { [slotsID: string]: number } = {
        sinkage: 0,
        art: 0,
        scene: 0
    };

    totalSlots: { [slotsID: string]: number } = {
        sinkage: 5,
        art: 10,
        scene: 10
    };

    timeoutIds: any = {};

    private readonly destroy$ = new Subject();

    constructor(
        private changeDetectorRef: ChangeDetectorRef,
        public config: ConfigService,
        public ds: DesignService,
        public as: AssetService,
        public ss: SceneService,
        public artService: ArtService,
        public textService: TextService,
        public shapeService: ShapeService
    ) {}

    ngOnInit() {
        this.ds.pipe(takeUntil(this.destroy$)).subscribe((e: any) => {
            switch (e.type) {
                case DesignServiceEventType.EVENT_INIT_COMPLETE:
                    this.totalSlots.sinkage = Object.keys(this.as.sinkageColors).length;
                    this.totalSlots.art = this.artService.maxRecent;
                    this.totalSlots.scene = this.ss.maxRecent;
                    break;
                case DesignServiceEventType.EVENT_TRANSFORM_TOOL_ADD:
                    clearTimeout(this.timeoutIds['scroll']);
                    this.timeoutIds['scroll'] = setTimeout(() => {
                        let elem: HTMLElement = document.querySelector('div.shape-line');
                        if (!elem) {
                            return;
                        }
                        let appPageIsScrollable: boolean =
                            document.body.scrollWidth > window.innerWidth || document.body.scrollHeight > window.innerHeight;
                        let fastScrolling: boolean = appPageIsScrollable || !this.config.isDesktop;
                        if (fastScrolling) {
                            // immediate scrolling
                            let parent: HTMLElement = elem.parentElement.parentElement;
                            parent.scrollTop = elem.offsetTop - parent.offsetTop;
                        } else {
                            // smooth scrolling, but scrolls the whole page if a scrollbar presents (due to the small screen)
                            elem.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
                        }
                    }, 100);

                    break;
            }
        });
    }

    isSelected(item: DesignItem) {
        return this.ds.tt.list.indexOf(item) >= 0;
    }

    // TODO: in the future improve performance by adding shapes array to the design service (and subBases, bases, tablets, polishes too)
    // instead of checking via NgZone
    get shapes() {
        if (!this.ds || !this.ds.container) {
            return [];
        }

        let shapes: DesignShape[] = this.ds.getShapes().reverse();
        // find polishes here and other data related to shapes (just for a performance benefit)
        this.initPolishes(shapes);
        this.basesAllowed = shapes.find((elem) => !this.shapeService.baseAllowed(elem.model)) ? false : true;
        this.subBasesAllowed = shapes.find((elem) => !this.shapeService.subBaseAllowed(elem.model)) ? false : true;

        return shapes;
    }

    initPolishes(shapes: DesignShape[]) {
        for (let shape of shapes) {
            if (!this.polishes.has(shape)) {
                let polishSelectItems: SelectItem[] = this.shapeService.getAvailablePolishes(shape).map((elem) => {
                    return { label: elem.name, value: elem.id };
                });
                this.polishes.set(shape, polishSelectItems);
            }
        }
    }

    isBaseShape(shape: DesignShape) {
        return ShapeService.isBaseShape(shape);
    }

    isSubBaseShape(shape: DesignShape) {
        return shape.model.lowerShapesInStack > 0;
    }

    getRoundShapeSize(value: number) {
        return Math.round(value); // * 4) / 4;
    }

    onShapeWidthChange(value: number, shape: DesignShape) {
        if (value >= this.getRoundShapeSize(shape.model.minWidth) + 1) {
            this.shapeService.setShapeWidth(shape, value);
            this.ds.tt.redraw(this.ds.tt.list.length === 1);
            this.ds.updateAnchorsAndMasks();
            this.ds.applyPhysics();
            this.ds.doAutoZoomDelayed();
            this.ds.remember();
        }
    }

    onShapeHeightChange(value: number, shape: DesignShape) {
        if (value >= this.getRoundShapeSize(shape.model.minHeight) + 1) {
            this.shapeService.setShapeHeight(shape, value);
            this.ds.tt.redraw(this.ds.tt.list.length === 1);
            this.ds.updateAnchorsAndMasks();
            this.ds.applyPhysics();
            this.ds.doAutoZoomDelayed();
            this.ds.remember();
        }
    }

    onShapeDepthChange() {
        this.ds.remember();
    }

    onShapePolishChange(value: string, shape: DesignShape) {
        let newShape: DesignShape = this.shapeService.setShapePolish(shape, value);
        let items: PIXI.Container[] = this.ds.tt.list.filter((elem) => elem !== shape); // copy of valid selected items (without old shape)
        if (this.isSelected(shape)) {
            items.push(newShape);
        }
        this.ds.tt.removeAllTransformables();
        this.ds.updateAnchorsAndMasks();
        this.ds.tt.addTransformables(items);
        this.ds.applyPhysics();
        this.ds.doAutoZoomDelayed();
        this.ds.remember();
        this.showPolishTip = false;
    }

    onShapePolishDropdownShow() {
        this.showPolishTip = true;
    }

    getShapePolishTip(polishID: string, shape: DesignShape) {
        if (
            this.showPolishTip &&
            (polishID === ShapeService.POLISH_P3.id || polishID === ShapeService.POLISH_P5.id) &&
            ShapeService.isCustomShape(shape)
        ) {
            return 'Check with quarry on custom finishing cost.';
        }
        return '';
    }

    onShapeDelete(shape: DesignShape) {
        this.ds.deleteTransformables([shape]);
    }

    onTabletAdd() {
        let tablet: DesignShape = this.ds.getContextTablets()[0];
        if (tablet) {
            // copy
            this.ds.copy([tablet])[0];
        } else {
            let data: DesignData = ShapeService.createShapeData();
            data.nid = ShapeService.SERP_ID;
            data.baseDepth = 0;
            this.ds.addShape(data, true);
        }
    }

    onBaseAdd() {
        // first get a prototype from selected bases or under selected tablets
        let selectedBases: DesignShape[] = this.ds.getContextBases(true);
        let base: DesignShape;
        if (selectedBases.length > 0) {
            base = selectedBases[0];
        } else {
            let selectedTablets: DesignShape[] = this.ds.getContextTablets(true);
            if (selectedTablets.length > 0) {
                base = this.ds.getClosestUnderBase(selectedTablets[0]);
            }
        }

        if (!base) {
            base = this.ds.getContextBases()[0];
        }

        if (base) {
            // copy
            this.ds.copy([base])[0];
        } else {
            let tablet: DesignShape = this.ds.getContextTablets(false)[0];
            let data: DesignData = ShapeService.createShapeData();
            if (tablet) {
                this.shapeService.copyModelToData(tablet.model, data);
            }
            data.depth = 0; // allows to create only a base
            this.ds.addShape(data, true, true);
        }
    }

    onSubBaseAdd() {
        // first get a prototype from selected bases or under selected tablets
        let selectedBases: DesignShape[] = this.ds.getContextBases(true);
        let base: DesignShape;
        if (selectedBases.length > 0) {
            base = selectedBases[0];
        } else {
            let selectedTablets: DesignShape[] = this.ds.getContextTablets(true);
            if (selectedTablets.length > 0) {
                base = this.ds.getClosestUnderBase(selectedTablets[0]);
            }
        }

        if (!base) {
            base = this.ds.getContextBases()[0];
        }

        if (base) {
            // copy
            this.ds.copyTransformables([base], 0, -5)[0]; // place it a bit upper
        } else {
            let data: DesignData = ShapeService.createShapeData();
            data.depth = 0;
            this.ds.addShape(data, true, true);
        }
    }

    getSinkageColorIcon(sinkageColorID: string): string {
        if (!this.ds || !this.ds.tt || !this.as) {
            return 'pi';
        }

        let colors: string[] = this.ds.getContextSinkageItems().map((elem) => elem.model.sinkage);
        for (let c of colors) {
            if (c === sinkageColorID) {
                return 'pi pi-check';
            }
        }

        return 'pi';
    }

    onSinkageColorClick(sinkageColorID: string) {
        let items: (DesignText | DesignArt)[] = this.ds.getContextSinkageItems();
        for (let item of items) {
            let type: string = (item as DesignItem).model.type;
            if (type === 'art') {
                this.artService.setArtSinkageColor(item as DesignArt, sinkageColorID);
            } else {
                if (type === 'text') {
                    this.textService.setTextSinkageColor(item as DesignText, sinkageColorID);
                }
            }
        }

        this.ds.remember();
    }

    onShowPreview(event: any, element: DesignData, opPreview: any) {
        if (
            element &&
            element.image &&
            (element.thumbnail || element.image || element.fullImage) &&
            !this.ds.isInteracting &&
            this.ds.leftSlotsAfterDragStart
        ) {
            this.hoverImage = element;
            opPreview.show(event);
            this.changeDetectorRef.detectChanges();
        }
    }

    onHidePreview(event: any, opPreview: any) {
        this.hoverImage = null;
        opPreview.hide(event);
        this.changeDetectorRef.detectChanges();
    }

    isSlotVisible(id: string, i: number) {
        let first: number = this.firstVisibleSlotIndex[id];
        return i >= first && i < first + this.visibleSlots;
    }

    isLeftArrowActive(id: string) {
        return this.firstVisibleSlotIndex[id] > 0;
    }

    isRightArrowActive(id: string) {
        return this.firstVisibleSlotIndex[id] + this.visibleSlots < this.totalSlots[id];
    }

    onSlotsArrowLeft(e: any = null, id: string) {
        this.ds.addDelayedLoop(
            () => {
                this.moveSlotsLeft(id);
            },
            0.15,
            e,
            100
        );
    }

    onSlotsArrowRight(e: any = null, id: string) {
        this.ds.addDelayedLoop(
            () => {
                this.moveSlotsRight(id);
            },
            0.15,
            e,
            100
        );
    }

    moveSlotsLeft = (id: string, checkTouchMoves: boolean = false, step: number = 1) => {
        if (checkTouchMoves && isNaN(this.ds.touchY0)) {
            return;
        }

        const min: number = 0;
        this.firstVisibleSlotIndex[id] = Math.max(min, this.firstVisibleSlotIndex[id] - step);

        if (this.firstVisibleSlotIndex[id] === min) {
            // remove delayed loop
            // cause we use [disabled] property for the arrow buttons which are activated by a mouseover event -
            // in this case mouseleave event won't be triggered (so removeDelayedLoop() won't be called too)
            this.ds.removeDelayedLoop();
        }
        this.changeDetectorRef.detectChanges();
    };

    moveSlotsRight = (id: string, checkTouchMoves: boolean = false, step: number = 1) => {
        if (checkTouchMoves && isNaN(this.ds.touchY0)) {
            return;
        }

        const max: number = this.totalSlots[id] - this.visibleSlots;
        this.firstVisibleSlotIndex[id] = Math.min(max, this.firstVisibleSlotIndex[id] + step);

        if (this.firstVisibleSlotIndex[id] === max) {
            // remove delayed loop
            // cause we use [disabled] property for the arrow buttons which are activated by a mouseover event -
            // in this case mouseleave event won't be triggered (so removeDelayedLoop() won't be called too)
            this.ds.removeDelayedLoop();
        }

        this.changeDetectorRef.detectChanges();
    };

    onSceneOpen = (data: DesignData) => {
        this.ds.addScene(data);
    };

    setCheckIcon = (item: any, value: boolean) => {
        if (item) {
            item.icon = value ? 'pi pi-fw pi-check' : null;
        }
    };

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}

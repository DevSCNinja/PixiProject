import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MenuItem, SelectItem, TreeNode } from 'primeng/api';
import * as PIXI from 'pixi.js';
import { Quill, RangeStatic } from 'quill';
import { TextInput } from '../pixi/text-input';
import { DesignService, DesignServiceEventType } from '../shared/services/design.service';
import { TextService } from '../shared/services/text.service';
import { DesignText, DesignArt, DesignData, FontItem } from '../shared/models/main';
import { MeasurementService } from '../shared/services/measurement.service';
import { ArtService } from '../shared/services/art.service';
import { ConfigService } from '../shared/services/config.service';
import { ShapeService } from '../shared/services/shape.service';
import { UIService } from '../shared/services/ui.service';
import { Spinner } from 'primeng/spinner';
import _ from 'lodash';
import { DataUtils } from '../shared/utils/data-utils';

@Component({
    selector: 'design-space',
    templateUrl: './space.component.html',
    styleUrls: ['./space.component.scss']
})
export class SpaceComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('spaceCanvas', { static: false }) spaceCanvas: ElementRef;

    @ViewChild('editTextButton', { static: false }) editTextButton: ElementRef;

    @ViewChild('menuTransformOptions', { static: false }) menuTransformOptions: ElementRef;

    fonts: SelectItem[];

    fontSizes: SelectItem[];

    textAligns: SelectItem[];

    textEffects: SelectItem[];

    selectedTextEffects: string[] = ['shape'];

    dropdownOverlayIsVisible: boolean = false;

    restoringTextSelection: boolean = false;

    editTextPopupStyle: any = { position: 'absolute', display: 'none', left: '0px', top: '0px' };

    transformOptionsPopupStyle: any = { position: 'absolute', display: 'none', left: '0px', top: '0px' };

    transformOptionsGeneral: MenuItem[];

    transformOptionsGroup: MenuItem[];

    typeofTransformable: string = 'general';

    dialogW: number = 230;

    dialog2W: number = 552;

    dialog2H: number = 384; // content's height (without the footer and the header)

    fixedDialog2H: boolean = true;

    artContainerStyle: any = { maxWidth: this.dialogW + 'px', minWidth: this.dialogW + 'px' };

    artContentStyle: any = { padding: 0 };

    textContainerStyle: any = { maxWidth: this.dialogW + 'px', minWidth: this.dialogW + 'px' };

    textContentStyle: any = { padding: 0 };

    libraryContainerStyle: any = { maxWidth: this.dialog2W + 'px', minWidth: this.dialog2W + 'px' };

    libraryContentStyle: any = { padding: 0, borderWidth: 1, maxHeight: this.dialog2H + 'px' };

    dialogLeft: number = 0;

    dialogTop: number = 0;

    dialog2Left: number = 0;

    dialog2Top: number = 0;

    textDialogMinimized: boolean = false;

    artDialogMinimized: boolean = false;

    shapeSelectedNode: TreeNode;

    private timeoutRestoreSelection: any;

    private timeoutResize: any;

    private timeoutResizeCanvas: any;

    private timeoutDialog: any;

    private timeoutEditTextButton: any;

    private readonly destroy$ = new Subject();

    constructor(
        public config: ConfigService,
        public ngZone: NgZone,
        public parentEl: ElementRef,
        public ds: DesignService,
        public artService: ArtService,
        public textService: TextService,
        public shapeService: ShapeService,
        public ui: UIService
    ) {
        if (!this.config.isDesktop) {
            // remove unnecessary soft keyboard appearance for non-desktop platforms ('mobile', 'tablet', 'tv')
            Spinner.prototype.onUpButtonMousedown = function (event) {
                if (!this.disabled) {
                    //this.inputfieldViewChild.nativeElement.focus(); // should be commented
                    this.repeat(event, null, 1);
                    this.updateFilledState();
                    event.preventDefault();
                }
            };
            Spinner.prototype.onDownButtonMousedown = function (event) {
                if (!this.disabled) {
                    //this.inputfieldViewChild.nativeElement.focus(); // should be commented
                    this.repeat(event, null, -1);
                    this.updateFilledState();
                    event.preventDefault();
                }
            };
        }
    }

    ngOnInit() {
        this.initFonts();

        this.ds.pipe(takeUntil(this.destroy$)).subscribe((e: any) => {
            switch (e.type) {
                case DesignServiceEventType.EVENT_INIT_COMPLETE:
                    this.initFonts();
                    break;
                case DesignServiceEventType.EVENT_RESIZE_REQUEST:
                    this.placeDialogs();
                    break;
            }
        });

        this.fontSizes = [
            { label: '1"', value: 1 },
            { label: '1.5"', value: 1.5 },
            { label: '2"', value: 2 },
            { label: '2.5"', value: 2.5 },
            { label: '3"', value: 3 },
            { label: '6"', value: 6 },
            { label: '12"', value: 12 }
        ];

        // title instead of label here to show a tip on hover
        this.textAligns = [
            { title: 'Left', value: 0, icon: 'pi pi-align-left' },
            { title: 'Center', value: 1, icon: 'pi pi-align-center' },
            { title: 'Right', value: 2, icon: 'pi pi-align-right' }
        ];

        this.textEffects = [
            { label: 'V Cut', value: 'vCut' },
            { label: 'Frost', value: 'frost' },
            { label: 'Polish', value: 'polish' },
            { label: 'Outline', value: 'outline' },
            { label: 'Shape', value: 'shape' }
        ];

        this.transformOptionsGeneral = [
            {
                label: 'Copy',
                icon: 'pi pi-fw pi-clone',
                command: () => {
                    this.ds.copy(this.ds.tt.list);
                }
            },
            {
                label: 'Mirror',
                icon: 'pi pi-fw pi-sort',
                command: () => {
                    this.ds.mirror(this.ds.tt.list);
                }
            },
            {
                label: 'Flip',
                icon: 'pi pi-fw pi-sort-alt',
                command: () => {
                    this.ds.flipH(this.ds.tt.list);
                }
            },
            { label: 'Bring To Front', command: this.ds.bringToFront }
        ];

        this.transformOptionsGroup = [
            {
                label: 'Copy',
                icon: 'pi pi-fw pi-clone',
                command: () => {
                    this.ds.copy(this.ds.tt.list);
                }
            },
            {
                label: 'Mirror',
                icon: 'pi pi-fw pi-sort',
                command: () => {
                    this.ds.mirror(this.ds.tt.list);
                }
            },
            { label: 'Bring To Front', command: this.ds.bringToFront }
        ];
    }

    initFonts() {
        this.fonts = [];
        this.textService.fonts.forEach((f) => {
            if (!f.hidden) {
                this.fonts.push({ label: f.fontFamilyAlias, value: f.fontFamily, title: 12 * f.dropdownScale + 'px' });
            }
        });
    }

    ngAfterViewInit() {
        this.ds.pipe(takeUntil(this.destroy$)).subscribe((e: any) => {
            switch (e.type) {
                case DesignServiceEventType.EVENT_TRANSFORM_TOOL_ADD:
                    this.onTransformAdd();

                    break;

                case DesignServiceEventType.EVENT_TRANSFORM_TOOL_BEFORE_REMOVE:
                    this.onTransformBeforeRemove();

                    break;

                case DesignServiceEventType.EVENT_RESIZE:
                case DesignServiceEventType.EVENT_ZOOM:
                case DesignServiceEventType.EVENT_TRANSFORM_TOOL_TRANSFORM:
                    this.onTransform();

                    break;

                case DesignServiceEventType.EVENT_TRANSFORM_TOOL_REDRAW:
                    this.onTransformRedraw();

                    break;

                case DesignServiceEventType.EVENT_TRANSFORM_TOOL_OPTIONS:
                    this.onTransformOptions();

                    break;

                case DesignServiceEventType.EVENT_TRANSFORM_TOOL_OPTIONS_APPLY:
                    this.onTransformOptionsApply();

                    break;
            }
        });

        // timeout needed to get rid of ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
            this.ds.init(this.spaceCanvas);
            // kinda trigger window:resize event
            this.onResize(true);
        });
    }

    placeDialogs = () => {
        if (!this.ds || !this.ds.renderer || !this.ds.renderer.view) {
            return;
        }
        // timeout needed because of default repositioning in primeng dialog component
        clearTimeout(this.timeoutDialog);
        this.timeoutDialog = setTimeout(() => {
            this.ngZone.run(() => {
                // Note. Primeng keeps the dialog in viewport (also there is no keepInViewport property in primeng 8.1.1)
                let bounds: PIXI.Rectangle = this.ds.getCanvasBounds(false);
                let margin: number = 10;

                this.dialogLeft = bounds.x + bounds.width - this.dialogW - margin;
                this.dialogTop = bounds.y + (bounds.width < 1000 ? 55 : 0) + margin;

                this.dialog2Left = bounds.x + margin;
                this.dialog2Top = bounds.y + 55 + margin;

                // fix a bug (positionLeft && positionTop don't work sometime)
                this.textContainerStyle.left = this.artContainerStyle.left = this.dialogLeft + 'px';
                this.textContainerStyle.top = this.artContainerStyle.top = this.dialogTop + 'px';

                this.libraryContainerStyle.left = this.dialog2Left + 'px';
                this.libraryContainerStyle.top = this.dialog2Top + 'px';

                if (!this.fixedDialog2H) {
                    this.dialog2H = this.ds.cH - 55 - 2 * margin - 65 - 48;
                }
                this.libraryContentStyle.maxHeight = this.dialog2H + 'px';
            });

            if (this.textService.selectedInput) {
                this.placeEditTextPopup();
            }
        }, 200);
    };

    getArt() {
        return this.ds.tt.list[0] as DesignArt;
    }

    getArtImage() {
        let imageFile: string = this.getArt().model.imageFile;

        // TODO: not important - conversion to a short url (needed just to fix FF's security error) probably
        // needed only if a proxy server is used
        let url: string = this.config.getAssetShortURL(imageFile);

        return this.config.getAssetFullURL(url);
    }

    getArtFrost(): boolean {
        return (this.ds.tt.list[0] as DesignArt).model.frostingVisible ? true : false;
    }

    onArtFrost(value: boolean) {
        for (let item of this.ds.tt.list) {
            this.artService.setArtEffect(item as DesignArt, 'frostingVisible', value);
        }
        this.ds.remember();
    }

    getArtInvert(): boolean {
        return (this.ds.tt.list[0] as DesignArt).model.inverted ? true : false;
    }

    onArtInvert(value: boolean) {
        for (let item of this.ds.tt.list) {
            this.artService.setArtEffect(item as DesignArt, 'inverted', value);
        }
        this.ds.remember();
    }

    getArtDrawSimple(): boolean {
        return (this.ds.tt.list[0] as DesignArt).model.drawSimple ? true : false;
    }

    onArtDrawSimple(value: boolean) {
        for (let item of this.ds.tt.list) {
            this.artService.setArtEffect(item as DesignArt, 'drawSimple', value);
        }
        this.ds.remember();
    }

    onArtDataLoadComplete = (artData: DesignData) => {
        let addToRecent: boolean = this.config.isUploaded(artData.image);
        this.ds.addArt(artData, addToRecent);

        this.ui.displayArtLibrary = false;
    };

    onArtDataRightClick = (artData: DesignData) => {
        this.artService.addDataToRecent(artData, this.artService.recentArtImages);
    };

    onVaseDataLoadComplete = (artData: DesignData) => {
        let addToRecent: boolean = this.config.isUploaded(artData.image);
        this.ds.addArt(artData, addToRecent);

        this.ui.displayVaseLibrary = false;
    };

    onVaseDataRightClick = (artData: DesignData) => {
        this.artService.addDataToRecent(artData, this.artService.recentArtVaseImages);
    };

    onShapeDataLoadComplete = (shapeData: DesignData) => {
        this.ds.addShape(shapeData, false, false);
        this.ui.displayShapeLibrary = false;
    };

    get shapeSearchVisible() {
        if (!this.shapeSelectedNode) {
            return false;
        }

        return this.shapeSelectedNode.label === 'Search Result' || DataUtils.getNodeAncestors(this.shapeSelectedNode)[0].label === 'Custom';
    }

    getTextFont(): string {
        let input: TextInput = this.textService.selectedInput;

        if (!input) {
            return null;
        }

        let value: string | string[] = input.currentFormat.font;

        return value instanceof Array ? null : value;
    }

    getTextFontAvaiableSizes(family?: string | string[]) {
        if (!family) {
            let input: TextInput = this.textService.selectedInput;

            if (!input) {
                return null;
            }

            family = input.currentFormat.font;
        }

        if (family instanceof Array) {
            // few fonts
            let fonts: FontItem[] = this.textService.fonts.filter((elem) => family.indexOf(elem.fontFamily) >= 0);
            if (fonts.length > 0) {
                //get intersection of available sizes
                let arrSizes: SelectItem[][] = fonts.map((elem) => elem.sizes);
                return _.intersectionBy(...arrSizes, 'value');
            }
        } else {
            // one font
            let font: FontItem = this.textService.fonts.find((elem) => elem.fontFamily === family);
            if (font) {
                return font.sizes;
            }
        }
        return [];
    }

    getTextFontSize(): number {
        let input: TextInput = this.textService.selectedInput;

        if (!input) {
            return null;
        }

        let value: string | string[] = input.currentFormat.size;

        return value instanceof Array ? null : MeasurementService.pxToUnit(value);
    }

    getTextLineSpacing(): number | number[] {
        let input: TextInput = this.textService.selectedInput;

        if (!input) {
            return null;
        }

        if (this.restoringTextSelection) {
            // return, cause on no focus input.getLineSpacing() may return a value only for the first line
            return undefined;
        }

        let value: number | number[] = input.currentLineSpacing;

        return value instanceof Array ? null : MeasurementService.pxToUnit(value);
    }

    onTextDropdownFocus() {
        if (!this.textService.editableInput) {
            return;
        }
        if (!this.dropdownOverlayIsVisible) {
            this.restoreTextInputSelection();
        }
    }

    onTextFontChange(value: string) {
        // TODO: hide 'editor' property in TextInput (add wrapping methods)
        let input: DesignText = this.textService.selectedInput as DesignText;
        let editor: Quill = input.editor as Quill;
        let fontSize: number = this.getTextFontSize();
        let newAvailableSizes: SelectItem[] = this.getTextFontAvaiableSizes(value);

        if (this.textService.editableInput) {
            this.restoreTextInputSelection(() => {
                // edit font family
                editor.format('font', value);

                if (!newAvailableSizes.find((elem) => elem.value === fontSize)) {
                    // edit size
                    let closestSize: number = this.findClosestFontSize(fontSize, newAvailableSizes);
                    editor.format('size', MeasurementService.unitToPx(closestSize) + 'px');
                }

                this.ds.tt.redraw(); // redraw() most likely not needed on this line (in similar functions too)
                this.ds.remember();
            });
        } else {
            // edit font family
            editor.formatText(0, input.text.length, 'font', value);

            if (!newAvailableSizes.find((elem) => elem.value === fontSize)) {
                // edit size
                let closestSize: number = this.findClosestFontSize(fontSize, newAvailableSizes);
                editor.formatText(0, input.text.length, 'size', MeasurementService.unitToPx(closestSize) + 'px');
            }

            this.ds.tt.redraw();
            this.ds.updateAnchorsAndMasks();
            this.ds.doAutoZoomDelayed();
            this.ds.remember();
        }
    }

    protected findClosestFontSize(fontSize: number, sizes: SelectItem[]) {
        let minDiff: number = Number.POSITIVE_INFINITY;
        let closest: number = 0;
        for (let size of sizes) {
            let diff: number = Math.abs(fontSize - size.value);
            if (diff < minDiff) {
                minDiff = diff;
                closest = size.value;
            } else {
                break;
            }
        }
        return closest;
    }

    onTextFontSizeChange(value: number) {
        let input: DesignText = this.textService.selectedInput as DesignText;
        let editor: Quill = input.editor as Quill;
        let valuePx: string = MeasurementService.unitToPx(value) + 'px';

        if (this.textService.editableInput) {
            this.restoreTextInputSelection(() => {
                editor.format('size', valuePx);

                this.ds.tt.redraw();
                this.ds.remember();
            });
        } else {
            editor.formatText(0, input.text.length, 'size', valuePx);

            this.ds.tt.redraw();
            this.ds.updateAnchorsAndMasks();
            this.ds.doAutoZoomDelayed();
            this.ds.remember();
        }
    }

    onTextAlignChange(value: number) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        input.setDefaultStyle('textAlign', this.textService.justifyToAlign(value));
        this.ds.remember();
    }

    onTextLineSpacingChange(value: number) {
        if (this.restoringTextSelection) {
            // return cause when the input has no focus, the starting value of the spinner may be wrong
            return;
        }

        let input: DesignText = this.textService.selectedInput as DesignText;

        if (this.textService.editableInput) {
            this.restoreTextInputSelection(() => {
                input.setLineSpacing(null, MeasurementService.unitToPx(value));

                this.ds.tt.redraw();
                this.ds.remember();
            });
        } else {
            input.setLineSpacing(null, MeasurementService.unitToPx(value));

            this.ds.tt.redraw();
            this.ds.updateAnchorsAndMasks();
            this.ds.doAutoZoomDelayed();
            this.ds.remember();
        }
    }

    onTextSpacingChange(event: any) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        input.setDefaultStyle('letterSpacing', MeasurementService.unitToPx(input.model.spacing) + 'px');

        this.ds.tt.redraw();
        this.ds.updateAnchorsAndMasks();
        this.ds.doAutoZoomDelayed();
        this.ds.remember();
    }

    onTextVCut(value: boolean) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        this.textService.setTextEffect(input, 'vCut', value);

        this.ds.tt.redraw();
        this.ds.updateAnchorsAndMasks();
        this.ds.doAutoZoomDelayed();
        this.ds.remember();
    }

    onTextFrost(value: boolean) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        this.textService.setTextEffect(input, 'frost', value);

        this.ds.tt.redraw();
        this.ds.remember();
    }

    onTextPolish(value: boolean) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        this.textService.setTextEffect(input, 'polish', value);

        this.ds.tt.redraw();
        this.ds.remember();
    }

    onTextOutline(value: boolean) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        this.textService.setTextEffect(input, 'outline', value);

        this.ds.tt.redraw();
        this.ds.remember();
    }

    onTextShape(value: boolean) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        input.shapeEnabled = value;
        input.updateShape();

        this.ds.tt.redraw();
        this.ds.remember();
    }

    onTextShapeAdjust(value: number) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        input.shapeAdjust = value;
        input.updateShape();
    }

    onTextShapeAdjustSlideEnd() {
        this.ds.tt.redraw();
        this.ds.remember();
    }

    // needed to handle focus
    onDropdownShow() {
        this.dropdownOverlayIsVisible = true;
    }

    onDropdownHide() {
        this.dropdownOverlayIsVisible = false;
    }

    restoreTextInputSelection(callback?: Function, e?: any) {
        let input: DesignText = this.textService.selectedInput as DesignText;

        if (!input) {
            return;
        }

        this.restoringTextSelection = true;
        // use the delay cause mouseup event is just about to reset input's focus
        this.timeoutRestoreSelection = setTimeout(() => {
            if (!input.hasFocus()) {
                input.focus();
            }

            this.restoringTextSelection = false;

            if (typeof callback === 'function') {
                callback();
            }
        });
    }

    onCanvasPointerDown(e: any) {
        if (this.ds.tt.list.length > 0) {
            if (e.button === 2) {
                if (!this.ds.isTweening) {
                    // block right click based movements

                    this.ds.st.selectionEnabled = false;
                    this.ds.tt.blockBoxInteraction = true;
                    this.ds.tt.blockCornerInteraction = true;
                }
            }
        }
    }

    onCanvasContextMenu = (e: Event, menu: any) => {
        if (!this.ds.isTweening) {
            if (this.ds.tt.list.length > 0) {
                menu.show(e);
            }

            this.ds.st.selectionEnabled = true;
            this.ds.tt.blockBoxInteraction = false;
            this.ds.tt.blockCornerInteraction = false;
        } else {
            e.preventDefault();

            setTimeout(() => {
                this.onCanvasContextMenu(e, menu);
            }, 250);
        }
    };

    onTransformAdd = () => {
        if (this.ds.tt.list.length === 1) {
            let item: PIXI.Container = this.ds.tt.list[0];

            if (item instanceof TextInput) {
                this.editTextPopupStyle.display = 'block';

                this.onTransform(); // maybe won't needed in the future

                return;
            } else {
                this.editTextPopupStyle.display = 'none';
            }
        } else {
            this.editTextPopupStyle.display = 'none';
        }
    };

    onTransformBeforeRemove = () => {
        if (!this.textService.editableInput) {
            this.editTextPopupStyle.display = 'none';
        }

        this.transformOptionsPopupStyle.display = 'none';
    };

    onTransform = () => {
        if (this.transformOptionsPopupStyle.display === 'block') {
            this.placeTransformOptionsPopup();
        }

        if (this.editTextPopupStyle.display === 'block') {
            if (this.textService.editableInput) {
                this.placeEditTextPopupDelayed();
            } else {
                this.placeEditTextPopup();
            }
        }
    };

    onTransformRedraw = () => {
        this.onTransform();
    };

    onTransformOptions = (e?: any) => {
        this.transformOptionsPopupStyle.display = this.transformOptionsPopupStyle.display === 'block' ? 'none' : 'block';

        if (this.transformOptionsPopupStyle.display === 'block') {
            this.placeTransformOptionsPopup();
        } else {
            this.onTransformOptionsHideComplete();
        }
    };

    onTransformOptionsApply = (e?: any) => {
        this.transformOptionsPopupStyle.display = 'none';
        this.onTransformOptionsHideComplete();
    };

    onTransformOptionsHideComplete() {
        if (!this.ds.isTweening) {
            this.ds.st.selectionEnabled = true;
            this.ds.tt.blockBoxInteraction = false;
            this.ds.tt.blockCornerInteraction = false;
        }
    }

    // use delayed version, when you edit the text, cause item.domEditor needs some time to update its own dimensions
    placeEditTextPopupDelayed = () => {
        clearTimeout(this.timeoutEditTextButton);
        this.timeoutEditTextButton = setTimeout(this.placeEditTextPopup, this.config.isDesktop ? 15 : 50);
    };

    placeEditTextPopup = () => {
        this.ngZone.run(() => {
            let item: TextInput = this.textService.editableInput ? this.textService.editableInput : (this.ds.tt.list[0] as TextInput);

            if (!item || !item.domBox) {
                return;
            }
            let minWidth: number = parseFloat(item.domBox.style.minWidth);
            let minHeight: number = parseFloat(item.domBox.style.minHeight);
            let itemWidth: number = item.width;
            let itemHeight: number =
                item.height + (this.textService.editableInput ? 2 * Math.max(parseInt(item.domEditor.offsetHeight) - item.height, 0) : 0);
            let itemPos: PIXI.Point = new PIXI.Point().copyFrom(item.position);
            let parent: PIXI.Container = this.ds.container;

            if (this.textService.editableInput) {
                // correct popup's position if the surrogate is smaller than the dom box

                let localCenter: PIXI.Point = new PIXI.Point(0, 0);
                if (itemWidth < minWidth) {
                    localCenter.x = (minWidth - item.width) / 2;
                    itemWidth = minWidth;
                }

                if (itemHeight < minHeight) {
                    localCenter.y = (minHeight - item.height) / 2;
                    itemHeight = minHeight;
                }

                if (localCenter.x !== 0 || localCenter.y !== 0) {
                    localCenter.x += item.pivot.x;
                    localCenter.y += item.pivot.y;
                    itemPos = itemPos.copyFrom(parent.toLocal(item.toGlobal(localCenter)));
                }
            }

            minWidth *= parent.scale.x;
            minHeight *= parent.scale.y;
            itemWidth *= parent.scale.x;
            itemHeight *= parent.scale.y;

            const dx: number = itemWidth * 0.5,
                dy: number = itemHeight * 0.5,
                delta: number = Math.sqrt(dx * dx + dy * dy),
                ang: number = Math.atan2(dy, dx) + item.rotation,
                ang2: number = Math.atan2(dy, -dx) + item.rotation,
                indent: number = 46 + Math.max(Math.abs(delta * Math.sin(ang)), Math.abs(delta * Math.sin(ang2))),
                bounds: PIXI.Rectangle = this.ds.getCanvasBounds(),
                w: number = 74, //this.editTextButton.nativeElement.offsetWidth
                h: number = 33;

            let etx: number = bounds.x + parent.x + parent.scale.x * itemPos.x - w * 0.5;
            let ety: number = bounds.y + parent.y + parent.scale.y * itemPos.y + indent;

            ety = Math.min(ety, window.innerHeight - h);

            let rightBorderX: number = this.dialogLeft - w + window.pageXOffset - 10;
            if (etx > rightBorderX) {
                etx = rightBorderX;
            }

            this.editTextPopupStyle.left = etx + 'px';
            this.editTextPopupStyle.top = ety + 'px';
        });
    };

    placeTransformOptionsPopup = () => {
        this.ngZone.run(() => {
            const p: PIXI.Point = this.ds.tt.getCornerPosition('options'),
                bounds: PIXI.Rectangle = this.ds.getCanvasBounds(),
                w: number = 200,
                h: number = 170; // approximate max height

            this.transformOptionsPopupStyle.left = Math.max(bounds.x + p.x - w, 0) + 'px';
            this.transformOptionsPopupStyle.top = Math.min(bounds.y + p.y + 20, window.innerHeight - h) + 'px';
        });
    };

    ngOnDestroy() {
        // remove all the subscriptions
        // TODO: make sure this.destroy$.unsubscribe() is not needed
        this.destroy$.next();
        this.destroy$.complete();
    }

    doResize = () => {
        return new Promise<any>((resolve) => {
            let vh: number = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);

            clearTimeout(this.timeoutResizeCanvas);
            this.timeoutResizeCanvas = setTimeout(
                () => {
                    resolve(this.ds.doResize());
                },
                this.config.isDesktop ? 200 : 400
            );
        });
    };

    @HostListener('window:resize', ['$event'])
    onResize(event?: any) {
        return new Promise<any>((resolve) => {
            if (event) {
                clearTimeout(this.timeoutResize);
                // give some time to the parent to update its own dimensions
                // 100 ms or even lower values (+ parent's delay) may be allowed, but keep it higher to avoid a theoretical errors on slow devices
                // or because of orientation change process (rotation)
                this.timeoutResize = setTimeout(
                    () => {
                        resolve(this.doResize());
                    },
                    this.config.isDesktop ? 100 : 1100
                );
            } else {
                resolve(this.doResize());
            }
        });
    }

    @HostListener('window:scroll', ['$event']) // for window scroll events
    onScroll(event?: any) {
        this.placeDialogs();
    }
}

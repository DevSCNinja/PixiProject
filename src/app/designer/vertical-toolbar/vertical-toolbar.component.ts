import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { SelectItem } from 'primeng/api';
import { DesignService, DesignServiceEventType } from '../shared/services/design.service';
import { DesignData, BitmapFillItem, DesignShape, DesignItem, DesignArt } from '../shared/models/main';
import { ArtService } from '../shared/services/art.service';
import { ShapeService } from '../shared/services/shape.service';
import { BackgroundService } from '../shared/services/background.service';
import { TextService } from '../shared/services/text.service';
import { AssetService } from '../shared/services/asset.service';
import { takeUntil } from 'rxjs/operators';
import { ConfigService } from '../shared/services/config.service';
import { UIService } from '../shared/services/ui.service';
import { ScrollPanel } from 'primeng/scrollpanel';

@Component({
    selector: 'vertical-toolbar',
    templateUrl: './vertical-toolbar.component.html',
    styleUrls: ['./vertical-toolbar.component.scss']
})
export class VerticalToolbarComponent implements OnInit, OnDestroy {
    @ViewChild('scrollPanelSwatch', { static: false }) scrollPanelSwatch: ScrollPanel;

    colors: SelectItem[];

    hoverImage: BitmapFillItem;

    private readonly destroy$ = new Subject();

    constructor(
        public config: ConfigService,
        public ds: DesignService,
        public as: AssetService,
        public artService: ArtService,
        public shapeService: ShapeService,
        public bgService: BackgroundService,
        public textService: TextService,
        public ui: UIService
    ) {}

    ngOnInit() {
        this.ds.pipe(takeUntil(this.destroy$)).subscribe((e: any) => {
            switch (e.type) {
                case DesignServiceEventType.EVENT_INIT_COMPLETE:
                    this.initColors();
                    break;
            }
        });
    }

    initColors() {
        this.colors = [];
        Object.keys(this.as.bitmapFills)
            .sort((a, b) => {
                return this.as.bitmapFills[a].sortVal - this.as.bitmapFills[b].sortVal;
            })
            .forEach((key) => {
                let bf: BitmapFillItem = this.as.bitmapFills[key];

                if (bf.id.search(/[a-z]/i) === -1) {
                    // only dark colors (no frost, pitch etc.)
                    this.colors.push({ label: bf.name, value: bf.id });
                }
            });

        // update scrollbar's visibility
        setTimeout(this.scrollPanelSwatch.moveBar);
    }

    onArtAdd = (e?: any) => {
        if (!this.ui.displayArtLibrary) {
            this.ui.closeDialogs();
        }
        this.ui.displayArtLibrary = !this.ui.displayArtLibrary;
    };

    onVaseAdd = (e?: any) => {
        if (!this.ui.displayVaseLibrary) {
            this.ui.closeDialogs();
        }
        this.ui.displayVaseLibrary = !this.ui.displayVaseLibrary;
    };

    onTextAdd = (e?: any) => {
        this.ds.addText();
    };

    onShapeAdd = (e?: any) => {
        if (!this.ui.displayShapeLibrary) {
            this.ui.closeDialogs();
        }
        this.ui.displayShapeLibrary = !this.ui.displayShapeLibrary;
    };

    getColorIcon(colorID: string): string {
        if (!this.ds || !this.ds.tt || !this.as) {
            return 'pi';
        }

        let colors: string[] = this.ds.getContextColoredItems().map((elem) => elem.model.color);
        for (let c of colors) {
            if (c === colorID) {
                return 'pi pi-check';
            }
        }

        return 'pi';
    }

    onColorClick(colorID: string) {
        let items: (DesignShape | DesignArt)[] = this.ds.getContextColoredItems();
        for (let item of items) {
            let type: string = (item as DesignItem).model.type;
            if (type === 'art') {
                this.artService.setArtColor(item as DesignArt, colorID);
            } else {
                if (type === 'shape') {
                    this.shapeService.setShapeColor(item as DesignShape, colorID);
                }
            }
        }

        this.ds.remember();
    }

    onShowPreview(event: any, element: BitmapFillItem, opPreview: any) {
        if (element && !this.ds.isInteracting) {
            this.hoverImage = element;
            opPreview.show(event);
        }
    }

    onHidePreview(event: any, opPreview: any) {
        this.hoverImage = null;
        opPreview.hide(event);
    }

    ngOnDestroy() {
        // remove all the subscriptions
        this.destroy$.next();
        this.destroy$.complete();
    }
}

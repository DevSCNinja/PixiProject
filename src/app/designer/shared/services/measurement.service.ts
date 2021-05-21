import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import * as _ from 'lodash';
import { RulerModel, DesignRuler, DesignGrid, GridModel } from '../models/main';
import { Ruler } from '../../pixi/ruler';

@Injectable({
    providedIn: 'root'
})
export class MeasurementService {
    // TODO: in the future, to support not only inches, much more work needs to be done:
    // - correct such fabric methods as createTextModel(), createShapeModel() etc.
    // - should use 'unit' property of SceneItemModel (e.g. to make Recent Arts work after scene units have been changed
    // - and other

    static readonly PIXEL: string = 'px';

    static readonly INCH: string = 'inch';

    static readonly CENTIMETER: string = 'cm'; // not used at the moment
    // higher values improve visual quality of display objects, but may affect performance (recommended values: 15, 30, 45)
    static readonly PIXELS_PER_INCH: number = 30;

    static readonly PIXELS_PER_UNIT: { [type: string]: number } = {
        [MeasurementService.PIXEL]: 1,
        [MeasurementService.INCH]: MeasurementService.PIXELS_PER_INCH,
        [MeasurementService.CENTIMETER]: MeasurementService.PIXELS_PER_INCH / 2.54
    };
    // px per inch of the legacy designer (don't change)
    static readonly LEGACY_PIXELS_PER_INCH: number = 15;
    // scale needed for textures, filters and other
    static readonly SCALE: number = MeasurementService.PIXELS_PER_INCH / MeasurementService.LEGACY_PIXELS_PER_INCH;

    static readonly DEFAULT_RULER_MODEL: RulerModel = {
        type: 'ruler',
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        inch: true
    };

    static readonly DEFAULT_GRID_MODEL: GridModel = {
        type: 'grid',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        inch: true
    };

    static readonly DEFAULT_UNIT: string = MeasurementService.INCH;

    static CURRENT_UNIT: string = MeasurementService.INCH;

    constructor() {}

    static convertToUnit(value: number | string, currentUnit: string, targetUnit: string) {
        if (typeof value === 'string') {
            value = parseFloat(value);
        }
        return (value * MeasurementService.PIXELS_PER_UNIT[currentUnit]) / MeasurementService.PIXELS_PER_UNIT[targetUnit];
    }

    static convertPropsToUnit(obj: any, props: string[], currentUnit: string, targetUnit: string) {
        if (currentUnit === targetUnit) {
            return obj;
        }
        props.forEach((p) => {
            if (obj.hasOwnProperty(p)) {
                obj[p] = MeasurementService.convertToUnit(obj[p], currentUnit, targetUnit);
            } else {
                console.warn('Object has no property "' + p + '"');
            }
        });

        return obj;
    }

    static unitToPx(value: number | string, unit?: string): number {
        if (!unit) {
            unit = MeasurementService.CURRENT_UNIT;
        }

        if (typeof value === 'string') {
            value = parseFloat(value);
        }
        return value * MeasurementService.PIXELS_PER_UNIT[unit];
    }

    static pxToUnit(value: number | string, unit?: string): number {
        if (!unit) {
            unit = MeasurementService.CURRENT_UNIT;
        }
        if (typeof value === 'string') {
            value = parseFloat(value);
        }
        return value / MeasurementService.PIXELS_PER_UNIT[unit];
    }

    // more compact conversion functions (suggest to use them only where inches explicitly used, otherwise use more the common functions above)
    static inchToPx(value: number | string): number {
        return MeasurementService.unitToPx(value, MeasurementService.INCH);
    }

    static pxToInch(value: number | string): number {
        return MeasurementService.pxToUnit(value, MeasurementService.INCH);
    }

    createRuler(m?: RulerModel): DesignRuler {
        if (!m) {
            m = _.cloneDeep(MeasurementService.DEFAULT_RULER_MODEL); // copy
        }

        let ruler: Ruler = new Ruler(
            125,
            MeasurementService.PIXELS_PER_UNIT[MeasurementService.INCH],
            300,
            33,
            0,
            MeasurementService.SCALE
        );
        ruler.pivot.x = ruler.width / 2;
        ruler.x = MeasurementService.unitToPx(m.x);
        ruler.y = MeasurementService.unitToPx(m.y);
        ruler.scale.x = m.scaleX;
        //ruler.scale.y = m.scaleY
        ruler.rotation = m.rotation;

        let dr: DesignRuler = ruler as DesignRuler;
        dr.model = m;
        dr.updateModel = (flag: string = 'default') => {
            this.updateRulerModel(dr, dr.model, flag);
        };
        dr.interactive = true;

        return dr;
    }

    private updateRulerModel(item: DesignRuler, m: RulerModel, flag: string) {
        m.x = MeasurementService.pxToUnit(item.x);
        m.y = MeasurementService.pxToUnit(item.y);
        m.scaleX = item.scale.x;
        //m.scaleY= item.scale.y
        m.rotation = item.rotation;
    }

    createGrid(m?: GridModel): DesignGrid {
        if (!m) {
            m = _.cloneDeep(MeasurementService.DEFAULT_GRID_MODEL); // copy
        }

        let texture: PIXI.Texture = PIXI.Texture.from('monuvision-assets/images/grid.png');
        let grid: DesignGrid = new PIXI.TilingSprite(texture) as DesignGrid;
        //grid.pivot.set(0);
        grid.x = MeasurementService.unitToPx(m.x);
        grid.y = MeasurementService.unitToPx(m.y);
        grid.width = m.width;
        grid.height = m.height;
        let sc: number = MeasurementService.inchToPx(12) / 256;
        grid.tileScale.x = sc;
        grid.tileScale.y = sc;
        grid.blendMode = PIXI.BLEND_MODES.SCREEN;

        let dg: DesignGrid = grid as DesignGrid;
        dg.model = m;
        dg.updateModel = (flag: string = 'default') => {
            this.updateGridModel(dg, dg.model, flag);
        };
        dg.interactive = false;

        return dg;
    }

    private updateGridModel(item: DesignGrid, m: GridModel, flag: string) {
        m.x = MeasurementService.pxToUnit(item.x);
        m.y = MeasurementService.pxToUnit(item.y);
        m.width = item.width;
        m.height = item.height;
    }
}

import * as PIXI from 'pixi.js';
import { FontItem } from '../shared/models/main';

export interface ExtendedTextStyle {
    valign?: 'top' | 'middle' | 'bottom' | 'baseline' | number;
    debug?: boolean;
    tagStyle?: 'xml' | 'bbcode';
    styleID?: number;
    align?: string;
    breakWords?: boolean;
    dropShadow?: boolean;
    dropShadowAlpha?: number;
    dropShadowAngle?: number;
    dropShadowBlur?: number;
    dropShadowColor?: string | number;
    dropShadowDistance?: number;
    fill?: string | string[] | number | number[] | CanvasGradient | CanvasPattern;
    fillGradientType?: number;
    fillGradientStops?: number[];
    fontFamily?: string | string[];
    fontSize?: number | string;
    fontStyle?: string;
    fontVariant?: string;
    fontWeight?: string;
    letterSpacing?: number;
    lineHeight?: number;
    lineJoin?: string;
    miterLimit?: number;
    padding?: number;
    stroke?: string | number;
    strokeThickness?: number;
    textBaseline?: string;
    trim?: boolean;
    whiteSpace?: string;
    wordWrap?: boolean;
    wordWrapWidth?: number;
    leading?: number;
}

export interface TextStyleSet {
    [key: string]: ExtendedTextStyle;
}

interface FontProperties {
    ascent: number;
    descent: number;
    fontSize: number;
}

interface TextData {
    text: string;
    style: ExtendedTextStyle;
    width: number;
    height: number;
    fontProperties: FontProperties;
    tag: TagData;
}

interface TextDrawingData {
    text: string;
    style: ExtendedTextStyle;
    x: number;
    y: number;
    width: number;
    ascent: number;
    descent: number;
    tag: TagData;
}

export interface MstDebugOptions {
    spans: {
        enabled?: boolean;
        baseline?: string;
        top?: string;
        bottom?: string;
        bounding?: string;
        text?: boolean;
    };
    objects: {
        enabled?: boolean;
        bounding?: string;
        text?: boolean;
    };
}

export interface TagData {
    name: string;
    properties: { [key: string]: string };
}

export interface MstInteractionEvent extends PIXI.InteractionEvent {
    targetTag: TagData;
}

const INTERACTION_EVENTS = [
    'pointerover',
    'pointerenter',
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'pointerout',
    'pointerleave',
    'gotpointercapture',
    'lostpointercapture',
    'mouseover',
    'mouseenter',
    'mousedown',
    'mousemove',
    'mouseup',
    'mousecancel',
    'mouseout',
    'mouseleave',
    'touchover',
    'touchenter',
    'touchdown',
    'touchmove',
    'touchup',
    'touchcancel',
    'touchout',
    'touchleave'
];

const TAG_STYLE = {
    bbcode: 'bbcode',
    xml: 'xml'
};

const TAG = {
    bbcode: ['[', ']'],
    xml: ['<', '>']
};

export default class MultiStyleText extends PIXI.Text {
    private static DEFAULT_TAG_STYLE: ExtendedTextStyle = {
        align: 'left',
        breakWords: false,
        // debug intentionally not included
        dropShadow: false,
        dropShadowAngle: Math.PI / 6,
        dropShadowBlur: 0,
        dropShadowColor: '#000000',
        dropShadowDistance: 5,
        fill: 'black',
        fillGradientType: PIXI.TEXT_GRADIENT.LINEAR_VERTICAL,
        fontFamily: 'Arial',
        fontSize: 26,
        fontStyle: 'normal',
        fontVariant: 'normal',
        fontWeight: 'normal',
        letterSpacing: 0,
        lineHeight: 0,
        lineJoin: 'miter',
        miterLimit: 10,
        padding: 0,
        stroke: 'black',
        strokeThickness: 0,
        styleID: 0,
        textBaseline: 'alphabetic',
        valign: 'baseline',
        wordWrap: false,
        wordWrapWidth: 100,
        tagStyle: 'xml'
    };

    public static debugOptions: MstDebugOptions = {
        spans: {
            enabled: false,
            baseline: '#44BB44',
            top: '#BB4444',
            bottom: '#4444BB',
            bounding: 'rgba(255, 255, 255, 0.1)',
            text: true
        },
        objects: {
            enabled: false,
            bounding: 'rgba(255, 255, 255, 0.05)',
            text: true
        }
    };

    textStyles: TextStyleSet;

    fonts: FontItem[] = [];
    // allows to overlay fonts
    fontReplacement: { [family: string]: string[] } = {};

    fontFillReplacement: { [family: string]: string[] } = {};

    lineSpacings: number[] = [];

    lineYMins: number[] = [];

    lineYMaxs: number[] = [];
    // to avoid text cropping (happens on the right side usually)
    generalPaddingX: number = 0;

    generalPaddingY: number = 0;

    // inhereted props missing in the pixi types:
    _style: any;

    _texture: PIXI.Texture;

    dirty: boolean;

    _generateFillStyle: Function;

    private hitboxes: { tag: TagData; hitbox: PIXI.Rectangle }[];

    constructor(text: string, styles: TextStyleSet) {
        super(text);

        this.styles = styles;

        INTERACTION_EVENTS.forEach((event) => {
            this.on(event, (e: PIXI.InteractionEvent) => this.handleInteraction(e));
        });
    }

    private handleInteraction(e: PIXI.InteractionEvent) {
        let ev = e as MstInteractionEvent;

        let localPoint = e.data.getLocalPosition(this);
        let targetTag = this.hitboxes.reduce(
            (prev, hitbox) => (prev !== undefined ? prev : hitbox.hitbox.contains(localPoint.x, localPoint.y) ? hitbox : undefined),
            undefined
        );
        ev.targetTag = targetTag === undefined ? undefined : targetTag.tag;
    }

    public set styles(styles: TextStyleSet) {
        this.textStyles = {};

        this.textStyles['default'] = this.assign({}, MultiStyleText.DEFAULT_TAG_STYLE);

        for (let style in styles) {
            if (style === 'default') {
                this.assign(this.textStyles['default'], styles[style]);
            } else {
                this.textStyles[style] = this.assign({}, styles[style]);
            }
        }
        if (this.textStyles.default.tagStyle === TAG_STYLE.bbcode) {
            // when using bbcode parsing, register a bunch of standard bbcode tags and some cool pixi ones
            this.textStyles.b = this.assign({}, { fontStyle: 'bold' });
            this.textStyles.i = this.assign({}, { fontStyle: 'italic' });
            this.textStyles.color = this.assign({}, { fill: '' }); // an array would result in gradients
            this.textStyles.outline = this.assign({}, { stroke: '', strokeThickness: 6 });
            this.textStyles.font = this.assign({}, { fontFamily: '' });
            this.textStyles.shadow = this.assign(
                {},
                {
                    dropShadowColor: '',
                    dropShadow: true,
                    dropShadowBlur: 3,
                    dropShadowDistance: 3,
                    dropShadowAngle: 2
                }
            );
            this.textStyles.size = this.assign({}, { fontSize: 'px' });
            this.textStyles.spacing = this.assign({}, { letterSpacing: '' });
            this.textStyles.align = this.assign({}, { align: '' });
        }

        this._style = new PIXI.TextStyle(this.textStyles['default']);
        this.dirty = true;
    }

    public get styles(): TextStyleSet {
        return this.textStyles;
    }

    public setTagStyle(tag: string, style: ExtendedTextStyle): void {
        if (tag in this.textStyles) {
            this.assign(this.textStyles[tag], style);
        } else {
            this.textStyles[tag] = this.assign({}, style);
        }

        this._style = new PIXI.TextStyle(this.textStyles['default']);
        this.dirty = true;
    }

    public deleteTagStyle(tag: string): void {
        if (tag === 'default') {
            this.textStyles['default'] = this.assign({}, MultiStyleText.DEFAULT_TAG_STYLE);
        } else {
            delete this.textStyles[tag];
        }

        this._style = new PIXI.TextStyle(this.textStyles['default']);
        this.dirty = true;
    }

    private getTagRegex(captureName: boolean, captureMatch: boolean): RegExp {
        let tagAlternation = Object.keys(this.textStyles).join('|');
        const { tagStyle } = this.textStyles.default;

        if (captureName) {
            tagAlternation = `(${tagAlternation})`;
        } else {
            tagAlternation = `(?:${tagAlternation})`;
        }

        let reStr =
            tagStyle === TAG_STYLE.bbcode
                ? `\\${TAG.bbcode[0]}${tagAlternation}(?:\\=(?:[A-Za-z0-9_\\-\\#]+|'(?:[^']+|\\\\')*'))*\\s*\\${TAG.bbcode[1]}|\\${TAG.bbcode[0]}\\/${tagAlternation}\\s*\\${TAG.bbcode[1]}`
                : `\\${TAG.xml[0]}${tagAlternation}(?:\\s+[A-Za-z0-9_\\-]+=(?:"(?:[^"]+|\\\\")*"|'(?:[^']+|\\\\')*'))*\\s*\\${TAG.xml[1]}|\\${TAG.xml[0]}\\/${tagAlternation}\\s*\\${TAG.xml[1]}`;

        if (captureMatch) {
            reStr = `(${reStr})`;
        }

        return new RegExp(reStr, 'g');
    }

    private getPropertyRegex(): RegExp {
        return new RegExp(`([A-Za-z0-9_\\-]+)=(?:"((?:[^"]+|\\\\")*)"|'((?:[^']+|\\\\')*)')`, 'g');
    }

    private getBBcodePropertyRegex(): RegExp {
        return new RegExp(`[A-Za-z0-9_\\-]+=([A-Za-z0-9_\\-\\#]+)`, 'g');
    }

    private _getTextDataPerLine(lines: string[]) {
        let outputTextData: TextData[][] = [];
        let re = this.getTagRegex(true, false);

        let styleStack = [this.assign({}, this.textStyles['default'])];
        let tagStack: TagData[] = [{ name: 'default', properties: {} }];

        // determine the group of word for each line
        for (let i = 0; i < lines.length; i++) {
            let lineTextData: TextData[] = [];

            // find tags inside the string
            let matches: RegExpExecArray[] = [];
            let matchArray: RegExpExecArray;

            while ((matchArray = re.exec(lines[i]))) {
                matches.push(matchArray);
            }
            // if there is no match, we still need to add the line with the default style
            if (matches.length === 0) {
                lineTextData.push(this.createTextData(lines[i], styleStack[styleStack.length - 1], tagStack[tagStack.length - 1]));
            } else {
                // We got a match! add the text with the needed style
                let currentSearchIdx = 0;
                for (let j = 0; j < matches.length; j++) {
                    // if index > 0, it means we have characters before the match,
                    // so we need to add it with the default style
                    if (matches[j].index > currentSearchIdx) {
                        lineTextData.push(
                            this.createTextData(
                                lines[i].substring(currentSearchIdx, matches[j].index),
                                styleStack[styleStack.length - 1],
                                tagStack[tagStack.length - 1]
                            )
                        );
                    }

                    if (matches[j][0][1] === '/') {
                        // reset the style if end of tag
                        if (styleStack.length > 1) {
                            styleStack.pop();
                            tagStack.pop();
                        }
                    } else {
                        // set the current style
                        let properties: { [key: string]: string } = {};
                        let propertyRegex = this.getPropertyRegex();
                        let propertyMatch: RegExpMatchArray;

                        while ((propertyMatch = propertyRegex.exec(matches[j][0]))) {
                            properties[propertyMatch[1]] = propertyMatch[2] || propertyMatch[3];
                        }

                        tagStack.push({ name: matches[j][1], properties });

                        const { tagStyle } = this.textStyles.default;
                        // if using bbtag style, take styling information in a different way
                        if (tagStyle === TAG_STYLE.bbcode && matches[j][0].includes('=') && this.textStyles[matches[j][1]]) {
                            const bbcodeRegex = this.getBBcodePropertyRegex();
                            const bbcodeTags = bbcodeRegex.exec(matches[j][0]);
                            let bbStyle: { [key: string]: string } = {};
                            Object.entries(this.textStyles[matches[j][1]]).forEach((style) => {
                                bbStyle[style[0]] = typeof style[1] !== 'string' ? style[1] : bbcodeTags[1] + style[1];
                            });
                            styleStack.push(this.assign({}, styleStack[styleStack.length - 1], bbStyle));
                        } else {
                            styleStack.push(this.assign({}, styleStack[styleStack.length - 1], this.textStyles[matches[j][1]]));
                        }
                    }

                    // update the current search index
                    currentSearchIdx = matches[j].index + matches[j][0].length;
                }

                // is there any character left?
                let characterLeft: boolean = currentSearchIdx <= lines[i].length - (i === 0 ? 0 : 1); // first line may contain only \n, so style it
                if (characterLeft) {
                    const result = this.createTextData(
                        currentSearchIdx ? lines[i].substring(currentSearchIdx) : lines[i],
                        styleStack[styleStack.length - 1],
                        tagStack[tagStack.length - 1]
                    );
                    lineTextData.push(result);
                }
            }

            outputTextData.push(lineTextData);
        }

        // don't display any incomplete tags at the end of text- good for scrolling text in games
        const { tagStyle } = this.textStyles.default;
        outputTextData[outputTextData.length - 1].map((data) => {
            if (data.text.includes(TAG[tagStyle][0])) data.text = data.text.match(tagStyle === TAG_STYLE.bbcode ? /^(.*)\[/ : /^(.*)\</)[1];
        });

        return outputTextData;
    }

    private getFontString(style: ExtendedTextStyle): string {
        return new PIXI.TextStyle(style).toFontString();
    }

    private createTextData(text: string, style: ExtendedTextStyle, tag: TagData): TextData {
        return {
            text,
            style,
            width: 0,
            height: 0,
            fontProperties: undefined,
            tag
        };
    }

    private getDropShadowPadding(): number {
        let maxDistance = 0;
        let maxBlur = 0;

        Object.keys(this.textStyles).forEach((styleKey) => {
            let { dropShadowDistance, dropShadowBlur } = this.textStyles[styleKey];
            maxDistance = Math.max(maxDistance, dropShadowDistance || 0);
            maxBlur = Math.max(maxBlur, dropShadowBlur || 0);
        });

        return maxDistance + maxBlur;
    }

    private measureFont(fontString: string): PIXI.IFontMetrics {
        return PIXI.TextMetrics.measureFont(fontString);
    }

    public updateText(): void {
        if (!this.dirty) {
            return;
        }

        this.hitboxes = [];

        this.texture.baseTexture.resolution = this.resolution;
        let textStyles = this.textStyles;
        let outputText = this.text;

        // TODO: not important, cause we don't use wordWrap, but fix wordWrap (now it deletes all spacebars)
        if (this._style.wordWrap) {
            outputText = this.wordWrap(this.text);
        }

        // split text into lines
        let lines = outputText.split(/(?:\r\n|\r|\n)/);

        // get the text data with specific styles
        let outputTextData = this._getTextDataPerLine(lines);

        // calculate text width and height
        let lineWidths: number[] = [];
        let lineYMins: number[] = [];
        let lineYMaxs: number[] = [];
        let maxLineWidth = 0;

        for (let i = 0; i < lines.length; i++) {
            let lineWidth = 0;
            let lineYMin = 0;
            let lineYMax = 0;
            let defaultLineYMin: number = this.lineYMins[i];
            let defaultLineYMax: number = this.lineYMaxs[i];
            let lineSpacing: number = i > 0 ? this.lineSpacings[i - 1] : 0;
            for (let j = 0; j < outputTextData[i].length; j++) {
                let sty = outputTextData[i][j].style;

                this.context.font = this.getFontString(sty);

                // save the width
                outputTextData[i][j].width = this.context.measureText(outputTextData[i][j].text).width;

                // TODO: fix the letter spacing issue (similar to https://github.com/pixijs/pixi.js/pull/6091),
                // also it may cause text being cropped on the right-hand side
                if (outputTextData[i][j].text.length !== 0) {
                    outputTextData[i][j].width += (outputTextData[i][j].text.length - 1) * sty.letterSpacing;

                    if (j > 0) {
                        lineWidth += sty.letterSpacing / 2; // spacing before first character
                    }

                    if (j < outputTextData[i].length - 1) {
                        lineWidth += sty.letterSpacing / 2; // spacing after last character
                    }
                }

                lineWidth += outputTextData[i][j].width;

                // save the font properties
                outputTextData[i][j].fontProperties = this.measureFont(this.context.font);

                // save the height
                outputTextData[i][j].height = outputTextData[i][j].fontProperties.fontSize;

                if (typeof sty.valign === 'number') {
                    lineYMin = Math.min(lineYMin, sty.valign - outputTextData[i][j].fontProperties.descent);
                    lineYMax = Math.max(lineYMax, sty.valign + outputTextData[i][j].fontProperties.ascent);
                } else {
                    lineYMin = Math.min(lineYMin, -outputTextData[i][j].fontProperties.descent);
                    lineYMax = Math.max(lineYMax, outputTextData[i][j].fontProperties.ascent);
                }
            }

            lineWidths[i] = lineWidth;
            lineYMins[i] = isNaN(defaultLineYMin) || i === lines.length - 1 ? lineYMin : defaultLineYMin;
            lineYMaxs[i] = isNaN(defaultLineYMax) || i === 0 ? lineYMax : defaultLineYMax + lineSpacing;
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
        }

        // transform styles in array
        let stylesArray = Object.keys(textStyles).map((key) => textStyles[key]);

        let maxStrokeThickness = stylesArray.reduce((prev, cur) => Math.max(prev, cur.strokeThickness || 0), 0);

        let dropShadowPadding = this.getDropShadowPadding();

        let totalHeight = lineYMaxs.reduce((prev, cur) => prev + cur, 0) - lineYMins.reduce((prev, cur) => prev + cur, 0);

        // define the right width and height
        let width = maxLineWidth + 2 * (maxStrokeThickness + dropShadowPadding + this.generalPaddingX);
        let height = totalHeight + 2 * (maxStrokeThickness + dropShadowPadding + this.generalPaddingY);

        this.canvas.width = width * this.resolution;
        this.canvas.height = height * this.resolution;

        this.context.scale(this.resolution, this.resolution);

        this.context.textBaseline = 'alphabetic';
        this.context.lineJoin = 'round';

        let basePositionY = dropShadowPadding + maxStrokeThickness + this.generalPaddingY;

        let drawingData: TextDrawingData[] = [];

        // Compute the drawing data
        for (let i = 0; i < outputTextData.length; i++) {
            let line = outputTextData[i];
            let linePositionX: number;

            switch (this._style.align) {
                case 'left':
                    linePositionX = this.generalPaddingX + dropShadowPadding + maxStrokeThickness;
                    break;

                case 'center':
                    linePositionX = this.generalPaddingX + dropShadowPadding + maxStrokeThickness + (maxLineWidth - lineWidths[i]) / 2;
                    break;

                case 'right':
                    linePositionX = this.generalPaddingX + dropShadowPadding + maxStrokeThickness + maxLineWidth - lineWidths[i];
                    break;
            }

            for (let j = 0; j < line.length; j++) {
                let { style, text, fontProperties, width, height, tag } = line[j];

                let linePositionY = basePositionY + fontProperties.ascent;

                switch (style.valign) {
                    case 'top':
                        // no need to do anything
                        break;

                    case 'baseline':
                        linePositionY += lineYMaxs[i] - fontProperties.ascent;
                        break;

                    case 'middle':
                        linePositionY += (lineYMaxs[i] - lineYMins[i] - fontProperties.ascent - fontProperties.descent) / 2;
                        break;

                    case 'bottom':
                        linePositionY += lineYMaxs[i] - lineYMins[i] - fontProperties.ascent - fontProperties.descent;
                        break;

                    default:
                        // A number - offset from baseline, positive is higher
                        linePositionY += lineYMaxs[i] - fontProperties.ascent - style.valign;
                        break;
                }

                if (style.letterSpacing === 0) {
                    drawingData.push({
                        text,
                        style,
                        x: linePositionX,
                        y: linePositionY,
                        width,
                        ascent: fontProperties.ascent,
                        descent: fontProperties.descent,
                        tag
                    });

                    linePositionX += line[j].width;
                } else {
                    this.context.font = this.getFontString(line[j].style);

                    for (let k = 0; k < text.length; k++) {
                        if (k > 0 || j > 0) {
                            linePositionX += style.letterSpacing / 2;
                        }

                        let charWidth = this.context.measureText(text.charAt(k)).width;

                        drawingData.push({
                            text: text.charAt(k),
                            style,
                            x: linePositionX,
                            y: linePositionY,
                            width: charWidth,
                            ascent: fontProperties.ascent,
                            descent: fontProperties.descent,
                            tag
                        });

                        linePositionX += charWidth;

                        if (k < text.length - 1 || j < line.length - 1) {
                            linePositionX += style.letterSpacing / 2;
                        }
                    }
                }
            }

            basePositionY += lineYMaxs[i] - lineYMins[i];
        }

        this.context.save();

        // replace fonts (for overlay effect)
        if (Object.keys(this.fontReplacement).length > 0) {
            drawingData.forEach(({ style, text, x, y, width, ascent, descent, tag }) => {
                if (style.fontFamily) {
                    let familyToReplace: string = style.fontFamily instanceof Array ? style.fontFamily[0] : style.fontFamily;
                    if (this.fontReplacement[familyToReplace]) {
                        let fills: string[] = this.fontFillReplacement[familyToReplace];
                        if (!fills || fills.length === 0) {
                            fills = this.fontReplacement[familyToReplace].map((elem) => '#00FFFF');
                        }
                        this.fontReplacement[familyToReplace].forEach((family, index) => {
                            if (index === 0) {
                                style.fontFamily = family;
                                style.fill = fills[index];
                            } else {
                                let newStyle: ExtendedTextStyle = this.assign({}, style);
                                newStyle.fontFamily = family;
                                newStyle.fill = fills[index];
                                let dd: TextDrawingData = { style: newStyle, text, x, y, width, ascent, descent, tag };
                                drawingData.push(dd);
                            }
                        });
                    }
                }
            });
        }

        // First pass: draw the shadows only
        drawingData.forEach(({ style, text, x, y }) => {
            if (!style.dropShadow) {
                return; // This text doesn't have a shadow
            }

            this.context.font = this.getFontString(style);

            let dropFillStyle = style.dropShadowColor;
            if (typeof dropFillStyle === 'number') {
                dropFillStyle = PIXI.utils.hex2string(dropFillStyle);
            }
            this.context.shadowColor = dropFillStyle;
            this.context.shadowBlur = style.dropShadowBlur;
            this.context.shadowOffsetX = Math.cos(style.dropShadowAngle) * style.dropShadowDistance * this.resolution;
            this.context.shadowOffsetY = Math.sin(style.dropShadowAngle) * style.dropShadowDistance * this.resolution;

            this.context.fillText(text, x, y);
        });

        this.context.restore();

        // Second pass: draw the strokes only
        drawingData.forEach(({ style, text, x, y, width, ascent, descent, tag }) => {
            if (style.stroke === undefined || !style.strokeThickness) {
                return; // Skip this step if we have no stroke
            }

            this.context.font = this.getFontString(style);

            let strokeStyle = style.stroke;
            if (typeof strokeStyle === 'number') {
                strokeStyle = PIXI.utils.hex2string(strokeStyle);
            }

            this.context.strokeStyle = strokeStyle;
            this.context.lineWidth = style.strokeThickness;

            this.context.strokeText(text, x, y);
        });

        // Third pass: draw the fills only
        drawingData.forEach(({ style, text, x, y, width, ascent, descent, tag }) => {
            if (style.fill === undefined) {
                return; // Skip this step if we have no fill
            }

            this.context.font = this.getFontString(style);

            // set canvas text styles
            let fillStyle = style.fill;
            if (typeof fillStyle === 'number') {
                fillStyle = PIXI.utils.hex2string(fillStyle);
            } else if (Array.isArray(fillStyle)) {
                for (let i = 0; i < fillStyle.length; i++) {
                    let fill = fillStyle[i];
                    if (typeof fill === 'number') {
                        fillStyle[i] = PIXI.utils.hex2string(fill);
                    }
                }
            }
            this.context.fillStyle = this._generateFillStyle(new PIXI.TextStyle(style), [text]) as string | CanvasGradient;
            // Typecast required for proper typechecking

            this.context.fillText(text, x, y);
        });

        // Fourth pass: collect the bounding boxes and draw the debug information
        drawingData.forEach(({ style, text, x, y, width, ascent, descent, tag }) => {
            let dropShadowPadding = this.getDropShadowPadding();

            let offsetX = -this._style.padding - dropShadowPadding - this.generalPaddingX;
            let offsetY = -this._style.padding - dropShadowPadding - this.generalPaddingY;

            this.hitboxes.push({
                tag,
                hitbox: new PIXI.Rectangle(x + offsetX, y - ascent + offsetY, width, ascent + descent)
            });

            let debugSpan = style.debug === undefined ? MultiStyleText.debugOptions.spans.enabled : style.debug;

            if (debugSpan) {
                this.context.lineWidth = 1;

                if (MultiStyleText.debugOptions.spans.bounding) {
                    this.context.fillStyle = MultiStyleText.debugOptions.spans.bounding;
                    this.context.strokeStyle = MultiStyleText.debugOptions.spans.bounding;
                    this.context.beginPath();
                    this.context.rect(x, y - ascent, width, ascent + descent);
                    this.context.fill();
                    this.context.stroke();
                    this.context.stroke(); // yes, twice
                }

                if (MultiStyleText.debugOptions.spans.baseline) {
                    this.context.strokeStyle = MultiStyleText.debugOptions.spans.baseline;
                    this.context.beginPath();
                    this.context.moveTo(x, y);
                    this.context.lineTo(x + width, y);
                    this.context.closePath();
                    this.context.stroke();
                }

                if (MultiStyleText.debugOptions.spans.top) {
                    this.context.strokeStyle = MultiStyleText.debugOptions.spans.top;
                    this.context.beginPath();
                    this.context.moveTo(x, y - ascent);
                    this.context.lineTo(x + width, y - ascent);
                    this.context.closePath();
                    this.context.stroke();
                }

                if (MultiStyleText.debugOptions.spans.bottom) {
                    this.context.strokeStyle = MultiStyleText.debugOptions.spans.bottom;
                    this.context.beginPath();
                    this.context.moveTo(x, y + descent);
                    this.context.lineTo(x + width, y + descent);
                    this.context.closePath();
                    this.context.stroke();
                }

                if (MultiStyleText.debugOptions.spans.text) {
                    this.context.fillStyle = '#ffffff';
                    this.context.strokeStyle = '#000000';
                    this.context.lineWidth = 2;
                    this.context.font = '8px monospace';
                    this.context.strokeText(tag.name, x, y - ascent + 8);
                    this.context.fillText(tag.name, x, y - ascent + 8);
                    this.context.strokeText(`${width.toFixed(2)}x${(ascent + descent).toFixed(2)}`, x, y - ascent + 16);
                    this.context.fillText(`${width.toFixed(2)}x${(ascent + descent).toFixed(2)}`, x, y - ascent + 16);
                }
            }
        });

        if (MultiStyleText.debugOptions.objects.enabled) {
            if (MultiStyleText.debugOptions.objects.bounding) {
                this.context.fillStyle = MultiStyleText.debugOptions.objects.bounding;
                this.context.beginPath();
                this.context.rect(0, 0, width, height);
                this.context.fill();
            }

            if (MultiStyleText.debugOptions.objects.text) {
                this.context.fillStyle = '#ffffff';
                this.context.strokeStyle = '#000000';
                this.context.lineWidth = 2;
                this.context.font = '8px monospace';
                this.context.strokeText(`${width.toFixed(2)}x${height.toFixed(2)}`, 0, 8, width);
                this.context.fillText(`${width.toFixed(2)}x${height.toFixed(2)}`, 0, 8, width);
            }
        }

        this.updateTexture();
    }

    protected fillPass({ style, text, x, y, width, ascent, descent, tag }) {}

    protected wordWrap(text: string): string {
        // Greedy wrapping algorithm that will wrap words as the line grows longer than its horizontal bounds.
        let result = '';
        let re = this.getTagRegex(true, true);

        const lines = text.split('\n');
        const wordWrapWidth = this._style.wordWrapWidth;
        let styleStack = [this.assign({}, this.textStyles['default'])];
        this.context.font = this.getFontString(this.textStyles['default']);

        for (let i = 0; i < lines.length; i++) {
            let spaceLeft = wordWrapWidth;
            const tagSplit = lines[i].split(re);
            let firstWordOfLine = true;

            for (let j = 0; j < tagSplit.length; j++) {
                if (re.test(tagSplit[j])) {
                    result += tagSplit[j];
                    if (tagSplit[j][1] === '/') {
                        j += 2;
                        styleStack.pop();
                    } else {
                        j++;
                        styleStack.push(this.assign({}, styleStack[styleStack.length - 1], this.textStyles[tagSplit[j]]));
                        j++;
                    }
                    this.context.font = this.getFontString(styleStack[styleStack.length - 1]);
                } else {
                    const words = tagSplit[j].split(' ');

                    for (let k = 0; k < words.length; k++) {
                        const wordWidth = this.context.measureText(words[k]).width;

                        if (this._style.breakWords && wordWidth > spaceLeft) {
                            // Part should be split in the middle
                            const characters = words[k].split('');

                            if (k > 0) {
                                result += ' ';
                                spaceLeft -= this.context.measureText(' ').width;
                            }

                            for (let c = 0; c < characters.length; c++) {
                                const characterWidth = this.context.measureText(characters[c]).width;

                                if (characterWidth > spaceLeft) {
                                    result += `\n${characters[c]}`;
                                    spaceLeft = wordWrapWidth - characterWidth;
                                } else {
                                    result += characters[c];
                                    spaceLeft -= characterWidth;
                                }
                            }
                        } else if (this._style.breakWords) {
                            result += words[k];
                            spaceLeft -= wordWidth;
                        } else {
                            const paddedWordWidth = wordWidth + (k > 0 ? this.context.measureText(' ').width : 0);

                            if (paddedWordWidth > spaceLeft) {
                                // Skip printing the newline if it's the first word of the line that is
                                // greater than the word wrap width.
                                if (!firstWordOfLine) {
                                    result += '\n';
                                }

                                result += words[k];
                                spaceLeft = wordWrapWidth - wordWidth;
                            } else {
                                spaceLeft -= paddedWordWidth;

                                if (k > 0) {
                                    result += ' ';
                                }

                                result += words[k];
                            }
                        }
                        firstWordOfLine = false;
                    }
                }
            }

            if (i < lines.length - 1) {
                result += '\n';
            }
        }

        return result;
    }

    protected updateTexture() {
        const texture = this._texture;

        let dropShadowPadding = this.getDropShadowPadding();

        let padding = this._style.trim ? 0 : this._style.padding;

        texture.trim.width = texture.frame.width = Math.ceil(this.canvas.width / this.resolution);
        texture.trim.height = texture.frame.height = Math.ceil(this.canvas.height / this.resolution);

        texture.trim.x = -padding - dropShadowPadding - this.generalPaddingX;
        texture.trim.y = -padding - dropShadowPadding - this.generalPaddingY;

        texture.orig.width = texture.frame.width - (padding + dropShadowPadding + this.generalPaddingX) * 2;
        texture.orig.height = texture.frame.height - (padding + dropShadowPadding + this.generalPaddingY) * 2;

        // call sprite onTextureUpdate to update scale if _width or _height were set
        this._onTextureUpdate();

        texture.baseTexture.setRealSize(this.canvas.width, this.canvas.height, this.resolution);

        this.dirty = false;
    }

    // Lazy fill for Object.assign
    private assign(destination: any, ...sources: any[]): any {
        for (let source of sources) {
            if (source instanceof PIXI.TextStyle) {
                // copy only specific properties, no need to copy _fontFamily, _fontSize etc.
                for (let key in MultiStyleText.DEFAULT_TAG_STYLE) {
                    if (source.hasOwnProperty(key) || PIXI.TextStyle.prototype.hasOwnProperty(key)) {
                        destination[key] = source[key];
                    }
                }
            } else {
                // copy all properties, cause we assume that the source is a valid plain object
                for (let key in source) {
                    destination[key] = source[key];
                }
            }
        }

        return destination;
    }
}

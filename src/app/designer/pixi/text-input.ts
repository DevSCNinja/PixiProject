import * as PIXI from 'pixi.js';
import Quill, { RangeStatic, DeltaOperation } from 'quill';
import Delta from 'quill-delta';
import { FontItem } from '../shared/models/main';
import MultiStyleText, { TextStyleSet } from './multi-style-text';
export class TextInput extends PIXI.Container {
    domBoxDefaultStyle: any;

    domEditorDefaultStyle: any;

    domBox: HTMLDivElement | any;

    surrogate: MultiStyleText;

    editor: Quill;

    // for Quill
    editableInlineAttributes: string[] = ['font', 'size'];

    // for Dom
    // the order should match editableInlineAttributes (associated attributes)
    editableDomStyleProps: string[] = ['fontFamily', 'fontSize'];

    // for PIXI.TextStyle
    editableTextStyleProps: string[] = ['fontFamily', 'fontSize'];

    placeholder: string = 'Enter Your Text';

    shapeEnabled: boolean = false;

    shapeAdjust: number = 0.75;

    shapeContainer: PIXI.Container;

    fonts: FontItem[] = [];

    lineSpacings: number[] = [0];

    lineContentHeights: number[] = [];

    lineMaxCaps: number[] = [];

    hasBlurListener: boolean = false;

    lastText: string = null;

    lastStyleID: number = 0;

    domAdded: boolean = false;

    domVisible: boolean = true;

    substituted: boolean = false;

    lastRenderer: PIXI.Renderer;

    resolution: number;

    previous: any = {};

    canvasBounds: any;

    state: string;

    // faster alternative of this.editor.getSelection() (use it where it's possible)
    currentSelection: RangeStatic;

    // format of the selected text or of the whole text if not the text input has no focus (context format)
    currentFormat: any;

    currentLineSpacing: number | number[];

    // faster alternative of this.text getter (use it where it's possible)
    wholeCurrentText: string;

    lastProperFormat: any;

    lastProperCaretFormat: any;

    timeoutTextChange: any;

    constructor(styles: any) {
        super();
        this.domBoxDefaultStyle = Object.assign(
            {
                position: 'absolute',
                transformOrigin: '0 0',
                overflow: 'hidden',
                height: 'auto',
                padding: 0,
                background: 'none',
                border: 'none',
                outline: 'none'
            },
            styles.domBox
        );

        this.domEditorDefaultStyle = Object.assign(
            {
                overflow: 'hidden',
                height: 'auto',
                padding: '12px',
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#86c8d6',
                // set a min width needed to show a blinking caret when no text entered yet
                // (don't use big values, it will cause issues with the input positioning)
                minWidth: '2px',
                caretColor: '#86c8d6',
                lineHeight: 1
            },
            styles.domEditor
        );

        if (typeof this.domEditorDefaultStyle.lineHeight === 'string') {
            console.warn('Line height must be a unitless value');
        }

        if (styles.shape) {
            this.shapeEnabled = styles.shape.hasOwnProperty('enabled') ? styles.shape.enabled : false;
            this.shapeAdjust = styles.shape.hasOwnProperty('adjust') ? styles.shape.adjust : 0.75;
        }

        this.createDOMInput();
        this.substituteText = true;
        this.setState('DEFAULT');
        this.addListeners();
    }

    htmlToPlainText(html: string) {
        return html.replace(/<\/?[^>]+(>|$)/g, '');
    }

    escapeHtml(str: string) {
        // escape for 2 reasons - security and the surrogate doesn't support <,>
        return str.replace(/</g, '').replace(/>/g, '');
    }

    needsEscapeHtml(str: string) {
        return str.indexOf('<') >= 0 || str.indexOf('>') >= 0;
    }

    // GETTERS & SETTERS

    get domEditor(): HTMLDivElement | any {
        return this.editor.root;
    }

    // as a rule contains a new line character at the end
    get text(): string {
        return this.editor.getText();
    }

    set text(text) {
        if (!text.trim()) {
            // fix an issue of format gets resetted on no text
            this.editor.setText(this.placeholder);
            this.editor.setSelection(0, this.placeholder.length, 'silent');
        } else {
            this.editor.setText(this.escapeHtml(text));
        }
        if (this.substituted) this.updateSurrogate();
    }

    get substituteText(): boolean {
        return this.substituted;
    }

    set substituteText(substitute) {
        if (this.substituted === substitute) return;

        this.substituted = substitute;

        if (substitute) {
            this.createSurrogate();
            this.domVisible = false;
        } else {
            this.destroySurrogate();
            this.domVisible = true;
        }
        this.update();
    }

    get disabled(): boolean {
        return this.domBox.disabled;
    }

    set disabled(disabled) {
        this.domBox.disabled = disabled;
        this.setState(disabled ? 'DISABLED' : 'DEFAULT');
    }

    get surrogateStyles(): TextStyleSet {
        return this.surrogate.textStyles;
    }

    get currentCaretFormat(): any {
        let f: any = {};
        if (this.currentFormat) {
            this.editableInlineAttributes.forEach((attr) => {
                let value: string | string[] = this.currentFormat[attr];
                f[attr] = value instanceof Array ? value[0] : value;
            });
        }

        return f;
    }

    setFonts(fonts: FontItem[]) {
        this.fonts = fonts;
        //this.surrogate.fonts = fonts;
        this.fonts.forEach((font) => {
            if (font.sandedCenter && font.hidden) {
                let i: number = font.fontFamily.indexOf('-SND');
                if (i >= 0) {
                    let oFamily: string = font.originalFontItem.fontFamily;
                    this.surrogate.fontReplacement[oFamily] = [oFamily, font.fontFamily];
                    this.surrogate.fontFillReplacement[oFamily] = ['#FFFFFF', '#000000'];
                }
            }
        });
    }

    // Custom getFormat() function, main difference from Quill.getFormat() function is that it fixes an issue
    // with empty format returned by Quill when selection's start end end are on the same formats
    // but there is a different format in the middle. Also it fixes improper formats for empty lines.
    // Better to use currentFormat property to quickly get format of a current selection (e.g. for data binding)
    getFormat(range?: RangeStatic): any {
        let format: any = {};
        let txt: string;
        if (!range) {
            // current selection
            if (this.state === 'FOCUSED') {
                range = this.currentSelection; //this.editor.getSelection();
            }

            // whole text
            txt = this.text;
            if (!range && txt !== '\n') {
                range = { index: 0, length: txt.length };
            }

            if (!range) {
                this.editableInlineAttributes.forEach((attr) => {
                    format[attr] = null;
                });
                return format;
            }
        }

        if (range.length <= 1) {
            format = this.editor.getFormat(range);
        } else {
            if (!txt) {
                txt = this.text;
            }
            let start: number = range.index;
            let end: number = Math.max(Math.min(range.index + range.length, txt.length), range.index);
            for (let i: number = start; i < end; i++) {
                let f: any = this.editor.getFormat(i, 1); // 1

                // save it like a string or add to an array
                Object.keys(f).forEach((key) => {
                    if (format.hasOwnProperty(key)) {
                        if (format[key] instanceof Array) {
                            if (format[key].indexOf(f[key]) === -1) {
                                format[key].push(f[key]);
                            }
                        } else {
                            if (format[key] !== f[key]) {
                                format[key] = [format[key], f[key]];
                            }
                        }
                    } else {
                        format[key] = f[key];
                    }
                });
            }
        }

        // fix improper format (most likely for caused by an empty line)
        if (!this.isProperFormat(format)) {
            let lpf = this.lastProperCaretFormat || this.lastProperFormat;
            if (lpf) {
                return lpf;
            }
        }

        return format;
    }

    fillEmptyFormats() {
        let txt: string = this.wholeCurrentText;
        let start: number = 0;
        let end: number = txt.length;
        let llpf: any; // last local proper format
        let rangesToApply: RangeStatic[] = [];
        let formatsToApply: any[] = [];
        let lastAppliedFormat: any;

        for (let i: number = start; i < end; i++) {
            let f: any = this.editor.getFormat(i, 1); // 1

            // skip a newline character cause its format stands for a line format https://quilljs.com/docs/delta/#line-formatting
            if (txt.charAt(i) === '\n') {
                lastAppliedFormat = null;
                continue;
            }
            if (this.isProperFormat(f)) {
                lastAppliedFormat = null;
                llpf = f;
                this.lastProperFormat = f;
            } else {
                if (this.lastProperCaretFormat) {
                    /* last proper caret format has highest priority, cause its our
                     context format - most empty formats appears on user iteractions*/
                    llpf = this.lastProperCaretFormat;
                }
                if (!llpf) {
                    llpf = this.lastProperFormat;
                }
                if (llpf) {
                    /* copy some attributes that have been set after line deletion and format loss
                    (e.g. line was deleted and its format was lost, then some font was specified by a user,
                    so newly entered text will have this font + other attributes from llpf )*/
                    this.editableInlineAttributes.forEach((attr) => {
                        let value: string = f[attr];
                        if (value) {
                            llpf[attr] = value;
                        }
                    });

                    let same: boolean = false;
                    if (lastAppliedFormat) {
                        same = true;
                        for (let m: number = 0; m < this.editableInlineAttributes.length; m++) {
                            let attr: string = this.editableInlineAttributes[m];
                            if (llpf[attr] !== lastAppliedFormat[attr]) {
                                same = false;
                                break;
                            }
                        }
                    }

                    if (same) {
                        rangesToApply[rangesToApply.length - 1].length++;
                    } else {
                        lastAppliedFormat = Object.assign({}, llpf);
                        formatsToApply.push(lastAppliedFormat);
                        rangesToApply.push({ index: i, length: 1 });
                    }

                    // don't apply separately, cause it may cause neighbor chars with the same format to be wrapped by a separate spans
                    //this.editor.removeFormat(i, 1, 'silent'); // letterSpacing, background and other props may be added by Quill somehow, so remove them
                    //this.editor.formatText(i, 1, llpf, 'silent');
                } else {
                    lastAppliedFormat = null;
                }
            }
        }

        rangesToApply.forEach((range, index) => {
            this.editor.removeFormat(range.index, range.length, 'silent');
            this.editor.formatText(range.index, range.length, formatsToApply[index], 'silent');
        });
    }

    // proper = has all editable attributes
    isProperFormat(format: any): boolean {
        if (!format) {
            return false;
        }

        for (let i: number = 0; i < this.editableInlineAttributes.length; i++) {
            let attr: string = this.editableInlineAttributes[i];
            if (!format[attr]) {
                return false;
            }
        }
        return true;
    }

    // use it for styles that always applied to all the text (e.g. textAlign or letterSpacing, no need to apply formatting by the editor)
    setDefaultStyle(prop, value) {
        this.domEditor.style[prop] = this.domEditorDefaultStyle[prop] = value;

        if (this.lastRenderer) this.update();

        this.correctPosition();

        this.emit('text-change', this);
    }

    setDefaultStyleFromFormat(format: any) {
        for (let i: number = 0; i < this.editableDomStyleProps.length; i++) {
            let attr: string = this.editableInlineAttributes[i];
            let prop: string = this.editableDomStyleProps[i];
            this.domEditor.style[prop] = this.domEditorDefaultStyle[prop] = format[attr];
        }
    }

    setLineSpacing(range?: RangeStatic, valuePx?: number) {
        let lines: string[] = this.wholeCurrentText.split('\n');
        let charCounter: number = 0;
        let maxTop: number[] = [];
        let maxBottom: number[] = [];
        this.lineMaxCaps = [];
        let maxSize: number[] = [];
        this.lineContentHeights = [];
        let lineH: number[] = [];
        let gapY: number[] = [];
        let linePosY: number[] = []; // relative position of the line
        if (!range) {
            if (this.domVisible && this.state === 'FOCUSED') {
                range = this.currentSelection;
            }

            if (!range) {
                range = { index: 0, length: this.wholeCurrentText.length };
            }
        }
        let start: number = range.index;
        let end: number = range.index + range.length;
        let changed: boolean = false;

        // read lines' data
        for (let i: number = 0; i < lines.length - 1; i++) {
            let line: string = lines[i];
            maxTop[i] = 0;
            maxBottom[i] = 0;
            this.lineMaxCaps[i] = 0;
            maxSize[i] = 0;
            if (line) {
                let lineRange: RangeStatic = { index: charCounter, length: line.length };
                let lineStart: number = lineRange.index;
                let lineEnd: number = lineRange.index + lineRange.length;
                let f: any;
                for (let k: number = lineStart; k < lineEnd; k++) {
                    f = this.editor.getFormat(k, 1);
                    if (this.isProperFormat(f)) {
                        let font: FontItem = this.fonts.find((element) => element.fontFamily === f.font);
                        if (font) {
                            let size: number = parseFloat(f.size);
                            let lineSc: number = isNaN(font.lineScale) ? 1 : font.lineScale;
                            maxSize[i] = Math.max(maxSize[i], size);
                            maxTop[i] = Math.max(maxTop[i], Math.abs(font.ascent * size)); // ascent
                            maxBottom[i] = Math.max(maxBottom[i], Math.abs(font.descent * size)); // descent
                            this.lineMaxCaps[i] = Math.max(this.lineMaxCaps[i], Math.abs(font.capHeight * size * lineSc));
                        }
                    }
                }
            }

            charCounter += line.length + 1; // + 1 stands for \n
        }

        charCounter = 0;

        // correct the data and apply formatting
        for (let i: number = 0; i < lines.length - 1; i++) {
            let line: string = lines[i];

            // set new line spacing if this line is inside a current text selection
            if (start <= charCounter + line.length && charCounter <= end && !isNaN(valuePx)) {
                this.lineSpacings[i] = valuePx;

                changed = true;
            }

            // this line has no spacing
            if (isNaN(this.lineSpacings[i])) {
                this.lineSpacings[i] = isNaN(this.lineSpacings[i - 1]) ? 0 : this.lineSpacings[i - 1];

                changed = true;
            }

            if (maxSize[i] === 0) {
                // empty line
                // copy values from closest non empty line
                let closestIndex: number;
                // look among upper lines first
                for (let k: number = i - 1; k >= 0; k--) {
                    if (maxSize[k] > 0) {
                        closestIndex = k;
                        break;
                    }
                }
                // then among lower lines if not found
                if (isNaN(closestIndex)) {
                    for (let k: number = i + 1; k < lines.length - 1; k++) {
                        if (maxSize[k] > 0) {
                            closestIndex = k;
                            break;
                        }
                    }
                }

                if (isNaN(closestIndex)) {
                    // stop if empty or zero-height lines only
                    break;
                } else {
                    maxSize[i] = maxSize[closestIndex];
                    maxTop[i] = maxTop[closestIndex];
                    maxBottom[i] = maxBottom[closestIndex];
                    this.lineMaxCaps[i] = this.lineMaxCaps[closestIndex];
                }
            }

            this.lineContentHeights[i] = maxBottom[i] + maxTop[i];
            lineH[i] = 1.4; // preferably anything bigger than 1
            gapY[i] = (maxSize[i] * lineH[i] - this.lineContentHeights[i]) / 2;

            if (i === 0) {
                linePosY[i] = -gapY[i] - (maxTop[i] - this.lineMaxCaps[i]); // TODO: the first line may be clipped a bit
            } else {
                linePosY[i] = -gapY[i] - (maxTop[i] - this.lineMaxCaps[i]) - (gapY[i - 1] + maxBottom[i - 1]) + this.lineSpacings[i - 1];
            }

            let lineFormat: any = {
                fontSize: maxSize[i] + 'px',
                lineHeight: lineH[i],
                marginTop: Math.floor(linePosY[i] * 100) / 100 + 'px'
            };

            this.editor.formatLine(charCounter, 1, lineFormat, 'silent');

            charCounter += line.length + 1;
        }

        // remove old excess line spacings
        if (lines.length < this.lineSpacings.length + 1) {
            this.lineSpacings.splice(lines.length);

            changed = true;
        }

        if (changed) {
            this.currentLineSpacing = this.getLineSpacing();

            if (this.substituted) this.updateSurrogate();
            this.correctPosition();
            this.emit('text-change', this);
        }
    }

    getLineSpacing(range?: RangeStatic): number | number[] {
        if (!range) {
            if (this.domVisible && this.state === 'FOCUSED') {
                range = this.currentSelection; //this.editor.getSelection();
            }

            if (!range) {
                if (!this.wholeCurrentText) {
                    return null;
                }
                range = { index: 0, length: this.wholeCurrentText.length };
            }
        }
        let indices: number[] = this.getLineIndices(range);
        let spacings: number[] = [];

        indices.forEach((element) => {
            let ls: number = this.lineSpacings[element];
            spacings.push(ls);
        });

        let first: number = spacings[0];
        let allTheSame: boolean = spacings.filter((element) => element === first).length === spacings.length;

        return allTheSame ? first : spacings;
    }

    getLineIndices(range?: RangeStatic): number[] {
        let lines: string[] = this.wholeCurrentText.split('\n');
        let charCounter: number = 0;
        let nums: number[] = [];
        let end: number = range.index + range.length;
        for (let i: number = 0; i < lines.length - 1; i++) {
            let line: string = lines[i];
            if (range.index <= charCounter + line.length && charCounter <= end) {
                nums.push(i);
            }
            charCounter += line.length + 1;
        }

        return nums;
    }

    get linesCount() {
        let arr = this.wholeCurrentText.match(/\n/g);
        if (arr) {
            return arr.length; // no + 1 cause there is always one extra \n at the end
        }
        return 1;
    }

    hasFocus() {
        return this.editor.hasFocus();
    }

    focus() {
        if (this.substituted && !this.domVisible) this.setDOMInputVisible(true);

        //this.domBox.focus();
        this.editor.focus();

        this.onFocused();
    }

    blur() {
        this.editor.blur();
    }

    destroy(options) {
        super.destroy(options);
    }

    // SETUP

    createDOMInput() {
        this.domBox = document.createElement('div');
        //this.domBox.classList.add('ql-disabled');
        //this.domBox.setAttribute('contenteditable', 'true');

        // an editor needed to handle this complex style changes
        // also it provides nice methods getFormat and setFormat
        let options = {
            //debug: 'info',
            modules: {
                toolbar: false
            }
        };
        this.editor = new Quill(this.domBox, options);

        // allow only plain text on paste
        this.editor.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
            let plainText: string = this.htmlToPlainText(node.outerHTML);
            return new Delta().insert(plainText);
        });

        Object.keys(this.domBoxDefaultStyle).forEach((key) => {
            this.domBox.style[key] = this.domBoxDefaultStyle[key];
        });

        Object.keys(this.domEditorDefaultStyle).forEach((key) => {
            this.domEditor.style[key] = this.domEditorDefaultStyle[key];
        });
    }

    addListeners() {
        this.on('added', this.onAdded.bind(this));
        this.on('removed', this.onRemoved.bind(this));

        // text-change includes format changing etc.
        this.editor.on('text-change', this.onTextChange.bind(this));
        this.editor.on('selection-change', this.onSelectionChange.bind(this));
        //this.domBox.addEventListener('focus', this.onFocused.bind(this));

        // add for the first time
        if (this.hasBlurListener) {
            this.addBlurListener();
        }
    }

    addBlurListener() {
        if (this.hasBlurListener) {
            return;
        }

        this.domBox.addEventListener('blur', this.onBlurred.bind(this));

        this.hasBlurListener = true;
    }

    removeBlurListener() {
        if (!this.hasBlurListener) {
            return;
        }

        this.domBox.removeEventListener('blur', this.onBlurred.bind(this));

        this.hasBlurListener = false;
    }

    onTextChange(delta, oldDelta, source) {
        this.wholeCurrentText = this.text;

        // fix an issue of format gets resetted on no text
        if (!this.wholeCurrentText.trim()) {
            let f: any = this.currentCaretFormat; // this line better to be first in this block
            this.editor.setText(this.placeholder, 'silent');
            this.editor.setSelection(0, this.placeholder.length, 'silent');
            this.editor.formatText(0, this.placeholder.length, f, 'silent');

            this.wholeCurrentText = this.placeholder + '\n'; // cause we call setText() silently
        }

        // fix an issue with no format on line deleting (by pressing Backspace, Enter etc.)
        // and probably loss of format on other actions
        this.fillEmptyFormats();

        this.currentSelection = this.editor.getSelection();
        this.currentFormat = this.getFormat();
        let ccf: any = this.currentCaretFormat;
        if (this.isProperFormat(ccf)) {
            this.lastProperCaretFormat = ccf;

            // fix an issue with double key press needed after line was deleted by Backspace
            this.setDefaultStyleFromFormat(ccf);
        }

        this.setLineSpacing({ index: 0, length: this.wholeCurrentText.length });
        this.currentLineSpacing = this.getLineSpacing();

        //clearTimeout(this.timeoutTextChange);
        //this.timeoutTextChange = setTimeout(() => {
        if (this.substituted) this.updateSubstitution();

        this.correctPosition();

        this.emit('text-change', this);
        //}, 100);
    }

    onSelectionChange(range, oldRange, source) {
        this.currentSelection = range;
        this.currentLineSpacing = this.getLineSpacing();
        if (range) {
            this.currentFormat = this.getFormat(range);
            let ccf: any = this.currentCaretFormat;
            if (this.isProperFormat(ccf)) {
                this.lastProperCaretFormat = ccf;

                // fix an issue with double key press needed after line was deleted by Backspace
                this.setDefaultStyleFromFormat(ccf);
            }
        }
    }

    onFocused() {
        this.setState('FOCUSED');
        this.emit('focus');
    }

    onBlurred() {
        this.setState('DEFAULT');

        this.correctPosition();

        this.emit('blur');
    }

    onAdded() {
        document.body.appendChild(this.domBox);
        this.domBox.style.display = 'none';
        this.domAdded = true;
    }

    onRemoved() {
        document.body.removeChild(this.domBox);
        this.domAdded = false;
    }

    setState(state) {
        this.state = state;
        if (this.substituted) this.updateSubstitution();

        this.currentSelection = this.editor.getSelection();
        this.currentFormat = this.getFormat();
        this.currentLineSpacing = this.getLineSpacing();
    }

    // pins the top left corner of the textinput if align value is 'left'
    // (call it after textinput's size was changed)
    correctPosition() {
        const lastPivotX = this.pivot.x;
        const lastPivotY = this.pivot.y;
        const localBounds = this.getLocalBounds();

        // move the pivot to the center (usually it's (width/2 , height/2))
        this.pivot.x = localBounds.width / 2 + localBounds.x;
        this.pivot.y = localBounds.height / 2 + localBounds.y;

        const style = this.surrogateStyles.default;
        const dx = this.shapeEnabled
            ? 0
            : style.align === 'left'
            ? this.pivot.x - lastPivotX
            : style.align === 'right'
            ? -this.pivot.x + lastPivotX
            : 0;
        const dy = this.pivot.y - lastPivotY;
        const delta = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx) + this.rotation;

        this.x += delta * Math.cos(ang);
        this.y += delta * Math.sin(ang);
    }

    // RENDER & UPDATE

    render(renderer) {
        super.render(renderer);
        this.renderInternal(renderer);
    }

    renderInternal(renderer) {
        this.resolution = renderer.resolution;
        this.lastRenderer = renderer;
        this.canvasBounds = this.getCanvasBounds();
        if (this.needsUpdate()) this.updateSimple(); // or this.update()
    }

    update() {
        this.updateDOMInput();
        if (this.substituted) this.updateSurrogate();
    }

    // more performant compared to the regular update() method
    updateSimple() {
        this.updateDOMInput();
    }

    updateSubstitution() {
        this.updateVisibility();
        this.updateDOMInput();
        this.updateSurrogate();
    }

    updateVisibility() {
        if (this.state === 'FOCUSED') {
            let txt: string = this.wholeCurrentText;
            if (txt && txt.trim() === this.placeholder && !this.domVisible) {
                this.editor.setSelection(0, this.wholeCurrentText.length); //, 'silent');
            }

            this.domVisible = true;
            // .alpha used instead of .visibile for proper placement of the shape
            this.surrogate.alpha = txt ? 0 : 1;
            if (this.shapeContainer && this.shapeContainer.parent) {
                this.shapeContainer.visible = false;
            }
        } else {
            this.domVisible = false;
            // .alpha used instead of .visibile for proper placement of the shape
            this.surrogate.alpha = this.shapeEnabled ? 0 : 1;
            if (this.shapeContainer && this.shapeContainer.parent) {
                this.shapeContainer.visible = true;
            }
        }
    }

    updateDOMInput() {
        if (!this.canvasBounds) return;

        this.domBox.style.top = this.canvasBounds.top + 'px';
        this.domBox.style.left = this.canvasBounds.left + 'px';
        let matrix: PIXI.Matrix = this.getDOMRelativeWorldTransform();
        this.domBox.style.transform = this.pixiMatrixToCSS(matrix);
        this.domBox.style.opacity = this.worldAlpha;
        this.setDOMInputVisible(this.worldVisible && this.domVisible);
        // fix wrong automatic width (cases when scale is too less than 1.0 and text is pretty wide)
        this.domBox.style.width = this.surrogate.width + 40 + 'px';

        this.previous.canvasBounds = this.canvasBounds;
        this.previous.worldTransform = this.worldTransform.clone();
        this.previous.worldAlpha = this.worldAlpha;
        this.previous.worldVisible = this.worldVisible;
    }

    // STATE COMPAIRSON (FOR PERFORMANCE BENEFITS)

    needsUpdate() {
        return (
            !this.comparePixiMatrices(this.worldTransform, this.previous.worldTransform) ||
            !this.compareClientRects(this.canvasBounds, this.previous.canvasBounds) ||
            this.worldAlpha != this.previous.worldAlpha ||
            this.worldVisible != this.previous.worldVisible
        );
    }

    // INPUT SUBSTITUTION

    createSurrogate() {
        this.surrogate = new MultiStyleText(null, null);

        this.addChild(this.surrogate);

        this.updateSurrogate();
    }

    updateSurrogate() {
        let data = this.deriveSurrogateStylesAndText();
        this.surrogate.lineSpacings = this.lineSpacings;
        this.surrogate.lineYMins = this.lineSpacings.concat().map((element) => 0);
        this.surrogate.lineYMaxs = this.lineMaxCaps;

        // fix text cropping issue (on the right side for some fonts)
        let maxFontSize: number = Number.NEGATIVE_INFINITY;
        Object.keys(data.styles).forEach((styleKey) => {
            const s = data.styles[styleKey];

            maxFontSize = Math.max(maxFontSize, parseFloat(s.fontSize));
        });
        this.surrogate.generalPaddingX = Math.round(0.3 * maxFontSize);

        this.surrogate.styles = data.styles;
        this.surrogate.text = data.text;

        let padding = this.deriveSurrogatePadding();
        this.surrogate.x = padding[3];
        this.surrogate.y = padding[0];

        this.updateShape();
    }

    updateShape() {
        // new lines were replaced by spaces (same as in the legacy app)
        const textString = this.removeAllTrailingNewLines(this.text).replace(/\n/g, ' ');
        const style = this.surrogateStyles.default;

        if (this.shapeEnabled) {
            if (this.domBox.style.display === 'block') {
                // performance optimization
                // no immediate update needed on text input events
                return;
            }

            if (!this.shapeContainer) {
                this.shapeContainer = new PIXI.Container();
            }

            if (!this.shapeContainer.parent) {
                this.addChild(this.shapeContainer);
            }

            // length of the arch in pixels;
            let disLength = 0;
            const distortAmount = this.shapeAdjust * 2 - 1;
            const distortValue = Math.abs(this.shapeAdjust * 2 - 1) * 0.5;
            const letterSpacingSquash = 1.1 - distortValue + style.letterSpacing * 0.1;

            let chars = [];
            let charWidths = [];
            let newInstance =
                textString !== this.lastText || this.lastStyleID !== style.styleID || this.shapeContainer.children.length === 0
                    ? true
                    : false;
            if (newInstance) {
                // delete old uneccessary children
                while (this.shapeContainer.children.length > 0) {
                    let child = this.shapeContainer.children[0];
                    child.destroy();
                    this.shapeContainer.removeChild(child);
                }
            }

            let spaceBarWidth: number;
            // Create an array of chars
            for (let i = 0; i < textString.length; i++) {
                let char = textString.charAt(i);
                let textObj: MultiStyleText;
                if (newInstance) {
                    textObj = new MultiStyleText(char, { default: style });
                    textObj.fontReplacement = this.surrogate.fontReplacement;
                    textObj.fontFillReplacement = this.surrogate.fontFillReplacement;
                } else {
                    textObj = this.shapeContainer.children[i] as MultiStyleText;
                }

                textObj.pivot.x = textObj.width / 2;
                textObj.pivot.y = textObj.height / 2;

                if (newInstance) {
                    this.shapeContainer.addChild(textObj);
                }

                chars.push(textObj);

                // letter width
                let charWidth: number;
                if (char === ' ') {
                    // spacebar has too small width, let's associate it with 'f' width
                    if (isNaN(spaceBarWidth)) {
                        spaceBarWidth = new PIXI.Text('f', style).width;
                    }
                    charWidth = spaceBarWidth * letterSpacingSquash;
                } else {
                    charWidth = textObj.width * letterSpacingSquash;
                }

                charWidths.push(charWidth);
                disLength += charWidths[i];
            }

            const disHeight = disLength * distortValue;

            const xOffset = -disLength * 0.5;
            const yOffset = disHeight * 0.5;

            const radFirstPart = Math.sqrt(disHeight * disHeight + (disLength * disLength) / 4);
            const disRadius = radFirstPart / (2 * Math.cos(Math.atan(disLength / (2 * disHeight))));

            let phraseWidth = 0;

            chars.forEach((char, i) => {
                let letterWidth = charWidths[i];

                let letterPlacement = phraseWidth + letterWidth * 0.5;
                phraseWidth += letterWidth;

                if (distortAmount === 0) {
                    char.x = letterPlacement + xOffset;
                    char.y = 0;
                    char.rotation = 0;

                    return;
                }

                let letterAngle =
                    Math.PI / 2 - (2 - (4 * letterPlacement) / disLength) * (Math.PI / 2 - Math.atan(disLength / (2 * disHeight)));

                if (distortAmount > 0) {
                    // positive curve
                    char.x = -(disRadius * Math.cos(letterAngle) - disLength / 2) + xOffset;
                    char.y = -(disRadius * Math.sin(letterAngle) - (disRadius - disHeight)) + yOffset;
                    char.rotation = letterAngle - Math.PI / 2;
                } else {
                    // negative curve
                    char.x = -(disRadius * Math.cos(letterAngle) - disLength / 2) + xOffset;
                    char.y = disRadius * Math.sin(letterAngle) - (disRadius - disHeight) - yOffset;
                    char.rotation = -(letterAngle - Math.PI / 2);
                }
            });

            const localBounds = this.shapeContainer.getLocalBounds();

            this.shapeContainer.pivot.x = localBounds.width / 2 + localBounds.x;
            this.shapeContainer.pivot.y = localBounds.height / 2 + localBounds.y;

            // TODO : make sure we need to set position to anything rather than (0,0)
            this.shapeContainer.x = this.surrogate.x + this.surrogate.width / 2;
            this.shapeContainer.y = this.surrogate.y + this.surrogate.height / 2;
        } else {
            if (this.shapeContainer) {
                if (this.shapeContainer.parent) {
                    this.shapeContainer.parent.removeChild(this.shapeContainer);
                }

                this.shapeContainer.destroy();
                this.shapeContainer = null;
            }
        }

        this.updateVisibility();

        this.lastText = textString;
        this.lastStyleID = style.styleID;
    }

    destroySurrogate() {
        if (!this.surrogate) return;

        this.removeChild(this.surrogate);
        this.surrogate.destroy();
        this.surrogate = null;
    }

    onSurrogateFocus() {
        this.setDOMInputVisible(true);
        //sometimes the input is not being focused by the mouseclick
        setTimeout(this.ensureFocus.bind(this), 10);
    }

    ensureFocus() {
        if (!this.hasFocus()) this.focus();
    }

    deriveSurrogateStylesAndText() {
        let contents = this.editor.getContents();
        let text = '';
        // default style doesn't have to correspond to domEditorDefaultStyle, it's may not even be used by the surrogate
        let styles = { default: this.deriveDefaultSurrogateStyle() };

        let textParts: string[] = [];
        let partTags: string[] = [];
        let prependStr: string = '';

        if (contents && contents.ops) {
            for (let i: number = 0; i < contents.ops.length; i++) {
                let operation: DeltaOperation = contents.ops[i];
                let name: string;
                let insertStr: string = this.escapeHtml(operation.insert as string);
                let hasEditableInlineAttributes: boolean = false; // as a rule \n or \n\n etc. has no such attributes

                if (operation.attributes) {
                    hasEditableInlineAttributes = true;

                    let newStyle = {};
                    this.copyDeltaAttributesToSurrogateStyle(operation.attributes, newStyle);

                    if (Object.keys(newStyle).length > 0) {
                        let styleKeys = Object.keys(styles);

                        let existingStyle = styleKeys.find((key) => {
                            name = key;
                            return this.sameSurrogateStyles(styles[key], newStyle);
                        });

                        if (existingStyle) {
                            newStyle = existingStyle;
                        } else {
                            name = 'st' + styleKeys.length;
                            styles[name] = newStyle;
                        }
                    } else {
                        hasEditableInlineAttributes = false;
                    }
                }

                if (hasEditableInlineAttributes) {
                    textParts[i] = prependStr + insertStr;
                    if (name && name !== 'default') {
                        partTags[i] = name;
                    }

                    prependStr = '';
                } else {
                    let appended: boolean = false;
                    // append to the previous operation (line)
                    for (let k: number = i - 1; k >= 0; k--) {
                        let part: string = textParts[k];
                        if (part) {
                            textParts[k] += insertStr;
                            appended = true;
                            break;
                        }
                    }
                    // prepend to the next operation (line)
                    if (!appended) {
                        prependStr += insertStr;
                    }
                }
            }
        }

        for (let i: number = 0; i < textParts.length; i++) {
            let part: string = textParts[i];
            let tag: string = partTags[i];

            if (i === textParts.length - 1) {
                part = this.removeAllTrailingNewLines(part);
            }

            if (part) {
                if (tag) {
                    text += '<' + tag + '>' + part + '</' + tag + '>';
                } else {
                    text += part;
                }
            }
        }

        return { styles, text };
    }

    // The input always has at least one \n at the end (which is not needed anywhere beside Quill).
    // Also if you have few trailing \n - this may produce issues
    // (one of them may be missing after cloning the text-input)
    removeAllTrailingNewLines(text: string) {
        while (text && text.charAt(text.length - 1) === '\n') {
            text = text.substr(0, text.length - 1);
        }

        return text;
    }

    deriveDefaultSurrogateStyle() {
        let style: any = new PIXI.TextStyle();
        // remember style id, otherwise it will be resetted while updating styles of the surrogate
        style.styleID = this.surrogateStyles.default.styleID;

        // copy dom's style, don't transmit a computed style here (too slow, isn't really synchronous)
        this.copyDomStyleToSurrogateStyle(this.domEditorDefaultStyle, style);
        // copy the first format's attributes, so default style will be always in use (the first among the styles)
        let f: any = this.editor.getFormat(0, 1);
        this.editableTextStyleProps.forEach((prop: string, index: number) => {
            let attr: string = this.editableInlineAttributes[index];
            if (f.hasOwnProperty(attr)) {
                style[prop] = f[attr];
            }
        });

        return style;
    }

    copyDomStyleToSurrogateStyle(domStyle: any, style: any) {
        Object.keys(domStyle).forEach((key) => {
            switch (key) {
                case 'color':
                    /* White color is preferable here, cause pixels with zero alpha are white in PIXI.Text's texture
                    and it causes no issues when you apply, for example, a negative filter. Darker colors can be a reason
                    for a tiny outline appearing on the filter application. */
                    style.fill = '#FFFFFF'; //domStyle.color;
                    break;
                case 'fontFamily':
                case 'fontSize':
                case 'fontWeight':
                case 'fontVariant':
                case 'fontStyle':
                    style[key] = domStyle[key];
                    break;
                case 'letterSpacing':
                    style.letterSpacing = parseFloat(domStyle.letterSpacing);
                    if (isNaN(style.letterSpacing)) {
                        //e.g. value is "normal"
                        style.letterSpacing = 0;
                    }
                    break;
                case 'textAlign':
                    style.align = domStyle[key];
                    break;
            }
        });

        return style;
    }

    copyDeltaAttributesToSurrogateStyle(deltaAttributes, style) {
        Object.keys(deltaAttributes).forEach((key) => {
            switch (key) {
                case 'font':
                    style.fontFamily = deltaAttributes[key];
                    break;
                case 'size':
                    style.fontSize = deltaAttributes[key];
                    break;
            }
        });

        return style;
    }

    sameSurrogateStyles(style1, style2) {
        let propsToMatch: string[] = ['fontFamily', 'fontSize'];

        for (let j = 0; j < propsToMatch.length; j++) {
            let p = propsToMatch[j];

            if (!style1[p] && !style2[p]) {
                continue;
            }
            if ((!style1[p] && style2[p]) || (style1[p] && !style2[p])) {
                return false;
            }

            let v1 = p !== 'fontFamily' ? parseFloat(style1[p]) : style1[p].toLowerCase();
            let v2 = p !== 'fontFamily' ? parseFloat(style2[p]) : style2[p].toLowerCase();

            // be careful, cause NaN === NaN returns false
            if (v1 !== v2) {
                return false;
            }
        }

        return true;
    }

    deriveSurrogatePadding() {
        let indent = this.domEditorDefaultStyle.textIndent ? parseFloat(this.domEditorDefaultStyle.textIndent) : 0;

        if (this.domEditorDefaultStyle.padding && this.domEditorDefaultStyle.padding.length > 0) {
            let components = this.domEditorDefaultStyle.padding.trim().split(' ');

            if (components.length == 1) {
                let padding = parseFloat(components[0]);
                return [padding, padding, padding, padding + indent];
            } else if (components.length == 2) {
                let paddingV = parseFloat(components[0]);
                let paddingH = parseFloat(components[1]);
                return [paddingV, paddingH, paddingV, paddingH + indent];
            } else if (components.length == 4) {
                let padding = components.map((component) => {
                    return parseFloat(component);
                });
                padding[3] += indent;
                return padding;
            }
        }

        return [0, 0, 0, indent];
    }

    // HELPER FUNCTIONS

    setDOMInputVisible(visible) {
        this.domBox.style.display = visible ? 'block' : 'none';
    }

    getCanvasBounds() {
        let rect = this.lastRenderer.view.getBoundingClientRect();
        let bounds = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
        bounds.left += window.scrollX;
        bounds.top += window.scrollY;
        return bounds;
    }

    getDOMInputBounds() {
        let removeAfter = false;

        if (!this.domAdded) {
            document.body.appendChild(this.domBox);
            removeAfter = true;
        }

        let orgTransform = this.domBox.style.transform;
        let orgDisplay = this.domBox.style.display;
        this.domBox.style.transform = '';
        this.domBox.style.display = 'block';
        let bounds = this.domBox.getBoundingClientRect();
        this.domBox.style.transform = orgTransform;
        this.domBox.style.display = orgDisplay;

        if (removeAfter) {
            document.body.removeChild(this.domBox);
        }

        return bounds;
    }

    getDOMRelativeWorldTransform() {
        let canvasBounds = this.lastRenderer.view.getBoundingClientRect();
        let matrix = this.worldTransform.clone();

        matrix.scale(this.resolution, this.resolution);
        matrix.scale(canvasBounds.width / this.lastRenderer.width, canvasBounds.height / this.lastRenderer.height);
        return matrix;
    }

    pixiMatrixToCSS(m) {
        return 'matrix(' + [m.a, m.b, m.c, m.d, m.tx, m.ty].join(',') + ')';
    }

    comparePixiMatrices(m1, m2) {
        if (!m1 || !m2) return false;
        return m1.a == m2.a && m1.b == m2.b && m1.c == m2.c && m1.d == m2.d && m1.tx == m2.tx && m1.ty == m2.ty;
    }

    compareClientRects(r1, r2) {
        if (!r1 || !r2) return false;
        return r1.left == r2.left && r1.top == r2.top && r1.width == r2.width && r1.height == r2.height;
    }
}

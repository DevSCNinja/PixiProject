export class CanvasUtils {
    static generateThumbnail(
        imageSource: CanvasImageSource,
        sx: number,
        sy: number,
        sWidth: number,
        sHeight: number,
        thumbnailWidth: number,
        thumbnailHeight: number,
        niceResize: boolean = true,
        fillStyle: string = '#e4e4e4'
    ): string {
        let canvas: HTMLCanvasElement = document.createElement('canvas');
        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;
        //document.body.appendChild(c);// test
        let context: CanvasRenderingContext2D = canvas.getContext('2d');

        if (typeof context.filter === 'undefined') {
            console.warn("the browser doesn't support Context2D filters.");
            niceResize = false;
        }

        context.fillStyle = fillStyle; // to remove a possible outline

        if (niceResize) {
            // apply smoothing for better interpolation
            // step 1
            const oc = document.createElement('canvas');
            const octx = oc.getContext('2d');
            oc.width = sWidth;
            oc.height = sHeight;

            // step 2: pre-filter image using steps as radius
            const steps = (oc.width / canvas.width) >> 1;

            octx.fillStyle = fillStyle; // to remove a possible dark outline (this bug appears sometimes)
            octx.fillRect(0, 0, oc.width, oc.height);

            octx.filter = `blur(${steps}px)`;
            octx.drawImage(imageSource, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

            // step 3, draw scaled
            context.drawImage(oc, 0, 0, oc.width, oc.height, 0, 0, thumbnailWidth, thumbnailHeight);
        } else {
            context.drawImage(imageSource, sx, sy, sWidth, sHeight, 0, 0, thumbnailWidth, thumbnailHeight);
        }

        return canvas.toDataURL('image/jpeg', 0.94);
    }

    static getTransformedCanvas(
        canvas: HTMLCanvasElement,
        dx: number = 0,
        dy: number = 0,
        angle: number = 0,
        scaleX: number = 1,
        scaleY: number = 1
    ) {
        let trCanvas: HTMLCanvasElement = document.createElement('canvas');
        trCanvas.width = canvas.width;
        trCanvas.height = canvas.height;

        let trContext: CanvasRenderingContext2D = trCanvas.getContext('2d');
        trContext.translate(dx, dy);
        trContext.rotate(angle);
        trContext.scale(scaleX, scaleY);

        trContext.drawImage(canvas, 0, 0);

        return trCanvas;
    }

    static createCanvasFromImageData(imageData: ImageData) {
        let canvas: HTMLCanvasElement = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        let context: CanvasRenderingContext2D = canvas.getContext('2d');
        context.putImageData(imageData, 0, 0);
        return canvas;
    }

    static smartFloodFill(
        imageData: ImageData,
        targetPoints: number[][],
        fillColor: number[],
        threshold: number,
        colorToReplace?: number[],
        replaceThreshold?: number
    ) {
        let width: number = imageData.width;
        let fillAllowed: boolean = true;

        if (colorToReplace) {
            let i: number = targetPoints.length - 1;
            while (fillAllowed && i >= 0) {
                let point: number[] = targetPoints[i];
                fillAllowed = CanvasUtils.pixelMatchesColor(
                    imageData.data,
                    CanvasUtils.getPixelPos(point[0], point[1], width),
                    colorToReplace,
                    replaceThreshold
                );
                i--;
            }
        }

        if (fillAllowed) {
            let fillHappened: boolean = false;
            targetPoints.forEach((point, index) => {
                if (CanvasUtils.floodFill(imageData, point[0], point[1], fillColor, threshold)) {
                    fillHappened = true;
                }
            });
            return fillHappened;
        } else {
            return false;
        }
    }

    // improved version of https://jsfiddle.net/Fidel90/1e8e3z7e/ (threshold added, optimized, a bug fixed)
    static floodFill(imageData: ImageData, startX: number, startY: number, fillColor: number[], threshold: number) {
        let width: number = imageData.width;
        let height: number = imageData.height;
        let dstData: Uint8ClampedArray = imageData.data;
        let startPos: number = CanvasUtils.getPixelPos(startX, startY, width);

        // skip if the start color already 100% matches the fill color
        if (CanvasUtils.pixelMatchesColor(dstData, startPos, fillColor, 0)) {
            return false;
        }
        let startColor: number[] = [
            dstData[startPos], // r
            dstData[startPos + 1], // g
            dstData[startPos + 2], // b
            dstData[startPos + 3] // a
        ];
        let todo: number[][] = [[startX, startY]];
        while (todo.length) {
            let pos: number[] = todo.pop();
            let x: number = pos[0];
            let y: number = pos[1];
            let currentPos: number = CanvasUtils.getPixelPos(x, y, width);

            while (y-- >= 0 && CanvasUtils.pixelMatchesColor(dstData, currentPos, startColor, threshold)) {
                currentPos -= width * 4;
            }

            currentPos += width * 4;
            ++y;
            let reachLeft: boolean = false;
            let reachRight: boolean = false;

            while (
                y++ < height - 1 &&
                CanvasUtils.pixelMatchesColor(dstData, currentPos, startColor, threshold) &&
                !CanvasUtils.pixelMatchesColor(dstData, currentPos, fillColor, 0)
            ) {
                CanvasUtils.colorPixel(dstData, currentPos, fillColor);
                //colored++;

                if (x > 0) {
                    if (CanvasUtils.pixelMatchesColor(dstData, currentPos - 4, startColor, threshold)) {
                        if (!reachLeft) {
                            todo.push([x - 1, y]);
                            reachLeft = true;
                        }
                    } else if (reachLeft) {
                        reachLeft = false;
                    }
                }

                if (x < width - 1) {
                    if (CanvasUtils.pixelMatchesColor(dstData, currentPos + 4, startColor, threshold)) {
                        if (!reachRight) {
                            todo.push([x + 1, y]);
                            reachRight = true;
                        }
                    } else if (reachRight) {
                        reachRight = false;
                    }
                }

                currentPos += width * 4;
            }
        }

        return true;
    }
    // position in the 1-dimensional array
    static getPixelPos(x: number, y: number, width: number) {
        return (y * width + x) * 4;
    }

    static pixelMatchesColor(data: Uint8ClampedArray, pos: number, colorRGBA: number[], threshold: number) {
        return (
            Math.abs(data[pos] - colorRGBA[0]) +
                Math.abs(data[pos + 1] - colorRGBA[1]) +
                Math.abs(data[pos + 2] - colorRGBA[2]) +
                Math.abs(data[pos + 3] - colorRGBA[3]) <=
            threshold
        );
    }

    static colorPixel(data: Uint8ClampedArray, pos: number, colorRGBA: number[]) {
        data[pos] = colorRGBA[0] || 0; // r
        data[pos + 1] = colorRGBA[1] || 0; // g
        data[pos + 2] = colorRGBA[2] || 0; // b
        data[pos + 3] = colorRGBA[3] >= 0 ? colorRGBA[3] : 255; // a
    }
}

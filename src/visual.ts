/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    "use strict";
    import formatting = powerbi.extensibility.utils.formatting;

    function animateOffset(t: number, startingOffset: number, endingOffset: number, revolutions: number) {
        const total = (endingOffset - startingOffset) + (revolutions * trig.PI2);
        const amount = total * t;
        return startingOffset + amount;
    }

    interface skOldData<T> {
        __sk_old__?: T;
    }

    function getOldData<T>(element: any): T | undefined {
        return (element as skOldData<T>).__sk_old__;
    }

    function setOldData<T>(element: any, value?: T) {
        (element as skOldData<T>).__sk_old__ = value;
    }

    function doTweenArc(oldData: ArcData | undefined, newData: ArcData | undefined, index: number): ((t: number) => string) {
        const startingOffset = trig.normaliseAngle(oldData && (oldData.adjust + oldData.offset) || 0);
        const endingOffset = trig.normaliseAngle(newData && (newData.adjust + newData.offset) || 0);
        const startingAngle = oldData && oldData.angle || 0;
        const endingAngle = newData && newData.angle || 0;
        const radius = (oldData && oldData.radius) || (newData && newData.radius) || 1;
        const hasChanges = ((startingOffset !== endingOffset) || (startingAngle !== endingAngle));
        if (hasChanges) {
            return t => {
                const offset = animateOffset(t, startingOffset, endingOffset, (index + 1));
                const angle = startingAngle + (t * (endingAngle - startingAngle));
                return trig.calculateArc(50, offset, radius, angle);
            }
        } else {
            const arc = trig.calculateArc(50, startingOffset, radius, endingAngle);
            return t => arc;
        }
    }

    function doTweenText(node: SVGTextElement, oldValue: number | undefined, newValue: number | undefined, index: number): ((t: number) => void) {
        const format = d3.format("0.0%");
        const starting = oldValue && oldValue || 0;
        const ending = newValue && newValue || 0;
        const hasChanges = starting !== ending;
        if (hasChanges) {
            const delta = ending - starting;
            return t => {
                const value = starting + (t * delta);
                node.textContent = format(value);
            }
        } else {
            return t => { };
        }
    }

    function tweenTextIn(this: SVGTextElement, datum: number, index: number) {
        return doTweenText(this, undefined, datum, index);
    }

    function tweenText(this: SVGTextElement, datum: number, index: number): ((t: number) => void) {
        const oldValue = getOldData<number>(this);
        return doTweenText(this, oldValue, datum, index);
    }

    function tweenTextOut(this: SVGTextElement, datum: number, index: number): ((t: number) => void) {
        const oldValue = getOldData<number>(this);
        return doTweenText(this, oldValue, undefined, index);
    }



    export class Visual implements IVisual {
        private readonly host: IVisualHost;
        private settings: VisualSettings;
        private readonly svg: d3.Selection<SVGGElement>;
        private readonly mainGraphics: d3.Selection<SVGGElement>;
        private readonly spinnerGraphics: d3.Selection<SVGGElement>;
        private readonly valueFormatter: formatting.IValueFormatter;


        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            const svg = this.svg = d3.select(options.element)
                .append("svg")
                .attr("viewBox", "0 0 100 100")
                .attr("preserveAspectRatio", "xMidYMid meet");
            const mainGraphics = this.mainGraphics = svg.append("g");
            this.spinnerGraphics = mainGraphics.append("g");
            this.valueFormatter = formatting.valueFormatter.create({});
        }

        public update(options: VisualUpdateOptions) {
            try {
                const viewModel = visualTransform(options, this.host);
                this.settings = viewModel.settings;
                const width = options.viewport.width;
                const height = options.viewport.height;
                this.svg.attr("width", width)
                    .attr("height", height);

                const mainGraphics = this.mainGraphics;
                const spinnerGraphics = this.spinnerGraphics;
                const offsetAmount = this.settings && this.settings.display.offsetAmount || 0;
                const overlapAmount = this.settings && this.settings.display.overlapAmount;

                let totalOffset = 0;

                const useOldData = function (this: any, datum: ArcInformation) {
                    datum.newData.adjust = totalOffset * (offsetAmount || 0);
                    const oldData = getOldData<ArcData>(this);
                    datum.oldData = oldData;
                    setOldData(this, datum.newData);
                };

                const arcs = spinnerGraphics.selectAll(".arc")
                    .each(function (this: any, datum: ArcInformation) {
                        totalOffset = datum.newData.angle + datum.newData.offset;
                    })
                    .data(viewModel.arcs)
                    .each(useOldData);

                const tweenArcOut = function (this: SVGGElement, datum: ArcInformation, index: number): ((t: number) => string) {
                    return doTweenArc(datum.oldData, undefined, index);
                }

                const tweenArc = function (this: any, datum: ArcInformation, index: number): ((t: number) => string) {
                    return doTweenArc(datum.oldData, datum.newData, index);
                }

                const tweenArcIn = function (this: SVGGElement, datum: ArcInformation, index: number): ((t: number) => string) {
                    return doTweenArc(undefined, datum.newData, index);
                }

                const values = mainGraphics.selectAll("text")
                    .each(function (this: any, datum: number) {
                        setOldData(this, datum);
                    })
                    .data([viewModel.value]);

                const duration = viewModel.settings.display.duration;

                values.enter()
                    .append("text")
                    .attr("x", 50)
                    .attr("y", 50)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central")
                    .transition().duration(duration)
                    .ease("poly")
                    .tween("text", tweenText as any);

                values.exit()
                    .transition().duration(duration / 2)
                    .ease("poly")
                    .tween("text", tweenText as any)
                    .remove();

                values
                    .attr("font-size", this.settings.percentages.fontSize)
                    .attr("fill", this.settings.percentages.color)
                    .transition().duration(duration)
                    .ease("bounce")
                    .tween("text", tweenText as any);

                arcs.enter()
                    .append("g")
                    .classed("arc", true)
                    .each(useOldData)
                    .append("path")
                    .classed("arcPath", true)
                    .attr("stroke-width", d => d.newData.width)
                    .attr("fill", "none")
                    .attr("stroke", d => d.newData.color)
                    .transition().duration(duration)
                    .ease("poly")
                    .attrTween("d", tweenArcIn);

                arcs.select(".arcPath")
                    .transition().duration(duration)
                    .ease("bounce")
                    .attr("stroke-width", d => d.newData.width)
                    .attr("stroke", d => d.newData.color)
                    .attrTween("d", tweenArc);

                const exits = arcs.exit()
                    .transition().duration(duration / 2);

                exits
                    .select(".arcPath")
                    .ease("poly")
                    .attrTween("d", tweenArcOut)
                exits
                    .remove();
            }
            catch (ex) {
                console.error("Got error", ex);
            }
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}
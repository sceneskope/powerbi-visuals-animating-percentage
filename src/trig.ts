module powerbi.extensibility.visual.trig {

    export const PI2 = 2 * Math.PI;
    export function normaliseAngle(angle: number): number {
        while (angle >= PI2) {
            angle -= PI2;
        }
        while (angle <= -PI2) {
            angle += PI2;
        }
        return angle;
    }
    export function calculateArc(center: number, offset: number, radius: number, angle: number): string {
        angle = normaliseAngle(angle);
        if (angle === 0) {
            angle = 0.0005;
        }

        const startX = center + (radius * Math.cos(offset));
        const startY = center + (radius * Math.sin(offset));
        const endX = center + (radius * Math.cos(angle + offset));
        const endY = center + (radius * Math.sin(angle + offset));

        if (isNaN(endX) || isNaN(endY)) {
            console.warn(`isNan: ${center} ${radius} ${angle} ${offset}`);
        }

        let sweep: number;
        let largeArc: number;
        if (angle < -Math.PI) {
            largeArc = 0;
            sweep = 1;
        } else if (angle < 0) {
            largeArc = 1;
            sweep = 1;
        } else if (angle < Math.PI) {
            largeArc = 0;
            sweep = 1;
        } else {
            largeArc = 1;
            sweep = 1;
        }

        return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${endX} ${endY}`;
    }

    export function getAngle(percentage: number) {
        return PI2 * percentage;
    }
}
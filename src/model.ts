module powerbi.extensibility.visual {
    import DataRoleHelper = powerbi.extensibility.utils.dataview.DataRoleHelper;
    import ColorHelper = powerbi.extensibility.utils.color.ColorHelper;

    export interface ArcComponent {
        value: number;

    }

    export interface ArcData {
        adjust: number;
        angle: number;
        offset: number;
        color: string;
        radius: number;
        width: number;
    }

    export interface ArcInformation {
        oldData?: ArcData;
        newData: ArcData;
    }


    export interface Model {
        arcs: ArcInformation[];
        value?: number;
        settings: VisualSettings;
    }


    function getIndexOfRole(columns: DataViewMetadataColumn[], columnName: string): number | undefined {

        for (let i = 0, len = columns.length; i < len; i++) {
            let column = columns[i];
            if (DataRoleHelper.hasRole(column, columnName)) {
                return column.index;
            }
        }
        return undefined;

    }

    function getRowValue(row: DataViewTableRow, index: number | undefined) {
        if (index !== undefined) {
            return row[index];
        }
    }

    function createEmptyModel() {
        return {
            arcs: [],
            settings: VisualSettings.getDefault() as VisualSettings
        }
    }


    export function visualTransform(options: VisualUpdateOptions, host: IVisualHost): Model {
        const dataViews = options.dataViews;

        if (!dataViews
            || !dataViews[0]
            || !dataViews[0].table
            || !dataViews[0].table.rows
            || !dataViews[0].table.rows[0]) {
                return createEmptyModel();
        }
        

        const dataView = dataViews[0];
        const table = dataView.table;
        const settings = VisualSettings.parse<VisualSettings>(dataView);

        const percentageIndex = getIndexOfRole(table.columns, "percentage");
        if (percentageIndex === undefined) {
            return createEmptyModel();
        }
        const labelIndex = getIndexOfRole(table.columns, "label");
        const hasLabel = (labelIndex !== undefined);
        const maxRadius = settings.display.maxRadius;
        const thicknessOverlap = 1 - settings.display.thicknessOverlap;
        const possibleThickness = (settings.display.maxRadius - settings.display.minRadius) / (table.rows.length * thicknessOverlap);
        const thickness = possibleThickness > settings.display.maxThickness ? settings.display.maxThickness : possibleThickness;

        let cumulativeAngle = 0;
        const arcs = table.rows.map((row, index) => {
            const percentage = (row[percentageIndex] as number) / 2;
            const label = hasLabel ? row[labelIndex] as string : (index + "");
            const color = host.colorPalette.getColor(label).value;
            const angle = trig.getAngle(percentage);

            const arcData: ArcData = {
                angle: angle,
                offset: cumulativeAngle,
                color: color,
                radius: maxRadius - (index * (thickness * thicknessOverlap)),
                width: thickness,
                adjust: 0
            };
            cumulativeAngle = trig.normaliseAngle(cumulativeAngle + angle);
            const information: ArcInformation = {
                newData: arcData
            };
            return information;
        })
        const value = table.rows[0][0] as number;
        return {
            arcs: arcs,
            value: value,
            settings: settings

        };
    }
}

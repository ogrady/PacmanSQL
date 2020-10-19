export type Dimensions = [number, number];
export type Coordinate = [number, number];

export interface Actor {
    id: number;
    coordinate: Coordinate;
}

export class Backend {
    public getMapDimensions(): Dimensions {
        return [1,1];
    }

    public getBlockedCells(): Coordinate[] {
        return [];
    }

    public getActors(): Actor[] {
        return [];
    }
}
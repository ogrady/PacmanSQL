import * as db from "./database";
import * as fp from "../functools";
import * as t from "../types";

export type EntityState = [number, number, number, number, number];

export class Environment extends db.DBUnit {
    public constructor(db: db.PostgresqlConnection) {
        super(db, "./src/db/sql/environment.sql");
    }

    private createEntity(type: string, x: number, y: number, ẟx: number = 0, ẟy: number = 0, speed: number = 0.04, controller: string = "ai"): Promise<number> {
        console.log(`creating entity of type ${type} at (${x}, ${y}) with movement (${ẟx}, ${ẟy}),speed ${speed} and controller ${controller}`);
        return this.func("environment.create_entity", [type, x, y, ẟx, ẟy, speed, db.str(controller)]);
    }

    public createPlayer(x: number, y: number, controller: string, ẟx: number = 0, ẟy: number = 0): Promise<number> {
        return this.createEntity(db.str("pacman"), x, y, ẟx, ẟy, 0.04, controller);
    }

    public createGhost(x: number, y: number, ẟx: number = 0, ẟy: number = 0): Promise<number> {
        return this.createEntity(db.str("ghost"), x, y, ẟx, ẟy);
    }

    private createMap(w: number, h: number): Promise<void> {
        console.log(`creating map of size ${w} x ${h}`);
        return this.func("environment.create_map", [w, h]);
    }

    public getConnectedComponents() {
        return this.exec(`SELECT * FROM environment.connected_components`);
    }

    public setMap(descriptor: string) {
        // yes, this may have been easier to read with two for-loops, but I am polishing my FP a bit.
        const lines = descriptor.split("\n").filter(row => row.trim().length > 0); // // remove rows that are completely empty
        const blocked: [number, number][] = lines
                                            .map(row => fp.zip(row.split(""), fp.range(row.length)))  // give each symbol their x-coordinate
                                            .map((row, y) => row.filter(char => char[0].trim())       // filter out all elements that are empty (= passable)
                                            .map(char => [char[1], y] as [number, number]))           // attach y-coordinate and remove block symbol
                                            .reduce((acc, row) => acc.concat(row), []);               // reduce 2d array into sequence

        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;
        this.createMap(width, height);
        for(const [x,y] of blocked) {
            this.run(`UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
        }
    }

    public getBlockedAreas(): t.Coordinate[]  {
        return this.get(`SELECT x,y FROM environment.cells WHERE NOT passable`);
    }

    public getWalkableAreas(): t.Coordinate[] {
         return this.get(`SELECT x,y FROM environment.cells WHERE passable`);
    }

    public getDimensions(): t.Dimensions {
        return this.exec(`SELECT MAX(x) AS width, MAX(y) AS height FROM environment.cells`)[0].values[0];
    }

    public setPlayerMovement(playerId: number, x: number, y: number): Promise<void> {
        return this.func("push", [playerId, x, y]);
    }

    public updatePositions(): Promise<[number, number, number][]> {
        return this.func("environment.update_positions", []);
    }

    public getStates(): EntityState[] {
        return this.get(`SELECT entity_id, x, y, ẟx, ẟy FROM environment.entity_components`);
    }

}
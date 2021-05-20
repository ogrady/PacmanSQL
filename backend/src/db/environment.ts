import * as db from "./database";
import * as fp from "../util/functools";
import * as t from "../types";

export type EntityState = [number, number, number, number, number];

export interface Entity {
    entity_id: number;
    x: number;
    y: number;
    ẟx: number;
    ẟy: number;
    speed: number
    type: "pacman" | "ghost"
}

export class Environment extends db.DBUnit {
    public constructor(db: db.PostgresqlConnection) {
        super(db, "./src/db/sql/environment.sql");
    }

    public async getEntities(): Promise<Entity[]> {
        return await this.get(`SELECT * FROM environment.entity_components`) as Entity[];
    }

    private async createEntity(type: string, x: number, y: number, ẟx = 0, ẟy = 0, speed = 0.04, controller: string = "ai", dfa = ""): Promise<number> {
        console.log(`creating entity of type ${type} at (${x}, ${y}) with movement (${ẟx}, ${ẟy}),speed ${speed} and controller ${controller}`);
        const eid = (await this.func("environment.create_entity", [db.str(type), x, y, ẟx, ẟy, speed, db.str(controller)]))[0].create_entity;
        if(dfa) {
            this.func("dfa.setup_entity", [eid, db.str(dfa)]);
        }
        return eid;
    }

    public async destroyEntity(eid: number): Promise<void> {
        return this.exec(`DELETE FROM environment.entities WHERE id = ${eid}`);
    }

    public async destroyPlayer(controller: string): Promise<void> {
        return this.exec(`DELETE FROM environment.entities WHERE id = (SELECT entity_id FROM environment.controller_components WHERE controller = ${db.str(controller)})`);
    }

    public createPlayer(x: number, y: number, controller: string, ẟx = 0, ẟy = 0): Promise<number> {
        return this.createEntity("pacman", x, y, ẟx, ẟy, 0.04, controller);
    }

    public async createGhost(x: number, y: number, dfa = ""): Promise<number> {
        return this.createEntity("ghost", x, y, 0, 0, 0.03, "ai", dfa);
    }

    private createMap(w: number, h: number): Promise<void> {
        console.log(`creating map of size ${w} x ${h}`);
        return this.func("environment.create_map", [w, h]);
    }

    public getConnectedComponents(): Promise<any> {
        return this.exec(`SELECT * FROM environment.connected_components`);
    }

    public getWallShapes(): Promise<any> {
        return this.get(`SELECT * FROM environment.wall_shapes`);
    }

    public async getMapDimensions(): Promise<any> {
        return (await this.get(`SELECT MAX(x) + 1 AS width, MAX(y) + 1 AS height FROM environment.cells`))[0]; // +1 to compensate for 0-based coordinates
    }

    public async setMap(descriptor: string): Promise<void> {
        // yes, this may have been easier to read with two for-loops, but I am polishing my FP a bit.
        const lines = descriptor.split("\n").filter(row => row.trim().length > 0); // // remove rows that are completely empty
        const blocked: [number, number][] = lines
                                            .map(row => fp.zip(row.split(""), fp.range(row.length)))  // give each symbol their x-coordinate
                                            .map((row, y) => row.filter(char => char[0].trim())       // filter out all elements that are empty (= passable)
                                            .map(char => [char[1], y] as [number, number]))           // attach y-coordinate and remove block symbol
                                            .reduce((acc, row) => acc.concat(row), []);               // reduce 2d array into sequence

        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;
        console.log(width, height);
        if(width < 1 || height < 1) {
            throw new Error("either width or height of passed map is 0.");
        }
        await this.createMap(width, height);
        for(const [x,y] of blocked) {
            this.run(`UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
        }
    }

    public async getBlockedAreas(): Promise<t.Coordinate[]>  {
        return this.get(`SELECT x,y FROM environment.cells WHERE NOT passable`);
    }

    public async getWalkableAreas(): Promise<t.Coordinate[]> {
         return this.get(`SELECT x,y FROM environment.cells WHERE passable`);
    }

    public async getDimensions(): Promise<t.Dimensions> {
        return this.exec(`SELECT MAX(x) AS width, MAX(y) AS height FROM environment.cells`)[0].values[0];
    }

    public setPlayerMovement(playerId: number, x: number, y: number): Promise<void> {
        return this.func("environment.push", [playerId, x, y]);
    }

    public updatePositions(): Promise<[number, number, number][]> {
        return this.func("environment.update_positions", []);
    }

    public async getStates(): Promise<EntityState[]> {
        return this.get(`SELECT entity_id, x, y, ẟx, ẟy FROM environment.entity_components`);
    }

}
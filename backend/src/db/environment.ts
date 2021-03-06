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

interface GhostType {
    dfa: string;
    r: number;
    g: number;
    b: number;
}

export class Environment extends db.DBUnit {
    public constructor(db: db.PostgresqlConnection) {
        super(db, "./src/db/sql/environment.sql");
    }

    public async getEntities(): Promise<Entity[]> {
        return await this.get(`SELECT * FROM environment.entity_components ORDER BY z ASC`) as Entity[];
    }

    public async getEntityDelta(): Promise<Entity[]> {
        return await this.get(`SELECT ec.* FROM environment.entity_components AS ec JOIN environment.game_state AS gs ON ec.last_update >= gs.checkpoint`);
    }

    public async getActors(): Promise<Entity[]> {
        return await this.get(`SELECT * FROM environment.entity_components WHERE category = 'actor'`) as Entity[];
    }

    public async checkpoint(): Promise<void> {
        return this.exec("UPDATE environment.game_state SET checkpoint = now()");
    }

    private async createEntity(type: string, x: number, y: number, width: number, height: number, {ẟx = 0, ẟy = 0, speed = 0.04, controller = "ai", dfa = "", r = 100, g = 0, b = 100} = {}): Promise<number> {
        console.log(`creating entity of type ${type} at (${x}, ${y}), of size ${width}x${height}, with movement (${ẟx}, ${ẟy}), speed ${speed} and controller '${controller}'`);
        const eid = (await this.func("environment.create_entity", [db.str(type), db.optional(x), db.optional(y), width, height, ẟx, ẟy, speed, db.str(controller)]), r, g, b)[0].create_entity;
        if(dfa) {
            this.func("dfa.setup_entity", [eid, db.str(dfa)]);
        }
        return eid;
    }

    public async destroyEntity(eid: number): Promise<void> {
        return this.exec(`DELETE FROM environment.entities WHERE id = ${eid}`);
    }

    public async destroyPlayer(controller: string): Promise<number> {
        return (await this.get(`DELETE FROM environment.entities WHERE id = (SELECT entity_id FROM environment.controller_components WHERE controller = ${db.str(controller)}) RETURNING id`))[0].id;
    }

    public async createPlayer({x, y, controller}: {x?: number, y?: number, controller: string}): Promise<number> {
        console.log(`creating player at (${x}, ${y}) with controller '${controller}'`);
        return (await this.func(`environment.create_player`, [db.optional(x), db.optional(y), db.str(controller)]))[0].create_player;
        //return this.createEntity("pacman", x, y, 30, 30, ẟx, ẟy, 0.04, controller);
    }

    public async createGhost({x, y, dfa = "", r = 255, g = 0, b = 0}: {x?: number, y?: number, dfa: string, r?: number, g?: number, b?: number}): Promise<number> {
        console.log(`creating ghost at (${x}, ${y}), with colour [${r},${g},${b}] and DFA '${dfa}'`);

        return (await this.func(`environment.create_ghost`, [db.optional(x), db.optional(y), r, g, b, db.str(dfa)]))[0].id;
        //return this.createEntity("ghost", x, y, 30, 30, {speed: 0.03, controller: "ai", dfa: dfa});
    }

    private async spawnGhost(type: GhostType, count: number) {
        for(let i = 0; i < count; i++) {
            await this.createGhost(type);
        }
    }

    public async spawnWanderer(count = 1) {
        return this.spawnGhost({dfa: "wandering", r:121, g:224, b:156}, count);
    }

    public async spawnAggressor(count = 1) {
        return this.spawnGhost({dfa: "aggressive", r:255, g:0, b:0}, count);
    }

    private createMap(w: number, h: number): Promise<void> {
        console.log(`creating map of size ${w} x ${h}`);
        return this.func("environment.create_map", [w, h]);
    }

    public getCellContents(): Promise<any> {
        return this.get(`SELECT ec.x, ec.y, ec.type FROM environment.entity_components AS ec WHERE ec.category ='item'`)
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
        if(width < 1 || height < 1) {
            throw new Error("either width or height of passed map is 0.");
        }
        await this.createMap(width, height);

        for(const [x,y] of blocked) {
            await this.run(`UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
        }
        this.func("environment.populate_with_pellets", []);
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

    public async updatePositions(): Promise<[number, number, number][]> {
        return (await this.func("environment.update_positions", [])).map(row => row.update_positions);
    }

    public async handleCollisions(): Promise<void> {
        return await this.exec("SELECT * FROM environment.handle_collisions()");//"SELECT environment.dispatch_collision_handler(eid1, eid2) FROM environment.collisions");
    }

    public async getStates(): Promise<EntityState[]> {
        return this.get(`SELECT entity_id, x, y, ẟx, ẟy FROM environment.entity_components`);
    }

}
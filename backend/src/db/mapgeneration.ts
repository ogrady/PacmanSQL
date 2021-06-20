import * as db from "./database";
import * as fp from "../util/functools";
import * as t from "../types";

export class Mapgeneration extends db.DBUnit {
    public constructor(db: db.PostgresqlConnection) {
        super(db, "./src/db/sql/mapgeneration.sql");
    }

    public async generateMap(size: number): Promise<void> {
        console.log(`generating random map of size ${size}`);
        return await this.func("mapgen.generate_pacman_map", [size])
    }

    public async addModule(module: [number, number, number][]): Promise<void> {
        const mid = (await this.get("INSERT INTO mapgen.modules DEFAULT VALUES RETURNING id"))[0].id;
        for(const [x, y, tid] of module) {
            await this.exec(`INSERT INTO mapgen.module_contents(module_id, x, y, tile_id) (VALUES (${mid}, ${x}, ${y}, ${tid}))`);
        }
    }

    public async refreshCompatibility(): Promise<void> {
        await this.exec("REFRESH MATERIALIZED VIEW mapgen.edge_compatibility");
    }
}
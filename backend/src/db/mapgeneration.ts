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
}
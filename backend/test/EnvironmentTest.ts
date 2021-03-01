import * as assert from "assert";
import { PacmanDB as DB } from "../src/db/database";

const supressOutput = true;

describe("Environment", () => {
    let db: DB = undefined;

    before(function () {
        if(supressOutput) {
            //silence the console
            console.log = function () { return; };    
        }        
    });

    after(function () {
        //reset console
        delete console.log;
    });

    before("init DB", async () => {
        db = await DB.create();
    });


    describe('#setMap()', () => {
        const map1 = "█████";
        const map2 = `█████
███ ██████
██ ██`;
            
        for(const [map, w, h] of [[map1,5,1], [map2,10,3]] as [string, number, number][]) {
            it(`testing configuration ${map} to be of size ${w} x ${h}`, async () => {
                const c = w*h;
                await db.environment.setMap(map);
                const count = await db.environment.getSingleValue("SELECT COUNT(*) FROM environment.cells");
                const width = await db.environment.getSingleValue("SELECT MAX(x) + 1 FROM environment.cells");
                const height = await db.environment.getSingleValue("SELECT MAX(y) + 1 FROM environment.cells");
                assert.equal(count, c, `after creating map '${map}' I expected ${c} cells but found ${count}`);
                assert.equal(height, h, `after creating map '${map}' I expected heigth ${h} but found ${height}`);
                assert.equal(width, w, `after creating map '${map}' I expected width ${w} but found ${width}`);
                //environment.clearTables();
                //assert.equal(db.environment.getSingleValue("SELECT COUNT(*) FROM cells"), 0, `should have no cells after clearing map`);
            });
        }
    });

    describe('#createEntity()', () => {
        it("creating two entities", async () => {
            await db.environment.createPlayer(2,2,"pacman test");
            await db.environment.createGhost(2,1);
            assert.equal(await db.environment.getSingleValue("SELECT COUNT(*) FROM environment.entities"), 2, `should have two entities after calling createEntity twice`);
        });
    });

    describe('map neighbours', () => {
        it("testing number of total cell neighbours", async () => {
            const map = `████
████
████
`;
            const w: number = Math.max(...map.split("\n").map(line => line.length));
            const h: number = map.split("\n").length;
            await db.environment.setMap(map);
            assert.equal((await db.environment.getSingleValue("SELECT COUNT(*) FROM environment.cell_neighbours") as number) < w*h*4, true, `too many total neighbours`); // can't be arsed to come up with an exact formula rn~
        });
    });

    describe('#updatePositions()', () => {
        it("creating runner", async () => {
            await db.environment.clearTables();
            await db.environment.setMap(`    █`)
            //await db.environment.createGhost(0,0,1,0);
            //assert.equal(await db.environment.getSingleValue("SELECT COUNT(*) FROM environment.entity_components WHERE (x,y) = (1,0)"), 0, "entity should not be at 1,0 yet");
            //await db.environment.updatePositions();
            //assert.equal(await db.environment.getSingleValue("SELECT COUNT(*) FROM environment.entity_components WHERE (x,y) = (1,0)"), 1, "entity should be at 1,0 by now");
        });
        it("creating blocked runner", async () => {
            await db.environment.clearTables();
            await db.environment.setMap(`    █`)
            await db.environment.createGhost(0,0,0,1); // only one row, going down will fail
            assert.equal(await db.environment.getSingleValue("SELECT COUNT(*) FROM environment.entity_components WHERE (x,y) = (0,1)"), 0, "entity should not be at 1,0 yet");
            await db.environment.updatePositions();
            assert.equal(await db.environment.getSingleValue("SELECT COUNT(*) FROM environment.entity_components WHERE (x,y) = (0,1)"), 0, "entity should still be at 0,0");
        });
    });

});

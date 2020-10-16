import * as mocha from "mocha";
import * as assert from "assert";
import { DB } from "../src/database";
import * as env from "../src/environment";

const supressOutput: boolean = true;

describe("Environment", () => {
    let db: any = undefined;
    let environment: env.Environment;

    before(function () {
        if(supressOutput) {
            //silence the console
            console.log = function () {};    
        }        
    });

    after(function () {
        //reset console
        delete console.log;
    });

    before("init DB", async () => {
        db = await DB.getInstance();      
        environment = new env.Environment(db);
        environment.clearTables();
    });


    describe('#setMap()', () => {
        const map1: string = "█████";
        const map2: string = `█████
███ ██████
██ ██`;
            
        for(const [map, w, h] of [[map1,5,1], [map2,10,3]] as [string, number, number][]) {
            it(`testing configuration ${map} to be of size ${w} x ${h}`, () => {
                const c = w*h;
                environment.setMap(map);
                const count = environment.getSingleValue("SELECT COUNT(*) FROM cells");
                const width = environment.getSingleValue("SELECT MAX(x) + 1 FROM cells");
                const height = environment.getSingleValue("SELECT MAX(y) + 1 FROM cells");
                assert.equal(count, c, `after creating map '${map}' I expected ${c} cells but found ${count}`);
                assert.equal(height, h, `after creating map '${map}' I expected heigth ${h} but found ${height}`);
                assert.equal(width, w, `after creating map '${map}' I expected width ${w} but found ${width}`);
                environment.clearTables();
                assert.equal(environment.getSingleValue("SELECT COUNT(*) FROM cells"), 0, `should have no cells after clearing map`);
            });
        }
    });

    describe('#createEntity()', () => {
        it("creating two entities", () => {
            environment.createEntity(2,2,1,0);
            environment.createEntity(2,1);
            assert.equal(environment.getSingleValue("SELECT COUNT(*) FROM entities"), 2, `should have two entities after calling createEntity twice`);
        });
    });

    describe('map neighbours', () => {
        it("testing number of total cell neighbours", () => {
            const map = `████
████
████
`;
            const w: number = Math.max(...map.split("\n").map(line => line.length));
            const h: number = map.split("\n").length;
            environment.setMap(map);
            assert.equal(environment.getSingleValue("SELECT COUNT(*) FROM cell_neighbours") < w*h*8, true, `too many total neighbours`); // can't be arsed to come up with an exact formula rn~
        });
    });

    describe('#updatePositions()', () => {
        it("creating runner", () => {
            environment.clearTables();
            environment.setMap(`     `)
            environment.createEntity(0,0,1,0);
            assert.equal(environment.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (1,0)"), 0, "entity should not be at 1,0 yet");
            environment.updatePositions();
            assert.equal(environment.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (1,0)"), 1, "entity should be at 1,0 by now");
        });
        it("creating blocked runner", () => {
            environment.clearTables();
            environment.setMap(`     `)
            environment.createEntity(0,0,0,1); // only one row, going down will fail
            assert.equal(environment.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (0,1)"), 0, "entity should not be at 1,0 yet");
            environment.updatePositions();
            assert.equal(environment.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (0,1)"), 0, "entity should still be at 0,0");
        });
    });

});

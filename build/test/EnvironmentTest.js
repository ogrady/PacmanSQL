"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const database_1 = require("../src/database");
const env = __importStar(require("../src/environment"));
const supressOutput = true;
describe("Environment", () => {
    let db = undefined;
    let environment;
    before(function () {
        if (supressOutput) {
            //silence the console
            console.log = function () { };
        }
    });
    after(function () {
        //reset console
        //delete console.log;
    });
    before("init DB", () => __awaiter(void 0, void 0, void 0, function* () {
        db = yield database_1.DB.getInstance();
        environment = new env.Environment(db);
        environment.clearTables();
    }));
    describe('#setMap()', () => {
        const map1 = "█████";
        const map2 = `█████
███ ██████
██ ██`;
        for (const [map, w, h] of [[map1, 5, 1], [map2, 10, 3]]) {
            it(`testing configuration ${map} to be of size ${w} x ${h}`, () => {
                const c = w * h;
                environment.setMap(map);
                const count = db.getSingleValue("SELECT COUNT(*) FROM cells");
                const width = db.getSingleValue("SELECT MAX(x) + 1 FROM cells");
                const height = db.getSingleValue("SELECT MAX(y) + 1 FROM cells");
                assert.equal(count, c, `after creating map '${map}' I expected ${c} cells but found ${count}`);
                assert.equal(height, h, `after creating map '${map}' I expected heigth ${h} but found ${height}`);
                assert.equal(width, w, `after creating map '${map}' I expected width ${w} but found ${width}`);
                environment.clearTables();
                assert.equal(db.getSingleValue("SELECT COUNT(*) FROM cells"), 0, `should have no cells after clearing map`);
            });
        }
    });
    describe('#createEntity()', () => {
        it("creating two entities", () => {
            environment.createEntity(2, 2, 1, 0);
            environment.createEntity(2, 1);
            assert.equal(db.getSingleValue("SELECT COUNT(*) FROM entities"), 2, `should have two entities after calling createEntity twice`);
        });
    });
    describe('map neighbours', () => {
        it("testing number of total cell neighbours", () => {
            const map = `████
████
████
`;
            const w = Math.max(...map.split("\n").map(line => line.length));
            const h = map.split("\n").length;
            environment.setMap(map);
            assert.equal(db.getSingleValue("SELECT COUNT(*) FROM cell_neighbours") < w * h * 4, true, `too many total neighbours`); // can't be arsed to come up with an exact formula rn~
        });
    });
    describe('#updatePositions()', () => {
        it("creating runner", () => {
            environment.clearTables();
            environment.setMap(`     `);
            environment.createEntity(0, 0, 1, 0);
            assert.equal(db.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (1,0)"), 0, "entity should not be at 1,0 yet");
            environment.updatePositions();
            assert.equal(db.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (1,0)"), 1, "entity should be at 1,0 by now");
        });
        it("creating blocked runner", () => {
            environment.clearTables();
            environment.setMap(`     `);
            environment.createEntity(0, 0, 0, 1); // only one row, going down will fail
            assert.equal(db.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (0,1)"), 0, "entity should not be at 1,0 yet");
            environment.updatePositions();
            assert.equal(db.getSingleValue("SELECT COUNT(*) FROM entity_components WHERE (x,y) = (0,1)"), 0, "entity should still be at 0,0");
        });
    });
});

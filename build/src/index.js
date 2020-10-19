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
const database_1 = require("./database");
const pf = __importStar(require("./pathfinding"));
const env = __importStar(require("./environment"));
function test(db, environment, pathfinding) {
    return __awaiter(this, void 0, void 0, function* () {
        /*environment.createEntity(3,0, 1,0);
        const eid = environment.createEntity(1,1);
        pathfinding.initSearch(eid, [3, 0], [7, 0]);
        //pathfinding.printQueryResult("SELECT * FROM node_list");
        for(let i = 0; i < 10; i++) {
            for(const path of pathfinding.tickPathsearch()) {
                console.log(path);
            }
        }*/
        /*    const app = new PIXI.Application();
        
            // The application will create a canvas element for you that you
            // can then insert into the DOM
            document.body.appendChild(app.view);
        
            // load the texture we need
            app.loader.add('bunny', 'bunny.png').load((loader, resources) => {
                // This creates a texture from a 'bunny.png' image
                const bunny = new PIXI.Sprite(resources.bunny.texture);
        
                // Setup the position of the bunny
                bunny.x = app.renderer.width / 2;
                bunny.y = app.renderer.height / 2;
        
                // Rotate around the center
                bunny.anchor.x = 0.5;
                bunny.anchor.y = 0.5;
        
                // Add the bunny to the scene we are building
                app.stage.addChild(bunny);
        
                // Listen for frame updates
                app.ticker.add(() => {
                     // each frame we spin the bunny around a bit
                    bunny.rotation += 0.01;
                });
            });*/
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield database_1.DB.getInstance();
        const environment = new env.Environment(db);
        const pathfinding = new pf.Pathfinding(db);
        const map = `
███ ███ ███
█        █
████████████`;
        environment.setMap(map);
        test(db, environment, pathfinding);
    });
}
main();
function garbage(db) {
    return __awaiter(this, void 0, void 0, function* () {
        // Prepare an sql statement
        var stmt = db.prepare("SELECT * FROM hello WHERE a=:aval AND b=:bval");
        // Bind values to the parameters and fetch the results of the query
        var result = stmt.getAsObject({ ':aval': 1, ':bval': 'world' });
        console.log(result); // Will print {a:1, b:'world'}
        // Bind other values
        stmt.bind([0, 'hello']);
        while (stmt.step())
            console.log(stmt.get()); // Will print [0, 'hello']
        // free the memory used by the statement
        stmt.free();
        // You can not use your statement anymore once it has been freed.
        // But not freeing your statements causes memory leaks. You don't want that.
        // You can also use JavaScript functions inside your SQL code
        // Create the js function you need
        function add(a, b) { return a + b; }
        // Specifies the SQL function's name, the number of it's arguments, and the js function to use
        db.create_function("add_js", add);
        // Run a query in which the function is used
        db.run("INSERT INTO hello VALUES (add_js(7, 3), add_js('Hello ', 'world'));"); // Inserts 10 and 'Hello world'
        // Export the database to an Uint8Array containing the SQLite database file
        var binaryArray = db.export();
    });
}

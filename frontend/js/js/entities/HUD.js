"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const game_1 = __importDefault(require("../game"));
const me_1 = __importDefault(require("../me"));
/**
 * a basic HUD item to display score
 */
class ScoreItem extends me_1.default.Renderable {
    constructor(x, y) {
        super(x, y, 10, 10);
        console.log('show HUD');
        this.score = -1;
    }
    update() {
        // we don't do anything fancy here, so just
        // return true if the score has been updated
        if (this.score !== game_1.default.data.score) {
            this.score = game_1.default.data.score;
            return true;
        }
        return false;
    }
}
class HUD extends me_1.default.Container {
    constructor() {
        super();
        // persistent across level change
        this.isPersistent = true;
        // make sure we use screen coordinates
        this.floating = true;
        // give a name
        this.name = "HUD";
        // add our child score object at the top left corner
        this.addChild(new ScoreItem(5, 5));
    }
}
exports.default = HUD;

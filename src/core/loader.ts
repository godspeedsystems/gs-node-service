
import iterate_yaml_directories from './configLoader';
import { PlainObject } from "./common";

let config:PlainObject = {};

(function loadSources() {
    config.app = iterate_yaml_directories(__dirname + '/..')['..'];
    console.log("config.app: ",config.app)
})();

export { config };
/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from './common';
import { logger } from './logger';
import { GSEachParallelFunction, GSEachSeriesFunction, GSFunction, GSParallelFunction, GSSeriesFunction, GSSwitchFunction} from './interfaces';
import { checkDatasource } from './utils';
import loadYaml from './yamlLoader';
import loadModules from './codeLoader';

export function createGSFunction(workflowJson: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject): GSFunction {

    logger.debug('Creating GSFunction %s', workflowJson.id);

    if (!workflowJson.fn) {
        if (Array.isArray(workflowJson)) {
            workflowJson = { tasks: workflowJson, fn: 'com.gs.sequential' };
        } else {
            workflowJson.fn = 'com.gs.sequential';
        }
    }

    let tasks;

    switch(workflowJson.fn) {
        case 'com.gs.sequential':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => createGSFunction(taskJson, workflows, nativeFunctions));
            return new GSSeriesFunction(workflowJson, undefined, tasks);

        case 'com.gs.parallel':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => createGSFunction(taskJson, workflows, nativeFunctions));
            return new GSParallelFunction(workflowJson, undefined, tasks);

        case 'com.gs.switch': {
            let args = [workflowJson.value];
            let cases:PlainObject = {};

            for (let c in workflowJson.cases) {
                cases[c] = createGSFunction(workflowJson.cases[c], workflows, nativeFunctions);
            }

            if (workflowJson.defaults) {
                cases.default = createGSFunction(workflowJson.defaults, workflows, nativeFunctions);
            }

            args.push(cases);

            logger.debug('loading switch workflow %o', workflowJson.cases);

            return new GSSwitchFunction(workflowJson, undefined, args);
        }

        case 'com.gs.each_parallel': {
                let args = [workflowJson.value];
                let tasks = workflowJson.tasks.map((taskJson:PlainObject) => createGSFunction(taskJson, workflows, nativeFunctions));
                let task = new GSSeriesFunction(workflowJson, undefined, tasks);

                args.push(task);

                logger.debug('loading each parallel workflow %o', workflowJson.tasks);

                return new GSEachParallelFunction(workflowJson, undefined, args);
            }

        case 'com.gs.each_sequential': {
                let args = [workflowJson.value];
                let tasks = workflowJson.tasks.map((taskJson:PlainObject) => createGSFunction(taskJson, workflows, nativeFunctions));
                let task = new GSSeriesFunction(workflowJson, undefined, tasks);

                args.push(task);

                logger.debug('loading each sequential workflow %o', workflowJson.tasks);

                return new GSEachSeriesFunction(workflowJson, undefined, args);
            }
    }

    //Load the fn for this GSFunction
    let fn = nativeFunctions[workflowJson.fn]; //First check if it's a native function
    let subwf = false;
    if (!fn) { //If not a native function, it should be a GSFunction/Json
        const existingWorkflowData = workflows[workflowJson.fn];
        if (!existingWorkflowData) {
          logger.error(`Function specified by name ${workflowJson.fn} not found in src/functions. Please ensure a function by this path exists.`);
          process.exit(1);
        }
        subwf = true;
        if (!(existingWorkflowData instanceof GSFunction) ) { //Is still a Json data, not converted to GSFunction
            fn = workflows[workflowJson.fn] = createGSFunction(existingWorkflowData, workflows, nativeFunctions);
        } else { //Is a GSFunction already
            fn = existingWorkflowData;
        }
    }

    if (workflowJson?.on_error?.tasks) {
        workflowJson.on_error.tasks = createGSFunction(workflowJson.on_error.tasks, workflows, nativeFunctions);
    }
    return new GSFunction(workflowJson, fn, workflowJson.args, subwf);
}

export async function loadFunctions(datasources: PlainObject,pathString: string): Promise<PlainObject> {
    let code = await loadModules(pathString);
    let functions = await loadYaml(pathString);
    let loadFnStatus:PlainObject;

    logger.info('Loaded native functions: %s', Object.keys(code));

    for (let f in functions) {
        const checkDS = checkDatasource(functions[f], datasources);
        if (!checkDS.success) {
          logger.error('Error in loading datasource for function %s . Error message: %s . Exiting.', f, checkDS.message);
          process.exit(1);
        }
    }

    logger.info('Creating workflows: %s', Object.keys(functions));

    for (let f in functions) {
        if (!(functions[f] instanceof GSFunction)) {
            functions[f] = createGSFunction(functions[f], functions, code);
        }
    }
    loadFnStatus = { success: true, functions: functions};
    logger.info('Loaded workflows: %s', Object.keys(functions));
    return loadFnStatus;
}

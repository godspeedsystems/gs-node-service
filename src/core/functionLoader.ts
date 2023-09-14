/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from './common';
import { logger } from './logger';
import { GSDynamicFunction, GSEachParallelFunction, GSEachSeriesFunction, GSFunction, GSIFFunction, GSParallelFunction, GSSeriesFunction, GSSwitchFunction} from './interfaces';
import { checkDatasource, compileScript } from './utils';
import loadYaml from './yamlLoader';
import loadModules from './codeLoader';

let lastIfFn: GSIFFunction | null;

export function createGSFunction(workflowJson: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject, onError: PlainObject | null): GSFunction | null {

    logger.debug('Creating GSFunction %s workflow_name %s', workflowJson.id, workflowJson.workflow_name);

    if (!workflowJson.fn) {
        if (Array.isArray(workflowJson)) {
            // @ts-ignore
            workflowJson = { tasks: workflowJson, fn: 'com.gs.sequential', workflow_name: workflowJson?.workflow_name };
        } else {
            workflowJson.fn = 'com.gs.sequential';
        }
    }

    let tasks;

    switch(workflowJson.fn) {
        case 'com.gs.sequential':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions, onError);
            });

            tasks = tasks.filter(Boolean);
            return new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.dynamic_fn':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions, onError);
            });
            tasks = tasks.filter(Boolean);
            return new GSDynamicFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.parallel':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions, onError);
            });
            tasks = tasks.filter(Boolean);
            return new GSParallelFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.switch': {
            let args = [workflowJson.value];
            let cases:PlainObject = {};

            for (let c in workflowJson.cases) {
                workflowJson.cases[c].workflow_name = workflowJson.workflow_name;
                cases[c] = createGSFunction(workflowJson.cases[c], workflows, nativeFunctions, onError);
            }

            if (workflowJson.defaults) {
                workflowJson.defaults.workflow_name = workflowJson.workflow_name;
                cases.default = createGSFunction(workflowJson.defaults, workflows, nativeFunctions, onError);
            }

            args.push(cases);

            logger.debug('loading switch workflow %o', workflowJson.cases);

            return new GSSwitchFunction(workflowJson, workflows, nativeFunctions, undefined, args, false);
        }

        case 'com.gs.if': {
            let args = [workflowJson.condition];

            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions, onError);
            });
            tasks = tasks.filter(Boolean);
            let task = new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

            args.push(task);

            lastIfFn = new GSIFFunction(workflowJson, workflows, nativeFunctions, undefined, args, false);

            return lastIfFn;
        }

        case 'com.gs.elif': {
            let args = [workflowJson.condition];

            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions, onError);
            });
            tasks = tasks.filter(Boolean);
            let task = new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

            args.push(task);

            let fn = new GSIFFunction(workflowJson, workflows, nativeFunctions, undefined, args, false);

            if (!lastIfFn) {
                logger.error(`If is missing before elsif ${workflowJson.id}.`);
                process.exit(1);
            } else {
                lastIfFn.else_fn = fn;
            }

            lastIfFn = fn;
            return null;
        }

        case 'com.gs.else': {
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions, onError);
            });
            tasks = tasks.filter(Boolean);
            let task = new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

            if (!lastIfFn) {
                logger.error(`If is missing before else ${workflowJson.id}.`);
                process.exit(1);
            } else {
                lastIfFn.else_fn = task;
            }

            lastIfFn = null;
            return null;
        }

        case 'com.gs.each_parallel': {
                let args = [workflowJson.value];
                let tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                    taskJson.workflow_name = workflowJson.workflow_name;
                    taskJson.isEachParallel = true;
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                });
                tasks = tasks.filter(Boolean);
                let task = new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

                args.push(task);

                if (workflowJson?.on_error?.tasks) {
                    workflowJson.on_error.tasks.workflow_name = workflowJson.workflow_name;
                    workflowJson.on_error.tasks = createGSFunction(workflowJson.on_error.tasks, workflows, nativeFunctions, null);
                }

                logger.debug('loading each parallel workflow %o', workflowJson.tasks);

                return new GSEachParallelFunction(workflowJson, workflows, nativeFunctions, undefined, args, false);
            }

        case 'com.gs.each_sequential': {
                let args = [workflowJson.value];
                let tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                    taskJson.workflow_name = workflowJson.workflow_name;
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                });
                tasks = tasks.filter(Boolean);
                let task = new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);
                args.push(task);

                if (workflowJson?.on_error?.tasks) {
                    workflowJson.on_error.tasks.workflow_name = workflowJson.workflow_name;
                    workflowJson.on_error.tasks = createGSFunction(workflowJson.on_error.tasks, workflows, nativeFunctions, null);
                }

                logger.debug('loading each sequential workflow %o', workflowJson.tasks);

                return new GSEachSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, args, false);
            }
    }

    let subwf = false;
    let fn;
    let fnScript;

    if (workflowJson.fn.match(/<(.*?)%/) && workflowJson.fn.includes('%>')) {
        fnScript = compileScript(workflowJson.fn);
    } else {
        //Load the fn for this GSFunction
        fn = nativeFunctions[workflowJson.fn]; //First check if it's a native function
        if (!fn) { //If not a native function, it should be a GSFunction/Json
            const existingWorkflowData = workflows[workflowJson.fn];
            if (!existingWorkflowData) {
                logger.error(`Function specified by name ${workflowJson.fn} not found in src/functions. Please ensure a function by this path exists.`);
                process.exit(1);
            }

            subwf = true;
            if (!(existingWorkflowData instanceof GSFunction) ) { //Is still a Json data, not converted to GSFunction
                existingWorkflowData.workflow_name = workflowJson.fn;
                fn = workflows[workflowJson.fn] = createGSFunction(existingWorkflowData, workflows, nativeFunctions, onError);
            } else { //Is a GSFunction already
                fn = existingWorkflowData;
            }
        }
    }


    if (workflowJson?.on_error?.tasks) {
        workflowJson.on_error.tasks.workflow_name = workflowJson.workflow_name;
        workflowJson.on_error.tasks = createGSFunction(workflowJson.on_error.tasks, workflows, nativeFunctions, null);
    } else if (workflowJson?.on_error) {
        // do nothing
    } else if (onError) {
        workflowJson.on_error = onError;
    }

    if (workflowJson?.authz) {
        workflowJson.authz.workflow_name = workflowJson.workflow_name;
        workflowJson.authz = createGSFunction(workflowJson.authz, workflows, nativeFunctions, onError);
    }

    return new GSFunction(workflowJson, workflows, nativeFunctions, fn, workflowJson.args, subwf, fnScript);
}

export async function loadFunctions(datasources: PlainObject,pathString: string): Promise<PlainObject> {
    let nativeFunctions = await loadModules(pathString);
    let yamlFunctions;
    let loadFnStatus:PlainObject;

    if (!process.env.GS_DEBUG) {
        yamlFunctions = await loadYaml(pathString);

        logger.info('Loaded native functions: %s', Object.keys(nativeFunctions));

        for (let f in yamlFunctions) {
            try {
                if (! yamlFunctions[f].tasks) {
                    logger.error('Error in loading tasks of function %s, exiting.', f);
                    process.exit(1);
                }
            } catch (ex) {
                logger.error('Error in loading tasks of function %s, exiting.', f);
                process.exit(1);
            }

            const checkDS = checkDatasource(yamlFunctions[f], datasources);
            if (!checkDS.success) {
                logger.error('Error in loading datasource for function %s . Error message: %s . Exiting.', f, checkDS.message);
                process.exit(1);
            }
        }

        logger.info('Creating workflows: %s', Object.keys(yamlFunctions));

        for (let f in yamlFunctions) {
            if (!(yamlFunctions[f] instanceof GSFunction)) {
                yamlFunctions[f].workflow_name = f;
                if (yamlFunctions[f].on_error?.tasks) {
                    yamlFunctions[f].on_error.tasks.workflow_name = f;
                    yamlFunctions[f].on_error.tasks = createGSFunction(yamlFunctions[f].on_error.tasks, yamlFunctions, nativeFunctions, null);
                }
                yamlFunctions[f] = createGSFunction(yamlFunctions[f], yamlFunctions, nativeFunctions, yamlFunctions[f].on_error);
            }
        }
    } else {
        // @ts-ignore
        global.functions = nativeFunctions
        yamlFunctions = {};
    }
    loadFnStatus = { success: true, functions: Object.assign(nativeFunctions, yamlFunctions)};
    logger.info('Loaded workflows: %s', Object.keys(yamlFunctions));
    return loadFnStatus;
}
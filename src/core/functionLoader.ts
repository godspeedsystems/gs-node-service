/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from './common';
import { logger } from './logger';
import { GSDynamicFunction, GSEachParallelFunction, GSEachSeriesFunction, GSFunction, GSParallelFunction, GSSeriesFunction, GSSwitchFunction} from './interfaces';
import { checkDatasource, compileScript } from './utils';
import loadYaml from './yamlLoader';
import loadModules from './codeLoader';

export function createGSFunction(workflowJson: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject): GSFunction {

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
                return createGSFunction(taskJson, workflows, nativeFunctions);
            });
            return new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.dynamic_fn':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions);
            });
            return new GSDynamicFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.parallel':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                taskJson.workflow_name = workflowJson.workflow_name;
                return createGSFunction(taskJson, workflows, nativeFunctions);
            });
            return new GSParallelFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.switch': {
            let args = [workflowJson.value];
            let cases:PlainObject = {};

            for (let c in workflowJson.cases) {
                workflowJson.cases[c].workflow_name = workflowJson.workflow_name;
                cases[c] = createGSFunction(workflowJson.cases[c], workflows, nativeFunctions);
            }

            if (workflowJson.defaults) {
                workflowJson.defaults.workflow_name = workflowJson.workflow_name;
                cases.default = createGSFunction(workflowJson.defaults, workflows, nativeFunctions);
            }

            args.push(cases);

            logger.debug('loading switch workflow %o', workflowJson.cases);

            return new GSSwitchFunction(workflowJson, workflows, nativeFunctions, undefined, args, false);
        }

        case 'com.gs.each_parallel': {
                let workflowJson1 = JSON.parse(JSON.stringify(workflowJson));
                let args = [workflowJson.value];
                let tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                    taskJson.workflow_name = workflowJson.workflow_name;
                    taskJson.isEachParallel = true;
                    return createGSFunction(taskJson, workflows, nativeFunctions);
                });
                let task = new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);

                args.push(task);

                logger.debug('loading each parallel workflow %o', workflowJson.tasks);

                return new GSEachParallelFunction(workflowJson1, workflows, nativeFunctions, undefined, args, false);
            }

        case 'com.gs.each_sequential': {
                let workflowJson1 = JSON.parse(JSON.stringify(workflowJson));
                let args = [workflowJson.value];
                let tasks = workflowJson.tasks.map((taskJson:PlainObject) => {
                    taskJson.workflow_name = workflowJson.workflow_name;
                    return createGSFunction(taskJson, workflows, nativeFunctions);
                });
                let task = new GSSeriesFunction(workflowJson, workflows, nativeFunctions, undefined, tasks, false);
                args.push(task);

                logger.debug('loading each sequential workflow %o', workflowJson.tasks);

                return new GSEachSeriesFunction(workflowJson1, workflows, nativeFunctions, undefined, args, false);
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
                fn = workflows[workflowJson.fn] = createGSFunction(existingWorkflowData, workflows, nativeFunctions);
            } else { //Is a GSFunction already
                fn = existingWorkflowData;
            }
        }
    }


    if (workflowJson?.on_error?.tasks) {
        workflowJson.on_error.tasks.workflow_name = workflowJson.workflow_name;
        workflowJson.on_error.tasks = createGSFunction(workflowJson.on_error.tasks, workflows, nativeFunctions);
    }

    if (workflowJson?.authz) {
        workflowJson.authz.workflow_name = workflowJson.workflow_name;
        workflowJson.authz = createGSFunction(workflowJson.authz, workflows, nativeFunctions);
    }

    return new GSFunction(workflowJson, workflows, nativeFunctions, fn, workflowJson.args, subwf, fnScript);
}

export async function loadFunctions(datasources: PlainObject,pathString: string): Promise<PlainObject> {
    let code = await loadModules(pathString);
    let functions = await loadYaml(pathString);
    let loadFnStatus:PlainObject;

    logger.info('Loaded native functions: %s', Object.keys(code));

    for (let f in functions) {
        try {
            if (! functions[f].tasks) {
                logger.error('Error in loading tasks of function %s, exiting.', f);
                process.exit(1);
            } 
        } catch (ex) {
            logger.error('Error in loading tasks of function %s, exiting.', f);
            process.exit(1);
        }

        const checkDS = checkDatasource(functions[f], datasources);
        if (!checkDS.success) {
          logger.error('Error in loading datasource for function %s . Error message: %s . Exiting.', f, checkDS.message);
          process.exit(1);
        }
    }

    logger.info('Creating workflows: %s', Object.keys(functions));

    for (let f in functions) {
        if (!(functions[f] instanceof GSFunction)) {
            functions[f].workflow_name = f;
            functions[f] = createGSFunction(functions[f], functions, code);
        }
    }
    loadFnStatus = { success: true, functions: functions};
    logger.info('Loaded workflows: %s', Object.keys(functions));
    return loadFnStatus;
}

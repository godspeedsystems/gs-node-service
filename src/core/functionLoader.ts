/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from './common';
import { GSContext, GSEachParallelFunction, GSEachSeriesFunction, GSFunction, GSIFFunction, GSParallelFunction, GSSeriesFunction, GSSwitchFunction } from './interfaces';
import { checkDatasource, compileScript } from './utils';
import loadYaml from './yamlLoader';
import loadModules from './codeLoader';
import {  logger } from '../logger';
//@ts-ignore
import path from 'path';

/*
    Two reasons to keep this module level variable
    1. To check dangling else or elif tasks, set lastIfFn to the ifFn when encountered, 
    and later check when loading elif and else tasks, whether `lastIfFn` is set or not.
    2. An com.gs.GSIFFunction has optional else_fn which is either com.gs.elif or com.gs.else function.  
*/
let lastIfFn: GSIFFunction | null;

// BaseJSON is common to workflow and task json
type BaseJSON = {
    fn?: string, //Even though in workflows developer does not need 
    //to define fn, they are convereted to com.gs.sequential functions
    id?: string,
    workflow_name?: string,
    on_error?: OnError
}
export type WorkflowJSON = BaseJSON & {
    tasks: Array<TaskJSON>
}
type OnError = {
    tasks: TasksJSON | GSFunction | null
}
type ParallelTaskJSON = WorkflowJSON & {
    isParallel: boolean
}
type SwitchTaskJSON = WorkflowJSON & {
    value: string | number | boolean,
    cases: { [key: string]: TasksJSON },
    defaults: TasksJSON
}
type CasesJSONLoaded = { [key: string]: GSFunction | null };
type IfTaskJSON = WorkflowJSON & { condition: string }
type EachTaskJSON = WorkflowJSON & { value: Array<any> }
type TasksJSON = Array<TaskJSON> & { workflow_name?: string }
type TaskJSON = BaseJSON & {
    isEachParallel?: boolean,
    authz?: TasksJSON | GSFunction,
    args: any
};

// Developer written JS/TS or datasource functions
export type NativeFunctions = {
    [key: string]: Function | null
}
    ;

/**
 * 
 * @param json a workflow or array of yaml tasks or a single yaml task
 * @param workflows all workflows that exist whether loaded yet or in json form and yet to be loaded.
 * @param nativeFunctions 
 * @param onError 
 * @returns GSFunction or null (in case of com.gs.elif or com.gs.else)
 */
export function createGSFunction(
    json: WorkflowJSON | TasksJSON | TaskJSON,
    workflows: PlainObject,
    nativeFunctions: NativeFunctions,
    onError: OnError | null,
    location: PlainObject
): GSFunction | null {
    const childLogger = logger.child(location);
    // initializeChildLogger(location);
    // logger.setBindings(null);

    
    if (Array.isArray(json)) { //These are workflow tasks and this is TasksJSON
        json = { tasks: json as TasksJSON, fn: 'com.gs.sequential', workflow_name: json?.workflow_name };
    } else if (!json.fn) {
        json.fn = 'com.gs.sequential';
    }
    childLogger.debug('Starting to parse and load GSFunction id: %s name: %s', json.id, json.workflow_name);

    //First lets handle core framework control flow functions
    //If this workflow is none of that then we will handle that after this switch block.
    let tasks;

    switch (json.fn) {
        case 'com.gs.sequential':
            tasks =
                (json as WorkflowJSON)
                    .tasks
                    .map((taskJson: TaskJSON) => {
                        taskJson.workflow_name = json.workflow_name;
                        const taskLocation = {parent: location, workflow_name: json.workflow_name, task_id: taskJson.id};
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError, taskLocation);
                    });

            tasks = tasks.filter(Boolean);

            return new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false, undefined, location);

        // case 'com.gs.dynamic_fn':
        //     tasks =
        //         (json as WorkflowJSON)
        //             .tasks
        //             .map((taskJson: TaskJSON) => {
        //                 taskJson.workflow_name = json.workflow_name;
        //                 return createGSFunction(taskJson, workflows, nativeFunctions, onError);
        //             });
        //     tasks = tasks.filter(Boolean);

        //     return new GSDynamicFunction(json, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.parallel':
            tasks =
                (json as WorkflowJSON)
                    .tasks
                    .map((taskJson: TaskJSON) => {
                        taskJson.workflow_name = json.workflow_name;
                        const taskLocation = { parent: location,  workflow_name: json.workflow_name, task_id: taskJson.id };
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError, taskLocation);
                    });

            tasks = tasks.filter(Boolean); //filter out falsy values from tasks

            (json as ParallelTaskJSON).isParallel = true;
            return new GSParallelFunction(json, workflows, nativeFunctions, undefined, tasks, false, undefined, location);

        case 'com.gs.switch': {
            const switchWorkflowJSON: SwitchTaskJSON = json as SwitchTaskJSON;
            let args: Array<any> = [switchWorkflowJSON.value];
            let cases: CasesJSONLoaded = {};

            for (let c in switchWorkflowJSON.cases) {
                switchWorkflowJSON.cases[c].workflow_name = switchWorkflowJSON.workflow_name;
                //@ts-ignore
                const taskLocation = { parent: location, case_workflow_name: switchWorkflowJSON.workflow_name, case: c, case_task_id: switchWorkflowJSON.cases[c].id };
                cases[c] = createGSFunction(switchWorkflowJSON.cases[c], workflows, nativeFunctions, onError, taskLocation);
            }

            if (switchWorkflowJSON.defaults) {
                switchWorkflowJSON.defaults.workflow_name = switchWorkflowJSON.workflow_name;
                //@ts-ignore
                const taskLocation = { parent: location, case_default_task_id: switchWorkflowJSON.defaults.id };
                cases.default = createGSFunction(switchWorkflowJSON.defaults, workflows, nativeFunctions, onError, taskLocation);
            }

            args.push(cases);

            // logger.debug('loading switch workflow cases %o', switchWorkflowJSON.cases);

            return new GSSwitchFunction(json, workflows, nativeFunctions, undefined, args, false, location);
        }

        case 'com.gs.if': {
            const ifWorkflowJSON = (json as IfTaskJSON);
            let args: Array<any> = [ifWorkflowJSON.condition];

            tasks = ifWorkflowJSON
                .tasks
                .map((taskJson: TaskJSON) => {
                    taskJson.workflow_name = ifWorkflowJSON.workflow_name;
                    const taskLocation = { parent: location, if_task_workflow_name: taskJson.workflow_name, if_task_task_id: taskJson.id } ;
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError, taskLocation);
                });

            tasks = tasks.filter(Boolean);
            /* 
                Create a series function which will be called 
                by the GSIFFunction if condition evaluates to true.
                Omit the `condition` from if task and make a series 
                function with its child tasks
             */

            const tasksJSON: WorkflowJSON = { ...ifWorkflowJSON };
            if ('condition' in tasksJSON) {
                delete tasksJSON.condition;
            }

            const tasksGSSeriesFunction = new GSSeriesFunction(tasksJSON, workflows, nativeFunctions, undefined, tasks, false, undefined, location);

            args.push(tasksGSSeriesFunction);


            const ifFunction = new GSIFFunction(json, workflows, nativeFunctions, undefined, args, false, location);

            // update the lastIfFn state to check later for dangling elif or else.
            lastIfFn = ifFunction;

            return ifFunction;
        }

        case 'com.gs.elif': {
            const elifWorkflowJSON = (json as IfTaskJSON);
            let args: Array<any> = [elifWorkflowJSON.condition];

            tasks = elifWorkflowJSON
                .tasks
                .map((taskJson: TaskJSON) => {
                    taskJson.workflow_name = elifWorkflowJSON.workflow_name;
                    const taskLocation = { parent: location,  workflow_name: taskJson.workflow_name, task_id: taskJson.id };
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError, taskLocation);
                });

            tasks = tasks.filter(Boolean);
            /* 
                Create a series function which will be called 
                by the GSIFFunction if condition evaluates to true.
                Omit the `condition` from if task and make a series 
                function with its child tasks
             */

            const tasksJSON: WorkflowJSON = { ...elifWorkflowJSON };
            if ('condition' in tasksJSON) {
                delete tasksJSON.condition;
            }
            let tasksGSSeriesFunction = new GSSeriesFunction(tasksJSON, workflows, nativeFunctions, undefined, tasks, false, undefined, location);

            args.push(tasksGSSeriesFunction);

            let elifFunction = new GSIFFunction(json, workflows, nativeFunctions, undefined, args, false, location);

            if (!lastIfFn) {
                childLogger.error(`If is missing before elif ${json.id}.`);
                process.exit(1);
            } else {
                lastIfFn.else_fn = elifFunction;
            }

            lastIfFn = elifFunction;
            return null;
        }

        case 'com.gs.else': {
            tasks = (json as WorkflowJSON)
                .tasks
                .map((taskJson: TaskJSON) => {
                    taskJson.workflow_name = json.workflow_name;
                    const taskLocation = { parent: location,  else_task_workflow_name: taskJson.workflow_name, else_task_task_id: taskJson.id };
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError, taskLocation);
                });

            tasks = tasks.filter(Boolean);
            let elseFunction = new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false, undefined, location);

            if (!lastIfFn) {
                childLogger.error(`If task is missing before else task ${json.id}.`);
                process.exit(1);
            } else {
                lastIfFn.else_fn = elseFunction;
            }
            // Reset the state to initial state, to handle next if/else/elseif flow.
            lastIfFn = null;
            return null;
        }

        case 'com.gs.each_parallel': {
            let args: Array<any> = [(json as EachTaskJSON).value];
            let tasks =
                (json as WorkflowJSON)
                    .tasks
                    .map((taskJson: TaskJSON) => {
                        taskJson.workflow_name = json.workflow_name;
                        taskJson.isEachParallel = true;
                        const taskLocation = { parent: location,  each_parallel_workflow_name: taskJson.workflow_name, each_parallel_task_id: taskJson.id };
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError, taskLocation);
                    });

            tasks = tasks.filter(Boolean);
            //Get the tasks to do in every loop
            let loopTasks = new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false, undefined, location);

            args.push(loopTasks);

            if (json?.on_error?.tasks) {
                json.on_error.tasks.workflow_name = json.workflow_name;
                //@ts-ignore
                const taskLocation = { parent: location,  workflow_name: json.workflow_name, task_id: json.on_error.tasks.id , section: 'on_error'};
                json.on_error.tasks = createGSFunction(json.on_error.tasks as TasksJSON, workflows, nativeFunctions, null, taskLocation);
            }

            childLogger.debug('loading each parallel workflow %o', (json as WorkflowJSON).tasks);

            return new GSEachParallelFunction(json, workflows, nativeFunctions, undefined, args, false, location);
        }

        case 'com.gs.each_sequential': {
            let args: Array<any> = [(json as EachTaskJSON).value];

            let tasks =
                (json as WorkflowJSON)
                    .tasks
                    .map((taskJson: TaskJSON) => {
                        taskJson.workflow_name = json.workflow_name;
                        const taskLocation = { parent: location,  each_sequential_workflow_name: taskJson.workflow_name, each_sequential_task_id: taskJson.id };
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError, taskLocation);
                    });

            tasks = tasks.filter(Boolean);
            let task = new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false, undefined, location);
            args.push(task);

            if (json?.on_error?.tasks) {
                json.on_error.tasks.workflow_name = json.workflow_name;
                //@ts-ignore
                const taskLocation = { parent: location, on_error_workflow_name: json.on_error.tasks.workflow_name, on_error_task_id: json.on_error.tasks.id , section: 'on_error'};
                json.on_error.tasks = createGSFunction(json.on_error.tasks as TasksJSON, workflows, nativeFunctions, null, taskLocation);
            }

            childLogger.debug('loading each sequential workflow %o', (json as WorkflowJSON).tasks);

            return new GSEachSeriesFunction(json, workflows, nativeFunctions, undefined, args, false, location);
        }
    }

    /*  
        This was not any of the core framework control functions.
        This must be a `TaskJSON` which is either 
        1. A developer written function (native JS/TS or yaml) or 
        2. A datasource function (also native JS/TS function)
    */
    let subwf = false;
    let fn;
    let fnScript;
    const taskJson: TaskJSON = json as TaskJSON;

    if (taskJson.fn?.match(/<(.*?)%/) && taskJson.fn.includes('%>')) {
        //@ts-ignore
        const taskLocation = { ...location, ...{ workflow_name: taskJson.fn, task_id: taskJson.fn.id } };
        fnScript = compileScript(taskJson.fn, taskLocation);
    } else {
        // Load the fn for this GSFunction
        childLogger.debug('Loading fn %s, which is either the datasource or a JS/TS/YAML workflow', taskJson.fn);

        /*      
            First check if it's a native function (developer written or datasource)
            but, special handling for datasource function, because
            while using datasource fn, starts with datasource.{datasourceName} followed by . 
            followed by the function or nested functions to be invoked
            For ex. in com.gs.prisma tasks, it is in this format, `datasource.{datasourceName}.{entityName}.{method}`
            where as, datasource clients are registered as `datasource.{datasourceName}`
            So we want to extract the datasource.{datasourceName} part
        */

        let fnName: string = String(taskJson.fn).startsWith('datasource.')
            ?
            String(taskJson.fn).split('.').splice(0, 2).join('.')
            :
            taskJson.fn as string;

        fn = nativeFunctions[fnName]; //Either a datasource or dev written JS/TS function 

        if (!fn) {
            // If not a native function, it should be a developer written Workflow as function
            const existingWorkflowData = workflows[fnName];
            if (!existingWorkflowData) {
                childLogger.fatal(`Function specified by name ${fnName} not found in src/functions. Please ensure a function by this path exists.`);
                process.exit(1);
            }

            subwf = true;
            if (!(existingWorkflowData instanceof GSFunction)) { //Is still a Json data, not converted to GSFunction
                existingWorkflowData.workflow_name = fnName;
                const taskLocation = { ...location, ...{ workflow_name: existingWorkflowData.workflow_name, task_id: existingWorkflowData.id } };
                fn = workflows[fnName] = createGSFunction(existingWorkflowData, workflows, nativeFunctions, onError, taskLocation);
            } else { //Is a GSFunction already
                fn = existingWorkflowData;
            }
        }
    }


    if (taskJson?.on_error?.tasks) {
        taskJson.on_error.tasks.workflow_name = taskJson.workflow_name;
        //@ts-ignore
        const taskLocation = { ...location, ...{ on_error_task_id: taskJson.on_error.tasks.id } };
        taskJson.on_error.tasks = createGSFunction(taskJson.on_error.tasks as TasksJSON, workflows, nativeFunctions, null, taskLocation);
    } else if (taskJson?.on_error) {
        // do nothing
    } else if (onError) {
        taskJson.on_error = onError;
    }

    if (taskJson.authz) {
        taskJson.authz.workflow_name = json.workflow_name;
        //@ts-ignore
        const taskLocation = { ...location, ...{ workflow_name: taskJson.authz.workflow_name, task_id: taskJson.authz.id } };
        taskJson.authz = createGSFunction(taskJson.authz as TasksJSON, workflows, nativeFunctions, onError, taskLocation) as GSFunction;
    }

    return new GSFunction(taskJson, workflows, nativeFunctions, fn as GSFunction, taskJson.args, subwf, fnScript, location);
}

// function setLocation(original: PlainObject, newLocation: PlainObject): PlainObject {
//     // const taskLocation = { ...{parent: location}, ...{ workflow_name: json.workflow_name, task_id: taskJson.id  }};
//     newLocation.parent = original;
//     if (!original.workflow_name) {
//         // newLocation.parent ||= {};
//         newLocation.parent.workflow_name = newLocation.workflow_name;
//         delete newLocation.workflow_name;
//     } else 
//     if (original.workflow_name === newLocation.workflow_name) {
//         delete newLocation.workflow_name;
//     }
//     return newLocation;
// }
export type LoadedFunctions = {
    nativeFunctions: NativeFunctions,
    functions: PlainObject, //All YAML workflows and native functions combined
    success: boolean
}
export default async function loadFunctions(datasources: PlainObject, pathString: string): Promise<LoadedFunctions> {

    // framework defined js/ts functions
    let frameworkFunctions = await loadModules(path.resolve(__dirname, '../functions'));

    // project defined yaml worlflows
    let yamlWorkflows = await loadYaml(pathString);

    // project defined js/ts functions
    let nativeMicroserviceFunctions = await loadModules(pathString);

    let loadFnStatus: LoadedFunctions;
    const childLogger = logger.child({section: 'loading_functions'});
    childLogger.debug('JS/TS functions found in src/functions %s', Object.keys(nativeMicroserviceFunctions));
    childLogger.debug('Yaml Workflows found in src/functions %s', Object.keys(yamlWorkflows));
    // logger.debug('Framework defined  functions %s', Object.keys(frameworkFunctions));
    childLogger.debug('Datasources found in src/datasources %o', Object.keys(datasources));

    let _datasourceFunctions = Object
        .keys(datasources)
        .reduce((acc: { [key: string]: Function }, dsName) => {
            // dsName, eg., httpbin, mongo, prostgres, salesforce
            acc[`datasource.${dsName}`] = async (ctx: GSContext, args: PlainObject) => {
                return datasources[dsName].execute(ctx, args);
            };
            return acc;
        }, {});

    const nativeFunctions = { ...frameworkFunctions, ..._datasourceFunctions, ...nativeMicroserviceFunctions };

    childLogger.debug('Creating workflows: %s', Object.keys(yamlWorkflows));

    for (let f in yamlWorkflows) {
        if (!yamlWorkflows[f]) {
            childLogger.fatal({fn: f}, `Found empty yaml workflow ${f}. Exiting.`);
            process.exit(1);
        }
        if (!yamlWorkflows[f].tasks) {
            childLogger.fatal({fn: f}, `Did not find tasks in yaml workflow ${f}. Exiting.`);
            process.exit(1);
        }
        if (!(yamlWorkflows[f] instanceof GSFunction)) {
            yamlWorkflows[f].workflow_name = f;
            if (yamlWorkflows[f].on_error?.tasks) {
                yamlWorkflows[f].on_error.tasks.workflow_name = f;
                childLogger.debug({fn: f}, "Start to load on error tasks for YAML workflow %s", f);
                try {
                    const taskLocation = { workflow_name: f, task_id: yamlWorkflows[f].on_error.tasks.id , section: 'on_error.tasks'};
                    yamlWorkflows[f].on_error.tasks = createGSFunction(yamlWorkflows[f].on_error.tasks, yamlWorkflows, nativeFunctions, null, taskLocation);
                } catch (err) {
                    logger.fatal("Error in loading on error tasks for YAML workflow %s %o", f, err);
                    process.exit(1);
                }
                logger.debug("Loaded on error tasks for YAML workflow %s", f);

            }
            logger.debug("Starting to load YAML workflow %s", f);
            try {
                const taskLocation = { workflow_name: f, task_id: yamlWorkflows[f].id};
                yamlWorkflows[f] = createGSFunction(yamlWorkflows[f], yamlWorkflows, nativeFunctions, yamlWorkflows[f].on_error, taskLocation);

            } catch (err:any) {
                logger.fatal("Error in loading YAML workflow %s %s %o", f, err.message, err);
                process.exit(1);
            }
            logger.debug("Loaded YAML workflow %s", f);

        }
        const checkDS = checkDatasource(yamlWorkflows[f].yaml, datasources);
        if (!checkDS.success) {
            childLogger.fatal({fn: f}, `Error in loading datasource for function ${f} . Error message: ${checkDS.message}. Exiting.`);
            process.exit(1);
        }
    }

    loadFnStatus = { success: true, nativeFunctions, functions: { ...yamlWorkflows, ...nativeMicroserviceFunctions } };
    logger.debug('Loaded YAML workflows: %o', Object.keys(yamlWorkflows));
    logger.info('Loaded all YAML workflows');

    logger.info('Loaded JS workflows %o', Object.keys(nativeMicroserviceFunctions));
    logger.info('Loaded JS/TS workflows');

    return loadFnStatus;
}
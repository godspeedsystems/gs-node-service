/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from './common';
import { GSContext, GSEachParallelFunction, GSEachSeriesFunction, GSFunction, GSIFFunction, GSParallelFunction, GSSeriesFunction, GSSwitchFunction } from './interfaces';
import { checkDatasource, compileScript } from './utils';
import loadYaml from './yamlLoader';
import loadModules from './codeLoader';
import { logger } from '../logger';
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
    cases: {[key: string]: TasksJSON},
    defaults: TasksJSON
}
type CasesJSONLoaded = {[key: string]: GSFunction | null};
type IfTaskJSON = WorkflowJSON & {condition: string}
type EachTaskJSON = WorkflowJSON & {value:Array<any>}
type TasksJSON = Array<TaskJSON> & {workflow_name?: string}
type TaskJSON = BaseJSON & {
    isEachParallel?: boolean,
    authz?: TasksJSON,
    args: any
};

// Developer written JS/TS or datasource functions
export type NativeFunctions = {
    [key: string]: Function | null}
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
    onError: OnError | null
): GSFunction | null {
    
    
    if (Array.isArray(json)) { //These are workflow tasks and this is TasksJSON
        json = { tasks: json as TasksJSON, fn: 'com.gs.sequential', workflow_name: json?.workflow_name };
    } else if (!json.fn) {
        json.fn = 'com.gs.sequential';
    }
    logger.debug('Creating GSFunction id: %s name: %s', json.id, json.workflow_name);
    
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
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                    });

            tasks = tasks.filter(Boolean);

            return new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false);

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
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                    });

            tasks = tasks.filter(Boolean); //filter out falsy values from tasks

            (json as ParallelTaskJSON).isParallel = true;
            return new GSParallelFunction(json, workflows, nativeFunctions, undefined, tasks, false);

        case 'com.gs.switch': {
            const switchWorkflowJSON: SwitchTaskJSON = json as SwitchTaskJSON;
            let args: Array<any> = [switchWorkflowJSON.value];
            let cases: CasesJSONLoaded = {};

            for (let c in switchWorkflowJSON.cases) {
                switchWorkflowJSON.cases[c].workflow_name = switchWorkflowJSON.workflow_name;
                cases[c] = createGSFunction(switchWorkflowJSON.cases[c], workflows, nativeFunctions, onError);
            }

            if (switchWorkflowJSON.defaults) {
                switchWorkflowJSON.defaults.workflow_name = switchWorkflowJSON.workflow_name;
                cases.default = createGSFunction(switchWorkflowJSON.defaults, workflows, nativeFunctions, onError);
            }

            args.push(cases);

            logger.debug('loading switch workflow cases %o', switchWorkflowJSON.cases);

            return new GSSwitchFunction(json, workflows, nativeFunctions, undefined, args, false);
        }

        case 'com.gs.if': {
            const ifWorkflowJSON = (json as IfTaskJSON);
            let args: Array<any> = [ifWorkflowJSON.condition];

            tasks = ifWorkflowJSON
                .tasks
                .map((taskJson: TaskJSON) => {
                    taskJson.workflow_name = ifWorkflowJSON.workflow_name;
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                });

            tasks = tasks.filter(Boolean);
            /* 
                Create a series function which will be called 
                by the GSIFFunction if condition evaluates to true.
                Omit the `condition` from if task and make a series 
                function with its child tasks
             */
             
            const tasksJSON: WorkflowJSON = {...ifWorkflowJSON};
            //@ts-ignore
            delete tasksJSON.condition;
            const tasksGSSeriesFunction = new GSSeriesFunction(tasksJSON, workflows, nativeFunctions, undefined, tasks, false);

            args.push(tasksGSSeriesFunction);
            
             
            const ifFunction = new GSIFFunction(json, workflows, nativeFunctions, undefined, args, false);
            
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
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                });

            tasks = tasks.filter(Boolean);
            /* 
                Create a series function which will be called 
                by the GSIFFunction if condition evaluates to true.
                Omit the `condition` from if task and make a series 
                function with its child tasks
             */
             
            const tasksJSON: WorkflowJSON = {...elifWorkflowJSON};
            //@ts-ignore
            delete tasksJSON.condition;
            let tasksGSSeriesFunction = new GSSeriesFunction(tasksJSON, workflows, nativeFunctions, undefined, tasks, false);

            args.push(tasksGSSeriesFunction);

            let elifFunction = new GSIFFunction(json, workflows, nativeFunctions, undefined, args, false);

            if (!lastIfFn) {
                logger.error(`If is missing before elif ${json.id}.`);
                throw new Error(`If is missing before elif ${json.id}.`);
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
                    return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                });

            tasks = tasks.filter(Boolean);
            let elseFunction = new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false);

            if (!lastIfFn) {
                logger.error(`If task is missing before else task ${json.id}.`);
                throw new Error(`If task is missing before else task ${json.id}.`);
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
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                    });

            tasks = tasks.filter(Boolean);
            //Get the tasks to do in every loop
            let loopTasks = new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false);

            args.push(loopTasks);

            if (json?.on_error?.tasks) {
                json.on_error.tasks.workflow_name = json.workflow_name;
                json.on_error.tasks = createGSFunction(json.on_error.tasks as TasksJSON, workflows, nativeFunctions, null);
            }

            logger.debug('loading each parallel workflow %o', (json as WorkflowJSON).tasks);

            return new GSEachParallelFunction(json, workflows, nativeFunctions, undefined, args, false);
        }

        case 'com.gs.each_sequential': {
            let args: Array<any> = [(json as EachTaskJSON).value];

            let tasks =
                (json as WorkflowJSON)
                    .tasks
                    .map((taskJson: TaskJSON) => {
                        taskJson.workflow_name = json.workflow_name;
                        return createGSFunction(taskJson, workflows, nativeFunctions, onError);
                    });

            tasks = tasks.filter(Boolean);
            let task = new GSSeriesFunction(json, workflows, nativeFunctions, undefined, tasks, false);
            args.push(task);

            if (json?.on_error?.tasks) {
                json.on_error.tasks.workflow_name = json.workflow_name;
                json.on_error.tasks = createGSFunction(json.on_error.tasks as TasksJSON, workflows, nativeFunctions, null);
            }

            logger.debug('loading each sequential workflow %o', (json as WorkflowJSON).tasks);

            return new GSEachSeriesFunction(json, workflows, nativeFunctions, undefined, args, false);
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
        fnScript = compileScript(taskJson.fn);
    } else {
        // Load the fn for this GSFunction
        logger.debug('workflowJson.fn %s', taskJson.fn);

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
                throw new Error(`Function specified by name ${fnName} not found in src/functions. Please ensure a function by this path exists.`);
            }

            subwf = true;
            if (!(existingWorkflowData instanceof GSFunction)) { //Is still a Json data, not converted to GSFunction
                existingWorkflowData.workflow_name = fnName;
                fn = workflows[fnName] = createGSFunction(existingWorkflowData, workflows, nativeFunctions, onError);
            } else { //Is a GSFunction already
                fn = existingWorkflowData;
            }
        }
    }


    if (taskJson?.on_error?.tasks) {
        taskJson.on_error.tasks.workflow_name = taskJson.workflow_name;
        taskJson.on_error.tasks = createGSFunction(taskJson.on_error.tasks as TasksJSON, workflows, nativeFunctions, null);
    } else if (taskJson?.on_error) {
        // do nothing
    } else if (onError) {
        taskJson.on_error = onError;
    }

    if (taskJson.authz) {
        taskJson.authz.workflow_name = json.workflow_name;
        //@ts-ignore
        taskJson.authz = createGSFunction(taskJson.authz as TasksJSON, workflows, nativeFunctions, onError);
    }

    return new GSFunction(taskJson, workflows, nativeFunctions, fn as GSFunction , taskJson.args, subwf, fnScript);
}
export type LoadedFunctions = {
    nativeFunctions: NativeFunctions,
    functions: PlainObject, //All YAML workflows and native functions combined
    success: boolean
}
export default async function loadFunctions(datasources: PlainObject, pathString: string): Promise<LoadedFunctions> {

    // framework defined js/ts functions
    //@ts-ignore
    let frameworkFunctions = await loadModules(path.resolve(__dirname, '../functions'));

    // project defined yaml worlflows
    let yamlWorkflows = await loadYaml(pathString);

    // project defined js/ts functions
    let nativeMicroserviceFunctions = await loadModules(pathString);

    let loadFnStatus: LoadedFunctions;

    logger.debug('JS functions %s', Object.keys(nativeMicroserviceFunctions));
    logger.debug('Yaml Workflows %s', Object.keys(yamlWorkflows));
    logger.debug('Framework defined  functions %s', Object.keys(frameworkFunctions));
    logger.debug('Datasource Functions %o', Object.keys(datasources));

    let _datasourceFunctions = Object
        .keys(datasources)
        .reduce((acc: {[key: string]: Function}, dsName) => {
            // dsName, eg., httpbin, mongo, prostgres, salesforce
            acc[`datasource.${dsName}`] = async (ctx: GSContext, args:PlainObject) => {
                return datasources[dsName].execute(ctx, args);
            };
            return acc;
        }, {});
    
    const nativeFunctions = { ...frameworkFunctions, ..._datasourceFunctions, ...nativeMicroserviceFunctions };

    for (let f in yamlWorkflows) {
        try {
            if (!yamlWorkflows[f].tasks) {
                throw new Error(`Error in loading tasks of function ${f}.`);
            }
        } catch (ex: unknown) {
            (ex as Error).message = `Error in loading tasks of function ${f}.` + (ex as Error).message;
            throw ex;
        }
        const checkDS = checkDatasource(yamlWorkflows[f], datasources);
        if (!checkDS.success) {
            throw new Error(`Error in loading datasource for function ${f} . Error message: ${checkDS.message}. Exiting.`);
        }
    }

    logger.debug('Creating workflows: %s', Object.keys(yamlWorkflows));

    for (let f in yamlWorkflows) {
        if (!(yamlWorkflows[f] instanceof GSFunction)) {
            yamlWorkflows[f].workflow_name = f;
            if (yamlWorkflows[f].on_error?.tasks) {
                yamlWorkflows[f].on_error.tasks.workflow_name = f;
                yamlWorkflows[f].on_error.tasks = createGSFunction(yamlWorkflows[f].on_error.tasks, yamlWorkflows, nativeFunctions, null);
            }
            yamlWorkflows[f] = createGSFunction(yamlWorkflows[f], yamlWorkflows, nativeFunctions, yamlWorkflows[f].on_error);
        }
    }

    loadFnStatus = { success: true, nativeFunctions, functions: { ...yamlWorkflows, ...nativeMicroserviceFunctions } };
    logger.info('Loaded YAML workflows: %o', Object.keys(yamlWorkflows));
    logger.info('Loaded JS workflows %o', Object.keys(nativeMicroserviceFunctions));
    return loadFnStatus;
}
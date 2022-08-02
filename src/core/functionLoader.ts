import { PlainObject } from './common';
import { logger } from './logger';
import {
  GSFunction,
  GSParallelFunction,
  GSSeriesFunction,
  GSSwitchFunction,
} from './interfaces';
import { checkDatasource } from './utils';
import loadYaml from './yamlLoader';
import loadModules from './codeLoader';
import { isValidWorkflow } from './validation';

export function createGSFunction(
  workflowJson: PlainObject,
  workflows: PlainObject,
  nativeFunctions: PlainObject
): GSFunction {
  logger.debug('Creating GSFunction %s', workflowJson.id);

  if (!workflowJson.fn) {
    if (Array.isArray(workflowJson)) {
      workflowJson = { tasks: workflowJson, fn: 'com.gs.sequential' };
    } else {
      workflowJson.fn = 'com.gs.sequential';
    }
  }

  let tasks;

  switch (workflowJson.fn) {
    case 'com.gs.sequential':
      tasks = workflowJson.tasks.map((taskJson: PlainObject) =>
        createGSFunction(taskJson, workflows, nativeFunctions)
      );
      return new GSSeriesFunction(
        workflowJson.id,
        undefined,
        tasks,
        workflowJson.summary,
        workflowJson.description
      );

    case 'com.gs.parallel':
      tasks = workflowJson.tasks.map((taskJson: PlainObject) =>
        createGSFunction(taskJson, workflows, nativeFunctions)
      );
      return new GSParallelFunction(
        workflowJson.id,
        undefined,
        tasks,
        workflowJson.summary,
        workflowJson.description
      );

    case 'com.gs.switch':
      let args = [workflowJson.value];
      let cases: PlainObject = {};

      for (let c in workflowJson.cases) {
        cases[c] = createGSFunction(
          workflowJson.cases[c],
          workflows,
          nativeFunctions
        );
      }

      if (workflowJson.defaults) {
        cases.default = createGSFunction(
          workflowJson.defaults,
          workflows,
          nativeFunctions
        );
      }

      args.push(cases);

      logger.debug(
        'loading switch workflow %s',
        JSON.stringify(workflowJson.cases)
      );

      return new GSSwitchFunction(
        workflowJson.id,
        undefined,
        args,
        workflowJson.summary,
        workflowJson.description
      );
  }

  //Load the fn for this GSFunction
  let fn = nativeFunctions[workflowJson.fn]; //First check if it's a native function
  let subwf = false;
  if (!fn) {
    //If not a native function, it should be a GSFunction/Json
    const existingWorkflowData = workflows[workflowJson.fn];
    if (!existingWorkflowData) {
      logger.error(
        `Function specified by name ${workflowJson.fn} not found in src/functions. Please ensure a function by this path exists.`
      );
      process.exit(1);
    }
    subwf = true;
    if (!(existingWorkflowData instanceof GSFunction)) {
      //Is still a Json data, not converted to GSFunction
      fn = workflows[workflowJson.fn] = createGSFunction(
        existingWorkflowData,
        workflows,
        nativeFunctions
      );
    } else {
      //Is a GSFunction already
      fn = existingWorkflowData;
    }
  }

  if (workflowJson?.on_error?.tasks) {
    workflowJson.on_error.tasks = createGSFunction(
      workflowJson.on_error.tasks,
      workflows,
      nativeFunctions
    );
    workflowJson.on_error.tasks.isSubWorkflow = true;
  }
  return new GSFunction(
    workflowJson.id,
    fn,
    workflowJson.args,
    workflowJson.summary,
    workflowJson.description,
    workflowJson.on_error,
    workflowJson.retry,
    subwf
  );
}

export async function loadFunctions(
  datasources: PlainObject,
  pathString: string
): Promise<PlainObject> {
  let code = await loadModules(pathString);
  let functions = await loadYaml(pathString);
  let loadFnStatus: PlainObject;

  logger.info('Loaded native functions: %s', Object.keys(code));

  for (let f in functions) {
    const checkDS = checkDatasource(functions[f], datasources);
    if (!checkDS.success) {
      logger.error(
        'Error in loading datasource for function %s . Error message: %s . Exiting.',
        f,
        checkDS.message
      );
      process.exit(1);
    }
  }

  logger.info('Creating workflows: %s', Object.keys(functions));

  for (let f in functions) {
    if (isValidWorkflow({ workflowKey: f, workflow: functions[f] })) {
      if (!(functions[f] instanceof GSFunction)) {
        functions[f] = createGSFunction(functions[f], functions, code);
      }
    } else {
      process.exit(1);
    }
  }
  loadFnStatus = { success: true, functions: functions };
  logger.info('Loaded workflows: %s', Object.keys(functions));
  return loadFnStatus;
}

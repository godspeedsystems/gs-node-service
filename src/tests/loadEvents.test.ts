/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import { logger } from '../core/logger';
import loadEvents from '../core/eventLoader';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
  it('loadEventsSuccess', async () => {
    try {
      const testId = 'loadEventsSuccess';
      const { loadInputs, pathString } = await require(`${fixDir}/${testId}`);
      const functions = await loadInputs();
      const result = await loadEvents(functions, pathString);

      logger.debug('result: %o', result);

      expect(result['/do_kyc/idfc.http.post']).to.be.eql({
        fn: 'com.biz.create_hdfc_account',
        data: {
          examples: null,
          schema: {
            body: {
              description: null,
              required: null,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { Gender: { type: 'string' } },
                    required: ['Gender'],
                  },
                  examples: {
                    '{example_name}': {
                      summary: null,
                      description: null,
                      value: null,
                      external_value: null,
                    },
                  },
                  encoding: null,
                },
              },
            },
            params: [
              {
                name: 'bank_id',
                in: 'query',
                required: true,
                allow_empty_value: false,
                description: null,
                schema: { type: 'string' },
                examples: null,
              },
            ],
          },
        },
        responses: {
          '200': {
            examples: null,
            schema: {
              data: {
                description: null,
                required: null,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { application_id: { type: 'string' } },
                      required: ['application_id'],
                    },
                    examples: {
                      example1: {
                        summary: null,
                        description: null,
                        value: { application_id: 'PRM20478956N' },
                        external_value: null,
                      },
                    },
                    encoding: null,
                  },
                },
              },
            },
          },
          '400': {
            examples: null,
            schema: {
              data: {
                description: null,
                required: null,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { lender_response_code: { type: 'string' } },
                    },
                    examples: {
                      example1: {
                        summary: null,
                        description: null,
                        value: { lender_response_code: 'E001' },
                        external_value: null,
                      },
                    },
                    encoding: null,
                  },
                },
              },
            },
          },
        },
      });
      expect(result['/sum.http.get']).to.be.eql({ fn: 'com.biz.sum-workflow' });
      expect(result['/test.http.get']).to.be.eql({ fn: 'com.biz.test' });
    } catch (error) {
      logger.error('error: %s', <Error>error);
      fail(<Error>error);
    }
  });
});

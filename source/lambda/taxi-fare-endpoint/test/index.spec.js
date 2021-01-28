/*********************************************************************************************************************
 *  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const expect = require('chai').expect;
const lambdaFn = require('../index.js');

describe('taxi fare endpoint', () => {
    it('should correctly proccess event records', async () => {
        const validEvent = {
            resource: '/{proxy+}',
            path: '/path/to/resource',
            httpMethod: 'GET',
            isBase64Encoded: false,
            body: null,
            queryStringParameters: {
                'ride_request_id': '123'
            }
        };

        const response = await lambdaFn.handler(validEvent);
        const body = JSON.parse(response.body);
        expect(response.statusCode).to.equal(200);
        expect(body.expected_fare).to.not.be.undefined;
    });

    it('should fail if event does not contain query string parameter', async () => {
        const invalidEvent = {
            resource: '/{proxy+}',
            path: '/path/to/resource',
            httpMethod: 'GET',
            isBase64Encoded: false,
            body: null,
            queryStringParameters: {
                'foo': 'bar'
            }
        };

        const response = await lambdaFn.handler(invalidEvent);
        expect(response.statusCode).to.equal(400);
    });
});

/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

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

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
const sinon = require('sinon');
const AWS = require('aws-sdk-mock');
const lambdaFn = require('../index.js');

const getSimpleEvent = () => ({
    eventSource: 'aws:kafka',
    eventSourceArn: 'arn:aws:kafka:EXAMPLE',
    records: {
        'MyTopic-0': [
            {
                topic: 'MyTopic',
                partition: 0,
                offset: 0,
                timestamp: 12345,
                timestampType: 'CREATE_TIME',
                value: Buffer.from('12345').toString('base64')
            },
            {
                topic: 'MyTopic',
                partition: 0,
                offset: 1,
                timestamp: 12346,
                timestampType: 'CREATE_TIME',
                value: Buffer.from('12346').toString('base64')
            }
        ]
    }
});

const getComplexEvent = () => {
    const topicRecords = [];

    // Each PutRecordBatch accepts up to 500 records, so we use a number larger than that
    // to make sure the function will send more than 1 batch
    for (let i = 0; i < 525; i++) {
        topicRecords.push({
            topic: 'MyTopic',
            partition: 0,
            offset: i,
            timestamp: i,
            timestampType: 'CREATE_TIME',
            value: Buffer.from(i.toString()).toString('base64')
        });
    }

    return {
        eventSource: 'aws:kafka',
        eventSourceArn: 'arn:aws:kafka:EXAMPLE',
        records: {
            'MyTopic-0': topicRecords
        }
    };
};

const createResponse = (numberOfRecords, failedPutCount) => {
    const response = {
        FailedPutCount: failedPutCount,
        RequestResponses: []
    };

    for (let i = 0; i < numberOfRecords; i++) {
        if (i < failedPutCount) {
            response.RequestResponses.push({ ErrorCode: 'ServiceUnavailableException' });
        } else {
            response.RequestResponses.push({ RecordId: `rid-${i}` });
        }
    }

    return response;
}

describe('MSK Lambda to KDF', () => {
    beforeEach(() => {
        process.env.AWS_SDK_USER_AGENT = '{ "customUserAgent": "AwsSolution/SO9999/v0.0.1" }';
        process.env.DELIVERY_STREAM_NAME = 'test-stream';

        sinon.stub(lambdaFn, 'sleep').callsFake();
    });

    afterEach(() => {
        delete process.env.AWS_SDK_USER_AGENT;
        delete process.env.DELIVERY_STREAM_NAME;

        lambdaFn.sleep.restore();
        AWS.restore('Firehose');
    });

    it('should only invoke KDF once when all records are delivered successfully', async () => {
        let callCount = 0;

        AWS.mock('Firehose', 'putRecordBatch', () => {
            callCount++;
            return Promise.resolve(createResponse(2, 0));
        });

        const batchesProcessed = await lambdaFn.handler(getSimpleEvent());
        expect(batchesProcessed).to.equal(1);
        expect(callCount).to.equal(1);
    });

    it('should send multiple batches if input is larger than KDF limits', async () => {
        let callCount = 0;

        AWS.mock('Firehose', 'putRecordBatch', (parameters) => {
            callCount++;
            return Promise.resolve(createResponse(parameters['Records'].length, 0));
        });

        const batchesProcessed = await lambdaFn.handler(getComplexEvent());
        expect(batchesProcessed).to.equal(2);
        expect(callCount).to.equal(2);
    });

    it('should retry if at least one record failed', async () => {
        let callCount = 0;

        AWS.mock('Firehose', 'putRecordBatch', () => {
            callCount++;

            const putResponse =
                callCount === 1 ?

                // Initial call (2 records and 1 failure)
                createResponse(2, 1) :

                // Retry (1 record and 0 failures)
                createResponse(1, 0);

            return Promise.resolve(putResponse);
        });

        const batchesProcessed = await lambdaFn.handler(getSimpleEvent());
        expect(batchesProcessed).to.equal(1);
        expect(callCount).to.equal(2);
    });

    it('should give up after 3 retries', async () => {
        let callCount = 0;

        AWS.mock('Firehose', 'putRecordBatch', () => {
            callCount++;

            const putResponse =
                callCount === 1 ?

                // Initial call (2 records and 1 failure)
                createResponse(2, 1) :

                // Retries (1 record and 1 failure)
                createResponse(1, 1);

            return Promise.resolve(putResponse);
        });

        const batchesProcessed = await lambdaFn.handler(getSimpleEvent());
        expect(batchesProcessed).to.equal(1);
        expect(callCount).to.equal(4);
    });
});

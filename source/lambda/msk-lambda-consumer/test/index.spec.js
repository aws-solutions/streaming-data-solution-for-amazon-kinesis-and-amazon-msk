/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

const expect = require('chai').expect;
const lambdaFn = require('../index.js');

describe('MSK Lambda consumer', () => {
    it('should correctly proccess event records', async () => {
        const validEvent = {
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
                ],
                'MyTopic-1': [
                    {
                        topic: 'MyTopic',
                        partition: 1,
                        offset: 2,
                        timestamp: 12347,
                        timestampType: 'CREATE_TIME',
                        value: Buffer.from('12347').toString('base64')
                    }
                ]
            }
        };

        const response = await lambdaFn.handler(validEvent);
        expect(response).to.equal(`Successfully processed 3 records.`);
    });
});

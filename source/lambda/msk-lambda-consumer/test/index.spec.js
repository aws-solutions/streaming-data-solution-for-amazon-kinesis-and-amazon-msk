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

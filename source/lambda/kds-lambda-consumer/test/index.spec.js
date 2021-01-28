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

describe('KDS Lambda consumer', () => {
    it('should correctly proccess event records', async () => {
        const validEvent = {
            Records: [{
                kinesis: {
                    partitionKey: 'some-pk',
                    kinesisSchemaVersion: '1.0',
                    data: Buffer.from('Hello World').toString('base64'),
                    sequenceNumber: '12345',
                    approximateArrivalTimestamp: 1234567890
                },
                eventSource: 'aws:kinesis',
                eventID: 'some-event-id',
                invokeIdentityArn: 'arn:aws:iam::EXAMPLE',
                eventVersion: '1.0',
                eventName: 'aws:kinesis:record',
                eventSourceARN: 'arn:aws:kinesis:EXAMPLE',
                awsRegion: 'us-east-1'
            }]
        };

        const response = await lambdaFn.handler(validEvent);
        expect(response).to.equal(`Successfully processed ${validEvent.Records.length} records.`);
    });

    it('should fail if event does not contain kinesis records', async () => {
        const invalidEvent = {
            Records: [{
                foo: 'bar'
            }]
        };

        try {
            await lambdaFn.handler(invalidEvent);
        } catch (error) {
            expect(error).to.not.be.null;
            return;
        }

        expect.fail('exception should have been thrown');
    });
});

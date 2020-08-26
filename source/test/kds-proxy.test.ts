/*********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

import * as cdk from '@aws-cdk/core';
import * as logs from '@aws-cdk/aws-logs';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { expect as expectCDK, haveResource, haveResourceLike, ResourcePart, SynthUtils } from '@aws-cdk/assert';

import { ProxyApi } from '../lib/kds-apigw-proxy';

describe('successful scenarios', () => {
    let stack: cdk.Stack;

    beforeAll(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack');

        new ProxyApi(stack, 'TestApi', {
            stream: new kinesis.Stream(stack, 'TestStream'),
            accessLogsRetention: logs.RetentionDays.ONE_WEEK,
            throttlingRateLimit: 100,
            throttlingBurstLimit: 50
        });
    });

    test('creates a proxy API for Kinesis', () => {
        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    });

    test('configures logging', () => {
        expectCDK(stack).to(haveResource('AWS::Logs::LogGroup', {
            RetentionInDays: 7
        }));

        expectCDK(stack).to(haveResource('AWS::ApiGateway::Account'));
    });

    test('creates an IAM role for API Gateway', () => {
        expectCDK(stack).to(haveResource('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: [{
                    Action: 'sts:AssumeRole',
                    Effect: 'Allow',
                    Principal: {
                        Service: 'apigateway.amazonaws.com'
                    }
                }],
                Version: '2012-10-17'
            }
        }));

        expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [{
                    Action: ['kinesis:ListShards', 'kinesis:PutRecord', 'kinesis:PutRecords'],
                    Effect: 'Allow'
                }]
            }
        }));
    });

    test('creates deployment related resources', () => {
        expectCDK(stack).to(haveResource('AWS::ApiGateway::Deployment'));
        expectCDK(stack).to(haveResource('AWS::ApiGateway::Stage', {
            MethodSettings: [{
                HttpMethod: '*',
                ResourcePath: '/*',
                ThrottlingRateLimit: 100,
                ThrottlingBurstLimit: 50
            }],
            StageName: 'prod'
        }));

        expectCDK(stack).to(haveResource('AWS::ApiGateway::RequestValidator', {
            ValidateRequestBody: true
        }));

        expectCDK(stack).to(haveResource('AWS::ApiGateway::Model', {
            Name: 'PutRecordModel'
        }));

        expectCDK(stack).to(haveResource('AWS::ApiGateway::Model', {
            Name: 'PutRecordsModel'
        }));
    });

    test('adds cfn_nag suppressions', () => {
        expectCDK(stack).to(haveResource('AWS::ApiGateway::Deployment', {
            Metadata: {
                cfn_nag: {
                    rules_to_suppress: [{
                        id: 'W68',
                        reason: 'Default usage plan can be used for this API'
                    }]
                }
            }
        }, ResourcePart.CompleteDefinition));

        expectCDK(stack).to(haveResource('AWS::ApiGateway::Stage', {
            Metadata: {
                cfn_nag: {
                    rules_to_suppress: [{
                        id: 'W64',
                        reason: 'Default usage plan can be used for this API'
                    }]
                }
            }
        }, ResourcePart.CompleteDefinition));
    });
});

describe('validation tests', () => {
    let stack: cdk.Stack;
    let fakeStream: kinesis.IStream;

    beforeEach(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack');
        fakeStream = new kinesis.Stream(stack, 'TestStream');
    });

    test.each([0, -1])('rate limit must be positive', (invalidRateLimit) => {
        expect(() => new ProxyApi(stack, 'TestApi', {
            stream: fakeStream,
            accessLogsRetention: logs.RetentionDays.ONE_WEEK,
            throttlingRateLimit: invalidRateLimit,
            throttlingBurstLimit: 50
        })).toThrowError(/throttlingRateLimit must be a positive number/);
    });

    test('burst limit must not be negative', () => {
        expect(() => new ProxyApi(stack, 'TestApi', {
            stream: fakeStream,
            accessLogsRetention: logs.RetentionDays.ONE_WEEK,
            throttlingRateLimit: 100,
            throttlingBurstLimit: -1
        })).toThrowError(/throttlingBurstLimit must be a non-negative number/);
    });
});

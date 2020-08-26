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
import * as kinesis from '@aws-cdk/aws-kinesis';
import { expect as expectCDK, haveResource, haveResourceLike } from '@aws-cdk/assert';

import { LambdaConsumer } from '../lib/kds-lambda-consumer';

let stack: cdk.Stack;
let fakeStream: kinesis.IStream;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    fakeStream = new kinesis.Stream(stack, 'TestStream');
});

test('creates a Lambda function', () => {
    new LambdaConsumer(stack, 'TestFunction', {
        stream: fakeStream,
        batchSize: 10,
        parallelizationFactor: 2,
        retryAttempts: 3,
        timeout: cdk.Duration.minutes(1)
    });

    expectCDK(stack).to(haveResource('AWS::SQS::Queue', {
        KmsDataKeyReusePeriodSeconds: 1800,
        KmsMasterKeyId: 'alias/aws/sqs'
    }));

    expectCDK(stack).to(haveResource('AWS::Lambda::Function', {
        Handler: 'index.handler',
        Runtime: 'nodejs12.x',
        Timeout: 60
    }));

    expectCDK(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
        StartingPosition: 'LATEST',
        BatchSize: 10,
        MaximumRetryAttempts: 3,
        ParallelizationFactor: 2,
        BisectBatchOnFunctionError: true
    }));

    expectCDK(stack).to(haveResourceLike('AWS::CloudWatch::Alarm', {
        Namespace: 'AWS/SQS',
        MetricName: 'ApproximateNumberOfMessagesVisible',
        Statistic: 'Sum',
        Period: 300,
        EvaluationPeriods: 1,
        Threshold: 1,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        TreatMissingData: 'notBreaching'
    }));
});

test.each([0, 16])('timeout must be between allowed values', (invalidTimeoutMinutes) => {
    expect(() => new LambdaConsumer(stack, 'TestFunction', {
        stream: fakeStream,
        batchSize: 10,
        parallelizationFactor: 2,
        retryAttempts: 3,
        timeout: cdk.Duration.minutes(invalidTimeoutMinutes)
    })).toThrowError('timeout must be a value between 1 and 900 seconds');
});

test.each([0, 10001])('batch size must be between allowed values', (invalidBatchSize) => {
    expect(() => new LambdaConsumer(stack, 'TestFunction', {
        stream: fakeStream,
        batchSize: invalidBatchSize,
        parallelizationFactor: 2,
        retryAttempts: 3,
        timeout: cdk.Duration.minutes(1)
    })).toThrowError(`Maximum batch size must be between 1 and 10000 inclusive (given ${invalidBatchSize})`);
});

test.each([-1, 10001])('retry attempts must be between allowed values', (invalidNumRetries) => {
    expect(() => new LambdaConsumer(stack, 'TestFunction', {
        stream: fakeStream,
        batchSize: 10,
        parallelizationFactor: 2,
        retryAttempts: invalidNumRetries,
        timeout: cdk.Duration.minutes(1)
    })).toThrowError(`retryAttempts must be between 0 and 10000 inclusive, got ${invalidNumRetries}`);
});

test.each([0, 11])('parallelization factor must be between allowed values', (invalidFactor) => {
    expect(() => new LambdaConsumer(stack, 'TestFunction', {
        stream: fakeStream,
        batchSize: 10,
        parallelizationFactor: invalidFactor,
        retryAttempts: 3,
        timeout: cdk.Duration.minutes(1)
    })).toThrowError(`parallelizationFactor must be between 1 and 10 inclusive, got ${invalidFactor}`);
});

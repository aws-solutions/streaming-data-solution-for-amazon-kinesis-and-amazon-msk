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
import { expect as expectCDK, haveResource, SynthUtils } from '@aws-cdk/assert';

import { DataStreamMonitoring } from '../lib/kds-monitoring';

let stack: cdk.Stack;

beforeAll(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

describe('KDS only monitoring', () => {
    beforeAll(() => {
        new DataStreamMonitoring(stack, 'TestAlarms1', {
            streamName: 'test-stream'
        });
    });

    test('creates a dashboard for KDS stream', () => {
        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    });

    test('creates IteratorAgeMilliseconds alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
            MetricName: 'GetRecords.IteratorAgeMilliseconds',
            Namespace: 'AWS/Kinesis',
            ComparisonOperator: 'GreaterThanOrEqualToThreshold',
            Statistic: 'Maximum',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 60000,
            TreatMissingData: 'breaching',
            Dimensions: [{
                Name: 'StreamName',
                Value: 'test-stream'
            }]
        }));
    });

    test('creates ReadProvisionedThroughputExceeded alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
            MetricName: 'ReadProvisionedThroughputExceeded',
            Namespace: 'AWS/Kinesis',
            ComparisonOperator: 'GreaterThanOrEqualToThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0.01,
            TreatMissingData: 'breaching',
            Dimensions: [{
                Name: 'StreamName',
                Value: 'test-stream'
            }]
        }));
    });

    test('creates WriteProvisionedThroughputExceeded alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
            MetricName: 'WriteProvisionedThroughputExceeded',
            Namespace: 'AWS/Kinesis',
            ComparisonOperator: 'GreaterThanOrEqualToThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0.01,
            TreatMissingData: 'breaching',
            Dimensions: [{
                Name: 'StreamName',
                Value: 'test-stream'
            }]
        }));
    });

    test('creates PutRecord alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
            MetricName: 'PutRecord.Success',
            Namespace: 'AWS/Kinesis',
            ComparisonOperator: 'LessThanOrEqualToThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0.95,
            TreatMissingData: 'notBreaching',
            Dimensions: [{
                Name: 'StreamName',
                Value: 'test-stream'
            }]
        }));
    });

    test('creates PutRecords alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
            MetricName: 'PutRecords.Success',
            Namespace: 'AWS/Kinesis',
            ComparisonOperator: 'LessThanOrEqualToThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0.95,
            TreatMissingData: 'notBreaching',
            Dimensions: [{
                Name: 'StreamName',
                Value: 'test-stream'
            }]
        }));
    });

    test('creates GetRecords alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
            MetricName: 'GetRecords.Success',
            Namespace: 'AWS/Kinesis',
            ComparisonOperator: 'LessThanOrEqualToThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0.98,
            TreatMissingData: 'breaching',
            Dimensions: [{
                Name: 'StreamName',
                Value: 'test-stream'
            }]
        }));
    });
});

describe('KDS + Lambda monitoring', () => {
    test('creates a dashboard for KDS stream and Lambda function', () => {
        new DataStreamMonitoring(stack, 'TestAlarms2', {
            streamName: 'test-stream',
            lambdaFunctionName: 'test-function'
        });

        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    });
});

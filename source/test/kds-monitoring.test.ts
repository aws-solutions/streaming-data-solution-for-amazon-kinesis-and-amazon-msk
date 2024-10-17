/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

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

    test('creates IteratorAgeMilliseconds alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
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
        });
    });

    test('creates ReadProvisionedThroughputExceeded alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
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
        });
    });

    test('creates WriteProvisionedThroughputExceeded alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
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
        });
    });

    test('creates PutRecord alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
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
        });
    });

    test('creates PutRecords alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
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
        });
    });

    test('creates GetRecords alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
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
        });
    });
});

describe('KDS + Lambda monitoring', () => {
    test('creates a dashboard for KDS stream and Lambda function', () => {
        new DataStreamMonitoring(stack, 'TestAlarms2', {
            streamName: 'test-stream',
            lambdaFunctionName: 'test-function'
        });

    });
});

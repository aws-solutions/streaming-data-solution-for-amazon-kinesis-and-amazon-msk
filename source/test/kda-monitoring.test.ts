/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import {  Template } from 'aws-cdk-lib/assertions';

import { ApplicationMonitoring } from '../lib/kda-monitoring';

describe('kinesis data stream as source', () => {
    let stack: cdk.Stack;

    beforeAll(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack');

        new ApplicationMonitoring(stack, 'Dashboard', {
            applicationName: 'test-application',
            logGroupName: 'test-log-group',
            inputStreamName: 'test-stream'
        });
    });

    test('creates downtime alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            MetricName: 'downtime',
            Namespace: 'AWS/KinesisAnalytics',
            ComparisonOperator: 'GreaterThanThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0,
            TreatMissingData: 'breaching',
            Dimensions: [{ Name: 'Application', Value: 'test-application' }]
        });
    });

    test('creates numberOfFailedCheckpoints alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            MetricName: 'numberOfFailedCheckpoints',
            Namespace: 'AWS/KinesisAnalytics',
            ComparisonOperator: 'GreaterThanThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0,
            TreatMissingData: 'breaching',
            Dimensions: [{ Name: 'Application', Value: 'test-application' }]
        });
    });

    test('creates numRecordsOutPerSecond alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            MetricName: 'numRecordsOutPerSecond',
            Namespace: 'AWS/KinesisAnalytics',
            ComparisonOperator: 'LessThanOrEqualToThreshold',
            Statistic: 'Average',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 0,
            TreatMissingData: 'breaching',
            Dimensions: [{ Name: 'Application', Value: 'test-application' }]
        });
    });

    test('creates millisBehindLatest alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            MetricName: 'millisBehindLatest',
            Namespace: 'AWS/KinesisAnalytics',
            ComparisonOperator: 'GreaterThanThreshold',
            Statistic: 'Maximum',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 60000,
            TreatMissingData: 'breaching',
            Dimensions: [
                { Name: 'Application', Value: 'test-application' },
                { Name: 'Flow', Value: 'Input' },
                { Name: 'Id', Value: 'test_stream' }
            ]
        });
    });

    test('creates cpuUtilization alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            MetricName: 'cpuUtilization',
            Namespace: 'AWS/KinesisAnalytics',
            ComparisonOperator: 'GreaterThanThreshold',
            Statistic: 'Maximum',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 80,
            TreatMissingData: 'breaching',
            Dimensions: [{ Name: 'Application', Value: 'test-application' }]
        });
    });

    test('creates heapMemoryUtilization alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            MetricName: 'heapMemoryUtilization',
            Namespace: 'AWS/KinesisAnalytics',
            ComparisonOperator: 'GreaterThanThreshold',
            Statistic: 'Maximum',
            EvaluationPeriods: 1,
            Period: 60,
            Threshold: 90,
            TreatMissingData: 'breaching',
            Dimensions: [{ Name: 'Application', Value: 'test-application' }]
        });
    });

    test('creates oldGenerationGCTime alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 1,
            Threshold: 60,
            Metrics: [
                {
                    Expression: '(m1 * 100)/60000',
                    Id: 'expr_1',
                    Label: 'Old Generation GC Time Percent'
                },
                {
                    Id: 'm1',
                    MetricStat: {
                        Metric: {
                            Dimensions: [{ Name: 'Application', Value: 'test-application'}],
                            MetricName: 'oldGenerationGCTime',
                            Namespace: 'AWS/KinesisAnalytics'
                        },
                        Period: 60,
                        Stat: 'Maximum'
                    },
                    ReturnData: false
                }
            ],
            TreatMissingData: 'breaching'
        });
    });
});

describe('kafka topic as source', () => {
    test('creates a dashboard for a Flink application', () => {
        const app = new cdk.App();
        const stack = new cdk.Stack(app, 'TestStack');

        new ApplicationMonitoring(stack, 'Dashboard', {
            applicationName: 'test-application',
            logGroupName: 'test-log-group',
            kafkaTopicName: 'test-topic'
        });

    });
});

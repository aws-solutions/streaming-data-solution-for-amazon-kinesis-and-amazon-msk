/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { DeliveryStreamMonitoring } from '../lib/kdf-monitoring';

let stack: cdk.Stack;

beforeAll(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

describe('direct put monitoring with limit alarms', () => {
    beforeAll(() => {
        new DeliveryStreamMonitoring(stack, 'TestAlarms1', {
            deliveryStreamName: 'test-delivery-stream',
            createLimitAlarms: true,
        });
    });

    test('creates IncomingBytes percentage alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 1,
            Threshold: 75,
            Metrics: [
                {
                    Expression: '100 * (m1 / m2)',
                    Id: 'expr_1',
                    Label: 'IncomingRecords (percentage)'
                },
                {
                    Id: 'm1',
                    Label: '',
                    MetricStat: {
                        Metric: {
                            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }],
                            MetricName: 'IncomingRecords',
                            Namespace: 'AWS/Firehose'
                        },
                        Period: 300,
                        Stat: 'Sum'
                    },
                    ReturnData: false
                },
                {
                    Id: 'm2',
                    Label: '',
                    MetricStat: {
                        Metric: {
                            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }],
                            MetricName: 'RecordsPerSecondLimit',
                            Namespace: 'AWS/Firehose'
                        },
                        Period: 300,
                        Stat: 'Minimum'
                    },
                    ReturnData: false
                }
            ],
            TreatMissingData: 'breaching'
        });
    });

    test('creates IncomingPutRequestsAlarm percentage alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 1,
            Threshold: 75,
            Metrics: [
                {
                    Expression: '100 * (m1 / m2)',
                    Id: 'expr_1',
                    Label: 'IncomingPutRequests (percentage)'
                },
                {
                    Id: 'm1',
                    Label: '',
                    MetricStat: {
                        Metric: {
                            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }],
                            MetricName: 'IncomingPutRequests',
                            Namespace: 'AWS/Firehose'
                        },
                        Period: 300,
                        Stat: 'Sum'
                    },
                    ReturnData: false
                },
                {
                    Id: 'm2',
                    Label: '',
                    MetricStat: {
                        Metric: {
                            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }],
                            MetricName: 'PutRequestsPerSecondLimit',
                            Namespace: 'AWS/Firehose'
                        },
                        Period: 300,
                        Stat: 'Minimum'
                    },
                    ReturnData: false
                }
            ],
            TreatMissingData: 'breaching'
        });
    });

    test('creates IncomingRecordsAlarm percentage alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            ComparisonOperator: 'GreaterThanThreshold',
            EvaluationPeriods: 1,
            Threshold: 75,
            Metrics: [
                {
                    Expression: '100 * (m1 / m2)',
                    Id: 'expr_1',
                    Label: 'IncomingRecords (percentage)'
                },
                {
                    Id: 'm1',
                    Label: '',
                    MetricStat: {
                        Metric: {
                            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }],
                            MetricName: 'IncomingRecords',
                            Namespace: 'AWS/Firehose'
                        },
                        Period: 300,
                        Stat: 'Sum'
                    },
                    ReturnData: false
                },
                {
                    Id: 'm2',
                    Label: '',
                    MetricStat: {
                        Metric: {
                            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }],
                            MetricName: 'RecordsPerSecondLimit',
                            Namespace: 'AWS/Firehose'
                        },
                        Period: 300,
                        Stat: 'Minimum'
                    },
                    ReturnData: false
                }
            ],
            TreatMissingData: 'breaching'
        });
    });
});

describe('kds as source monitoring without limit alarms', () => {
    beforeAll(() => {
        new DeliveryStreamMonitoring(stack, 'TestAlarms2', {
            deliveryStreamName: 'test-delivery-stream',
            dataStreamName: 'test-data-stream',
            createLimitAlarms: false
        });
    });

    test('creates DataFreshness alarm', () => {
        Template.fromStack(stack).hasResourceProperties('AWS::CloudWatch::Alarm', {
            MetricName: 'DeliveryToS3.DataFreshness',
            Namespace: 'AWS/Firehose',
            ComparisonOperator: 'GreaterThanThreshold',
            Statistic: 'Maximum',
            EvaluationPeriods: 1,
            Period: 300,
            Threshold: 900,
            TreatMissingData: 'breaching',
            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }]
        });
    });
});

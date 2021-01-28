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

import * as cdk from '@aws-cdk/core';
import { expect as expectCDK, haveResource, SynthUtils } from '@aws-cdk/assert';

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

    test('creates a dashboard for KDF only', () => {
        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    });

    test('creates IncomingBytes percentage alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
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
        }));
    });

    test('creates IncomingPutRequestsAlarm percentage alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
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
        }));
    });

    test('creates IncomingRecordsAlarm percentage alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
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
        }));
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

    test('creates a dashboard for KDF and KDS', () => {
        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    });

    test('creates DataFreshness alarm', () => {
        expectCDK(stack).to(haveResource('AWS::CloudWatch::Alarm', {
            MetricName: 'DeliveryToS3.DataFreshness',
            Namespace: 'AWS/Firehose',
            ComparisonOperator: 'GreaterThanThreshold',
            Statistic: 'Maximum',
            EvaluationPeriods: 1,
            Period: 300,
            Threshold: 900,
            TreatMissingData: 'breaching',
            Dimensions: [{ Name: 'DeliveryStreamName', Value: 'test-delivery-stream' }]
        }));
    });
});

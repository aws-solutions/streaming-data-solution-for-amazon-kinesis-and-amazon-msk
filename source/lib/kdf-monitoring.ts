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
import * as cw from '@aws-cdk/aws-cloudwatch';
import { MonitoringBase } from './monitoring-base';

export interface DeliveryStreamMonitoringProps {
    readonly dataStreamName?: string;
    readonly deliveryStreamName: string;
    readonly createLimitAlarms: boolean;
}

export class DeliveryStreamMonitoring extends MonitoringBase {
    // These values are recommended, but can be ajusted depending on the workload.
    private readonly KDF_DATA_FRESHNESS_THRESHOLD: number = 900;
    private readonly KDF_INCOMING_BYTES_PCT_THRESHOLD: number = 75;
    private readonly KDF_INCOMING_REQUESTS_PCT_THRESHOLD: number = 75;
    private readonly KDF_INCOMING_RECORDS_PCT_THRESHOLD: number = 75;

    constructor(scope: cdk.Construct, id: string, props: DeliveryStreamMonitoringProps) {
        super(scope, id);

        this.addDataStreamMetrics(props.dataStreamName);
        this.addFirehoseMetrics(props.deliveryStreamName, props.createLimitAlarms, props.dataStreamName);
    }

    private createWidgetWithoutUnits(
        title: string,
        metric: cw.IMetric | cw.IMetric[],
        label?: string,
        min?: number,
        max?: number
    ): cw.GraphWidget {
        return new cw.GraphWidget({
            title,
            left: Array.isArray(metric) ? metric : [metric],
            leftYAxis: { showUnits: false, label, min, max }
        });
    }

    private addFirehoseMetrics(deliveryStreamName: string, createLimitAlarms: boolean, dataStreamName?: string) {
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Kinesis Data Firehose Metrics\n'));

        const monitoringPeriod = cdk.Duration.minutes(5);

        const defaultMetricProps = {
            namespace: 'AWS/Firehose',
            period: monitoringPeriod,
            dimensionsMap: { 'DeliveryStreamName': deliveryStreamName },
            statistic: cw.Statistic.SUM
        };

        const defaultAlarmProps = {
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.BREACHING,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD
        };

        if (dataStreamName === undefined) {
            const defaultExpressionProps = {
                period: monitoringPeriod,
                expression: 'METRICS("m1") / 300'
            };

            //---------------------------------------------------------------------
            const incomingBytesMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'IncomingBytes' });
            const bytesPerSecondMetric = new cw.Metric({
                ...defaultMetricProps,
                metricName: 'BytesPerSecondLimit',
                color: cw.Color.RED,
                statistic: cw.Statistic.MINIMUM
            });

            const incomingBytesExpression = new cw.MathExpression({
                ...defaultExpressionProps,
                label: 'IncomingBytes (per second average)',
                usingMetrics: {
                    'm1': new cw.Metric({ ...incomingBytesMetric, label: '' })
                }
            });

            //---------------------------------------------------------------------
            const incomingPutRequestsMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'IncomingPutRequests' });
            const putRequestsPerSecondMetric = new cw.Metric({
                ...defaultMetricProps,
                metricName: 'PutRequestsPerSecondLimit',
                color: cw.Color.RED,
                statistic: cw.Statistic.MINIMUM
            });

            const putRequestsExpression = new cw.MathExpression({
                ...defaultExpressionProps,
                label: 'IncomingPutRequests (per second average)',
                usingMetrics: {
                    'm1': new cw.Metric({ ...incomingPutRequestsMetric, label: '' })
                }
            });

            //---------------------------------------------------------------------
            const incomingRecordsMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'IncomingRecords' });
            const recordsPerSecondMetric = new cw.Metric({
                ...defaultMetricProps,
                metricName: 'RecordsPerSecondLimit',
                color: cw.Color.RED,
                statistic: cw.Statistic.MINIMUM
            });

            const incomingRecordsExpression = new cw.MathExpression({
                ...defaultExpressionProps,
                label: 'IncomingRecords (per second average)',
                usingMetrics: {
                    'm1': new cw.Metric({ ...incomingRecordsMetric, label: '' })
                }
            });

            //---------------------------------------------------------------------
            const throttledRecordsMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'ThrottledRecords' });

            //---------------------------------------------------------------------
            this.Dashboard.addWidgets(
                this.createWidgetWithoutUnits('Incoming bytes per second', [incomingBytesExpression, bytesPerSecondMetric], 'Bytes', 0),
                this.createWidgetWithoutUnits('Incoming put requests per second', [putRequestsExpression, putRequestsPerSecondMetric], 'Count', 0),
                this.createWidgetWithoutUnits('Incoming records per second', [incomingRecordsExpression, recordsPerSecondMetric], 'Count', 0),
                this.createWidgetWithUnits('Throttled records (Count)', throttledRecordsMetric),
            );

            if (createLimitAlarms) {
                /*
                    Kinesis Data Firehose publishes some metrics that can be used to check whether a
                    delivery stream is being throttled (e.g. BytesPerSecondLimit). These metrics are already
                    included in the dashboard, but you can optionally set alarms on them.
                    If the soft limits are reached, you can then request an increase with AWS Support.
                */

                const incomingBytesAlarm = new cw.Alarm(this, 'IncomingBytesAlarm', {
                    ...defaultAlarmProps,
                    threshold: this.KDF_INCOMING_BYTES_PCT_THRESHOLD,
                    metric: new cw.MathExpression({
                        ...defaultExpressionProps,
                        expression: '100 * (m1 / m2)',
                        label: 'IncomingBytes (percentage)',
                        usingMetrics: {
                            'm1': new cw.Metric({ ...incomingBytesMetric, label: '' }),
                            'm2': new cw.Metric({ ...bytesPerSecondMetric, label: '' }),
                        }
                    })
                });

                const incomingPutRequestsAlarm = new cw.Alarm(this, 'IncomingPutRequestsAlarm', {
                    ...defaultAlarmProps,
                    threshold: this.KDF_INCOMING_REQUESTS_PCT_THRESHOLD,
                    metric: new cw.MathExpression({
                        ...defaultExpressionProps,
                        expression: '100 * (m1 / m2)',
                        label: 'IncomingPutRequests (percentage)',
                        usingMetrics: {
                            'm1': new cw.Metric({ ...incomingPutRequestsMetric, label: '' }),
                            'm2': new cw.Metric({ ...putRequestsPerSecondMetric, label: '' }),
                        }
                    })
                });

                const incomingRecordsAlarm = new cw.Alarm(this, 'IncomingRecordsAlarm', {
                    ...defaultAlarmProps,
                    threshold: this.KDF_INCOMING_RECORDS_PCT_THRESHOLD,
                    metric: new cw.MathExpression({
                        ...defaultExpressionProps,
                        expression: '100 * (m1 / m2)',
                        label: 'IncomingRecords (percentage)',
                        usingMetrics: {
                            'm1': new cw.Metric({ ...incomingRecordsMetric, label: '' }),
                            'm2': new cw.Metric({ ...recordsPerSecondMetric, label: '' }),
                        }
                    })
                });

                this.Dashboard.addWidgets(
                    this.createAlarmWidget('Incoming bytes (percentage of limit)', incomingBytesAlarm),
                    this.createAlarmWidget('Incoming put requests (percentage of limit)', incomingPutRequestsAlarm),
                    this.createAlarmWidget('Incoming records (percentage of limit)', incomingRecordsAlarm),
                );
            }
        } else {
            //---------------------------------------------------------------------
            const dataReadRecordsMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'DataReadFromKinesisStream.Records' });

            //---------------------------------------------------------------------
            const dataReadBytesMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'DataReadFromKinesisStream.Bytes' });

            //---------------------------------------------------------------------
            const getRecordsThrottledMetric = new cw.Metric({
                ...defaultMetricProps,
                metricName: 'ThrottledGetRecords',
                statistic: cw.Statistic.AVERAGE
            });

            //---------------------------------------------------------------------
            this.Dashboard.addWidgets(
                this.createWidgetWithUnits('Records read from Kinesis Data Streams (Sum)', dataReadRecordsMetric),
                this.createWidgetWithUnits('Bytes read from Kinesis Data Streams (Sum)', dataReadBytesMetric),
                this.createWidgetWithUnits('GetRecords operations throttled (Average)', getRecordsThrottledMetric),
            );
        }

        //---------------------------------------------------------------------
        const deliverySuccessExpression = new cw.MathExpression({
            period: monitoringPeriod,
            expression: 'METRICS("m1") * 100',
            label: 'DeliveryToS3.Success',
            usingMetrics: {
                'm1': new cw.Metric({
                    ...defaultMetricProps,
                    metricName: 'DeliveryToS3.Success',
                    statistic: cw.Statistic.AVERAGE,
                    label: ''
                })
            }
        });

        //---------------------------------------------------------------------
        const deliveryFreshnessAlarm = new cw.Alarm(this, 'DataFreshnessAlarm', {
            ...defaultAlarmProps,
            threshold: this.KDF_DATA_FRESHNESS_THRESHOLD,
            metric: new cw.Metric({
                ...defaultMetricProps,
                metricName: 'DeliveryToS3.DataFreshness',
                statistic: cw.Statistic.MAXIMUM
            })
        });

        //---------------------------------------------------------------------
        const deliveryRecordsMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'DeliveryToS3.Records' });

        //---------------------------------------------------------------------
        const deliveryBytesMetric = new cw.Metric({ ...defaultMetricProps, metricName: 'DeliveryToS3.Bytes' });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(
            this.createWidgetWithoutUnits('Delivery to Amazon S3 success', deliverySuccessExpression, 'Percentage', 0, 100),
            this.createAlarmWidget('Delivery to Amazon S3 data freshness (Maximum)', deliveryFreshnessAlarm),
            this.createWidgetWithUnits('Records delivered to Amazon S3 (Sum)', deliveryRecordsMetric),
            this.createWidgetWithUnits('Bytes delivered to Amazon S3 (Sum)', deliveryBytesMetric),
        );
    }
}

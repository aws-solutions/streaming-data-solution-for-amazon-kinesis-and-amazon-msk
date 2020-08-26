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
import * as cw from '@aws-cdk/aws-cloudwatch';

export interface StreamMonitoringProps {
    readonly streamName: string;
    readonly lambdaFunctionName?: string;
}

export class StreamMonitoring extends cdk.Construct {
    private readonly Dashboard: cw.Dashboard;

    // These values are recommended, but can be ajusted depending on the workload.
    private readonly ITERATOR_AGE_THRESHOLD: number = 60000;
    private readonly READ_WRITE_PROVISIONED_THRESHOLD: number = 0.01;
    private readonly PUT_RECORDS_THRESHOLD: number = 0.95;
    private readonly GET_RECORDS_THRESHOLD: number = 0.98;

    private readonly MONITORING_PERIOD: cdk.Duration = cdk.Duration.minutes(1);

    constructor(scope: cdk.Construct, id: string, props: StreamMonitoringProps) {
        super(scope, id);

        this.Dashboard = new cw.Dashboard(this, 'Dashboard');

        this.addStreamMetrics(props.streamName);
        this.addLambdaMetrics(props.lambdaFunctionName);
    }

    private createMarkdownWidget(text: string): cw.TextWidget {
        return new cw.TextWidget({ markdown: text, width: 24, height: 1 });
    }

    private createGraphWidget(title: string, metric: cw.IMetric | cw.IMetric[], annonations?: cw.HorizontalAnnotation[]): cw.GraphWidget {
        return new cw.GraphWidget({
            title,
            left: Array.isArray(metric) ? metric : [metric],
            leftAnnotations: annonations
        });
    }

    private createAvailabilityWidget(title: string, leftMetric: cw.IMetric, rightMetric: cw.IMetric): cw.GraphWidget {
        return new cw.GraphWidget({
            title,
            left: [leftMetric],
            right: [rightMetric],
            rightYAxis: { max: 100 }
        });
    }

    private addStreamMetrics(streamName: string) {
        const defaultMetricProps = {
            namespace: 'AWS/Kinesis',
            period: this.MONITORING_PERIOD,
            statistic: 'Average',
            dimensions: { 'StreamName': streamName }
        };

        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Kinesis Stream Metrics\n'));

        //---------------------------------------------------------------------
        const iteratorAgeMetric = new cw.Metric({
            ...defaultMetricProps,
            statistic: 'Maximum',
            metricName: 'GetRecords.IteratorAgeMilliseconds'
        });

        const iteratorAgeAnnonations = [{
            label: 'Iterator age threshold',
            value: this.ITERATOR_AGE_THRESHOLD
        }];

        new cw.Alarm(this, 'IteratorAgeAlarm', {
            threshold: this.ITERATOR_AGE_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.BREACHING,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: iteratorAgeMetric
        });

        //---------------------------------------------------------------------
        const readProvisionedMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'ReadProvisionedThroughputExceeded'
        });

        const readProvisionedAnnonations = [{
            label: 'Read throughput threshold',
            value: this.READ_WRITE_PROVISIONED_THRESHOLD
        }];

        new cw.Alarm(this, 'ReadProvisionedAlarm', {
            threshold: this.READ_WRITE_PROVISIONED_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.BREACHING,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: readProvisionedMetric
        });

        //---------------------------------------------------------------------
        const writeProvisionedMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'WriteProvisionedThroughputExceeded'
        });

        const writeProvisionedAnnonations = [{
            label: 'Write throughput threshold',
            value: this.READ_WRITE_PROVISIONED_THRESHOLD
        }];

        new cw.Alarm(this, 'WriteProvisionedAlarm', {
            threshold: this.READ_WRITE_PROVISIONED_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.BREACHING,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: writeProvisionedMetric
        });

        //---------------------------------------------------------------------
        const putRecordMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'PutRecord.Success'
        });

        const putRecordAnnonations = [{
            label: 'Put record threshold',
            value: this.PUT_RECORDS_THRESHOLD
        }];

        new cw.Alarm(this, 'PutRecordAlarm', {
            threshold: this.PUT_RECORDS_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: putRecordMetric
        });

        //---------------------------------------------------------------------
        const putRecordsMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'PutRecords.Success'
        });

        const putRecordsAnnonations = [{
            label: 'Put records threshold',
            value: this.PUT_RECORDS_THRESHOLD
        }];

        new cw.Alarm(this, 'PutRecordsAlarm', {
            threshold: this.PUT_RECORDS_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: putRecordsMetric
        });

        //---------------------------------------------------------------------
        const getRecordsMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'GetRecords.Success'
        });

        const getRecordsAnnonations = [{
            label: 'Get records threshold',
            value: this.GET_RECORDS_THRESHOLD
        }];

        new cw.Alarm(this, 'GetRecordsAlarm', {
            threshold: this.GET_RECORDS_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.BREACHING,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: getRecordsMetric
        });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(
            this.createGraphWidget('Get records iterator age (Milliseconds)', iteratorAgeMetric, iteratorAgeAnnonations),
            this.createGraphWidget('Read throughput exceeded (Percent)', readProvisionedMetric, readProvisionedAnnonations),
            this.createGraphWidget('Write throughput exceeded (Percent)', writeProvisionedMetric, writeProvisionedAnnonations),
            this.createGraphWidget('Put record success (Percent)', putRecordMetric, putRecordAnnonations),
            this.createGraphWidget('Put records success (Percent)', putRecordsMetric, putRecordsAnnonations),
            this.createGraphWidget('Get records success (Percent)', getRecordsMetric, getRecordsAnnonations)
        );
    }

    private addLambdaMetrics(functionName?: string) {
        if (functionName === undefined) {
            return;
        }

        const defaultMetricProps = {
            namespace: 'AWS/Lambda',
            period: this.MONITORING_PERIOD,
            dimensions: {
                'FunctionName': functionName,
                'Resource': functionName
            }
        };

        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Lambda Metrics\n'));

        //---------------------------------------------------------------------
        const invocationsMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'Invocations',
            statistic: 'Sum'
        });

        //---------------------------------------------------------------------
        const durationMetrics = [
            new cw.Metric({ ...defaultMetricProps, metricName: 'Duration', statistic: 'Minimum' }),
            new cw.Metric({ ...defaultMetricProps, metricName: 'Duration', statistic: 'Average' }),
            new cw.Metric({ ...defaultMetricProps, metricName: 'Duration', statistic: 'Maximum' })
        ];

        //---------------------------------------------------------------------
        const errorsMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'Errors',
            statistic: 'Maximum',
            color: cw.Color.RED
        });

        const availabilityExpression = new cw.MathExpression({
            expression: '100 - 100 * errors / MAX([errors, invocations])',
            label: 'Success rate (%)',
            period: this.MONITORING_PERIOD,
            color: cw.Color.GREEN,
            usingMetrics: {
                'errors': errorsMetric,
                'invocations': new cw.Metric({ ...invocationsMetric, label: '' })
            }
        });

        //---------------------------------------------------------------------
        const throttlesMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'Throttles',
            statistic: 'Sum'
        });

        //---------------------------------------------------------------------
        const iteratorAgeMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'IteratorAge',
            statistic: 'Maximum'
        });

        //---------------------------------------------------------------------
        const executionsMetric = new cw.Metric({
            ...defaultMetricProps,
            metricName: 'ConcurrentExecutions',
            statistic: 'Maximum'
        });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(
            this.createGraphWidget('Invocations', invocationsMetric),
            this.createGraphWidget('Duration', durationMetrics),
            this.createAvailabilityWidget('Error count and success rate (%)', errorsMetric, availabilityExpression),
            this.createGraphWidget('Throttles', throttlesMetric),
            this.createGraphWidget('IteratorAge', iteratorAgeMetric),
            this.createGraphWidget('Concurrent executions', executionsMetric),
        );
    }
}

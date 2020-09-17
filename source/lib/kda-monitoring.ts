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

export interface ApplicationMonitoringProps {
    readonly applicationName: string;
    readonly logGroupName: string;
    readonly inputStreamName: string;
}

export class ApplicationMonitoring extends cdk.Construct {
    private readonly Dashboard: cw.Dashboard;

    // These values are recommended, but can be ajusted depending on the workload.
    private readonly FAILED_CHECKPOINTS_THRESHOLD: number = 0;
    private readonly DOWNTIME_THRESHOLD: number = 0;
    private readonly CPU_UTILIZATION_THRESHOLD: number = 80;
    private readonly HEAP_MEMORY_THRESHOLD: number = 90;
    private readonly GARBAGE_COLLECTION_THRESHOLD: number = 60;
    private readonly PROCESSING_DELAY_THRESHOLD: number = 60000;
    private readonly LOG_QUERY_LIMIT: number = 20;

    private readonly MONITORING_PERIOD: cdk.Duration = cdk.Duration.minutes(1);

    private DEFAULT_METRIC_PROPS = {
        namespace: 'AWS/KinesisAnalytics',
        period: this.MONITORING_PERIOD,
        dimensions: { 'Application': '' }
    };

    private DEFAULT_ALARM_PROPS = {
        evaluationPeriods: 1,
        treatMissingData: cw.TreatMissingData.BREACHING,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD
    };

    constructor(scope: cdk.Construct, id: string, props: ApplicationMonitoringProps) {
        super(scope, id);

        this.DEFAULT_METRIC_PROPS.dimensions['Application'] = props.applicationName;
        this.Dashboard = new cw.Dashboard(this, 'Dashboard');

        this.addApplicationHealth();
        this.addResourceUtilization();
        this.addApplicationProgress();
        this.addSourceMetrics(props.inputStreamName);
        this.addLogging(props.applicationName, props.logGroupName);
    }

    private createMarkdownWidget(text: string): cw.TextWidget {
        return new cw.TextWidget({ markdown: text, width: 24, height: 1 });
    }

    private createGraphWidget(title: string, metric: cw.IMetric, annonations?: cw.HorizontalAnnotation[]): cw.GraphWidget {
        return new cw.GraphWidget({
            title,
            left: [metric],
            leftYAxis: { showUnits: false },
            rightYAxis: { showUnits: false },
            leftAnnotations: annonations
        });
    }

    private createLogWidget(logGroupName: string, title: string, queryString: string): cw.LogQueryWidget {
        return new cw.LogQueryWidget({
            logGroupNames: [logGroupName],
            title,
            queryString,
            width: 24
        });
    }

    private addApplicationHealth() {
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Application Health\n'));

        //---------------------------------------------------------------------
        const downtimeMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'downtime',
            statistic: 'Average'
        });

        const downtimeAnnonations = [{
            label: 'Downtime threshold',
            value: this.DOWNTIME_THRESHOLD
        }];

        new cw.Alarm(this, 'DowntimeAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            metric: downtimeMetric,
            threshold: this.DOWNTIME_THRESHOLD
        });

        //---------------------------------------------------------------------
        const uptimeMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'uptime',
            statistic: 'Minimum'
        });

        //---------------------------------------------------------------------
        const jobRestartsMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'fullRestarts',
            statistic: 'Maximum'
        });

        //---------------------------------------------------------------------
        const failedCheckpointsMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'numberOfFailedCheckpoints',
            statistic: 'Average'
        });

        const failedCheckpointsAnnonations = [{
            label: 'Number of Failed Checkpoints threshold',
            value: this.FAILED_CHECKPOINTS_THRESHOLD
        }];

        new cw.Alarm(this, 'CheckpointAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            metric: failedCheckpointsMetric,
            threshold: this.FAILED_CHECKPOINTS_THRESHOLD
        });

        //---------------------------------------------------------------------
        const checkpointDurationMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'lastCheckpointDuration',
            statistic: 'Maximum'
        });

        //---------------------------------------------------------------------
        const checkpointSizeMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'lastCheckpointSize',
            statistic: 'Average'
        });

        this.Dashboard.addWidgets(
            this.createGraphWidget('Downtime', downtimeMetric, downtimeAnnonations),
            this.createGraphWidget('Uptime', uptimeMetric),
            this.createGraphWidget('Flink Job Restarts', jobRestartsMetric),
            this.createGraphWidget('Number of Failed Checkpoints', failedCheckpointsMetric, failedCheckpointsAnnonations),
            this.createGraphWidget('Last Checkpoint Duration', checkpointDurationMetric),
            this.createGraphWidget('Last Checkpoint Size', checkpointSizeMetric)
        );
    }

    private addResourceUtilization() {
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Resource Utilization\n'));

        //---------------------------------------------------------------------
        const cpuUtilizationMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'cpuUtilization',
            statistic: 'Maximum'
        });

        const cpuUtilizationAnnonations = [{
            label: 'CPU Utilization threshold',
            value: this.CPU_UTILIZATION_THRESHOLD
        }];

        //---------------------------------------------------------------------
        const heapMemoryMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'heapMemoryUtilization',
            statistic: 'Maximum'
        });

        const heapMemoryAnnonations = [{
            label: 'Heap Memory Utilization threshold',
            value: this.HEAP_MEMORY_THRESHOLD
        }];

        //---------------------------------------------------------------------
        const gcCountRateExpression = new cw.MathExpression({
            expression: 'RATE(METRICS()) * 60',
            label: 'Old Generation GC Count Rate',
            period: this.MONITORING_PERIOD,
            usingMetrics: {
                'm1': new cw.Metric({
                    ...this.DEFAULT_METRIC_PROPS,
                    metricName: 'oldGenerationGCCount',
                    label: '',
                    statistic: 'Maximum'
                })
            }
        });

        //---------------------------------------------------------------------
        const gcPercentExpression = new cw.MathExpression({
            expression: '(m1 * 100)/60000',
            label: 'Old Generation GC Time Percent',
            period: this.MONITORING_PERIOD,
            usingMetrics: {
                'm1': new cw.Metric({
                    ...this.DEFAULT_METRIC_PROPS,
                    metricName: 'oldGenerationGCTime',
                    statistic: 'Maximum'
                })
            }
        });

        const gcPercentAnnonations = [{
            label: 'GC Percent threshold',
            value: this.GARBAGE_COLLECTION_THRESHOLD
        }];

        //---------------------------------------------------------------------
        const threadCountMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'threadsCount',
            statistic: 'Maximum'
        });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(
            this.createGraphWidget('CPU Utilization', cpuUtilizationMetric, cpuUtilizationAnnonations),
            this.createGraphWidget('Heap Memory Utilization', heapMemoryMetric, heapMemoryAnnonations),
            this.createGraphWidget('Thread Count', threadCountMetric),
            this.createGraphWidget('Old Generation GC Percent (Over 1 Min)', gcPercentExpression, gcPercentAnnonations),
            this.createGraphWidget('Old Generation GC Count Rate', gcCountRateExpression)
        );
    }

    private addApplicationProgress() {
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Flink Application Progress\n'));

        //---------------------------------------------------------------------
        const incomingRecordsMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'numRecordsInPerSecond',
            statistic: 'Average'
        });

        //---------------------------------------------------------------------
        const outgoingRecordsMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'numRecordsOutPerSecond',
            statistic: 'Average'
        });

        new cw.Alarm(this, 'RecordsOutAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            metric: outgoingRecordsMetric,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold: 0
        });

        //---------------------------------------------------------------------
        const inputWatermarkMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'currentInputWatermark',
            statistic: 'Minimum'
        });

        //---------------------------------------------------------------------
        const outputWatermarkMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'currentOutputWatermark',
            statistic: 'Minimum'
        });

        //---------------------------------------------------------------------
        const eventTimeExpression = new cw.MathExpression({
            expression: 'm1 - m2',
            label: 'Event Time Latency',
            period: this.MONITORING_PERIOD,
            usingMetrics: {
                'm1': new cw.Metric({ ...outputWatermarkMetric, label: '' }),
                'm2': new cw.Metric({ ...inputWatermarkMetric, label: '' })
            }
        });

        //---------------------------------------------------------------------
        const lateRecordsMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'numLateRecordsDropped',
            statistic: 'Maximum'
        });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(
            this.createGraphWidget('Incoming Records (Per Second)', incomingRecordsMetric),
            this.createGraphWidget('Outgoing Records (Per Second)', outgoingRecordsMetric),
            this.createGraphWidget('Input Watermark', inputWatermarkMetric),
            this.createGraphWidget('Output Watermark', outputWatermarkMetric),
            this.createGraphWidget('Event Time Latency', eventTimeExpression),
            this.createGraphWidget('Late Records Dropped', lateRecordsMetric)
        );
    }

    private addSourceMetrics(inputStreamName: string) {
        const kinesisDimensions = {
            ...this.DEFAULT_METRIC_PROPS.dimensions,
            'Id': cdk.Fn.join('_', cdk.Fn.split('-', inputStreamName)),
            'Flow': 'Input'
        };

        //---------------------------------------------------------------------
        const kinesisMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'millisBehindLatest',
            statistic: 'Maximum',
            dimensions: kinesisDimensions
        });

        const kinesisAnnotations = [{
            label: 'MillisBehindLatest threshold',
            value: this.PROCESSING_DELAY_THRESHOLD
        }];

        new cw.Alarm(this, 'MillisBehindAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            metric: kinesisMetric,
            threshold: this.PROCESSING_DELAY_THRESHOLD
        });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Kinesis Source Metrics\n'));
        this.Dashboard.addWidgets(
            this.createGraphWidget('Kinesis MillisBehindLatest', kinesisMetric, kinesisAnnotations)
        );
    }

    private addLogging(applicationName: string, logGroupName: string) {
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Logs Insights\n'));

        const applicationArn = `arn:${cdk.Aws.PARTITION}:kinesisanalytics:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:application\/${applicationName}`;

        const distributionOfTasksQuery = [
            'fields @timestamp, message',
            '| filter message like /Deploying/',
            '| parse message " to flink-taskmanager-*" as @tmid',
            '| stats count(*) by @tmid',
            '| sort @timestamp desc',
            `| limit ${this.LOG_QUERY_LIMIT}`
        ].join('\n');
        this.Dashboard.addWidgets(this.createLogWidget(logGroupName, 'Distribution of Tasks', distributionOfTasksQuery));

        const changeInParallelismQuery = [
            'fields @timestamp, @parallelism',
            '| filter message like /property: parallelism.default, /',
            '| parse message "default, *" as @parallelism',
            '| sort @timestamp asc',
            `| limit ${this.LOG_QUERY_LIMIT}`
        ].join('\n');
        this.Dashboard.addWidgets(this.createLogWidget(logGroupName, 'Change in Parallelism', changeInParallelismQuery));

        const accessDeniedQuery = [
            'fields @timestamp, @message, @messageType',
            `| filter applicationARN like /${applicationArn}/`,
            '| filter @message like /AccessDenied/',
            '| sort @timestamp desc',
            `| limit ${this.LOG_QUERY_LIMIT}`
        ].join('\n');
        this.Dashboard.addWidgets(this.createLogWidget(logGroupName, 'Access Denied', accessDeniedQuery));

        const resourceNotFoundQuery = [
            'fields @timestamp, @message',
            `| filter applicationARN like /${applicationArn}/`,
            '| filter @message like /ResourceNotFoundException/',
            '| sort @timestamp desc',
            `| limit ${this.LOG_QUERY_LIMIT}`
        ].join('\n');
        this.Dashboard.addWidgets(this.createLogWidget(logGroupName, 'Source or Sink Not Found', resourceNotFoundQuery));

        const appFailuresQuery = [
            'fields @timestamp, @message',
            `| filter applicationARN like /${applicationArn}/`,
            '| filter @message like /switched from RUNNING to FAILED/',
            '| sort @timestamp desc',
            `| limit ${this.LOG_QUERY_LIMIT}`
        ].join('\n');
        this.Dashboard.addWidgets(this.createLogWidget(logGroupName, 'Application Task-Related Failures', appFailuresQuery));
    }
}

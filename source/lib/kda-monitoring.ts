/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import {aws_cloudwatch as cw} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MonitoringBase } from './monitoring-base';

export interface ApplicationMonitoringProps {
    readonly applicationName: string;
    readonly logGroupName: string;
    readonly inputStreamName?: string;
    readonly kafkaTopicName?: string;
}

export class ApplicationMonitoring extends MonitoringBase {
    // These values are recommended, but can be ajusted depending on the workload.
    private readonly FAILED_CHECKPOINTS_THRESHOLD: number = 0;
    private readonly DOWNTIME_THRESHOLD: number = 0;
    private readonly CPU_UTILIZATION_THRESHOLD: number = 80;
    private readonly HEAP_MEMORY_THRESHOLD: number = 90;
    private readonly GARBAGE_COLLECTION_THRESHOLD: number = 60;
    private readonly PROCESSING_DELAY_THRESHOLD: number = 60000;
    private readonly LOG_QUERY_LIMIT: number = 20;

    private DEFAULT_METRIC_PROPS = {
        namespace: 'AWS/KinesisAnalytics',
        period: this.MONITORING_PERIOD,
        dimensionsMap: { 'Application': '' }
    };

    private DEFAULT_ALARM_PROPS = {
        evaluationPeriods: 1,
        treatMissingData: cw.TreatMissingData.BREACHING,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD
    };

    constructor(scope: Construct, id: string, props: ApplicationMonitoringProps) {
        super(scope, id);

        this.DEFAULT_METRIC_PROPS.dimensionsMap['Application'] = props.applicationName;

        this.addApplicationHealth();
        this.addResourceUtilization();
        this.addApplicationProgress();
        this.addSourceMetrics(props.inputStreamName, props.kafkaTopicName);
        this.addLogging(props.applicationName, props.logGroupName);
    }

    private createLogWidget(logGroupName: string, title: string, queryString: string): cw.LogQueryWidget {
        return new cw.LogQueryWidget({
            logGroupNames: [logGroupName],
            title,
            queryString,
            width: 24
        });
    }

    private createWidgetWithoutUnits(title: string, metric: cw.IMetric): cw.GraphWidget {
        return new cw.GraphWidget({
            title,
            left: [metric],
            leftYAxis: { showUnits: false },
            rightYAxis: { showUnits: false }
        });
    }

    private addApplicationHealth() {
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Application Health\n'));

        //---------------------------------------------------------------------
        const downtimeAlarm = new cw.Alarm(this, 'DowntimeAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            threshold: this.DOWNTIME_THRESHOLD,
            metric: new cw.Metric({
                ...this.DEFAULT_METRIC_PROPS,
                metricName: 'downtime',
                statistic: 'Average'
            })
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
        const checkpointAlarm = new cw.Alarm(this, 'CheckpointAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            threshold: this.FAILED_CHECKPOINTS_THRESHOLD,
            metric: new cw.Metric({
                ...this.DEFAULT_METRIC_PROPS,
                metricName: 'numberOfFailedCheckpoints',
                statistic: 'Average'
            })
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
            this.createAlarmWidget('Downtime', downtimeAlarm),
            this.createWidgetWithoutUnits('Uptime', uptimeMetric),
            this.createWidgetWithoutUnits('Flink Job Restarts', jobRestartsMetric),
            this.createAlarmWidget('Number of Failed Checkpoints', checkpointAlarm),
            this.createWidgetWithoutUnits('Last Checkpoint Duration', checkpointDurationMetric),
            this.createWidgetWithoutUnits('Last Checkpoint Size', checkpointSizeMetric)
        );
    }

    private addResourceUtilization() {
        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Resource Utilization\n'));

        //---------------------------------------------------------------------
        const cpuUtilizationAlarm = new cw.Alarm(this, 'CpuUtilizationAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            threshold: this.CPU_UTILIZATION_THRESHOLD,
            metric: new cw.Metric({
                ...this.DEFAULT_METRIC_PROPS,
                metricName: 'cpuUtilization',
                statistic: 'Maximum'
            })
        })

        //---------------------------------------------------------------------
        const heapMemoryAlarm = new cw.Alarm(this, 'HeapMemoryAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            threshold: this.HEAP_MEMORY_THRESHOLD,
            metric: new cw.Metric({
                ...this.DEFAULT_METRIC_PROPS,
                metricName: 'heapMemoryUtilization',
                statistic: 'Maximum'
            })
        });

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
        const gcPercentAlarm = new cw.Alarm(this, 'GCPercentAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            threshold: this.GARBAGE_COLLECTION_THRESHOLD,
            metric: new cw.MathExpression({
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
            })
        });

        //---------------------------------------------------------------------
        const threadCountMetric = new cw.Metric({
            ...this.DEFAULT_METRIC_PROPS,
            metricName: 'threadsCount',
            statistic: 'Maximum'
        });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(
            this.createAlarmWidget('CPU Utilization', cpuUtilizationAlarm),
            this.createAlarmWidget('Heap Memory Utilization', heapMemoryAlarm),
            this.createWidgetWithoutUnits('Thread Count', threadCountMetric),
            this.createAlarmWidget('Old Generation GC Percent (Over 1 Min)', gcPercentAlarm),
            this.createWidgetWithoutUnits('Old Generation GC Count Rate', gcCountRateExpression)
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
        const recordsOutAlarm = new cw.Alarm(this, 'RecordsOutAlarm', {
            ...this.DEFAULT_ALARM_PROPS,
            metric: new cw.Metric({
                ...this.DEFAULT_METRIC_PROPS,
                metricName: 'numRecordsOutPerSecond',
                statistic: 'Average'
            }),
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
            this.createWidgetWithoutUnits('Incoming Records (Per Second)', incomingRecordsMetric),
            this.createAlarmWidget('Outgoing Records (Per Second)', recordsOutAlarm),
            this.createWidgetWithoutUnits('Input Watermark', inputWatermarkMetric),
            this.createWidgetWithoutUnits('Output Watermark', outputWatermarkMetric),
            this.createWidgetWithoutUnits('Event Time Latency', eventTimeExpression),
            this.createWidgetWithoutUnits('Late Records Dropped', lateRecordsMetric)
        );
    }

    private addSourceMetrics(inputStreamName?: string, kafkaTopicName?: string) {
        if (inputStreamName !== undefined) {
            //---------------------------------------------------------------------
            const kinesisMetric = new cw.Metric({
                ...this.DEFAULT_METRIC_PROPS,
                metricName: 'millisBehindLatest',
                statistic: 'Maximum',
                dimensionsMap: {
                    ...this.DEFAULT_METRIC_PROPS.dimensionsMap,
                    'Id': cdk.Fn.join('_', cdk.Fn.split('-', inputStreamName)),
                    'Flow': 'Input'
                }
            });

            const millisBehindAlarm = new cw.Alarm(this, 'MillisBehindAlarm', {
                ...this.DEFAULT_ALARM_PROPS,
                metric: kinesisMetric,
                threshold: this.PROCESSING_DELAY_THRESHOLD
            });

            //---------------------------------------------------------------------
            this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Kinesis Source Metrics\n'));
            this.Dashboard.addWidgets(this.createAlarmWidget('Kinesis MillisBehindLatest', millisBehindAlarm));
        } else if (kafkaTopicName !== undefined) {
            //---------------------------------------------------------------------
            const kafkaMetric = new cw.Metric({
                ...this.DEFAULT_METRIC_PROPS,
                metricName: 'records_lag_max',
                statistic: 'Maximum',
                dimensionsMap: {
                    ...this.DEFAULT_METRIC_PROPS.dimensionsMap
                }
            });

            //---------------------------------------------------------------------
            this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Kafka Source Metrics\n'));
            this.Dashboard.addWidgets(this.createWidgetWithoutUnits('Kafka RecordsLagMax', kafkaMetric));
        }
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
            '| filter @message like /switched from RUNNING to RESTARTING/',
            '| sort @timestamp desc',
            `| limit ${this.LOG_QUERY_LIMIT}`
        ].join('\n');
        this.Dashboard.addWidgets(this.createLogWidget(logGroupName, 'Application Task-Related Failures', appFailuresQuery));
    }
}

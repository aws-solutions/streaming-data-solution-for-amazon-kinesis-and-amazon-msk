/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {aws_cloudwatch as cw} from 'aws-cdk-lib';

export abstract class MonitoringBase extends Construct {
    protected readonly Dashboard: cw.Dashboard;
    protected readonly MONITORING_PERIOD: cdk.Duration = cdk.Duration.minutes(1);

    // These values are recommended, but can be ajusted depending on the workload.
    private readonly KDS_ITERATOR_AGE_THRESHOLD: number = 60000;
    private readonly KDS_READ_WRITE_PROVISIONED_THRESHOLD: number = 0.01;
    private readonly KDS_PUT_RECORDS_THRESHOLD: number = 0.95;
    private readonly KDS_GET_RECORDS_THRESHOLD: number = 0.98;

    constructor(scope: Construct, id: string) {
        super(scope, id);
        this.Dashboard = new cw.Dashboard(this, 'Dashboard');
    }

    protected createMarkdownWidget(text: string): cw.TextWidget {
        return new cw.TextWidget({ markdown: text, width: 24, height: 1 });
    }

    protected createWidgetWithUnits(title: string, metric: cw.IMetric | cw.IMetric[]): cw.GraphWidget {
        return new cw.GraphWidget({
            title,
            left: Array.isArray(metric) ? metric : [metric]
        });
    }

    protected createAlarmWidget(title: string, alarm: cw.Alarm): cw.AlarmWidget {
        return new cw.AlarmWidget({ title, alarm });
    }

    protected addDataStreamMetrics(streamName?: string) {
        if (streamName === undefined) {
            return;
        }

        const defaultMetricProps = {
            namespace: 'AWS/Kinesis',
            period: this.MONITORING_PERIOD,
            statistic: 'Average',
            dimensionsMap: { 'StreamName': streamName }
        };

        const defaultAlarmProps = {
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.BREACHING,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        };

        this.Dashboard.addWidgets(this.createMarkdownWidget('\n# Kinesis Data Stream Metrics\n'));

        //---------------------------------------------------------------------
        const iteratorAgeAlarm = new cw.Alarm(this, 'IteratorAgeAlarm', {
            ...defaultAlarmProps,
            threshold: this.KDS_ITERATOR_AGE_THRESHOLD,
            metric: new cw.Metric({
                ...defaultMetricProps,
                statistic: 'Maximum',
                metricName: 'GetRecords.IteratorAgeMilliseconds'
            })
        });

        //---------------------------------------------------------------------
        const readProvisionedAlarm = new cw.Alarm(this, 'ReadProvisionedAlarm', {
            ...defaultAlarmProps,
            threshold: this.KDS_READ_WRITE_PROVISIONED_THRESHOLD,
            metric: new cw.Metric({ ...defaultMetricProps, metricName: 'ReadProvisionedThroughputExceeded' })
        });

        //---------------------------------------------------------------------
        const writeProvisionedAlarm = new cw.Alarm(this, 'WriteProvisionedAlarm', {
            ...defaultAlarmProps,
            threshold: this.KDS_READ_WRITE_PROVISIONED_THRESHOLD,
            metric: new cw.Metric({ ...defaultMetricProps, metricName: 'WriteProvisionedThroughputExceeded' })
        });

        //---------------------------------------------------------------------
        const putRecordAlarm = new cw.Alarm(this, 'PutRecordAlarm', {
            ...defaultAlarmProps,
            threshold: this.KDS_PUT_RECORDS_THRESHOLD,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: new cw.Metric({ ...defaultMetricProps, metricName: 'PutRecord.Success' })
        });

        //---------------------------------------------------------------------
        const putRecordsAlarm = new cw.Alarm(this, 'PutRecordsAlarm', {
            ...defaultAlarmProps,
            threshold: this.KDS_PUT_RECORDS_THRESHOLD,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: new cw.Metric({ ...defaultMetricProps, metricName: 'PutRecords.Success' })
        });

        //---------------------------------------------------------------------
        const getRecordsAlarm = new cw.Alarm(this, 'GetRecordsAlarm', {
            ...defaultAlarmProps,
            threshold: this.KDS_GET_RECORDS_THRESHOLD,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            metric: new cw.Metric({ ...defaultMetricProps, metricName: 'GetRecords.Success' })
        });

        //---------------------------------------------------------------------
        this.Dashboard.addWidgets(
            this.createAlarmWidget('Get records iterator age (Milliseconds)', iteratorAgeAlarm),
            this.createAlarmWidget('Read throughput exceeded (Percent)', readProvisionedAlarm),
            this.createAlarmWidget('Write throughput exceeded (Percent)', writeProvisionedAlarm),
            this.createAlarmWidget('Put record success (Percent)', putRecordAlarm),
            this.createAlarmWidget('Put records success (Percent)', putRecordsAlarm),
            this.createAlarmWidget('Get records success (Percent)', getRecordsAlarm)
        );
    }
}

/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import { Construct } from 'constructs';
import {aws_cloudwatch as cw} from 'aws-cdk-lib';
import { MonitoringBase } from './monitoring-base';

export interface DataStreamMonitoringProps {
    readonly streamName: string;
    readonly lambdaFunctionName?: string;
}

export class DataStreamMonitoring extends MonitoringBase {
    constructor(scope: Construct, id: string, props: DataStreamMonitoringProps) {
        super(scope, id);

        this.addDataStreamMetrics(props.streamName);
        this.addLambdaMetrics(props.lambdaFunctionName);
    }

    private createAvailabilityWidget(title: string, leftMetric: cw.IMetric, rightMetric: cw.IMetric): cw.GraphWidget {
        return new cw.GraphWidget({
            title,
            left: [leftMetric],
            right: [rightMetric],
            rightYAxis: { max: 100 }
        });
    }

    private addLambdaMetrics(functionName?: string) {
        if (functionName === undefined) {
            return;
        }

        const defaultMetricProps = {
            namespace: 'AWS/Lambda',
            period: this.MONITORING_PERIOD,
            dimensionsMap: {
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
            this.createWidgetWithUnits('Invocations', invocationsMetric),
            this.createWidgetWithUnits('Duration', durationMetrics),
            this.createAvailabilityWidget('Error count and success rate (%)', errorsMetric, availabilityExpression),
            this.createWidgetWithUnits('Throttles', throttlesMetric),
            this.createWidgetWithUnits('IteratorAge', iteratorAgeMetric),
            this.createWidgetWithUnits('Concurrent executions', executionsMetric),
        );
    }
}

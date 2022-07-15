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

export interface DataStreamMonitoringProps {
    readonly streamName: string;
    readonly lambdaFunctionName?: string;
}

export class DataStreamMonitoring extends MonitoringBase {
    constructor(scope: cdk.Construct, id: string, props: DataStreamMonitoringProps) {
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

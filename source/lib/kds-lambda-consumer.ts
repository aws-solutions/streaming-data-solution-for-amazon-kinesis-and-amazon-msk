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
import * as lambda from '@aws-cdk/aws-lambda';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cw from '@aws-cdk/aws-cloudwatch';

import { KinesisEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';
import { ExecutionRole } from './lambda-role-cloudwatch';

export interface LambdaConsumerProps {
    readonly stream: kinesis.IStream;
    readonly batchSize: number;
    readonly retryAttempts: number;
    readonly parallelizationFactor: number;
    readonly timeout: cdk.Duration;
}

export class LambdaConsumer extends cdk.Construct {
    public readonly Function: lambda.IFunction;

    private MIN_TIMEOUT_SECONDS: number = 1;
    private MAX_TIMEOUT_SECONDS: number = 900;

    constructor(scope: cdk.Construct, id: string, props: LambdaConsumerProps) {
        super(scope, id);

        const timeoutSeconds = props.timeout.toSeconds();
        if (timeoutSeconds < this.MIN_TIMEOUT_SECONDS || timeoutSeconds > this.MAX_TIMEOUT_SECONDS) {
            throw new Error(`timeout must be a value between ${this.MIN_TIMEOUT_SECONDS} and ${this.MAX_TIMEOUT_SECONDS} seconds`);
        }

        const dlq = this.createDeadLetterQueue();
        const executionRole = new ExecutionRole(this, 'Role');

        this.Function = new lambda.Function(this, 'Consumer', {
            runtime: lambda.Runtime.NODEJS_12_X,
            handler: 'index.handler',
            role: executionRole.Role,
            code: lambda.Code.fromAsset('lambda/kds-lambda-consumer'),
            timeout: props.timeout
        });

        this.Function.addEventSource(new KinesisEventSource(props.stream, {
            startingPosition: lambda.StartingPosition.LATEST,
            batchSize: props.batchSize,
            retryAttempts: props.retryAttempts,
            parallelizationFactor: props.parallelizationFactor,
            bisectBatchOnError: true,
            onFailure: new SqsDlq(dlq)
        }));
    }

    private createDeadLetterQueue(): sqs.Queue {
        const dlq = new sqs.Queue(this, 'DLQ', {
            encryption: sqs.QueueEncryption.KMS_MANAGED,
            dataKeyReuse: cdk.Duration.minutes(30)
        });

        new cw.Alarm(this, 'DLQDepthAlarm', {
            metric: new cw.Metric({
                namespace: 'AWS/SQS',
                metricName: 'ApproximateNumberOfMessagesVisible',
                dimensions: { 'QueueName': dlq.queueName },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5)
            }),
            threshold: 1,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING
        });

        return dlq;
    }
}
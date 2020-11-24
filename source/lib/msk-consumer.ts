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
import * as iam from '@aws-cdk/aws-iam';

import { ExecutionRole } from './lambda-role-cloudwatch';

export interface KafkaConsumerProps {
    readonly clusterArn: string;

    readonly batchSize: number;
    readonly startingPosition: lambda.StartingPosition;
    readonly topicName: string;
    readonly enabled: boolean;

    readonly code: lambda.Code;
    readonly timeout: cdk.Duration;
    readonly environmentVariables?: { [key: string]: string };
}

export class KafkaConsumer extends cdk.Construct {
    public readonly Function: lambda.IFunction;
    public readonly EventMapping: lambda.EventSourceMapping;

    private MIN_BATCH_SIZE: number = 1;
    private MAX_BATCH_SIZE: number = 10000;
    private MIN_TIMEOUT_SECONDS: number = 1;

    // According to the Lambda docs (https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html#services-msk-configure):
    // The maximum supported function execution time is 14 minutes
    private MAX_TIMEOUT_SECONDS: number = 840;

    constructor(scope: cdk.Construct, id: string, props: KafkaConsumerProps) {
        super(scope, id);

        if (!cdk.Token.isUnresolved(props.batchSize)) {
            if (props.batchSize < this.MIN_BATCH_SIZE || props.batchSize > this.MAX_BATCH_SIZE) {
                throw new Error(`batchSize must be between ${this.MIN_BATCH_SIZE} and ${this.MAX_BATCH_SIZE} (given ${props.batchSize})`);
            }
        }

        const timeoutSeconds = props.timeout.toSeconds();
        if (timeoutSeconds < this.MIN_TIMEOUT_SECONDS || timeoutSeconds > this.MAX_TIMEOUT_SECONDS) {
            throw new Error(`timeout must be a value between ${this.MIN_TIMEOUT_SECONDS} and ${this.MAX_TIMEOUT_SECONDS} seconds (given ${timeoutSeconds})`);
        }

        const mskPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        'kafka:DescribeCluster',
                        'kafka:GetBootstrapBrokers',
                        'ec2:CreateNetworkInterface',
                        'ec2:DescribeNetworkInterfaces',
                        'ec2:DescribeVpcs',
                        'ec2:DeleteNetworkInterface',
                        'ec2:DescribeSubnets',
                        'ec2:DescribeSecurityGroups'
                    ],
                    resources: ['*']
                })
            ]
        });

        const executionRole = new ExecutionRole(this, 'Role', {
            inlinePolicyName: 'MskPolicy',
            inlinePolicyDocument: mskPolicy
        });

        (executionRole.Role.node.defaultChild as iam.CfnRole).cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W11',
                    reason: 'Actions do not support resource level permissions'
                }]
            }
        };

        this.Function = new lambda.Function(this, 'Consumer', {
            runtime: lambda.Runtime.NODEJS_12_X,
            handler: 'index.handler',
            role: executionRole.Role,
            code: props.code,
            timeout: props.timeout,
            environment: props.environmentVariables
        });

        this.EventMapping = this.Function.addEventSourceMapping('Mapping', {
            eventSourceArn: props.clusterArn,
            startingPosition: props.startingPosition,
            batchSize: props.batchSize,
            kafkaTopic: props.topicName,
            enabled: props.enabled
        });
    }
}

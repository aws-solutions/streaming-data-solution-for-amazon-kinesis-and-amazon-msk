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
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';

import { ExecutionRole } from './lambda-role-cloudwatch';

export interface DataStreamProps {
    readonly shardCount: number;
    readonly retentionPeriod: cdk.Duration;
    readonly enableEnhancedMonitoring: string;
}

export class DataStream extends cdk.Construct {
    public readonly Stream: kinesis.Stream;

    constructor(scope: cdk.Construct, id: string, props: DataStreamProps) {
        super(scope, id);

        if (!cdk.Token.isUnresolved(props.shardCount) && props.shardCount <= 0) {
            throw new Error('shardCount must be a positive number');
        }

        this.Stream = new kinesis.Stream(this, 'DataStream', {
            encryption: kinesis.StreamEncryption.MANAGED,
            shardCount: props.shardCount,
            retentionPeriod: props.retentionPeriod
        });

        this.createCustomResource(props.enableEnhancedMonitoring);
    }

    private createCustomResource(enableEnhancedMonitoring: string) {
        const monitoringPolicy = new iam.PolicyDocument({
            statements: [new iam.PolicyStatement({
                resources: ['*'],
                actions: ['kinesis:EnableEnhancedMonitoring', 'kinesis:DisableEnhancedMonitoring']
            })]
        });

        const customResouceRole = new ExecutionRole(this, 'Role', {
            inlinePolicyName: 'MonitoringPolicy',
            inlinePolicyDocument: monitoringPolicy
        });

        const cfnRole = customResouceRole.Role.node.defaultChild as iam.CfnRole;
        cfnRole.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W11',
                    reason: 'Kinesis enhanced monitoring actions do not support resource level permissions'
                }]
            }
        };

        const customResourceFunction = new lambda.Function(this, 'CustomResource', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'lambda_function.handler',
            role: customResouceRole.Role,
            code: lambda.Code.fromAsset('lambda/kds-enhanced-monitoring'),
            timeout: cdk.Duration.seconds(30)
        });

        new cdk.CustomResource(this, 'EnhancedMonitoring', {
            serviceToken: customResourceFunction.functionArn,
            properties: {
                EnableEnhancedMonitoring: enableEnhancedMonitoring,
                StreamName: this.Stream.streamName
            },
            resourceType: 'Custom::EnhancedMonitoring'
        });
    }
}

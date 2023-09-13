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

import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kinesis as kinesis, aws_lambda as lambda, aws_iam as iam } from 'aws-cdk-lib';

import { ExecutionRole } from './lambda-role-cloudwatch';
import { CfnNagHelper } from './cfn-nag-helper';

export interface DataStreamProps {
    readonly shardCount: number;
    readonly retentionPeriod: cdk.Duration;
    readonly enableEnhancedMonitoring: string;
}

export class DataStream extends Construct {
    public readonly Stream: kinesis.Stream;

    constructor(scope: Construct, id: string, props: DataStreamProps) {
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
        const customResouceRole = new ExecutionRole(this, 'Role', {
            inlinePolicyName: 'MonitoringPolicy',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [new iam.PolicyStatement({
                    resources: ['*'],
                    actions: ['kinesis:EnableEnhancedMonitoring', 'kinesis:DisableEnhancedMonitoring']
                })]
            })
        });

        const cfnRole = customResouceRole.Role.node.defaultChild as iam.CfnRole;
        CfnNagHelper.addSuppressions(cfnRole, {
            Id: 'W11',
            Reason: 'Kinesis enhanced monitoring actions do not support resource level permissions'
        });

        const customResourceFunction = new lambda.Function(this, 'CustomResource', {
            runtime: lambda.Runtime.PYTHON_3_10,
            handler: 'lambda_function.handler',
            role: customResouceRole.Role,
            code: lambda.Code.fromAsset('lambda/kds-enhanced-monitoring'),
            timeout: cdk.Duration.seconds(30)
        });

        new cdk.CustomResource(this, 'EnhancedMonitoring', {
            serviceToken: customResourceFunction.functionArn,
            properties: {
                'EnableEnhancedMonitoring': enableEnhancedMonitoring,
                'StreamName': this.Stream.streamName
            },
            resourceType: 'Custom::EnhancedMonitoring'
        });
    }
}

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
import { aws_lambda as lambda } from 'aws-cdk-lib';

import { ExecutionRole } from './lambda-role-cloudwatch';

export interface SolutionHelperProps {
    readonly solutionId: string;
    readonly pattern: string;

    // KDS metrics
    readonly shardCount?: number;
    readonly retentionHours?: number;
    readonly enhancedMonitoring?: string;

    // KDF metrics
    readonly bufferingSize?: number;
    readonly bufferingInterval?: number;
    readonly compressionFormat?: string;

    // MSK metrics
    readonly numberOfBrokerNodes?: number;
    readonly brokerInstanceType?: string;
    readonly monitoringLevel?: string;
    readonly accessControlMethod?: string;
}

export class SolutionHelper extends Construct {
    constructor(scope: Construct, id: string, props: SolutionHelperProps) {
        super(scope, id);

        const metricsMapping = new cdk.CfnMapping(this, 'AnonymousData', {
            mapping: {
                'SendAnonymousData': {
                    'Data': 'Yes'
                }
            }
        });

        const metricsCondition = new cdk.CfnCondition(this, 'AnonymousDatatoAWS', {
            expression: cdk.Fn.conditionEquals(metricsMapping.findInMap('SendAnonymousData', 'Data'), 'Yes')
        });

        const helperRole = new ExecutionRole(this, 'Role');
        const helperFunction = new lambda.Function(this, 'SolutionHelper', {
            runtime: lambda.Runtime.PYTHON_3_10,
            handler: 'lambda_function.handler',
            description: 'This function generates UUID for each deployment and sends anonymous data to the AWS Solutions team',
            role: helperRole.Role,
            code: lambda.Code.fromAsset('lambda/solution-helper'),
            timeout: cdk.Duration.seconds(30)
        });

        const createIdFunction = new cdk.CustomResource(this, 'CreateUniqueID', {
            serviceToken: helperFunction.functionArn,
            properties: {
                'Resource': 'UUID'
            },
            resourceType: 'Custom::CreateUUID'
        });

        const sendDataFunction = new cdk.CustomResource(this, 'SendAnonymousData', {
            serviceToken: helperFunction.functionArn,
            properties: {
                'Resource': 'AnonymousMetric',
                'UUID': createIdFunction.getAttString('UUID'),

                'Region': cdk.Aws.REGION,
                'SolutionId': props.solutionId,
                'Version': '%%VERSION%%',
                'Pattern': props.pattern,

                'ShardCount': props.shardCount,
                'RetentionHours': props.retentionHours,
                'EnhancedMonitoring': props.enhancedMonitoring,

                'BufferingSize': props.bufferingSize,
                'BufferingInterval': props.bufferingInterval,
                'CompressionFormat': props.compressionFormat,

                'NumberOfBrokerNodes': props.numberOfBrokerNodes,
                'BrokerInstanceType': props.brokerInstanceType,
                'MonitoringLevel': props.monitoringLevel,
                'AccessControlMethod': props.accessControlMethod
            },
            resourceType: 'Custom::AnonymousData'
        });

        (helperFunction.node.defaultChild as lambda.CfnFunction).cfnOptions.condition = metricsCondition;
        (createIdFunction.node.defaultChild as lambda.CfnFunction).cfnOptions.condition = metricsCondition;
        (sendDataFunction.node.defaultChild as lambda.CfnFunction).cfnOptions.condition = metricsCondition;
    }
}

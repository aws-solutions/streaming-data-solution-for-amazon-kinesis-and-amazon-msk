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
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';

import { ExecutionRole } from './lambda-role-cloudwatch';
import { CfnNagHelper } from './cfn-nag-helper';

export interface KafkaMonitoringProps {
    readonly clusterArn: string;
    readonly dashboardName: string;
}

export class KafkaMonitoring extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: KafkaMonitoringProps) {
        super(scope, id);

        const monitoringRole = new ExecutionRole(this, 'Role', {
            inlinePolicyName: 'DashboardPolicy',
            inlinePolicyDocument: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        actions: ['cloudwatch:PutDashboard', 'cloudwatch:DeleteDashboards'],
                        resources: [`arn:${cdk.Aws.PARTITION}:cloudwatch::${cdk.Aws.ACCOUNT_ID}:dashboard/${props.dashboardName}`]
                    }),
                    new iam.PolicyStatement({
                        actions: ['kafka:DescribeCluster'],
                        resources: ['*']
                    })
                ]
            })
        });

        const cfnRole = monitoringRole.Role.node.defaultChild as iam.CfnRole;
        CfnNagHelper.addSuppressions(cfnRole, {
            Id: 'W11',
            Reason: 'DescribeCluster does not support resource level permissions'
        });

        const monitoringFunction = new lambda.Function(this, 'Function', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'lambda_function.handler',
            description: 'This function creates a dashboard that monitors the health of a MSK cluster',
            role: monitoringRole.Role,
            code: lambda.Code.fromAsset('lambda/msk-dashboard'),
            timeout: cdk.Duration.seconds(30)
        });

        new cdk.CustomResource(this, 'DashboardCR', {
            serviceToken: monitoringFunction.functionArn,
            properties: {
                'ClusterArn': props.clusterArn,
                'DashboardName': props.dashboardName,
                'Region': cdk.Aws.REGION
            },
            resourceType: 'Custom::CloudWatchDashboard'
        });
    }
}

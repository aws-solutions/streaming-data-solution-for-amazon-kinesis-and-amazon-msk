/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda as lambda, aws_iam as iam } from 'aws-cdk-lib';

import { ExecutionRole } from './lambda-role-cloudwatch';
import { CfnNagHelper } from './cfn-nag-helper';

export interface KafkaMonitoringProps {
    readonly clusterArn: string;
    readonly dashboardName: string;
}

export class KafkaMonitoring extends Construct {
    constructor(scope: Construct, id: string, props: KafkaMonitoringProps) {
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
            runtime: lambda.Runtime.PYTHON_3_12,
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

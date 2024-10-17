/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { CfnGuardHelper } from './cfn-guard-helper';
import { CfnRole } from 'aws-cdk-lib/aws-iam';

export interface ExecutionRoleProps {
    readonly inlinePolicyName: string;
    readonly inlinePolicyDocument: iam.PolicyDocument;
}

export class ExecutionRole extends Construct {
    public readonly Role: iam.IRole;

    constructor(scope: Construct, id: string, props?: ExecutionRoleProps) {
        super(scope, id);

        const logsPolicy = new iam.PolicyStatement({
            resources: [`arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`],
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents']
        });

        const inlinePolicies = {
            CloudWatchLogsPolicy: new iam.PolicyDocument({
                statements: [logsPolicy]
            })
        };

        if (props !== undefined) {
            (inlinePolicies as any)[props.inlinePolicyName] = props.inlinePolicyDocument;
        }

        this.Role = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            inlinePolicies
        });

        // Add suppressions
        CfnGuardHelper.addSuppressions(this.Role.node.defaultChild as CfnRole, 'IAM_NO_INLINE_POLICY_CHECK');
    }
}
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
import * as iam from '@aws-cdk/aws-iam';

export interface ExecutionRoleProps {
    readonly inlinePolicyName: string;
    readonly inlinePolicyDocument: iam.PolicyDocument;
}

export class ExecutionRole extends cdk.Construct {
    public readonly Role: iam.IRole;

    constructor(scope: cdk.Construct, id: string, props?: ExecutionRoleProps) {
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
    }
}
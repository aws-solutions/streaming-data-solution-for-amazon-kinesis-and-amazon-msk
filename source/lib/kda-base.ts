/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
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
import { aws_kinesisanalytics as analytics, aws_iam as iam, aws_logs as logs, aws_lambda as lambda } from 'aws-cdk-lib';

import { ExecutionRole } from './lambda-role-cloudwatch';

export interface FlinkBaseProps {
    readonly logsRetentionDays: logs.RetentionDays;
    readonly logLevel: string;

    readonly subnetIds?: string[];
    readonly securityGroupIds?: string[];
}

export enum FlinkLogLevels {
    DEBUG = 'DEBUG',
    ERROR = 'ERROR',
    INFO = 'INFO',
    WARN = 'WARN'
}

export enum FlinkMetricLevels {
    APPLICATION = 'APPLICATION',
    OPERATOR = 'OPERATOR',
    PARALLELISM = 'PARALLELISM',
    TASK = 'TASK'
}

export abstract class FlinkBase extends Construct {
    protected readonly Application: analytics.CfnApplicationV2;
    protected readonly LogGroup: logs.LogGroup;
    protected readonly Role: iam.IRole;

    public get ApplicationName(): string {
        return this.Application.ref;
    }

    public get LogGroupName(): string {
        return this.LogGroup.logGroupName;
    }

    public get ApplicationRole(): iam.IRole {
        return this.Role;
    }

    constructor(scope: Construct, id: string, props: FlinkBaseProps) {
        super(scope, id);

        this.LogGroup = new logs.LogGroup(this, 'LogGroup', {
            retention: props.logsRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        const logStream = new logs.LogStream(this, 'LogStream', {
            logGroup: this.LogGroup,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        this.Role = this.createRole(props);
        this.Application = this.createApplication(props);

        this.createCustomResource(props.subnetIds, props.securityGroupIds);
        this.configureLogging(logStream.logStreamName);
    }

    protected abstract createRole(props: FlinkBaseProps): iam.IRole;
    protected abstract createApplication(props: FlinkBaseProps): analytics.CfnApplicationV2;

    private configureLogging(logStreamName: string) {
        const logStreamArn = `arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:${this.LogGroupName}:log-stream:${logStreamName}`;

        new analytics.CfnApplicationCloudWatchLoggingOptionV2(this, 'Logging', {
            applicationName: this.ApplicationName,
            cloudWatchLoggingOption: { logStreamArn }
        });
    }

    private createCustomResource(subnets?: string[], securityGroups?: string[]) {
        const vpcConfigDocument = new iam.PolicyDocument({
            statements: [new iam.PolicyStatement({
                resources: [
                    `arn:${cdk.Aws.PARTITION}:kinesisanalytics:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:application/${this.ApplicationName}`
                ],
                actions: [
                    'kinesisanalytics:AddApplicationVpcConfiguration',
                    'kinesisanalytics:DeleteApplicationVpcConfiguration',
                    'kinesisanalytics:DescribeApplication'
                ]
            })]
        });

        const customResouceRole = new ExecutionRole(this, 'CustomResourceRole', {
            inlinePolicyName: 'VpcConfigPolicy',
            inlinePolicyDocument: vpcConfigDocument
        });

        const customResourceFunction = new lambda.Function(this, 'CustomResource', {
            runtime: lambda.Runtime.PYTHON_3_10,
            handler: 'lambda_function.handler',
            role: customResouceRole.Role,
            code: lambda.Code.fromAsset('lambda/kda-vpc-config'),
            timeout: cdk.Duration.seconds(30)
        });

        new cdk.CustomResource(this, 'VpcConfiguration', {
            serviceToken: customResourceFunction.functionArn,
            properties: {
                ApplicationName: this.ApplicationName,
                SubnetIds: subnets ?? [],
                SecurityGroupIds: securityGroups ?? []
            },
            resourceType: 'Custom::VpcConfiguration'
        });
    }
}

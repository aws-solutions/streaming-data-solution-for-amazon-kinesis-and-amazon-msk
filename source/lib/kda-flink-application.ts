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
import * as analytics from '@aws-cdk/aws-kinesisanalytics';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as lambda from '@aws-cdk/aws-lambda';

import { ExecutionRole } from './lambda-role-cloudwatch';

export interface FlinkApplicationProps {
    readonly environmentProperties: analytics.CfnApplicationV2.PropertyGroupProperty;

    readonly logsRetentionDays: logs.RetentionDays;
    readonly logLevel: string;
    readonly metricsLevel: string;

    readonly codeBucketArn: string;
    readonly codeFileKey: string;

    readonly enableSnapshots: string;
    readonly enableAutoScaling: string;

    readonly subnetIds?: string[];
    readonly securityGroupIds?: string[];
}

export class FlinkApplication extends cdk.Construct {
    private readonly Application: analytics.CfnApplicationV2;
    private readonly LogGroup: logs.LogGroup;
    private readonly Role: iam.IRole;

    public get ApplicationName() {
        return this.Application.ref;
    }

    public get LogGroupName() {
        return this.LogGroup.logGroupName;
    }

    public get ApplicationRole() {
        return this.Role;
    }

    public static get AllowedLogLevels(): string[] {
        return ['DEBUG', 'ERROR', 'INFO', 'WARN'];
    }

    public static get AllowedMetricLevels(): string[] {
        return ['APPLICATION', 'OPERATOR', 'PARALLELISM', 'TASK'];
    }

    constructor(scope: cdk.Construct, id: string, props: FlinkApplicationProps) {
        super(scope, id);

        if (!cdk.Token.isUnresolved(props.logLevel) && !FlinkApplication.AllowedLogLevels.includes(props.logLevel)) {
            throw new Error(`Unknown log level: ${props.logLevel}`);
        }

        if (!cdk.Token.isUnresolved(props.metricsLevel) && !FlinkApplication.AllowedMetricLevels.includes(props.metricsLevel)) {
            throw new Error(`Unknown metrics level: ${props.metricsLevel}`);
        }

        this.LogGroup = new logs.LogGroup(this, 'LogGroup', {
            retention: props.logsRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        const logStream = new logs.LogStream(this, 'LogStream', {
            logGroup: this.LogGroup,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        this.Role = this.createRole(props.codeBucketArn, props.codeFileKey);

        const autoScalingCondition = new cdk.CfnCondition(this, 'EnableAutoScaling', {
            expression: cdk.Fn.conditionEquals(props.enableAutoScaling, 'true')
        });

        const snapshotCondition = new cdk.CfnCondition(this, 'EnableSnapshots', {
            expression: cdk.Fn.conditionEquals(props.enableSnapshots, 'true')
        });

        this.Application = new analytics.CfnApplicationV2(this, 'Application', {
            runtimeEnvironment: 'FLINK-1_8',
            serviceExecutionRole: this.Role.roleArn,
            applicationConfiguration: {
                applicationCodeConfiguration: {
                    codeContent: {
                        s3ContentLocation: {
                            bucketArn: props.codeBucketArn,
                            fileKey: props.codeFileKey
                        }
                    },
                    codeContentType: 'ZIPFILE'
                },
                environmentProperties: {
                    propertyGroups: [props.environmentProperties]
                },
                flinkApplicationConfiguration: {
                    monitoringConfiguration: {
                        configurationType: 'CUSTOM',
                        logLevel: props.logLevel,
                        metricsLevel: props.metricsLevel
                    },
                    parallelismConfiguration: {
                        configurationType: 'CUSTOM',
                        autoScalingEnabled: cdk.Fn.conditionIf(autoScalingCondition.logicalId, true, false)
                    },
                    checkpointConfiguration: {
                        configurationType: 'DEFAULT'
                    }
                },
                applicationSnapshotConfiguration: {
                    snapshotsEnabled: cdk.Fn.conditionIf(snapshotCondition.logicalId, true, false)
                }
            }
        });

        this.configureLogging(logStream.logStreamName);

        this.createCustomResource(props.subnetIds, props.securityGroupIds);
    }

    private createRole(bucketArn: string, fileKey: string): iam.IRole {
        const s3CodePolicy = new iam.PolicyDocument({
            statements: [new iam.PolicyStatement({
                resources: [`${bucketArn}/${fileKey}`],
                actions: ['s3:GetObjectVersion', 's3:GetObject']
            })]
        });

        const logsPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    resources: [`arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:*`],
                    actions: ['logs:DescribeLogGroups']
                }),
                new iam.PolicyStatement({
                    resources: [this.LogGroup.logGroupArn],
                    actions: ['logs:DescribeLogStreams', 'logs:PutLogEvents']
                })
            ]
        });

        const vpcPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    resources: ['*'],
                    actions: [
                        'ec2:CreateNetworkInterface',
                        'ec2:DescribeNetworkInterfaces',
                        'ec2:DescribeVpcs',
                        'ec2:DeleteNetworkInterface',
                        'ec2:DescribeDhcpOptions',
                        'ec2:DescribeSubnets',
                        'ec2:DescribeSecurityGroups'
                    ]
                }),
                new iam.PolicyStatement({
                    resources: [`arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:network-interface/*`],
                    actions: ['ec2:CreateNetworkInterfacePermission']
                })
            ]
        });

        const role = new iam.Role(this, 'AppRole', {
            assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com'),
            inlinePolicies: {
                S3Policy: s3CodePolicy,
                LogsPolicy: logsPolicy,
                VpcPolicy: vpcPolicy
            }
        });

        const cfnRole = role.node.defaultChild as iam.CfnRole;
        cfnRole.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W11',
                    reason: 'EC2 actions in VPC policy do not support resource level permissions'
                }]
            }
        };

        return role;
    }

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
            runtime: lambda.Runtime.PYTHON_3_8,
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

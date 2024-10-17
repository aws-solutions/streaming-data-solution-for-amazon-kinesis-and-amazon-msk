/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kinesisanalytics as analytics, aws_iam as iam } from 'aws-cdk-lib';

import { CfnNagHelper } from './cfn-nag-helper';
import { CfnGuardHelper } from './cfn-guard-helper';
import { FlinkBase, FlinkBaseProps } from './kda-base';

export interface FlinkApplicationProps extends FlinkBaseProps {
    readonly environmentProperties: analytics.CfnApplicationV2.PropertyGroupProperty;
    readonly metricsLevel: string;

    readonly codeBucketArn: string;
    readonly codeFileKey: string;

    readonly enableSnapshots: string;
    readonly enableAutoScaling: string;
}

export class FlinkApplication extends FlinkBase {
    constructor(scope: Construct, id: string, props: FlinkApplicationProps) {
        super(scope, id, props);
        this.addCfnNagSuppressions();
        this.addCfnGuardSuppressions();
    }

    protected createApplication(props: FlinkApplicationProps): analytics.CfnApplicationV2 {
        const autoScalingCondition = new cdk.CfnCondition(this, 'EnableAutoScaling', {
            expression: cdk.Fn.conditionEquals(props.enableAutoScaling, 'true')
        });

        const snapshotCondition = new cdk.CfnCondition(this, 'EnableSnapshots', {
            expression: cdk.Fn.conditionEquals(props.enableSnapshots, 'true')
        });

        return new analytics.CfnApplicationV2(this, 'Application', {
            runtimeEnvironment: 'FLINK-1_15',
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
    }

    protected createRole(props: FlinkApplicationProps): iam.IRole {
        const s3CodePolicy = new iam.PolicyDocument({
            statements: [new iam.PolicyStatement({
                resources: [`${props.codeBucketArn}/${props.codeFileKey}`],
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

        return new iam.Role(this, 'AppRole', {
            assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com'),
            inlinePolicies: {
                S3Policy: s3CodePolicy,
                LogsPolicy: logsPolicy,
                VpcPolicy: vpcPolicy
            }
        });
    }

    private addCfnNagSuppressions() {
        const cfnRole = this.Role.node.defaultChild as iam.CfnRole;
        CfnNagHelper.addSuppressions(cfnRole, {
            Id: 'W11',
            Reason: 'EC2 actions in VPC policy do not support resource level permissions'
        });
    }

    private addCfnGuardSuppressions() {
        const cfnRole = this.Role.node.defaultChild as iam.CfnRole;
        CfnGuardHelper.addSuppressions(cfnRole, ['IAM_NO_INLINE_POLICY_CHECK']);
    }
}

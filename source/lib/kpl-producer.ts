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
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kinesis from '@aws-cdk/aws-kinesis';

export interface KinesisProducerProps {
    readonly vpcId: string;
    readonly subnetId: string;
    readonly imageId: string;

    readonly stream: kinesis.IStream;

    readonly codeBucketName: string;
    readonly codeFileKey: string;
}

export class KinesisProducer extends cdk.Construct {
    private readonly Instance: ec2.CfnInstance;

    public get InstanceId(): string {
        return this.Instance.ref;
    }

    constructor(scope: cdk.Construct, id: string, props: KinesisProducerProps) {
        super(scope, id);

        const s3Path = `${props.codeBucketName}/${props.codeFileKey}`;
        const securityGroup = this.createSecurityGroup(props.vpcId);
        const instanceProfile = this.createInstanceProfile(props.stream, s3Path);

        const userDataCommands = [
            '#!/bin/bash',
            'yum update -y',
            'amazon-linux-extras install java-openjdk11 -y',
            'java -version',
            `aws s3 cp s3://${s3Path} /tmp/producer.zip`,
            'unzip /tmp/producer.zip -d /tmp && rm -f /tmp/producer.zip'
        ];

        this.Instance = new ec2.CfnInstance(this, 'Producer', {
            imageId: props.imageId,
            instanceType: 't3.small',
            subnetId: props.subnetId,
            iamInstanceProfile: instanceProfile.ref,
            securityGroupIds: [securityGroup.attrGroupId],
            userData: cdk.Fn.base64(userDataCommands.join('\n')),
            tags: [{ key: 'Name', value: 'KplInstance' }]
        });
    }

    private createInstanceProfile(stream: kinesis.IStream, s3Path: string): iam.CfnInstanceProfile {
        const role = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });

        const ssmPolicy = new iam.Policy(this, 'SessionManagerPolicy', {
            statements: [new iam.PolicyStatement({
                resources: ['*'],
                actions: [
                    'ssm:UpdateInstanceInformation',
                    'ssmmessages:CreateControlChannel',
                    'ssmmessages:CreateDataChannel',
                    'ssmmessages:OpenControlChannel',
                    'ssmmessages:OpenDataChannel'
                ]
            })]
        });

        this.addW12Suppression(ssmPolicy, 'Session Manager actions do not support resource level permissions');
        ssmPolicy.attachToRole(role);

        const metricPolicy = new iam.Policy(this, 'MonitoringPolicy', {
            statements: [new iam.PolicyStatement({
                resources: ['*'],
                actions: ['cloudwatch:PutMetricData']
            })]
        });

        this.addW12Suppression(metricPolicy, 'PutMetricData action does not support resource level permissions');
        metricPolicy.attachToRole(role);

        stream.grantWrite(role);
        stream.grant(
            role,
            'kinesis:DescribeStream',
            'kinesis:DescribeStreamSummary',
            'kinesis:DescribeStreamConsumer',
            'kinesis:RegisterStreamConsumer',
            'kinesis:SubscribeToShard'
        );

        // The demo applications read data from the aws-bigdata-blog bucket, so
        // we need to include it in the policy resources as well.
        const s3Policy = new iam.Policy(this, 'CodePolicy', {
            statements: [new iam.PolicyStatement({
                resources: [
                    `arn:${cdk.Aws.PARTITION}:s3:::${s3Path}`,
                    `arn:${cdk.Aws.PARTITION}:s3:::aws-bigdata-blog/*`,
                    `arn:${cdk.Aws.PARTITION}:s3:::aws-bigdata-blog`
                ],
                actions: ['s3:GetObjectVersion', 's3:GetObject', 's3:ListBucket']
            })]
        });
        s3Policy.attachToRole(role);

        const cfnRole = role.node.defaultChild as iam.CfnRole;
        return new iam.CfnInstanceProfile(this, 'InstanceProfile', {
            roles: [cfnRole.ref]
        });
    }

    private createSecurityGroup(vpcId: string): ec2.CfnSecurityGroup {
        const securityGroup = new ec2.CfnSecurityGroup(this, 'SecurityGroup', {
            vpcId,
            groupDescription: 'KPL security group',
            securityGroupEgress: [
                {
                    cidrIp: '0.0.0.0/0',
                    fromPort: 80,
                    toPort: 80,
                    ipProtocol: 'tcp',
                    description: 'Allow HTTP outbound traffic'
                },
                {
                    cidrIp: '0.0.0.0/0',
                    fromPort: 443,
                    toPort: 443,
                    ipProtocol: 'tcp',
                    description: 'Allow HTTPS outbound traffic'
                }
            ]
        });

        securityGroup.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W5',
                    reason: 'Outbound access is allowed to connect to Kinesis'
                }]
            }
        };

        return securityGroup;
    }

    private addW12Suppression(policy: iam.Policy, reason: string) {
        const cfnPolicy = policy.node.defaultChild as iam.CfnPolicy;

        cfnPolicy.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W12',
                    reason: reason
                }]
            }
        };
    }
}

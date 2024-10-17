/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2, aws_iam as iam } from 'aws-cdk-lib';

import { CfnNagHelper } from './cfn-nag-helper';
import Constants from './constants';

export interface KafkaClientProps {
    readonly vpcId: string;
    readonly subnetId: string;
    readonly imageId: string;
    readonly instanceType: string;

    readonly kafkaVersion: string;
    readonly clusterName: string;
    readonly clusterSecurityGroupId: string;
}

export class KafkaClient extends Construct {
    private readonly Instance: ec2.CfnInstance;

    public get InstanceId(): string {
        return this.Instance.ref;
    }

    constructor(scope: Construct, id: string, props: KafkaClientProps) {
        super(scope, id);

        const instanceProfile = this.createInstanceProfile(props.clusterName);

        const userDataCommands = [
            '#!/bin/bash',
            'yum update -y',
            'yum install java-11-amazon-corretto-headless python3 -y',

            'mkdir -p /home/kafka && cd /home/kafka',
            `wget https://archive.apache.org/dist/kafka/${props.kafkaVersion}/kafka_2.12-${props.kafkaVersion}.tgz`,
            `tar -xzf kafka_2.12-${props.kafkaVersion}.tgz --strip 1 && rm kafka_2.12-${props.kafkaVersion}.tgz`,

            'wget https://github.com/aws/aws-msk-iam-auth/releases/download/v1.1.1/aws-msk-iam-auth-1.1.1-all.jar',
            'wget https://github.com/aws/aws-msk-iam-auth/releases/download/v1.1.1/aws-msk-iam-auth-1.1.1-all.jar.sha256',
            'IAM_LIB_CHECKSUM=`cat aws-msk-iam-auth-1.1.1-all.jar.sha256`',
            'echo "$IAM_LIB_CHECKSUM aws-msk-iam-auth-1.1.1-all.jar" | sha256sum -c',
            'mv aws-msk-iam-auth-1.1.1-all.jar aws-msk-iam-auth-1.1.1-all.jar.sha256 ./libs',

            `find /usr/lib/jvm/ -name "cacerts" | xargs -I '{}' cp '{}' /tmp/kafka.client.truststore.jks`,

            `touch bin/client-ssl.properties`,
            `echo "security.protocol=SSL" >> bin/client-ssl.properties`,
            `echo "ssl.truststore.location=/tmp/kafka.client.truststore.jks" >> bin/client-ssl.properties`,

            `touch bin/client-sasl.properties`,
            `echo "security.protocol=SASL_SSL" >> bin/client-sasl.properties`,
            `echo "sasl.mechanism=SCRAM-SHA-512" >> bin/client-sasl.properties`,
            `echo "ssl.truststore.location=/tmp/kafka.client.truststore.jks" >> bin/client-sasl.properties`,

            `touch bin/client-iam.properties`,
            `echo "security.protocol=SASL_SSL" >> bin/client-iam.properties`,
            `echo "sasl.mechanism=AWS_MSK_IAM" >> bin/client-iam.properties`,
            `echo "sasl.jaas.config=software.amazon.msk.auth.iam.IAMLoginModule required;" >> bin/client-iam.properties`,
            `echo "sasl.client.callback.handler.class=software.amazon.msk.auth.iam.IAMClientCallbackHandler" >> bin/client-iam.properties`,
        ];

        // Require IMDSv2 for this EC2 instance.
        const launchTemplate = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
            launchTemplateData: {
                metadataOptions: {
                    httpTokens: 'required'
                }
            }
        });

        this.Instance = new ec2.CfnInstance(this, 'Client', {
            blockDeviceMappings: [{
                deviceName: '/dev/xvda',
                ebs: {
                    encrypted: true,
                }
            }],
            imageId: props.imageId,
            instanceType: props.instanceType,
            monitoring: true,
            subnetId: props.subnetId,
            iamInstanceProfile: instanceProfile.ref,
            securityGroupIds: [props.clusterSecurityGroupId],
            userData: cdk.Fn.base64(userDataCommands.join('\n')),
            tags: [{ key: 'Name', value: 'KafkaClient' }],
            launchTemplate: {
                launchTemplateId: launchTemplate.ref,
                version: launchTemplate.attrLatestVersionNumber
            }
        });
    }

    private createInstanceProfile(clusterName: string): iam.CfnInstanceProfile {
        const role = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });

        const ssmPolicy = new iam.Policy(this, 'SessionManagerPolicy', { // NOSONAR: Explicitly listing actions is security standard
            statements: [new iam.PolicyStatement({
                resources: ['*'],
                actions: Constants.SsmManagedActions
            })]
        });

        this.addW12Suppression(ssmPolicy, 'Session Manager actions do not support resource level permissions');
        ssmPolicy.attachToRole(role);

        const mskPolicy = new iam.Policy(this, 'MskPolicy', {
            statements: [
                new iam.PolicyStatement({
                    sid: 'ClusterMetadata',
                    resources: ['*'],
                    actions: ['kafka:DescribeCluster', 'kafka:GetBootstrapBrokers']
                }),

                // For topics and groups, the resources contain "/*/*":
                // - The first one refers to the cluster UUID
                // - The second one refers to the topic / group name
                // Since this is meant to be a generic client, we use "*" so that this instance can create any topics or groups.
                new iam.PolicyStatement({
                    sid: 'ClusterAPIs',
                    resources: [
                        // The cluster ARN in MSK contains an UUID, which is only available after the cluster is created.
                        // Example: arn:${Partition}:kafka:${Region}:${Account}:cluster/${ClusterName}/${UUID}
                        `arn:${cdk.Aws.PARTITION}:kafka:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:cluster/${clusterName}/*`,
                        `arn:${cdk.Aws.PARTITION}:kafka:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:group/${clusterName}/*/*`
                    ],
                    actions: [
                        'kafka-cluster:Connect',
                        'kafka-cluster:DescribeCluster',
                        'kafka-cluster:AlterGroup',
                        'kafka-cluster:DescribeGroup',
                        'kafka-cluster:DeleteGroup'
                    ]
                }),
                new iam.PolicyStatement({
                    sid: 'ProducerAPIs',
                    resources: [
                        `arn:${cdk.Aws.PARTITION}:kafka:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/${clusterName}/*/*`
                    ],
                    actions: ['kafka-cluster:*Topic*', 'kafka-cluster:WriteData']
                }),
                new iam.PolicyStatement({
                    sid: 'ConsumerAPIs',
                    resources: [
                        `arn:${cdk.Aws.PARTITION}:kafka:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/${clusterName}/*/*`
                    ],
                    actions: ['kafka-cluster:*Topic*', 'kafka-cluster:ReadData']
                }),
            ]
        });

        this.addW12Suppression(mskPolicy, 'MSK actions do not support resource level permissions');
        mskPolicy.attachToRole(role);

        const cfnRole = role.node.defaultChild as iam.CfnRole;
        return new iam.CfnInstanceProfile(this, 'InstanceProfile', {
            roles: [cfnRole.ref]
        });
    }

    private addW12Suppression(policy: iam.Policy, reason: string) {
        const cfnPolicy = policy.node.defaultChild as iam.CfnPolicy;

        CfnNagHelper.addSuppressions(cfnPolicy, {
            Id: 'W12',
            Reason: reason
        });
    }
}

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

export interface KafkaClientProps {
    readonly vpcId: string;
    readonly subnetId: string;
    readonly imageId: string;
    readonly instanceType: string;

    readonly kafkaVersion: string;
    readonly clusterSecurityGroupId: string;
}

export class KafkaClient extends cdk.Construct {
    private readonly Instance: ec2.CfnInstance;

    public get InstanceId(): string {
        return this.Instance.ref;
    }

    constructor(scope: cdk.Construct, id: string, props: KafkaClientProps) {
        super(scope, id);

        const instanceProfile = this.createInstanceProfile();

        const userDataCommands = [
            '#!/bin/bash',
            'yum update -y',
            'yum install java-1.8.0 python3 -y',

            'mkdir -p /home/kafka && cd /home/kafka',
            `wget https://archive.apache.org/dist/kafka/${props.kafkaVersion}/kafka_2.12-${props.kafkaVersion}.tgz`,
            `tar -xzf kafka_2.12-${props.kafkaVersion}.tgz --strip 1 && rm kafka_2.12-${props.kafkaVersion}.tgz`,

            `find /usr/lib/jvm/ -name "cacerts" | xargs -I '{}' cp '{}' /tmp/kafka.client.truststore.jks`,
            `touch bin/client.properties`,
            `echo "security.protocol=SSL" >> bin/client.properties`,
            `echo "ssl.truststore.location=/tmp/kafka.client.truststore.jks" >> bin/client.properties`,
        ];

        this.Instance = new ec2.CfnInstance(this, 'Client', {
            imageId: props.imageId,
            instanceType: props.instanceType,
            subnetId: props.subnetId,
            iamInstanceProfile: instanceProfile.ref,
            securityGroupIds: [props.clusterSecurityGroupId],
            userData: cdk.Fn.base64(userDataCommands.join('\n')),
            tags: [{ key: 'Name', value: 'KafkaClient' }],
        })
    }

    private createInstanceProfile(): iam.CfnInstanceProfile {
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

        const mskPolicy = new iam.Policy(this, 'MskPolicy', {
            statements: [new iam.PolicyStatement({
                resources: ['*'],
                actions: ['kafka:DescribeCluster', 'kafka:GetBootstrapBrokers']
            })]
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

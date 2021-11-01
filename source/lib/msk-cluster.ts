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

import * as cdk from '@aws-cdk/core';
import * as msk from '@aws-cdk/aws-msk';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as logs from '@aws-cdk/aws-logs';

export interface KafkaClusterProps {
    readonly kafkaVersion: string;
    readonly numberOfBrokerNodes: number;
    readonly brokerInstanceType: string;
    readonly monitoringLevel: string;
    readonly ebsVolumeSize: number;
    readonly accessControl: string;

    readonly brokerVpcId: string;
    readonly brokerSubnets: string[];
}

export enum KafkaAccessControl {
    Unauthenticated = 'Unauthenticated access',
    IAM = 'IAM role-based authentication',
    SCRAM = 'SASL/SCRAM authentication'
}

export enum KafkaInstanceType {
    m5_large = 'kafka.m5.large',
    m5_xlarge = 'kafka.m5.xlarge',
    m5_2xlarge = 'kafka.m5.2xlarge',
    m5_4xlarge = 'kafka.m5.4xlarge',
    m5_8xlarge = 'kafka.m5.8xlarge',
    m5_12xlarge = 'kafka.m5.12xlarge',
    m5_16xlarge = 'kafka.m5.16xlarge',
    m5_24xlarge = 'kafka.m5.24xlarge',
    t3_small = 'kafka.t3.small'
}

export enum KafkaActiveVersion {
    V2_8_1 = '2.8.1',
    V2_8_0 = '2.8.0',
    V2_7_1 = '2.7.1',
    V2_7_0 = '2.7.0',
    V2_6_2 = '2.6.2',
    V2_6_1 = '2.6.1',
    V2_6_0 = '2.6.0',
    V2_5_1 = '2.5.1',
    V2_4_1_1 = '2.4.1.1',
    V2_3_1 = '2.3.1',
    V2_2_1 = '2.2.1'
}

export enum KafkaMonitoringLevel {
    DEFAULT = 'DEFAULT',
    PER_BROKER = 'PER_BROKER',
    PER_TOPIC_PER_BROKER = 'PER_TOPIC_PER_BROKER',
    PER_TOPIC_PER_PARTITION = 'PER_TOPIC_PER_PARTITION'
}

export class KafkaCluster extends cdk.Construct {
    private readonly Cluster: msk.CfnCluster;
    private readonly SecurityGroup: ec2.CfnSecurityGroup;

    public get ClusterArn(): string {
        return this.Cluster.ref;
    }

    public get ClusterName(): string {
        return cdk.Fn.join('-', ['kafka-cluster', cdk.Aws.ACCOUNT_ID]);
    }

    public get SecurityGroupId(): string {
        return this.SecurityGroup.ref;
    }

    private MIN_SUBNETS: number = 2;
    private MAX_SUBNETS: number = 3;

    public static get MinStorageSizeGiB(): number {
        return 1;
    }

    public static get MaxStorageSizeGiB(): number {
        return 16384;
    }

    public static get RequiredRules() {
        return [
            { port: 2181, description: 'ZooKeeper Plaintext' },
            { port: 2182, description: 'ZooKeeper TLS' },
            { port: 9092, description: 'Bootstrap servers Plaintext' },
            { port: 9094, description: 'Bootstrap servers TLS' },
            { port: 9096, description: 'SASL/SCRAM' },
            { port: 9098, description: 'IAM' },
        ];
    }

    constructor(scope: cdk.Construct, id: string, props: KafkaClusterProps) {
        super(scope, id);

        this.validateProps(props);

        const unauthenticatedCondition = new cdk.CfnCondition(this, 'EnableUnauthenticatedCondition', {
            expression: cdk.Fn.conditionEquals(props.accessControl, KafkaAccessControl.Unauthenticated)
        });

        const iamCondition = new cdk.CfnCondition(this, 'EnableIAMCondition', {
            expression: cdk.Fn.conditionEquals(props.accessControl, KafkaAccessControl.IAM)
        });

        const scramCondition = new cdk.CfnCondition(this, 'EnableSCRAMCondition', {
            expression: cdk.Fn.conditionEquals(props.accessControl, KafkaAccessControl.SCRAM)
        });

        this.SecurityGroup = this.createSecurityGroup(props.brokerVpcId);
        const logGroup = new logs.LogGroup(this, 'LogGroup', { removalPolicy: cdk.RemovalPolicy.RETAIN });

        this.Cluster = new msk.CfnCluster(this, 'KafkaCluster', {
            clusterName: this.ClusterName,
            kafkaVersion: props.kafkaVersion,
            numberOfBrokerNodes: props.numberOfBrokerNodes,
            brokerNodeGroupInfo: {
                brokerAzDistribution: 'DEFAULT',
                instanceType: props.brokerInstanceType,
                clientSubnets: props.brokerSubnets,
                securityGroups: [this.SecurityGroupId],
                storageInfo: {
                    ebsStorageInfo: {
                        volumeSize: props.ebsVolumeSize
                    }
                }
            },
            loggingInfo: {
                brokerLogs: {
                    cloudWatchLogs: {
                        logGroup: logGroup.logGroupName,
                        enabled: true
                    }
                }
            },
            enhancedMonitoring: props.monitoringLevel,
            clientAuthentication: {
                sasl: {
                    iam: {
                        enabled: cdk.Fn.conditionIf(iamCondition.logicalId, true, false)
                    },
                    scram: {
                        enabled: cdk.Fn.conditionIf(scramCondition.logicalId, true, false)
                    }
                },
                unauthenticated: {
                    enabled: cdk.Fn.conditionIf(unauthenticatedCondition.logicalId, true, false)
                }
            },
            encryptionInfo: {
                encryptionAtRest: {
                    dataVolumeKmsKeyId: 'alias/aws/kafka'
                },
                encryptionInTransit: {
                    clientBroker: 'TLS',
                    inCluster: true
                }
            },
            openMonitoring: {
                prometheus: {
                    jmxExporter: { enabledInBroker: true },
                    nodeExporter: { enabledInBroker: true }
                }
            }
        });
    }

    private validateProps(props: KafkaClusterProps) {
        if (!cdk.Token.isUnresolved(props.brokerSubnets)) {
            if (props.brokerSubnets.length < this.MIN_SUBNETS || props.brokerSubnets.length > this.MAX_SUBNETS) {
                throw new Error(`brokerSubnets must contain between ${this.MIN_SUBNETS} and ${this.MAX_SUBNETS} items`);
            }
        }

        if (!cdk.Token.isUnresolved(props.numberOfBrokerNodes) && props.numberOfBrokerNodes <= 0) {
            throw new Error('numberOfBrokerNodes must be a positive number');
        }

        if (!cdk.Token.isUnresolved(props.brokerSubnets) && !cdk.Token.isUnresolved(props.numberOfBrokerNodes)) {
            if (props.numberOfBrokerNodes % props.brokerSubnets.length !== 0) {
                throw new Error('numberOfBrokerNodes must be a multiple of brokerSubnets');
            }
        }

        const volumeSize = props.ebsVolumeSize;
        if (!cdk.Token.isUnresolved(volumeSize) && (volumeSize < KafkaCluster.MinStorageSizeGiB || volumeSize > KafkaCluster.MaxStorageSizeGiB)) {
            throw new Error(`ebsVolumeSize must be a value between ${KafkaCluster.MinStorageSizeGiB} and ${KafkaCluster.MaxStorageSizeGiB} GiB (given ${volumeSize})`);
        }
    }

    private createSecurityGroup(vpcId: string): ec2.CfnSecurityGroup {
        const securityGroup = new ec2.CfnSecurityGroup(this, 'ClusterSG', {
            vpcId: vpcId,
            groupDescription: 'Security group for the MSK cluster',
            tags: [{ key: 'Name', value: 'msk-cluster-sg' }]
        });

        KafkaCluster.RequiredRules.forEach((rule, index) => {
            new ec2.CfnSecurityGroupIngress(this, `IngressRule${index}`, {
                ipProtocol: 'tcp',
                groupId: securityGroup.ref,
                sourceSecurityGroupId: securityGroup.ref,
                fromPort: rule.port,
                toPort: rule.port,
                description: rule.description
            });
        });

        return securityGroup;
    }
}

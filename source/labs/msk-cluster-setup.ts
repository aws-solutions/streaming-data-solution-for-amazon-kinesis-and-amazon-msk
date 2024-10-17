/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { Construct} from 'constructs';
import { aws_ec2 as ec2, aws_msk as msk } from 'aws-cdk-lib';

import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';

export class MskClusterStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        const kafkaVersion = new cdk.CfnParameter(this, 'MSKKafkaVersion', {
            type: 'String',
            default: '2.8.1',
            allowedValues: [
                '2.8.1',
                '2.8.0',
                '2.7.2',
                '2.7.1',
                '2.7.0',
                '2.6.3',
                '2.6.2',
                '2.6.1',
                '2.6.0',
                '2.5.1',
                '2.4.1.1',
                '2.3.1',
                '2.2.1'
            ]
        });

        const tlsMutualAuth = new cdk.CfnParameter(this, 'TLSMutualAuthentication', {
            type: 'String',
            default: 'false',
            allowedValues: ['true', 'false']
        });

        const pcaArn = new cdk.CfnParameter(this, 'PcaArn', {
            type: 'String',
            allowedPattern: 'arn:aws:acm-pca:[us\\-east\\-1|us\\-east\\-2|eu\\-west\\-1]{9}:\\d{12}:certificate-authority\\/[\\da-f]{8}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{12}|^$',
            constraintDescription: 'Not a valid ACM PCA ARN'
        });

        const clientAndVpcStack = new cdk.CfnParameter(this, 'VpcBastionStack', {
            type: 'String'
        });

        //---------------------------------------------------------------------
        // Template metadata
        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Amazon MSK cluster configuration' },
                        Parameters: [
                            clientAndVpcStack.logicalId,
                            kafkaVersion.logicalId,
                            tlsMutualAuth.logicalId,
                            pcaArn.logicalId
                        ]
                    }
                ],
                ParameterLabels: {
                    [clientAndVpcStack.logicalId]: {
                        default: 'Name of the Bastion / Kafka client instance stack'
                    },
                    [kafkaVersion.logicalId]: {
                        default: 'Apache Kafka version on the brokers'
                    },
                    [tlsMutualAuth.logicalId]: {
                        default: 'Whether TLS Mutual Auth should be enabled for the cluster'
                    },
                    [pcaArn.logicalId]: {
                        default: '(Optional) ARN of the ACM Certificate Authority (for TLS Mutual Auth)'
                    }
                }
            }
        };

        // With the CDK approach we took, `BastionStack` and `VPCStack` are the same
        const clientAndVpcStackName = clientAndVpcStack.valueAsString;

        const mtlsCondition = new cdk.CfnCondition(this, 'MTLS', {
            expression: cdk.Fn.conditionEquals(tlsMutualAuth.value, 'true')
        });

        const noMtlsCondition = new cdk.CfnCondition(this, 'noMTLS', {
            expression: cdk.Fn.conditionEquals(tlsMutualAuth.value, 'false')
        });

        //---------------------------------------------------------------------
        // MSK security group
        const kafkaClientSG = cdk.Fn.importValue(`${clientAndVpcStackName}-KafkaClientEC2InstanceSecurityGroupId`);

        const clusterSecurityGroup = new ec2.CfnSecurityGroup(this, 'MSKSecurityGroup', {
            vpcId: cdk.Fn.importValue(`${clientAndVpcStackName}-VPCID`),
            groupDescription: 'MSK Security Group',
            securityGroupIngress: [
                {
                    ipProtocol: 'tcp',
                    fromPort: 2181,
                    toPort: 2181,
                    sourceSecurityGroupId: kafkaClientSG,
                    description: 'ZooKeeper Plaintext'
                },
                {
                    ipProtocol: 'tcp',
                    fromPort: 9092,
                    toPort: 9092,
                    sourceSecurityGroupId: kafkaClientSG,
                    description: 'Bootstrap servers Plaintext'
                },
                {
                    ipProtocol: 'tcp',
                    fromPort: 9094,
                    toPort: 9094,
                    sourceSecurityGroupId: kafkaClientSG,
                    description: 'Bootstrap servers TLS'
                }
            ]
        });

        new ec2.CfnSecurityGroupIngress(this, 'MSKSecurityGroup9092', {
            groupId: clusterSecurityGroup.attrGroupId,
            sourceSecurityGroupId: clusterSecurityGroup.attrGroupId,
            description: 'Enable access to port 9092 inside the MSKSecurityGroup',
            ipProtocol: 'tcp',
            fromPort: 9092,
            toPort: 9092
        });

        new ec2.CfnSecurityGroupIngress(this, 'MSKSecurityGroup9094', {
            groupId: clusterSecurityGroup.attrGroupId,
            sourceSecurityGroupId: clusterSecurityGroup.attrGroupId,
            description: 'Enable access to port 9094 inside the MSKSecurityGroup',
            ipProtocol: 'tcp',
            fromPort: 9094,
            toPort: 9094
        });

        //---------------------------------------------------------------------
        // MSK cluster
        const clusterProps: msk.CfnClusterProps = {
            clusterName: `MSKCluster-${cdk.Aws.STACK_NAME}`,
            enhancedMonitoring: 'DEFAULT',
            kafkaVersion: kafkaVersion.valueAsString,
            numberOfBrokerNodes: 3,
            encryptionInfo: {
                encryptionInTransit: {
                    inCluster: true,
                    clientBroker: 'TLS_PLAINTEXT'
                }
            },
            brokerNodeGroupInfo: {
                clientSubnets: [
                    cdk.Fn.importValue(`${clientAndVpcStackName}-PrivateSubnetMSKOne`),
                    cdk.Fn.importValue(`${clientAndVpcStackName}-PrivateSubnetMSKTwo`),
                    cdk.Fn.importValue(`${clientAndVpcStackName}-PrivateSubnetMSKThree`)
                ],
                instanceType: 'kafka.m5.large',
                securityGroups: [clusterSecurityGroup.attrGroupId],
                storageInfo: {
                    ebsStorageInfo: {
                        volumeSize: 1000
                    }
                }
            }
        };

        const clientAuth: msk.CfnCluster.ClientAuthenticationProperty = {
            tls: {
                certificateAuthorityArnList: [pcaArn.valueAsString]
            }
        }

        const noMtlsCluster = new msk.CfnCluster(this, 'MSKClusterNoMTLS', clusterProps);
        const mtlsCluster = new msk.CfnCluster(this, 'MSKClusterMTLS', {
            ...clusterProps,
            clientAuthentication: clientAuth
        });

        noMtlsCluster.cfnOptions.condition = noMtlsCondition;
        mtlsCluster.cfnOptions.condition = mtlsCondition;

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskClusterStack.name
        });

        //---------------------------------------------------------------------
        // Outputs
        new cdk.CfnOutput(this, 'MSKSecurityGroupID', {
            value: clusterSecurityGroup.attrGroupId,
            description: 'ID of the security group for the MSK cluster'
        });

        new cdk.CfnOutput(this, 'SSHKafkaClientEC2Instance', {
            value: cdk.Fn.importValue(`${clientAndVpcStackName}-SSHKafkaClientEC2Instance`),
            description: 'SSH command for the EC2 instance'
        });

        new cdk.CfnOutput(this, 'KafkaClientEC2InstanceSecurityGroupId', {
            value: cdk.Fn.importValue(`${clientAndVpcStackName}-KafkaClientEC2InstanceSecurityGroupId`),
            description: 'ID of the security group for the EC2 instance'
        });

        new cdk.CfnOutput(this, 'SchemaRegistryUrl', {
            value: cdk.Fn.importValue(`${clientAndVpcStackName}-SchemaRegistryUrl`),
            description: 'Url for the Schema Registry'
        });

        new cdk.CfnOutput(this, 'MSKClusterArn', {
            value: cdk.Fn.conditionIf(mtlsCondition.logicalId, mtlsCluster.ref, noMtlsCluster.ref).toString(),
            description: 'Arn for the MSK cluster',
            exportName: `${cdk.Aws.STACK_NAME}-MSKClusterArn`
        });

        // TODO: Check if this is still required
        new cdk.CfnOutput(this, 'VPCStackName', {
            value: clientAndVpcStackName,
            description: 'The name of the VPC Stack'
        });
    }
}
